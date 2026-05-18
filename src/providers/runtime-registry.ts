import { createFixtureProvider } from './fixture.js';
import { createMyShipTrackingProvider } from './myshiptracking.js';
import { createProviderRegistry, type ProviderRegistry } from './registry.js';
import { createShipFinderProvider } from './shipfinder.js';
import type { VesselDataProvider } from './types.js';

export const PUBLIC_PROVIDERS_ENV = 'VESSEL_MCP_ENABLE_PUBLIC_PROVIDERS';

const publicProviderFactories = {
  myshiptracking: createMyShipTrackingProvider,
  shipfinder: createShipFinderProvider,
} as const;

type PublicProviderId = keyof typeof publicProviderFactories;

function parsePublicProviderIds(value: string | undefined): Set<PublicProviderId> {
  const enabled = new Set<PublicProviderId>();
  if (!value) return enabled;

  const tokens = value
    .split(/[,\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.some((token) => token === '1' || token === 'true' || token === 'all')) {
    for (const id of Object.keys(publicProviderFactories) as PublicProviderId[]) {
      enabled.add(id);
    }
    return enabled;
  }

  for (const token of tokens) {
    if (token in publicProviderFactories) {
      enabled.add(token as PublicProviderId);
    }
  }
  return enabled;
}

export function createRuntimeProviderRegistry(env: NodeJS.ProcessEnv = process.env): ProviderRegistry {
  const enabled = parsePublicProviderIds(env[PUBLIC_PROVIDERS_ENV]);
  if (enabled.size === 0) return createProviderRegistry();

  const providers: VesselDataProvider[] = [];
  for (const id of Object.keys(publicProviderFactories) as PublicProviderId[]) {
    if (enabled.has(id)) providers.push(publicProviderFactories[id]());
  }
  providers.push(createFixtureProvider());
  return createProviderRegistry(providers);
}
