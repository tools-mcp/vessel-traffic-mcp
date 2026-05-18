import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { loadCredentialProfiles, type CredentialStore } from '../config/credentials.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { createRuntimeProviderRegistry } from '../providers/runtime-registry.js';
import {
  credentialProfilesOutputSchema,
  dataSourcesOutputSchema,
  providerStatusOutputSchema,
} from '../tools/contracts.js';
import { getCredentialProfiles } from '../tools/credential-profiles.js';
import { getDataSources } from '../tools/data-sources.js';
import { getProviderStatus } from '../tools/provider-status.js';
import { documentVesselLookup, documentVesselLookupInputSchema } from '../tools/document-vessel-lookup.js';
import { portCalls, portCallsInputSchema } from '../tools/port-calls.js';
import { vesselArea, vesselAreaInputSchema } from '../tools/vessel-area.js';
import { vesselNameResolve, vesselNameResolveInputSchema } from '../tools/vessel-name-resolve.js';
import { vesselPosition, vesselPositionInputSchema } from '../tools/vessel-position.js';
import { vesselSearch, vesselSearchInputSchema } from '../tools/vessel-search.js';
import { vesselTrack, vesselTrackInputSchema } from '../tools/vessel-track.js';

const serverVersion = '0.1.0';

function jsonToolResult(structuredContent: Record<string, unknown>) {
  // Round-trip through JSON so text and structuredContent agree on undefined-vs-missing keys.
  const serialized = JSON.stringify(structuredContent, null, 2);
  return {
    content: [
      {
        type: 'text' as const,
        text: serialized,
      },
    ],
    structuredContent: JSON.parse(serialized) as Record<string, unknown>,
  };
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export interface CreateVesselMcpServerOptions {
  registry?: ProviderRegistry;
  credentialStore?: CredentialStore;
}

export function createVesselMcpServer(options: CreateVesselMcpServerOptions = {}): McpServer {
  const registry = options.registry ?? createRuntimeProviderRegistry();
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
      annotations: readOnlyAnnotations,
    },
    async () => jsonToolResult(await getProviderStatus(registry)),
  );

  server.registerTool(
    'data_sources',
    {
      title: 'Data Sources',
      description: 'List available vessel data source adapters, coverage notes, auth mode, and caveats.',
      outputSchema: dataSourcesOutputSchema,
      annotations: readOnlyAnnotations,
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
      annotations: readOnlyAnnotations,
    },
    async () => jsonToolResult(await getCredentialProfiles(credentialStore)),
  );

  const deps = { registry, credentialStore };

  server.registerTool(
    'vessel_search',
    {
      title: 'Vessel Search',
      description:
        'Search vessels by MMSI, IMO, name, or callsign. Requires at least one identifier; returns normalized identities with provider source metadata.',
      inputSchema: vesselSearchInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => jsonToolResult(await vesselSearch(deps, args)),
  );

  server.registerTool(
    'vessel_name_resolve',
    {
      title: 'Vessel Name Resolve',
      description:
        'Resolve a messy vessel name (e.g. from B/L text) to ranked MMSI/IMO candidates with matched/missing signals and confidence.',
      inputSchema: vesselNameResolveInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => jsonToolResult(await vesselNameResolve(deps, args)),
  );

  server.registerTool(
    'document_vessel_lookup',
    {
      title: 'Document Vessel Lookup',
      description:
        'Extract vessel signals (name, IMO/MMSI/callsign, voyage, ports, container numbers, dates) from B/L-style text and return ranked candidates.',
      inputSchema: documentVesselLookupInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => jsonToolResult(await documentVesselLookup(deps, args)),
  );

  server.registerTool(
    'vessel_position',
    {
      title: 'Vessel Position',
      description:
        'Return the latest known position for a vessel by MMSI or IMO with source, retrievedAt, observedAt, and freshness metadata.',
      inputSchema: vesselPositionInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => jsonToolResult(await vesselPosition(deps, args)),
  );

  server.registerTool(
    'vessel_area',
    {
      title: 'Vessel Area',
      description:
        'Return latest known positions for vessels inside a bounding box (latMin<=latMax, lonMin<=lonMax) with provider source metadata.',
      inputSchema: vesselAreaInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => jsonToolResult(await vesselArea(deps, args)),
  );

  server.registerTool(
    'vessel_track',
    {
      title: 'Vessel Track',
      description:
        'Return the recent track points for a vessel by MMSI or IMO, optionally bounded by ISO-8601 windowStart/windowEnd.',
      inputSchema: vesselTrackInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => jsonToolResult(await vesselTrack(deps, args)),
  );

  server.registerTool(
    'port_calls',
    {
      title: 'Port Calls',
      description:
        'Return recent port-call events for a vessel by MMSI/IMO or for a UN/LOCODE port. Requires at least one filter.',
      inputSchema: portCallsInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => jsonToolResult(await portCalls(deps, args)),
  );

  return server;
}
