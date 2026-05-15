// F2B.AC3: disabled-by-default one-time request credential path. In-memory
// only, redacted from errors/logs, not exposed by the credential_profiles
// MCP tool, and gated behind VESSEL_MCP_ONE_TIME_CREDENTIALS env var.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import {
  createOneTimeCredentialOverlay,
  emptyCredentialStore,
  loadCredentialProfiles,
  ONE_TIME_CREDENTIAL_ENV_GATE,
  readOneTimeCredentialGate,
} from '../dist/config/credentials.js';
import { createFixtureProvider } from '../dist/providers/fixture.js';
import { createProviderRegistry } from '../dist/providers/registry.js';
import { createVesselMcpServer } from '../dist/server/create-server.js';
import { getCredentialProfiles } from '../dist/tools/credential-profiles.js';
import { resolveProvider } from '../dist/tools/vessel-routing.js';
import { createJsonLogger } from '../dist/util/logger.js';
import { redactForLog } from '../dist/util/redact.js';

const ONE_TIME_KEY = 'sk-live-ONE-TIME-F2B-AC3-DO-NOT-LEAK';
const ONE_TIME_BEARER = 'bearer-ONE-TIME-F2B-AC3-DO-NOT-LEAK';
const ONE_TIME_PASSWORD = 'pw-ONE-TIME-F2B-AC3-DO-NOT-LEAK';
const ONE_TIME_SUBSCRIPTION = 'sub-ONE-TIME-F2B-AC3-DO-NOT-LEAK';
const BASE_STORE_SECRET = 'base-store-secret-F2B-AC3-DO-NOT-LEAK';
const ALL_SECRETS = [
  ONE_TIME_KEY,
  ONE_TIME_BEARER,
  ONE_TIME_PASSWORD,
  ONE_TIME_SUBSCRIPTION,
  BASE_STORE_SECRET,
];

function assertNoSecrets(payload, secrets = ALL_SECRETS) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const secret of secrets) {
    assert.ok(!text.includes(secret), `payload must not contain raw secret "${secret}"`);
  }
}

function makeMetadata(id, tier, accessClass, capabilities, landingUrl) {
  return {
    id,
    displayName: id,
    accessClass,
    tier,
    landingUrl,
    signupUrl: landingUrl,
    coverage: 'test',
    capabilities,
    captureEligibility: 'unknown',
  };
}

function makePaidProvider(id, profileFields = ['api_key']) {
  return {
    id,
    capabilities() {
      return ['vessel_position'];
    },
    async status() {
      return {
        id,
        name: id,
        authState: 'missing',
        status: 'available',
        capabilities: ['vessel_position'],
        source: { provider: id, adapterVersion: 'test-1', transport: 'api' },
        retrievedAt: '2026-01-01T00:00:00.000Z',
        caveats: [],
      };
    },
    async dataSources() {
      return [];
    },
    metadata() {
      return makeMetadata(id, 'paid-commercial', 'byok-commercial', ['vessel_position'], `https://${id}.example/`);
    },
    credentialRequirement() {
      return { required: true, mode: 'byok-profile', profileFields };
    },
    rateLimitPolicy() {
      return { requestsPerInterval: 60, intervalMs: 60_000 };
    },
    cacheTtlPolicy() {
      return { defaultTtlMs: 60_000 };
    },
  };
}

function paidRegistry() {
  return createProviderRegistry([createFixtureProvider(), makePaidProvider('marinetraffic')]);
}

async function withInMemoryClient(server, run) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'vessel-traffic-mcp-one-time-test', version: '0.1.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test('readOneTimeCredentialGate: default-off when env var is unset', () => {
  const gate = readOneTimeCredentialGate({});
  assert.equal(gate.enabled, false);
  assert.equal(gate.reason, 'env_not_set');
});

test('readOneTimeCredentialGate: empty string treated as unset (default-off)', () => {
  const gate = readOneTimeCredentialGate({ [ONE_TIME_CREDENTIAL_ENV_GATE]: '' });
  assert.equal(gate.enabled, false);
  assert.equal(gate.reason, 'env_not_set');
});

test('readOneTimeCredentialGate: accepts canonical opt-in tokens', () => {
  for (const value of ['1', 'true', 'on', 'enabled', 'yes', 'TRUE', 'Enabled', '  on  ']) {
    const gate = readOneTimeCredentialGate({ [ONE_TIME_CREDENTIAL_ENV_GATE]: value });
    assert.equal(gate.enabled, true, `value "${value}" should opt in`);
    assert.equal(gate.reason, undefined);
  }
});

test('readOneTimeCredentialGate: rejects non-canonical values with env_value_invalid', () => {
  for (const value of ['0', 'no', 'off', 'disabled', 'maybe', 'sure-thing']) {
    const gate = readOneTimeCredentialGate({ [ONE_TIME_CREDENTIAL_ENV_GATE]: value });
    assert.equal(gate.enabled, false, `value "${value}" must NOT opt in`);
    assert.equal(gate.reason, 'env_value_invalid');
  }
});

test('createOneTimeCredentialOverlay: list() excludes overlay (MCP credential_profiles never sees it)', () => {
  const base = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_PERSISTENT_PROD__PROVIDER: 'marinetraffic',
      VESSEL_MCP_PROFILE_PERSISTENT_PROD__API_KEY: BASE_STORE_SECRET,
    },
    cwd: '/tmp/imaginary',
    readFile: () => undefined,
  });

  const overlay = createOneTimeCredentialOverlay(base, {
    providerId: 'marinetraffic',
    label: 'one-time-request',
    fields: { api_key: ONE_TIME_KEY },
  });

  const labels = overlay.list().map((p) => p.label);
  assert.deepEqual(labels, ['persistent-prod']);
  assert.equal(overlay.list().find((p) => p.label === 'one-time-request'), undefined);
  assertNoSecrets(JSON.stringify(overlay.list()));
});

test('createOneTimeCredentialOverlay: get() returns one-time summary marked source=one-time', () => {
  const overlay = createOneTimeCredentialOverlay(emptyCredentialStore(), {
    providerId: 'marinetraffic',
    label: 'one-time-request',
    fields: { api_key: ONE_TIME_KEY, bearer_token: ONE_TIME_BEARER },
  });

  const summary = overlay.get('one-time-request');
  assert.ok(summary);
  assert.equal(summary.label, 'one-time-request');
  assert.equal(summary.provider, 'marinetraffic');
  assert.equal(summary.source, 'one-time');
  assert.equal(summary.status, 'configured');
  assert.deepEqual([...summary.fieldsPresent], ['api_key', 'bearer_token']);
  // The summary must not carry any field value.
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'fields'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'value'), false);
  assertNoSecrets(summary);
  assertNoSecrets(JSON.stringify(summary));
});

test('createOneTimeCredentialOverlay: resolveSecret returns overlay value when enabled', () => {
  const overlay = createOneTimeCredentialOverlay(emptyCredentialStore(), {
    providerId: 'marinetraffic',
    label: 'one-time-request',
    fields: {
      api_key: ONE_TIME_KEY,
      bearer_token: ONE_TIME_BEARER,
      password: ONE_TIME_PASSWORD,
      subscription_key: ONE_TIME_SUBSCRIPTION,
    },
  });

  assert.equal(overlay.resolveSecret('one-time-request', 'api_key'), ONE_TIME_KEY);
  assert.equal(overlay.resolveSecret('one-time-request', 'bearer_token'), ONE_TIME_BEARER);
  assert.equal(overlay.resolveSecret('one-time-request', 'password'), ONE_TIME_PASSWORD);
  assert.equal(overlay.resolveSecret('one-time-request', 'subscription_key'), ONE_TIME_SUBSCRIPTION);
  // Fields not in the overlay are undefined.
  assert.equal(overlay.resolveSecret('one-time-request', 'username'), undefined);
  assert.equal(overlay.resolveSecret('one-time-request', 'client_id'), undefined);
});

test('createOneTimeCredentialOverlay: non-persistence — overlay does not mutate the base store', () => {
  const base = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_PERSISTENT__PROVIDER: 'spire',
      VESSEL_MCP_PROFILE_PERSISTENT__API_KEY: BASE_STORE_SECRET,
    },
    cwd: '/tmp/imaginary',
    readFile: () => undefined,
  });
  const baseSnapshot = JSON.stringify(base.list());

  const overlay = createOneTimeCredentialOverlay(base, {
    providerId: 'marinetraffic',
    label: 'one-time-request',
    fields: { api_key: ONE_TIME_KEY },
  });

  // Reading through overlay must not change the base store's surface.
  assert.equal(overlay.resolveSecret('one-time-request', 'api_key'), ONE_TIME_KEY);
  assert.equal(overlay.resolveSecret('persistent', 'api_key'), BASE_STORE_SECRET);

  const baseAfter = JSON.stringify(base.list());
  assert.equal(baseAfter, baseSnapshot, 'base store list() must not change');
  // The base store must not have learned the one-time label.
  assert.equal(base.get('one-time-request'), undefined);
  assert.equal(base.resolveSecret('one-time-request', 'api_key'), undefined);
});

test('createOneTimeCredentialOverlay: empty/whitespace field values are dropped (incomplete status)', () => {
  const overlay = createOneTimeCredentialOverlay(emptyCredentialStore(), {
    providerId: 'marinetraffic',
    label: 'one-time-request',
    fields: { api_key: '', bearer_token: '   ' },
  });

  const summary = overlay.get('one-time-request');
  assert.ok(summary);
  assert.equal(summary.status, 'incomplete');
  assert.deepEqual([...summary.fieldsPresent], []);
  assert.equal(overlay.resolveSecret('one-time-request', 'api_key'), undefined);
  assert.equal(overlay.resolveSecret('one-time-request', 'bearer_token'), undefined);
});

test('createOneTimeCredentialOverlay: label normalization matches loadCredentialProfiles', () => {
  // Trim, lowercase, underscores → dashes — same rules as env profiles so
  // operators get one mental model.
  const overlay = createOneTimeCredentialOverlay(emptyCredentialStore(), {
    providerId: 'marinetraffic',
    label: ' One_Time_Request ',
    fields: { api_key: ONE_TIME_KEY },
  });

  const summary = overlay.get('one-time-request');
  assert.ok(summary);
  assert.equal(summary.label, 'one-time-request');
  assert.equal(overlay.resolveSecret('one-time-request', 'api_key'), ONE_TIME_KEY);
  // Lookup with the raw spelling also works.
  assert.equal(overlay.resolveSecret(' One_Time_Request ', 'api_key'), ONE_TIME_KEY);
});

test('createOneTimeCredentialOverlay: secret never appears in JSON serialization of the store', () => {
  const overlay = createOneTimeCredentialOverlay(emptyCredentialStore(), {
    providerId: 'marinetraffic',
    label: 'one-time-request',
    fields: {
      api_key: ONE_TIME_KEY,
      bearer_token: ONE_TIME_BEARER,
      password: ONE_TIME_PASSWORD,
      subscription_key: ONE_TIME_SUBSCRIPTION,
    },
  });
  assertNoSecrets(JSON.stringify(overlay));
  assertNoSecrets(JSON.stringify(overlay.list()));
  assertNoSecrets(JSON.stringify(overlay.get('one-time-request')));
});

test('resolveProvider: refuses oneTimeCredential by default (env gate not set)', () => {
  const registry = paidRegistry();
  const result = resolveProvider({
    registry,
    credentialStore: emptyCredentialStore(),
    capability: 'vessel_position',
    routing: {
      provider: 'marinetraffic',
      oneTimeCredential: {
        providerId: 'marinetraffic',
        label: 'one-time-request',
        fields: { api_key: ONE_TIME_KEY },
      },
      fallbackPolicy: 'strict',
    },
    retrievedAtFallback: '2026-01-01T00:00:00.000Z',
    env: {}, // no VESSEL_MCP_ONE_TIME_CREDENTIALS
  });

  assert.equal(result.ok, false);
  assert.equal(result.noData.reason, 'no_credential_profile');
  assert.match(result.noData.message, /one-time credential/i);
  assert.match(result.noData.message, /VESSEL_MCP_ONE_TIME_CREDENTIALS/);
  // The refusal must not echo the raw key.
  assertNoSecrets(result);
  assertNoSecrets(JSON.stringify(result));
});

test('resolveProvider: refuses oneTimeCredential when env gate is set to a non-canonical value', () => {
  const registry = paidRegistry();
  const result = resolveProvider({
    registry,
    credentialStore: emptyCredentialStore(),
    capability: 'vessel_position',
    routing: {
      provider: 'marinetraffic',
      oneTimeCredential: {
        providerId: 'marinetraffic',
        label: 'one-time-request',
        fields: { api_key: ONE_TIME_KEY },
      },
      fallbackPolicy: 'strict',
    },
    retrievedAtFallback: '2026-01-01T00:00:00.000Z',
    env: { [ONE_TIME_CREDENTIAL_ENV_GATE]: 'no' },
  });

  assert.equal(result.ok, false);
  assert.equal(result.noData.reason, 'no_credential_profile');
  assertNoSecrets(result);
});

test('resolveProvider: opt-in routes via overlay and exposes resolvable secret on success', () => {
  const registry = paidRegistry();
  const result = resolveProvider({
    registry,
    credentialStore: emptyCredentialStore(),
    capability: 'vessel_position',
    routing: {
      provider: 'marinetraffic',
      oneTimeCredential: {
        providerId: 'marinetraffic',
        label: 'one-time-request',
        fields: { api_key: ONE_TIME_KEY },
      },
      fallbackPolicy: 'strict',
    },
    retrievedAtFallback: '2026-01-01T00:00:00.000Z',
    env: { [ONE_TIME_CREDENTIAL_ENV_GATE]: 'enabled' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider.id, 'marinetraffic');
  // The overlay store attached to the success result resolves the secret —
  // this is the only legitimate way for an adapter to read it.
  assert.equal(result.credentialStore.resolveSecret('one-time-request', 'api_key'), ONE_TIME_KEY);
  // The list() output does NOT include the one-time entry.
  assert.equal(result.credentialStore.list().length, 0);
  // The decision/considered fields must not leak the secret.
  assertNoSecrets(result.upgradeHints);
  assertNoSecrets(result.considered);
  assertNoSecrets(JSON.stringify({ upgradeHints: result.upgradeHints, considered: result.considered }));
});

test('resolveProvider: opt-in but missing both label fields and resolved provider — fails with no_credential_profile', () => {
  const registry = paidRegistry();
  const result = resolveProvider({
    registry,
    credentialStore: emptyCredentialStore(),
    capability: 'vessel_position',
    routing: {
      provider: 'marinetraffic',
      oneTimeCredential: {
        providerId: 'marinetraffic',
        label: 'one-time-request',
        fields: { api_key: '' }, // empty → incomplete
      },
      fallbackPolicy: 'strict',
    },
    retrievedAtFallback: '2026-01-01T00:00:00.000Z',
    env: { [ONE_TIME_CREDENTIAL_ENV_GATE]: 'enabled' },
  });

  assert.equal(result.ok, false);
  assert.equal(result.noData.reason, 'no_credential_profile');
});

test('resolveProvider: oneTimeCredential never persists into base store across multiple calls', () => {
  const baseStore = emptyCredentialStore();
  const registry = paidRegistry();
  const args = {
    registry,
    credentialStore: baseStore,
    capability: 'vessel_position',
    routing: {
      provider: 'marinetraffic',
      oneTimeCredential: {
        providerId: 'marinetraffic',
        label: 'one-time-request',
        fields: { api_key: ONE_TIME_KEY },
      },
      fallbackPolicy: 'strict',
    },
    retrievedAtFallback: '2026-01-01T00:00:00.000Z',
    env: { [ONE_TIME_CREDENTIAL_ENV_GATE]: 'enabled' },
  };

  resolveProvider(args);
  resolveProvider(args);

  // After two resolved calls, the base store has learned nothing about the
  // one-time label and exposes no secret material.
  assert.deepEqual(baseStore.list(), []);
  assert.equal(baseStore.get('one-time-request'), undefined);
  assert.equal(baseStore.resolveSecret('one-time-request', 'api_key'), undefined);
});

test('credential_profiles MCP tool never echoes a one-time overlay back to clients', async () => {
  // Build a server whose default loadCredentialProfiles store contains a
  // persistent profile. The MCP tool surface must show only that profile —
  // the one-time path lives entirely outside the surface.
  const base = loadCredentialProfiles({
    env: {
      VESSEL_MCP_PROFILE_PERSISTENT__PROVIDER: 'marinetraffic',
      VESSEL_MCP_PROFILE_PERSISTENT__API_KEY: BASE_STORE_SECRET,
    },
    cwd: '/tmp/imaginary',
    readFile: () => undefined,
  });
  // Build the overlay the same way resolveProvider would, then pass it as
  // the server's credentialStore to simulate the case where the overlay is
  // active during the request lifetime.
  const overlay = createOneTimeCredentialOverlay(base, {
    providerId: 'marinetraffic',
    label: 'one-time-request',
    fields: { api_key: ONE_TIME_KEY, bearer_token: ONE_TIME_BEARER },
  });

  const server = createVesselMcpServer({ credentialStore: overlay });

  await withInMemoryClient(server, async (client) => {
    const result = await client.callTool({ name: 'credential_profiles', arguments: {} });
    assert.notEqual(result.isError, true);

    const text = result.content[0].text;
    const structured = result.structuredContent;
    // The one-time overlay must never appear in the MCP payload.
    assert.equal(structured.profiles.length, 1);
    assert.equal(structured.profiles[0].label, 'persistent');
    assert.ok(!structured.profiles.some((p) => p.label === 'one-time-request'));
    assert.ok(!structured.profiles.some((p) => p.source === 'one-time'));
    assertNoSecrets(text);
    assertNoSecrets(structured);
  });
});

test('getCredentialProfiles helper: source counts ignore one-time entries (they are unlisted)', async () => {
  const overlay = createOneTimeCredentialOverlay(emptyCredentialStore(), {
    providerId: 'marinetraffic',
    label: 'one-time-request',
    fields: { api_key: ONE_TIME_KEY },
  });
  const payload = await getCredentialProfiles(overlay);
  // The overlay has no persistent profiles → counts are all zero.
  assert.equal(payload.summary.total, 0);
  assert.equal(payload.summary.configured, 0);
  assert.equal(payload.summary.fromEnv, 0);
  assert.equal(payload.summary.fromLocalConfig, 0);
  assertNoSecrets(payload);
  assertNoSecrets(JSON.stringify(payload));
});

test('redactForLog: scrubs one-time secrets in error-shaped strings', () => {
  const errorish = [
    `Error: marinetraffic call failed; api_key=${ONE_TIME_KEY}`,
    `Authorization: Bearer ${ONE_TIME_BEARER}`,
    `password=${ONE_TIME_PASSWORD}`,
    `subscription_key=${ONE_TIME_SUBSCRIPTION}`,
  ].join(' | ');
  const redacted = redactForLog(errorish);
  assertNoSecrets(redacted);
  const count = redacted.match(/\[REDACTED\]/g) ?? [];
  assert.ok(count.length >= 4, `expected ≥4 redactions, got: ${redacted}`);
});

test('JSON logger: structured fields carrying one-time secrets are redacted at the field level', () => {
  const lines = [];
  const logger = createJsonLogger({
    sink: (line) => {
      lines.push(line);
    },
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  });

  logger.error('provider_call_failed', {
    providerId: 'marinetraffic',
    api_key: ONE_TIME_KEY,
    bearer_token: ONE_TIME_BEARER,
    password: ONE_TIME_PASSWORD,
    subscription_key: ONE_TIME_SUBSCRIPTION,
    nested: { credential: ONE_TIME_KEY, raw: `Bearer ${ONE_TIME_BEARER}` },
    raw: `api_key=${ONE_TIME_KEY}; password=${ONE_TIME_PASSWORD}`,
  });

  assert.equal(lines.length, 1);
  const [line] = lines;
  assertNoSecrets(line);
  // Non-secret context survives so operators can diagnose the failure.
  assert.match(line, /"providerId":"marinetraffic"/);
  assert.match(line, /\[REDACTED\]/);
});

test('Error message that interpolates a one-time secret is fully scrubbed by redactForLog', () => {
  // Adapters that compose error messages with template strings must rely on
  // redactForLog before the message reaches the logger or the MCP client.
  const naive = new Error(
    `marinetraffic POST /export-vessel failed: api_key=${ONE_TIME_KEY}, bearer_token=${ONE_TIME_BEARER}`,
  );
  const safe = redactForLog(naive.message);
  assertNoSecrets(safe);
  const count = safe.match(/\[REDACTED\]/g) ?? [];
  assert.ok(count.length >= 2, `expected ≥2 redactions, got: ${safe}`);
});

test('resolveProvider: oneTimeCredential routes deterministically across repeated calls', () => {
  const registry = paidRegistry();
  const routing = {
    provider: 'marinetraffic',
    oneTimeCredential: {
      providerId: 'marinetraffic',
      label: 'one-time-request',
      fields: { api_key: ONE_TIME_KEY },
    },
    fallbackPolicy: 'strict',
  };
  const env = { [ONE_TIME_CREDENTIAL_ENV_GATE]: 'enabled' };
  const a = resolveProvider({
    registry,
    credentialStore: emptyCredentialStore(),
    capability: 'vessel_position',
    routing,
    retrievedAtFallback: '2026-01-01T00:00:00.000Z',
    env,
  });
  const b = resolveProvider({
    registry,
    credentialStore: emptyCredentialStore(),
    capability: 'vessel_position',
    routing,
    retrievedAtFallback: '2026-01-01T00:00:00.000Z',
    env,
  });

  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.provider.id, b.provider.id);
  assert.equal(a.upgradeHints.length, b.upgradeHints.length);
  assert.deepEqual(a.considered, b.considered);
});

test('resolveProvider: when overlay is created with a credentialProfile that mismatches providerId, store still resolves overlay secret', () => {
  // Architect contract: oneTimeCredential supplies its own providerId, but a
  // caller may also send credentialProfile pointing at the same label.
  // The overlay must still resolve the secret via the label.
  const registry = paidRegistry();
  const result = resolveProvider({
    registry,
    credentialStore: emptyCredentialStore(),
    capability: 'vessel_position',
    routing: {
      provider: 'marinetraffic',
      credentialProfile: { providerId: 'marinetraffic', label: 'one-time-request' },
      oneTimeCredential: {
        providerId: 'marinetraffic',
        label: 'one-time-request',
        fields: { api_key: ONE_TIME_KEY },
      },
      fallbackPolicy: 'strict',
    },
    retrievedAtFallback: '2026-01-01T00:00:00.000Z',
    env: { [ONE_TIME_CREDENTIAL_ENV_GATE]: 'enabled' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.credentialStore.resolveSecret('one-time-request', 'api_key'), ONE_TIME_KEY);
});

test('credentialProfilesOutputSchema: source enum accepts one-time but list() never emits it', async () => {
  const { credentialProfilesOutputSchema } = await import('../dist/tools/contracts.js');
  const { z } = await import('zod/v4');
  const schema = z.object(credentialProfilesOutputSchema);

  // The schema itself must allow the 'one-time' source value so that any
  // future deliberate emission (e.g. an admin tool) round-trips, but the
  // production credential_profiles MCP tool never emits it.
  const valid = schema.safeParse({
    profiles: [
      {
        label: 'audit-only',
        provider: 'marinetraffic',
        source: 'one-time',
        fieldsPresent: ['api_key'],
        status: 'configured',
      },
    ],
    summary: { total: 1, configured: 1, incomplete: 0, fromEnv: 0, fromLocalConfig: 0 },
    notes: [],
  });
  assert.ok(valid.success, `schema must accept one-time source: ${JSON.stringify(valid.error?.issues ?? [])}`);
});
