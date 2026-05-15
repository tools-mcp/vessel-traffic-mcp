import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import {
  emptyCredentialStore,
  loadCredentialProfiles,
} from '../dist/config/credentials.js';
import { createVesselMcpServer } from '../dist/server/create-server.js';
import { getCredentialProfiles } from '../dist/tools/credential-profiles.js';
import { redactForLog } from '../dist/util/redact.js';

const SECRET_KEY = 'sk-live-CREDENTIAL-PROFILES-AC1-DO-NOT-LEAK';
const SECRET_BEARER = 'bearer-CREDENTIAL-PROFILES-AC1-DO-NOT-LEAK';
const SECRET_PASSWORD = 'pw-CREDENTIAL-PROFILES-AC1-DO-NOT-LEAK';

function assertNoSecrets(payload, secrets = [SECRET_KEY, SECRET_BEARER, SECRET_PASSWORD]) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const secret of secrets) {
    assert.ok(!text.includes(secret), `payload must not contain raw secret "${secret}"`);
  }
}

async function withInMemoryClient(server, run) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'vessel-traffic-mcp-credential-test', version: '0.1.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test('loadCredentialProfiles ignores unknown fields and empty values', () => {
  const store = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__PROVIDER: 'marinetraffic',
      VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__API_KEY: SECRET_KEY,
      VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__FAKE_FIELD: 'ignored',
      VESSEL_MCP_PROFILE_DECLARED_ONLY__PROVIDER: 'aisstream',
      VESSEL_MCP_PROFILE_EMPTY__API_KEY: '',
      OTHER_UNRELATED: 'noise',
    },
    cwd: '/nonexistent',
    readFile: () => undefined,
  });

  const profiles = store.list();
  assert.equal(profiles.length, 2);

  const mt = store.get('marinetraffic-prod');
  assert.ok(mt);
  assert.equal(mt.provider, 'marinetraffic');
  assert.equal(mt.source, 'env');
  assert.deepEqual([...mt.fieldsPresent], ['api_key']);
  assert.equal(mt.status, 'configured');

  const declared = store.get('declared-only');
  assert.ok(declared);
  assert.equal(declared.provider, 'aisstream');
  assert.deepEqual([...declared.fieldsPresent], []);
  assert.equal(declared.status, 'incomplete');

  assertNoSecrets(profiles);
});

test('loadCredentialProfiles reads gitignored local JSON config', () => {
  const localJson = JSON.stringify({
    profiles: [
      {
        label: 'AisStream-Dev',
        provider: 'aisstream',
        fields: { bearer_token: SECRET_BEARER, fake: 'ignored' },
      },
      { label: 'incomplete-entry', provider: 'spire' },
    ],
  });
  const store = loadCredentialProfiles({
    env: {},
    cwd: '/tmp/imaginary',
    readFile: (path) => {
      assert.match(path, /credential-profiles\.local\.json$/);
      return localJson;
    },
  });

  const profiles = store.list();
  assert.equal(profiles.length, 2);

  const dev = store.get('aisstream-dev');
  assert.ok(dev);
  assert.equal(dev.source, 'local-config');
  assert.equal(dev.provider, 'aisstream');
  assert.deepEqual([...dev.fieldsPresent], ['bearer_token']);
  assert.equal(dev.status, 'configured');

  assertNoSecrets(profiles);
});

test('loadCredentialProfiles merges sources with env taking precedence on label collision', () => {
  const localJson = JSON.stringify({
    profiles: [
      {
        label: 'marinetraffic-prod',
        provider: 'marinetraffic-old',
        fields: { api_key: 'STALE-LOCAL-CONFIG-VALUE' },
      },
    ],
  });
  const store = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__PROVIDER: 'marinetraffic',
      VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__API_KEY: SECRET_KEY,
    },
    cwd: '/tmp/imaginary',
    readFile: () => localJson,
  });

  const mt = store.get('marinetraffic-prod');
  assert.ok(mt);
  assert.equal(mt.source, 'env');
  assert.equal(mt.provider, 'marinetraffic');
  assert.equal(store.resolveSecret('marinetraffic-prod', 'api_key'), SECRET_KEY);
});

test('loadCredentialProfiles rejects malformed local JSON with a redacted error', () => {
  assert.throws(
    () =>
      loadCredentialProfiles({
        env: {},
        cwd: '/tmp/imaginary',
        readFile: () => '{not-json',
      }),
    /is not valid JSON/,
  );

  assert.throws(
    () =>
      loadCredentialProfiles({
        env: {},
        cwd: '/tmp/imaginary',
        readFile: () => JSON.stringify({ profiles: 'not-an-array' }),
      }),
    /must be an array/,
  );
});

test('CredentialStore exposes only summaries; raw values are unreachable except by explicit field lookup', () => {
  const store = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_VESSELFINDER_PROD__PROVIDER: 'vesselfinder',
      VESSEL_MCP_PROFILE_VESSELFINDER_PROD__API_KEY: SECRET_KEY,
      VESSEL_MCP_PROFILE_VESSELFINDER_PROD__PASSWORD: SECRET_PASSWORD,
    },
    cwd: '/tmp/imaginary',
    readFile: () => undefined,
  });

  const summary = store.get('vesselfinder-prod');
  assert.ok(summary);
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'fields'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'value'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'values'), false);
  assertNoSecrets(JSON.stringify(store.list()));
  assertNoSecrets(JSON.stringify(summary));

  // The store object itself must not stringify any secret material.
  assertNoSecrets(JSON.stringify(store));

  // Explicit secret resolution is the only way to retrieve raw values.
  assert.equal(store.resolveSecret('vesselfinder-prod', 'api_key'), SECRET_KEY);
  assert.equal(store.resolveSecret('vesselfinder-prod', 'password'), SECRET_PASSWORD);
  assert.equal(store.resolveSecret('vesselfinder-prod', 'bearer_token'), undefined);
  assert.equal(store.resolveSecret('vesselfinder-prod', 'username'), undefined);
});

test('getCredentialProfiles tool returns redacted MCP payload', async () => {
  const store = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__PROVIDER: 'marinetraffic',
      VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__API_KEY: SECRET_KEY,
      VESSEL_MCP_PROFILE_AISSTREAM_DEV__PROVIDER: 'aisstream',
      VESSEL_MCP_PROFILE_AISSTREAM_DEV__BEARER_TOKEN: SECRET_BEARER,
    },
    cwd: '/tmp/imaginary',
    readFile: () => undefined,
  });

  const payload = await getCredentialProfiles(store);
  assert.equal(payload.summary.total, 2);
  assert.equal(payload.summary.configured, 2);
  assert.equal(payload.summary.incomplete, 0);
  assert.equal(payload.summary.fromEnv, 2);
  assert.equal(payload.summary.fromLocalConfig, 0);
  assert.ok(Array.isArray(payload.notes));
  assert.ok(payload.notes.length > 0);
  assertNoSecrets(payload);
  assertNoSecrets(JSON.stringify(payload));
});

test('MCP credential_profiles tool returns labels-only payload via in-memory transport', async () => {
  const store = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__PROVIDER: 'marinetraffic',
      VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__API_KEY: SECRET_KEY,
    },
    cwd: '/tmp/imaginary',
    readFile: () => undefined,
  });
  const server = createVesselMcpServer({ credentialStore: store });

  await withInMemoryClient(server, async (client) => {
    const result = await client.callTool({ name: 'credential_profiles', arguments: {} });
    assert.notEqual(result.isError, true);
    const text = result.content[0].text;
    const structured = result.structuredContent;
    assertNoSecrets(text);
    assertNoSecrets(structured);
    assert.equal(structured.profiles.length, 1);
    const [profile] = structured.profiles;
    assert.equal(profile.label, 'marinetraffic-prod');
    assert.equal(profile.provider, 'marinetraffic');
    assert.equal(profile.source, 'env');
    assert.deepEqual(profile.fieldsPresent, ['api_key']);
    assert.equal(profile.status, 'configured');
  });
});

test('emptyCredentialStore returns no profiles and resolves no secrets', () => {
  const store = emptyCredentialStore();
  assert.deepEqual(store.list(), []);
  assert.equal(store.get('anything'), undefined);
  assert.equal(store.resolveSecret('anything', 'api_key'), undefined);
});

test('redactForLog scrubs VESSEL_MCP_PROFILE_* values from log lines', () => {
  const noisy = `failed to call provider: VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__API_KEY=${SECRET_KEY}`;
  const redacted = redactForLog(noisy);
  assertNoSecrets(redacted);
  assert.match(redacted, /\[REDACTED\]/);
});

test('loadCredentialProfiles emits profiles in deterministic alphabetical order', () => {
  // Insertion order is intentionally not alphabetical to catch any reliance
  // on Map insertion order leaking out to MCP clients.
  const store = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_ZETA__PROVIDER: 'zeta-provider',
      VESSEL_MCP_PROFILE_ZETA__API_KEY: SECRET_KEY,
      VESSEL_MCP_PROFILE_MIKE__PROVIDER: 'mike-provider',
      VESSEL_MCP_PROFILE_MIKE__API_KEY: SECRET_KEY,
      VESSEL_MCP_PROFILE_ALPHA__PROVIDER: 'alpha-provider',
      VESSEL_MCP_PROFILE_ALPHA__API_KEY: SECRET_KEY,
    },
    cwd: '/tmp/imaginary',
    readFile: () => undefined,
  });

  const labels = store.list().map((entry) => entry.label);
  assert.deepEqual(labels, ['alpha', 'mike', 'zeta']);
});

test('fieldsPresent appears in canonical field order regardless of env declaration order', () => {
  const store = loadCredentialProfiles({
    env: {
      // Declared in reverse-of-canonical order to assert the loader sorts
      // to the documented schema order (api_key, username, password, ...).
      VESSEL_MCP_PROFILE_MIXED__SUBSCRIPTION_KEY: SECRET_KEY,
      VESSEL_MCP_PROFILE_MIXED__CLIENT_SECRET: SECRET_KEY,
      VESSEL_MCP_PROFILE_MIXED__CLIENT_ID: 'client-id-only',
      VESSEL_MCP_PROFILE_MIXED__BEARER_TOKEN: SECRET_BEARER,
      VESSEL_MCP_PROFILE_MIXED__PASSWORD: SECRET_PASSWORD,
      VESSEL_MCP_PROFILE_MIXED__USERNAME: 'opname',
      VESSEL_MCP_PROFILE_MIXED__API_KEY: SECRET_KEY,
    },
    cwd: '/tmp/imaginary',
    readFile: () => undefined,
  });

  const entry = store.get('mixed');
  assert.ok(entry);
  assert.deepEqual(
    [...entry.fieldsPresent],
    ['api_key', 'username', 'password', 'bearer_token', 'client_id', 'client_secret', 'subscription_key'],
  );
});

test('local config: missing "profiles" key returns no profiles without error', () => {
  const store = loadCredentialProfiles({
    env: {},
    cwd: '/tmp/imaginary',
    readFile: () => JSON.stringify({ note: 'no profiles field at all' }),
  });
  assert.deepEqual(store.list(), []);
});

test('local config: rejects non-object JSON root', () => {
  assert.throws(
    () =>
      loadCredentialProfiles({
        env: {},
        cwd: '/tmp/imaginary',
        readFile: () => JSON.stringify(['not', 'an', 'object']),
      }),
    /must be a JSON object/,
  );

  assert.throws(
    () =>
      loadCredentialProfiles({
        env: {},
        cwd: '/tmp/imaginary',
        readFile: () => JSON.stringify('a bare string'),
      }),
    /must be a JSON object/,
  );
});

test('local config: non-object profile entries are skipped, valid entries still load', () => {
  const localJson = JSON.stringify({
    profiles: [
      null,
      'not-an-object',
      42,
      { label: '', provider: 'should-be-skipped' },
      { provider: 'no-label-skipped' },
      { label: 'good-entry', provider: 'aisstream', fields: { bearer_token: SECRET_BEARER } },
    ],
  });
  const store = loadCredentialProfiles({
    env: {},
    cwd: '/tmp/imaginary',
    readFile: () => localJson,
  });

  const profiles = store.list();
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].label, 'good-entry');
  assert.deepEqual([...profiles[0].fieldsPresent], ['bearer_token']);
  assertNoSecrets(profiles);
});

test('local config: rejects non-string field values to prevent type-confusion bypass', () => {
  // A non-string value (number, boolean, object) for a known field must be
  // treated as not-set so attackers can't smuggle data through type coercion.
  const localJson = JSON.stringify({
    profiles: [
      {
        label: 'type-confusion',
        provider: 'aisstream',
        fields: {
          api_key: 12345,
          bearer_token: true,
          password: { nested: 'object' },
          username: null,
          client_id: 'legit-string',
        },
      },
    ],
  });
  const store = loadCredentialProfiles({
    env: {},
    cwd: '/tmp/imaginary',
    readFile: () => localJson,
  });

  const entry = store.get('type-confusion');
  assert.ok(entry);
  // Only the genuine string field is accepted.
  assert.deepEqual([...entry.fieldsPresent], ['client_id']);
  // resolveSecret must not return non-string values for any of the coerced fields.
  assert.equal(store.resolveSecret('type-confusion', 'api_key'), undefined);
  assert.equal(store.resolveSecret('type-confusion', 'bearer_token'), undefined);
  assert.equal(store.resolveSecret('type-confusion', 'password'), undefined);
  assert.equal(store.resolveSecret('type-confusion', 'username'), undefined);
  assert.equal(store.resolveSecret('type-confusion', 'client_id'), 'legit-string');
});

test('env-collision: local-config secret is not reachable via resolveSecret once env overrides label', () => {
  const localJson = JSON.stringify({
    profiles: [
      {
        label: 'collision',
        provider: 'old-provider',
        fields: { api_key: 'STALE-LOCAL-VALUE-MUST-NOT-LEAK', password: 'STALE-LOCAL-PW' },
      },
    ],
  });
  const store = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_COLLISION__PROVIDER: 'new-provider',
      VESSEL_MCP_PROFILE_COLLISION__API_KEY: SECRET_KEY,
    },
    cwd: '/tmp/imaginary',
    readFile: () => localJson,
  });

  // env wins entirely — local-config fields are not silently merged in.
  const entry = store.get('collision');
  assert.ok(entry);
  assert.equal(entry.source, 'env');
  assert.equal(entry.provider, 'new-provider');
  assert.deepEqual([...entry.fieldsPresent], ['api_key']);

  // The stale local-config password must NOT be reachable via resolveSecret —
  // env replaces the profile entirely, it does not merge fields.
  assert.equal(store.resolveSecret('collision', 'api_key'), SECRET_KEY);
  assert.equal(store.resolveSecret('collision', 'password'), undefined);

  // And nothing about the stale local-config values can be serialized out.
  assertNoSecrets(JSON.stringify(store.list()), ['STALE-LOCAL-VALUE-MUST-NOT-LEAK', 'STALE-LOCAL-PW']);
});

test('credential_profiles MCP payload validates against the registered output schema', async () => {
  // Re-load the zod schema and assert the produced payload passes it. This
  // guards against contract drift between the loader, the tool, and the
  // public MCP output schema.
  const { credentialProfilesOutputSchema } = await import('../dist/tools/contracts.js');
  const { z } = await import('zod/v4');
  const schema = z.object(credentialProfilesOutputSchema);

  const store = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_VALIDATED__PROVIDER: 'aisstream',
      VESSEL_MCP_PROFILE_VALIDATED__BEARER_TOKEN: SECRET_BEARER,
    },
    cwd: '/tmp/imaginary',
    readFile: () => undefined,
  });

  const payload = await getCredentialProfiles(store);
  const parsed = schema.safeParse(payload);
  assert.ok(parsed.success, `payload should match schema: ${JSON.stringify(parsed.error?.issues ?? [])}`);
  assertNoSecrets(JSON.stringify(parsed.data));
});

test('default credential store is loaded from process.env when none is injected', async () => {
  // Verify the default branch (no credentialStore option) reads from
  // process.env, which is what the HTTP transport relies on.
  const labelEnv = 'VESSEL_MCP_PROFILE_DEFAULT_ENV_PROBE__PROVIDER';
  const keyEnv = 'VESSEL_MCP_PROFILE_DEFAULT_ENV_PROBE__API_KEY';
  const prevLabel = process.env[labelEnv];
  const prevKey = process.env[keyEnv];
  process.env[labelEnv] = 'probe-provider';
  process.env[keyEnv] = SECRET_KEY;
  try {
    const server = createVesselMcpServer();
    await withInMemoryClient(server, async (client) => {
      const result = await client.callTool({ name: 'credential_profiles', arguments: {} });
      const text = result.content[0].text;
      const structured = result.structuredContent;
      assertNoSecrets(text);
      assertNoSecrets(structured);
      const probe = structured.profiles.find((p) => p.label === 'default-env-probe');
      assert.ok(probe, 'expected default-env-probe profile to be discovered from process.env');
      assert.equal(probe.provider, 'probe-provider');
      assert.equal(probe.source, 'env');
      assert.deepEqual(probe.fieldsPresent, ['api_key']);
      assert.equal(probe.status, 'configured');
    });
  } finally {
    if (prevLabel === undefined) delete process.env[labelEnv];
    else process.env[labelEnv] = prevLabel;
    if (prevKey === undefined) delete process.env[keyEnv];
    else process.env[keyEnv] = prevKey;
  }
});

test('redactForLog scrubs multiple BYOK env fragments on one log line', () => {
  const noisy = [
    `VESSEL_MCP_PROFILE_MARINETRAFFIC_PROD__API_KEY=${SECRET_KEY}`,
    `VESSEL_MCP_PROFILE_AISSTREAM_DEV__BEARER_TOKEN=${SECRET_BEARER}`,
    `VESSEL_MCP_PROFILE_VESSELFINDER__PASSWORD=${SECRET_PASSWORD}`,
  ].join(' ');
  const redacted = redactForLog(noisy);
  assertNoSecrets(redacted);
  const redactedCount = redacted.match(/\[REDACTED\]/g) ?? [];
  assert.ok(redactedCount.length >= 3, `expected each fragment redacted, got: ${redacted}`);
});
