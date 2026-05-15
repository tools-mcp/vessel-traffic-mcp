import { z } from 'zod/v4';

import type { CredentialStore } from '../config/credentials.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { isDataResult, type VesselIdentity, type VesselSearchResult } from '../providers/types.js';
import {
  applyUpgradeHints,
  mergeUpgradeHints,
  nowIso,
  resolveProvider,
  routingInputShape,
  type RoutingInput,
} from './vessel-routing.js';

export const vesselNameResolveInputSchema = z
  .object({
    name: z.string().min(1).optional(),
    ports: z.array(z.string().min(1)).max(20).optional(),
    voyageNumber: z.string().min(1).optional(),
    carrier: z.string().min(1).optional(),
    limit: z.number().int().positive().max(50).optional(),
    ...routingInputShape,
  })
  .superRefine((data, ctx) => {
    if (!data.name || data.name.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'vessel_name_resolve requires a non-empty name.',
      });
    }
  });

export type VesselNameResolveInput = z.infer<typeof vesselNameResolveInputSchema>;

interface Deps {
  registry: ProviderRegistry;
  credentialStore: CredentialStore;
}

export interface VesselResolutionCandidate {
  identity: VesselIdentity;
  matchedSignals: string[];
  missingSignals: string[];
  confidence: 'high' | 'medium' | 'low';
  needsConfirmation: boolean;
}

export function normalizeVesselName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 .\-\/]/g, '')
    .trim();
}

function scoreCandidate(
  identity: VesselIdentity,
  normalizedQuery: string,
): { matchedSignals: string[]; missingSignals: string[]; confidence: 'high' | 'medium' | 'low' } {
  const matched: string[] = [];
  const missing: string[] = [];
  const candidateName = identity.name ? normalizeVesselName(identity.name) : '';
  if (candidateName === normalizedQuery && candidateName.length > 0) {
    matched.push('name_exact');
  } else if (candidateName && candidateName.includes(normalizedQuery)) {
    matched.push('name_substring');
  } else {
    missing.push('name_match');
  }
  if (identity.mmsi) matched.push('mmsi_known');
  else missing.push('mmsi');
  if (identity.imo) matched.push('imo_known');
  else missing.push('imo');

  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (matched.includes('name_exact') && (matched.includes('mmsi_known') || matched.includes('imo_known'))) {
    confidence = 'high';
  } else if (matched.includes('name_exact') || matched.includes('name_substring')) {
    confidence = 'medium';
  }
  return { matchedSignals: matched, missingSignals: missing, confidence };
}

export async function vesselNameResolve(
  deps: Deps,
  input: VesselNameResolveInput,
): Promise<Record<string, unknown>> {
  const retrievedAt = nowIso();
  const rawName = (input.name ?? '').trim();
  const normalizedName = normalizeVesselName(rawName);
  const routing: RoutingInput = {
    provider: input.provider,
    credentialProfile: input.credentialProfile,
    fallbackPolicy: input.fallbackPolicy,
    coverageHint: input.coverageHint,
  };
  const resolved = resolveProvider({
    registry: deps.registry,
    credentialStore: deps.credentialStore,
    capability: 'vessel_search',
    routing,
    retrievedAtFallback: retrievedAt,
  });
  if (!resolved.ok) {
    return {
      ...resolved.noData,
      normalizedName,
      candidates: [],
    };
  }
  if (!resolved.provider.search) {
    return {
      ok: false,
      reason: 'no_provider_for_capability',
      message: `Provider "${resolved.provider.id}" does not implement vessel_search for name resolution.`,
      retrievedAt,
      upgradeHints: resolved.upgradeHints,
      normalizedName,
      candidates: [],
    };
  }
  const searchResult = await resolved.provider.search({ name: rawName, limit: input.limit });
  if (!isDataResult<VesselSearchResult>(searchResult)) {
    return applyUpgradeHints(
      {
        ...searchResult,
        normalizedName,
        candidates: [],
        note: 'First-pass name resolution stub; full B/L scoring is owned by F3B.',
      },
      resolved.upgradeHints,
    );
  }
  const candidates: VesselResolutionCandidate[] = searchResult.data.matches.map((identity) => {
    const score = scoreCandidate(identity, normalizedName);
    return {
      identity,
      matchedSignals: score.matchedSignals,
      missingSignals: score.missingSignals,
      confidence: score.confidence,
      needsConfirmation: score.confidence !== 'high',
    };
  });
  const limited = input.limit && input.limit > 0 ? candidates.slice(0, input.limit) : candidates;
  return {
    ok: true,
    data: {
      normalizedName,
      candidates: limited,
      total: candidates.length,
    },
    retrievedAt: searchResult.retrievedAt,
    source: searchResult.source,
    caveats: [
      ...(searchResult.caveats ?? []),
      'First-pass name resolution stub; full B/L scoring is owned by F3B.',
    ],
    upgradeHints: mergeUpgradeHints(searchResult.upgradeHints, resolved.upgradeHints),
  };
}
