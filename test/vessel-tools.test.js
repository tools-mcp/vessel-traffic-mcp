import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { emptyCredentialStore } from '../dist/config/credentials.js';
import { createFixtureProvider } from '../dist/providers/fixture.js';
import { createProviderRegistry } from '../dist/providers/registry.js';
import { createVesselMcpServer } from '../dist/server/create-server.js';
import { extractDocumentSignals } from '../dist/tools/document-vessel-lookup.js';
import { normalizeVesselName } from '../dist/tools/vessel-name-resolve.js';

const F3_TOOL_NAMES = Object.freeze([
  'document_vessel_lookup',
  'port_calls',
  'vessel_area',
  'vessel_name_resolve',
  'vessel_position',
  'vessel_search',
  'vessel_track',
]);

async function withClient(run) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const registry = createProviderRegistry([createFixtureProvider()]);
  const server = createVesselMcpServer({
    registry,
    credentialStore: emptyCredentialStore(),
  });
  const client = new Client({ name: 'vessel-tools-test', version: '0.1.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

function parseStructured(result) {
  assert.notEqual(result.isError, true, `tool result must not be marked isError: ${JSON.stringify(result)}`);
  assert.ok(result.structuredContent, 'tool result must include structuredContent');
  const text = JSON.parse(result.content[0].text);
  assert.deepEqual(text, result.structuredContent, 'text payload must mirror structuredContent');
  return result.structuredContent;
}

async function assertRejected(client, params, pattern) {
  const result = await client.callTool(params);
  assert.equal(result.isError, true, `expected isError=true for ${params.name}: ${JSON.stringify(result)}`);
  const errorText = (result.content ?? []).map((c) => c.text ?? '').join('\n');
  assert.match(errorText, pattern, `error text did not match expected pattern for ${params.name}`);
}

test('F3.AC1 registers all seven read-only vessel tools with empty required arrays', async () => {
  await withClient(async (client) => {
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    for (const expected of F3_TOOL_NAMES) {
      assert.ok(names.includes(expected), `expected tool ${expected} to be registered`);
      const tool = tools.tools.find((t) => t.name === expected);
      assert.equal(tool.annotations.readOnlyHint, true, `${expected} must be readOnly`);
      assert.equal(tool.annotations.destructiveHint, false, `${expected} must be non-destructive`);
      assert.equal(tool.inputSchema.type, 'object', `${expected} inputSchema must be an object`);
      assert.deepEqual(tool.inputSchema.required ?? [], [], `${expected} top-level required must be empty`);
    }
  });
});

test('vessel_search returns fixture matches when fallbackPolicy=allow-fixture', async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: 'vessel_search',
      arguments: { name: 'EVER', fallbackPolicy: 'allow-fixture' },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.matches.length, 1);
    assert.equal(payload.data.matches[0].mmsi, '477806100');
    assert.equal(payload.source.provider, 'fixture');
  });
});

test('vessel_search rejects empty input via runtime validation', async () => {
  await withClient(async (client) => {
    await assertRejected(
      client,
      { name: 'vessel_search', arguments: { fallbackPolicy: 'allow-fixture' } },
      /Invalid arguments|at least one of/i,
    );
  });
});

test('vessel_position returns fixture position with freshness metadata', async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: 'vessel_position',
      arguments: { mmsi: '477806100', fallbackPolicy: 'allow-fixture' },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.lat, 30.5852);
    assert.equal(payload.data.lon, 32.2654);
    assert.equal(payload.data.identity.mmsi, '477806100');
    assert.equal(payload.data.observedAt, '2025-12-31T23:00:00.000Z');
    assert.equal(payload.source.provider, 'fixture');
    assert.equal(payload.freshnessSeconds, 3600);
  });
});

test('vessel_position rejects when neither mmsi nor imo provided', async () => {
  await withClient(async (client) => {
    await assertRejected(
      client,
      { name: 'vessel_position', arguments: { fallbackPolicy: 'allow-fixture' } },
      /Invalid arguments|at least one of/i,
    );
  });
});

test('vessel_area returns positions inside a bounding box', async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: 'vessel_area',
      arguments: {
        boundingBox: { latMin: 1, latMax: 2, lonMin: 103, lonMax: 104 },
        fallbackPolicy: 'allow-fixture',
      },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.total, 1);
    assert.equal(payload.data.positions[0].identity.mmsi, '538009132');
  });
});

test('vessel_area rejects missing boundingBox via runtime validation', async () => {
  await withClient(async (client) => {
    await assertRejected(
      client,
      { name: 'vessel_area', arguments: { fallbackPolicy: 'allow-fixture' } },
      /Invalid arguments|boundingBox/i,
    );
  });
});

test('vessel_area rejects inverted latitude range via runtime validation', async () => {
  await withClient(async (client) => {
    await assertRejected(
      client,
      {
        name: 'vessel_area',
        arguments: {
          boundingBox: { latMin: 50, latMax: 30, lonMin: 0, lonMax: 10 },
          fallbackPolicy: 'allow-fixture',
        },
      },
      /Invalid arguments|latMin/i,
    );
  });
});

test('vessel_track returns deterministic chronological points within window', async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: 'vessel_track',
      arguments: {
        mmsi: '477806100',
        windowStart: '2025-12-31T21:30:00.000Z',
        windowEnd: '2025-12-31T23:30:00.000Z',
        fallbackPolicy: 'allow-fixture',
      },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.pointCount, 2);
    for (let i = 1; i < payload.data.points.length; i += 1) {
      assert.ok(
        Date.parse(payload.data.points[i].observedAt) >= Date.parse(payload.data.points[i - 1].observedAt),
        'track points must be chronologically non-decreasing',
      );
    }
  });
});

test('vessel_track rejects when windowStart > windowEnd', async () => {
  await withClient(async (client) => {
    await assertRejected(
      client,
      {
        name: 'vessel_track',
        arguments: {
          mmsi: '477806100',
          windowStart: '2026-01-02T00:00:00.000Z',
          windowEnd: '2026-01-01T00:00:00.000Z',
          fallbackPolicy: 'allow-fixture',
        },
      },
      /Invalid arguments|windowStart|windowEnd/i,
    );
  });
});

test('port_calls returns deterministic events by MMSI', async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: 'port_calls',
      arguments: { mmsi: '636019999', fallbackPolicy: 'allow-fixture' },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.calls.length, 1);
    assert.equal(payload.data.calls[0].port.unlocode, 'NLRTM');
    assert.equal(payload.data.calls[0].event, 'arrival');
  });
});

test('port_calls rejects when all of mmsi/imo/portUnlocode are missing', async () => {
  await withClient(async (client) => {
    await assertRejected(
      client,
      { name: 'port_calls', arguments: { fallbackPolicy: 'allow-fixture' } },
      /Invalid arguments|at least one of/i,
    );
  });
});

test('port_calls rejects malformed portUnlocode', async () => {
  await withClient(async (client) => {
    await assertRejected(
      client,
      {
        name: 'port_calls',
        arguments: { portUnlocode: 'nope1', fallbackPolicy: 'allow-fixture' },
      },
      /Invalid arguments|UN\/LOCODE|portUnlocode/i,
    );
  });
});

test('vessel_name_resolve normalizes name and returns ranked candidates against fixture data', async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: 'vessel_name_resolve',
      arguments: { name: '  ever given  ', fallbackPolicy: 'allow-fixture' },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.normalizedName, 'EVER GIVEN');
    assert.equal(payload.data.candidates.length, 1);
    const top = payload.data.candidates[0];
    assert.equal(top.identity.mmsi, '477806100');
    assert.ok(top.matchedSignals.includes('name_exact'));
    assert.equal(top.confidence, 'high');
    assert.equal(top.needsConfirmation, false);
  });
});

test('vessel_name_resolve rejects empty name', async () => {
  await withClient(async (client) => {
    await assertRejected(
      client,
      { name: 'vessel_name_resolve', arguments: { fallbackPolicy: 'allow-fixture' } },
      /Invalid arguments|name/i,
    );
  });
});

test('document_vessel_lookup extracts B/L signals and resolves against fixture provider', async () => {
  await withClient(async (client) => {
    const text = [
      'BILL OF LADING',
      'VESSEL: EVER GIVEN  Voyage: 042E',
      'IMO: 9839272',
      'POL: EGPSD  POD: NLRTM',
      'CONTAINER: MSCU1234567',
      'ETD 2025-12-31',
    ].join('\n');
    const result = await client.callTool({
      name: 'document_vessel_lookup',
      arguments: { text, fallbackPolicy: 'allow-fixture' },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, true);
    assert.equal(payload.signals.vesselName, 'EVER GIVEN');
    assert.equal(payload.signals.imo, '9839272');
    assert.equal(payload.signals.voyageNumber, '042E');
    assert.ok(payload.signals.ports.includes('EGPSD'), `expected ports to include EGPSD, got ${payload.signals.ports.join(',')}`);
    assert.ok(payload.signals.ports.includes('NLRTM'));
    assert.deepEqual(payload.signals.containerNumbers, ['MSCU1234567']);
    assert.ok(payload.data.candidates.some((c) => c.identity.mmsi === '477806100'));
  });
});

test('document_vessel_lookup rejects empty text', async () => {
  await withClient(async (client) => {
    await assertRejected(
      client,
      { name: 'document_vessel_lookup', arguments: { fallbackPolicy: 'allow-fixture' } },
      /Invalid arguments|text/i,
    );
  });
});

test('document_vessel_lookup returns identifier_not_found when no vessel signals are extractable', async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: 'document_vessel_lookup',
      arguments: { text: 'merely some commercial-invoice prose without ship identifiers.', fallbackPolicy: 'allow-fixture' },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, false);
    assert.equal(payload.reason, 'identifier_not_found');
    assert.ok(Array.isArray(payload.signals.ports));
  });
});

test('fixture tools surface no_provider_for_capability under default (terrestrial-only) fallback policy', async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: 'vessel_search',
      arguments: { name: 'EVER GIVEN' },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, false);
    assert.equal(payload.reason, 'no_provider_for_capability');
  });
});

test('normalizeVesselName strips noise and uppercases', () => {
  assert.equal(normalizeVesselName('  ever given!! '), 'EVER GIVEN');
  assert.equal(normalizeVesselName('MSC OSCAR-IV/A'), 'MSC OSCAR-IV/A');
});

test('extractDocumentSignals parses canonical B/L fields', () => {
  const signals = extractDocumentSignals(
    'VESSEL: PACIFIC CARRIER\nIMO: 9778888\nMMSI: 538009132\nVOY 0815\nPOL SGSIN POD NLRTM\nCONTAINER ABCD1234567\nETD 2026-01-02',
  );
  assert.equal(signals.vesselName, 'PACIFIC CARRIER');
  assert.equal(signals.imo, '9778888');
  assert.equal(signals.mmsi, '538009132');
  assert.equal(signals.voyageNumber, '0815');
  assert.ok(signals.ports.includes('SGSIN'));
  assert.ok(signals.ports.includes('NLRTM'));
  assert.deepEqual(signals.containerNumbers, ['ABCD1234567']);
  assert.ok(signals.dates.includes('2026-01-02'));
});

test('credential_profile routing rejects unknown profile labels without leaking', async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: 'vessel_search',
      arguments: {
        name: 'EVER GIVEN',
        fallbackPolicy: 'allow-fixture',
        credentialProfile: { providerId: 'fixture', label: 'no-such-profile' },
      },
    });
    const payload = parseStructured(result);
    assert.equal(payload.ok, false);
    assert.equal(payload.reason, 'no_credential_profile');
    const serialized = JSON.stringify(payload);
    assert.doesNotMatch(serialized, /api[_-]?key|bearer|password|secret/i);
  });
});
