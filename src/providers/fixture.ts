import type {
  CacheTtlPolicy,
  CredentialRequirement,
  DataSource,
  ProviderCapability,
  ProviderMetadata,
  ProviderStatus,
  RateLimitPolicy,
  SourceMetadata,
  VesselDataProvider,
} from './types.js';

const adapterVersion = 'fixture-0.1.0';
const fixtureRetrievedAt = '2026-01-01T00:00:00.000Z';

const capabilities: ProviderCapability[] = [
  'provider_status',
  'data_sources',
  'vessel_search',
  'vessel_position',
  'vessel_area',
  'vessel_track',
  'port_calls',
];

function fixtureSource(): SourceMetadata {
  return {
    provider: 'fixture',
    adapterVersion,
    transport: 'fixture',
    coverage: 'Deterministic sanitized fixture data for local development and tests; not live AIS coverage.',
    confidence: 'high',
    termsNote: 'Local fixture only. Do not use as safety-critical navigation data.',
  };
}

export class FixtureProvider implements VesselDataProvider {
  readonly id = 'fixture';

  capabilities(): ProviderCapability[] {
    return [...capabilities];
  }

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      name: 'Fixture Provider',
      authState: 'not_required',
      status: 'available',
      capabilities: this.capabilities(),
      source: fixtureSource(),
      retrievedAt: fixtureRetrievedAt,
      quota: {
        state: 'not_applicable',
        note: 'Fixture provider does not call live or paid services.',
      },
      caveats: [
        'Static fixture data only.',
        'No live AIS coverage, no account access, and no provider-side quota.',
        'Not for safety-critical navigation.',
      ],
    };
  }

  async dataSources(): Promise<DataSource[]> {
    return [
      {
        id: this.id,
        name: 'Fixture Provider',
        transport: 'fixture',
        capabilities: this.capabilities(),
        coverage: 'Local deterministic sample data for tool and transport verification.',
        auth: {
          required: false,
          mode: 'none',
        },
        caveats: [
          'Used by default tests and MCP smoke checks.',
          'Does not represent real-time vessel traffic.',
          'Not for safety-critical navigation.',
        ],
        source: fixtureSource(),
      },
    ];
  }

  metadata(): ProviderMetadata {
    return {
      id: this.id,
      displayName: 'Fixture Provider',
      accessClass: 'fixture',
      tier: 'fixture',
      coverage: 'Local deterministic fixture data only.',
      capabilities: this.capabilities(),
      captureEligibility: 'allowed',
      notes: 'Default provider for deterministic tests and MCP smoke checks.',
    };
  }

  credentialRequirement(): CredentialRequirement {
    return {
      required: false,
      mode: 'none',
      profileFields: [],
      notes: 'Fixture provider does not require credentials.',
    };
  }

  rateLimitPolicy(): RateLimitPolicy {
    return {
      requestsPerInterval: Number.MAX_SAFE_INTEGER,
      intervalMs: 1_000,
      scope: 'per-instance',
      notes: 'Fixture provider is local and not rate-limited; policy retained for routing parity.',
    };
  }

  cacheTtlPolicy(): CacheTtlPolicy {
    return {
      defaultTtlMs: 60_000,
      scope: 'per-instance',
      notes: 'Fixture data is static; cache TTL is informational only.',
    };
  }
}

export function createFixtureProvider(): FixtureProvider {
  return new FixtureProvider();
}
