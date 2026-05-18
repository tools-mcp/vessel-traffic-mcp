import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadCredentialProfiles } from '../dist/config/credentials.js';
import {
  BYOK_PROVIDERS_ENV,
  PUBLIC_PROVIDERS_ENV,
  createRuntimeProviderRegistry,
} from '../dist/providers/runtime-registry.js';

function credentialStore(env = {}) {
  return loadCredentialProfiles({
    env,
    cwd: '/nonexistent',
    readFile: () => undefined,
  });
}

test('runtime registry enables every implemented credentialed provider through BYOK=all', () => {
  const registry = createRuntimeProviderRegistry(
    { [BYOK_PROVIDERS_ENV]: 'all' },
    credentialStore(),
  );

  assert.deepEqual(registry.providers().map((provider) => provider.id), [
    'marinetraffic',
    'vesselfinder',
    'aisstream',
    'aishub',
    'barentswatch',
    'fixture',
  ]);
});

test('runtime registry enables implemented credentialed providers by explicit id', () => {
  const registry = createRuntimeProviderRegistry(
    { [BYOK_PROVIDERS_ENV]: 'vesselfinder aisstream aishub barentswatch' },
    credentialStore(),
  );

  assert.deepEqual(registry.providers().map((provider) => provider.id), [
    'vesselfinder',
    'aisstream',
    'aishub',
    'barentswatch',
    'fixture',
  ]);
});

test('runtime registry auto-enables implemented credentialed providers with default profiles', () => {
  const registry = createRuntimeProviderRegistry(
    {},
    credentialStore({
      VESSEL_MCP_PROFILE_VESSELFINDER__API_KEY: 'vf-test-key',
      VESSEL_MCP_PROFILE_AISSTREAM__API_KEY: 'aisstream-test-key',
      VESSEL_MCP_PROFILE_AISHUB__USERNAME: 'aishub-test-user',
      VESSEL_MCP_PROFILE_BARENTSWATCH__CLIENT_ID: 'barentswatch-client',
      VESSEL_MCP_PROFILE_BARENTSWATCH__CLIENT_SECRET: 'barentswatch-secret',
    }),
  );

  assert.deepEqual(registry.providers().map((provider) => provider.id), [
    'vesselfinder',
    'aisstream',
    'aishub',
    'barentswatch',
    'fixture',
  ]);
});

test('runtime registry still keeps public providers opt-in and separate from BYOK providers', () => {
  const registry = createRuntimeProviderRegistry(
    {
      [PUBLIC_PROVIDERS_ENV]: 'all',
      [BYOK_PROVIDERS_ENV]: 'marinetraffic',
    },
    credentialStore(),
  );

  assert.deepEqual(registry.providers().map((provider) => provider.id), [
    'myshiptracking',
    'shipfinder',
    'tradlinx-schedule',
    'marinetraffic',
    'fixture',
  ]);
});
