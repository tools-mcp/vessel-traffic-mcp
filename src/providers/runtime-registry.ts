import type { CredentialStore } from '../config/credentials.js';
import { AISHUB_DEFAULT_LABEL, createAishubProvider } from './aishub.js';
import { AISSTREAM_DEFAULT_LABEL, createAisStreamProvider } from './aisstream.js';
import { BARENTSWATCH_DEFAULT_LABEL, createBarentsWatchProvider } from './barentswatch.js';
import { createFixtureProvider } from './fixture.js';
import { createMarineTrafficProvider, MARINETRAFFIC_DEFAULT_LABEL } from './marinetraffic.js';
import { createMyShipTrackingProvider } from './myshiptracking.js';
import { createProviderRegistry, type ProviderRegistry } from './registry.js';
import { createShipFinderProvider } from './shipfinder.js';
import { createTradlinxScheduleProvider } from './tradlinx.js';
import type { VesselDataProvider } from './types.js';
import { VESSELFINDER_DEFAULT_LABEL, createVesselFinderProvider } from './vesselfinder.js';

export const PUBLIC_PROVIDERS_ENV = 'VESSEL_MCP_ENABLE_PUBLIC_PROVIDERS';
export const BYOK_PROVIDERS_ENV = 'VESSEL_MCP_ENABLE_BYOK_PROVIDERS';

const publicProviderFactories = {
  myshiptracking: createMyShipTrackingProvider,
  shipfinder: createShipFinderProvider,
  'tradlinx-schedule': createTradlinxScheduleProvider,
} as const;

type PublicProviderId = keyof typeof publicProviderFactories;

const credentialedProviderFactories = {
  marinetraffic: createMarineTrafficProvider,
  vesselfinder: createVesselFinderProvider,
  aisstream: createAisStreamProvider,
  aishub: createAishubProvider,
  barentswatch: createBarentsWatchProvider,
} as const;

const credentialedProviderDefaultLabels = {
  marinetraffic: MARINETRAFFIC_DEFAULT_LABEL,
  vesselfinder: VESSELFINDER_DEFAULT_LABEL,
  aisstream: AISSTREAM_DEFAULT_LABEL,
  aishub: AISHUB_DEFAULT_LABEL,
  barentswatch: BARENTSWATCH_DEFAULT_LABEL,
} as const;

type CredentialedProviderId = keyof typeof credentialedProviderFactories;

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
    if (token === 'tradlinx') {
      enabled.add('tradlinx-schedule');
      continue;
    }
    if (token in publicProviderFactories) {
      enabled.add(token as PublicProviderId);
    }
  }
  return enabled;
}

function parseCredentialedProviderIds(value: string | undefined): Set<CredentialedProviderId> {
  const enabled = new Set<CredentialedProviderId>();
  if (!value) return enabled;

  const tokens = value
    .split(/[,\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.some((token) => token === '1' || token === 'true' || token === 'all')) {
    for (const id of Object.keys(credentialedProviderFactories) as CredentialedProviderId[]) {
      enabled.add(id);
    }
    return enabled;
  }

  for (const token of tokens) {
    if (token in credentialedProviderFactories) {
      enabled.add(token as CredentialedProviderId);
    }
  }
  return enabled;
}

function hasConfiguredDefaultProfile(
  credentialStore: CredentialStore | undefined,
  providerId: CredentialedProviderId,
): boolean {
  return credentialStore?.get(credentialedProviderDefaultLabels[providerId])?.status === 'configured';
}

export function createRuntimeProviderRegistry(
  env: NodeJS.ProcessEnv = process.env,
  credentialStore?: CredentialStore,
): ProviderRegistry {
  const enabledPublic = parsePublicProviderIds(env[PUBLIC_PROVIDERS_ENV]);
  const enabledCredentialed = parseCredentialedProviderIds(env[BYOK_PROVIDERS_ENV]);
  for (const id of Object.keys(credentialedProviderFactories) as CredentialedProviderId[]) {
    if (hasConfiguredDefaultProfile(credentialStore, id)) enabledCredentialed.add(id);
  }
  if (enabledPublic.size === 0 && enabledCredentialed.size === 0) return createProviderRegistry();

  const providers: VesselDataProvider[] = [];
  for (const id of Object.keys(publicProviderFactories) as PublicProviderId[]) {
    if (enabledPublic.has(id)) providers.push(publicProviderFactories[id]());
  }
  if (credentialStore) {
    for (const id of Object.keys(credentialedProviderFactories) as CredentialedProviderId[]) {
      if (enabledCredentialed.has(id)) {
        providers.push(credentialedProviderFactories[id]({ credentialStore }));
      }
    }
  }
  providers.push(createFixtureProvider());
  return createProviderRegistry(providers);
}
