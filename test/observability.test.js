import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';

import {
  buildProviderStatusDiagnosticsEntry,
  createMcpHttpHandler,
} from '../dist/server/transports/http.js';
import { createProviderRegistry } from '../dist/providers/registry.js';
import {
  createJsonLogger,
  isSensitiveKey,
  redactStructured,
} from '../dist/util/logger.js';

const SECRET_KEY = 'sk-live-OBSERVABILITY-AC1-DO-NOT-LEAK';
const SECRET_BEARER = 'bearer-OBSERVABILITY-AC1-DO-NOT-LEAK';
const SECRET_COOKIE = 'session=OBSERVABILITY-AC1-DO-NOT-LEAK';
const SECRET_BODY = 'OBSERVABILITY-AC1-RAW-PROVIDER-RESPONSE';

function assertNoSecrets(payload, secrets = [SECRET_KEY, SECRET_BEARER, SECRET_COOKIE, SECRET_BODY]) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const secret of secrets) {
    assert.ok(!text.includes(secret), `payload must not contain raw secret "${secret}"`);
  }
}

test('isSensitiveKey flags credential-like field names', () => {
  for (const key of [
    'authorization',
    'Authorization',
    'cookie',
    'Set-Cookie',
    'api_key',
    'apiKey',
    'API-KEY',
    'bearer',
    'bearerToken',
    'token',
    'access_token',
    'refreshToken',
    'password',
    'pass',
    'secret',
    'client_secret',
    'session_id',
    'session',
    'subscription_key',
    'x-api-key',
    'credential',
  ]) {
    assert.equal(isSensitiveKey(key), true, `expected "${key}" to be flagged`);
  }
  for (const key of ['provider', 'host', 'port', 'requestId', 'transport', 'mmsi', 'imo']) {
    assert.equal(isSensitiveKey(key), false, `expected "${key}" to be safe`);
  }
});

test('redactStructured removes nested credential fields and inline header secrets', () => {
  const input = {
    requestId: 'rid-1',
    headers: {
      Authorization: `Bearer ${SECRET_BEARER}`,
      Cookie: SECRET_COOKIE,
      'X-Api-Key': SECRET_KEY,
      'content-type': 'application/json',
    },
    body: {
      api_key: SECRET_KEY,
      password: 'p@ss',
      nested: {
        bearer_token: SECRET_BEARER,
        provider: 'marinetraffic',
      },
      providers: [
        { id: 'mt', token: 'inner-token-do-not-leak' },
        { id: 'fixture', status: 'available' },
      ],
    },
    rawString: `Authorization: Bearer ${SECRET_BEARER} api_key=${SECRET_KEY}`,
  };

  const output = redactStructured(input);

  assertNoSecrets(output);
  assert.equal(output.requestId, 'rid-1');
  assert.equal(output.headers.Authorization, '[REDACTED]');
  assert.equal(output.headers.Cookie, '[REDACTED]');
  assert.equal(output.headers['X-Api-Key'], '[REDACTED]');
  assert.equal(output.headers['content-type'], 'application/json');
  assert.equal(output.body.api_key, '[REDACTED]');
  assert.equal(output.body.password, '[REDACTED]');
  assert.equal(output.body.nested.bearer_token, '[REDACTED]');
  assert.equal(output.body.nested.provider, 'marinetraffic');
  assert.equal(output.body.providers[0].token, '[REDACTED]');
  assert.equal(output.body.providers[1].status, 'available');
  assert.match(output.rawString, /Authorization: Bearer \[REDACTED\]/i);
  assert.match(output.rawString, /api_key=\[REDACTED\]/i);
});

test('redactStructured handles arrays, primitives, null, and circular-safe depth', () => {
  assert.equal(redactStructured(null), null);
  assert.equal(redactStructured(undefined), undefined);
  assert.equal(redactStructured(42), 42);
  assert.equal(redactStructured(true), true);
  assert.deepEqual(redactStructured([1, 2, { token: 'x' }]), [1, 2, { token: '[REDACTED]' }]);

  let deep = { token: 'leaf' };
  for (let i = 0; i < 30; i += 1) {
    deep = { child: deep };
  }
  const out = redactStructured(deep);
  let cursor = out;
  let depth = 0;
  while (cursor && typeof cursor === 'object' && 'child' in cursor) {
    cursor = cursor.child;
    depth += 1;
  }
  assert.ok(depth >= 1, 'walk should descend at least one level');
});

test('createJsonLogger emits redacted JSON lines with timestamp/level/event', () => {
  const lines = [];
  const fixedTs = new Date('2026-05-15T00:00:00.000Z');
  const logger = createJsonLogger({
    sink: (line) => lines.push(line),
    now: () => fixedTs,
  });

  logger.info('test_event', {
    requestId: 'req-123',
    headers: { Authorization: `Bearer ${SECRET_BEARER}` },
    detail: `payload api_key=${SECRET_KEY}`,
  });

  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.ts, '2026-05-15T00:00:00.000Z');
  assert.equal(parsed.level, 'info');
  assert.equal(parsed.event, 'test_event');
  assert.equal(parsed.requestId, 'req-123');
  assert.equal(parsed.headers.Authorization, '[REDACTED]');
  assert.match(parsed.detail, /api_key=\[REDACTED\]/);
  assertNoSecrets(parsed);
});

test('createJsonLogger withBase merges base fields into every entry', () => {
  const lines = [];
  const logger = createJsonLogger({
    sink: (line) => lines.push(line),
    baseFields: { transport: 'streamable-http' },
  });
  const child = logger.withBase({ component: 'http' });
  child.warn('event_one', { detail: 'x' });

  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.transport, 'streamable-http');
  assert.equal(parsed.component, 'http');
  assert.equal(parsed.detail, 'x');
});

test('createJsonLogger redact:false bypasses redaction (for tests only)', () => {
  const lines = [];
  const logger = createJsonLogger({
    sink: (line) => lines.push(line),
    redact: false,
  });
  logger.info('raw_event', { token: 'plain-text' });
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.token, 'plain-text');
});

test('buildProviderStatusDiagnosticsEntry summarizes registry without raw provider responses', async () => {
  const registry = createProviderRegistry();
  const entry = await buildProviderStatusDiagnosticsEntry(registry);

  assert.equal(entry.event, 'provider_status_diagnostics');
  assert.equal(entry.transport, 'streamable-http');
  assert.equal(entry.level, 'info');
  assert.equal(entry.providerCount, 1);
  assert.equal(entry.summary.total, 1);
  assert.equal(entry.summary.available, 1);
  assert.equal(entry.summary.fixtureBacked, 1);
  assert.equal(entry.summary.liveCapable, 0);

  assert.equal(entry.providers.length, 1);
  const provider = entry.providers[0];
  assert.equal(provider.id, 'fixture');
  assert.equal(provider.status, 'available');
  assert.equal(provider.authState, 'not_required');
  assert.equal(provider.sourceTransport, 'fixture');
  assert.equal(provider.fixtureBacked, true);
  assert.equal(typeof provider.capabilityCount, 'number');
  assert.ok(provider.capabilityCount > 0);

  const allowedKeys = new Set([
    'id',
    'status',
    'authState',
    'capabilityCount',
    'sourceTransport',
    'fixtureBacked',
  ]);
  for (const key of Object.keys(provider)) {
    assert.ok(allowedKeys.has(key), `provider diagnostics key "${key}" is not on allow-list`);
  }

  assertNoSecrets(JSON.stringify(entry), [SECRET_KEY, SECRET_BEARER, SECRET_COOKIE, SECRET_BODY]);
});

test('buildProviderStatusDiagnosticsEntry skips status() calls for live-capable providers', async () => {
  let liveStatusCalls = 0;
  const liveProvider = {
    id: 'spire-live',
    capabilities: () => ['vessel_position'],
    metadata: () => ({
      id: 'spire-live',
      displayName: 'Live Stub',
      accessClass: 'byok-commercial',
      tier: 'paid-commercial',
      coverage: 'live',
      capabilities: ['vessel_position'],
      captureEligibility: 'unknown',
    }),
    async status() {
      liveStatusCalls += 1;
      return {
        id: 'spire-live',
        name: 'Spire Live',
        authState: 'configured',
        status: 'available',
        capabilities: ['vessel_position'],
        source: { provider: 'spire', adapterVersion: '1', transport: 'api' },
        retrievedAt: '2026-01-01T00:00:00.000Z',
        caveats: [],
      };
    },
    async dataSources() {
      return [];
    },
  };
  const registry = createProviderRegistry([liveProvider]);
  const entry = await buildProviderStatusDiagnosticsEntry(registry);

  assert.equal(liveStatusCalls, 0, 'live provider status() must not be called during startup diagnostics');
  assert.equal(entry.providerCount, 1);
  assert.equal(entry.summary.fixtureBacked, 0);
  assert.equal(entry.summary.liveCapable, 1);
  assert.equal(entry.level, 'warn', 'liveCapable providers should escalate diagnostics to warn');
  assert.equal(entry.providers[0].status, 'unknown');
  assert.equal(entry.providers[0].fixtureBacked, false);
  assert.equal(entry.providers[0].sourceTransport, 'unknown');
});

test('HTTP request logger emits a single redacted entry with a request id', async () => {
  const logs = [];
  const handler = createMcpHttpHandler({
    host: '127.0.0.1',
    port: 0,
    authToken: SECRET_BEARER,
    logger: (entry) => logs.push(entry),
  });
  try {
    const response = await handler.handle(
      new Request('http://vessel-mcp.test/mcp', {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${SECRET_BEARER}`,
          Cookie: SECRET_COOKIE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );
    assert.equal(response.status, 400);
    assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/i);
  } finally {
    await handler.close();
  }

  assert.equal(logs.length, 1, 'only the http_request entry should be emitted for a normal 400 response');
  const entry = logs[0];
  assert.equal(entry.event, 'http_request');
  assert.match(entry.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(entry.method, 'POST');
  assert.equal(entry.path, '/mcp');
  assert.equal(entry.authRequired, true);
  assert.equal(entry.transport, 'streamable-http');
  assert.equal(typeof entry.durationMs, 'number');
  assertNoSecrets(entry);
  assert.doesNotMatch(JSON.stringify(entry), /authorization|bearer/i);
  assert.doesNotMatch(JSON.stringify(entry), new RegExp(SECRET_BEARER));
  assert.doesNotMatch(JSON.stringify(entry), new RegExp(SECRET_COOKIE));
});

test('stdio binary stays silent on stderr by default', { timeout: 5000 }, async () => {
  const projectRoot = new URL('..', import.meta.url).pathname;
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, VESSEL_MCP_TRANSPORT: 'stdio' },
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  await new Promise((resolve) => setTimeout(resolve, 350));
  child.kill('SIGTERM');
  await once(child, 'exit');

  assert.equal(stderr.trim(), '', `stdio transport must remain silent; got: ${stderr}`);
});
