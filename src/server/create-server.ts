import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { loadCredentialProfiles, type CredentialStore } from '../config/credentials.js';
import { createProviderRegistry, type ProviderRegistry } from '../providers/registry.js';
import {
  credentialProfilesOutputSchema,
  dataSourcesOutputSchema,
  providerStatusOutputSchema,
} from '../tools/contracts.js';
import { getCredentialProfiles } from '../tools/credential-profiles.js';
import { getDataSources } from '../tools/data-sources.js';
import { getProviderStatus } from '../tools/provider-status.js';

const serverVersion = '0.1.0';

function jsonToolResult(structuredContent: Record<string, unknown>) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(structuredContent, null, 2),
      },
    ],
    structuredContent,
  };
}

export interface CreateVesselMcpServerOptions {
  registry?: ProviderRegistry;
  credentialStore?: CredentialStore;
}

export function createVesselMcpServer(options: CreateVesselMcpServerOptions = {}): McpServer {
  const registry = options.registry ?? createProviderRegistry();
  const credentialStore = options.credentialStore ?? loadCredentialProfiles();
  const server = new McpServer({
    name: 'vessel-traffic-mcp',
    version: serverVersion,
  });

  server.registerTool(
    'provider_status',
    {
      title: 'Provider Status',
      description: 'List configured vessel data providers, auth state, feature support, quota hints, and caveats.',
      outputSchema: providerStatusOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => jsonToolResult(await getProviderStatus(registry)),
  );

  server.registerTool(
    'data_sources',
    {
      title: 'Data Sources',
      description: 'List available vessel data source adapters, coverage notes, auth mode, and caveats.',
      outputSchema: dataSourcesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => jsonToolResult(await getDataSources(registry)),
  );

  server.registerTool(
    'credential_profiles',
    {
      title: 'Credential Profiles',
      description:
        'List BYOK credential profile labels, provider hints, declared field names, and status. Raw keys are never returned.',
      outputSchema: credentialProfilesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => jsonToolResult(await getCredentialProfiles(credentialStore)),
  );

  return server;
}
