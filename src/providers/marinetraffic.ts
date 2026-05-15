import {
  coerceFiniteNumber,
  coerceString,
  createPaidByokProvider,
  isPlainObject,
  pickFirst,
  type CreatePaidByokProviderOptions,
  type PaidByokProvider,
  type PaidByokProviderTemplate,
  type PaidByokQueryOptions,
  type PaidByokRecord,
  type PaidByokRequestPlan,
} from './paid-byok-rest.js';

export const MARINETRAFFIC_PROVIDER_ID = 'marinetraffic';
export const MARINETRAFFIC_ADAPTER_VERSION = 'marinetraffic-0.1.0';
export const MARINETRAFFIC_DISPLAY_NAME = 'MarineTraffic / Kpler';
export const MARINETRAFFIC_LANDING_URL = 'https://servicedocs.marinetraffic.com/';
export const MARINETRAFFIC_API_KEY_PROFILE_FIELD = 'api_key' as const;
export const MARINETRAFFIC_DEFAULT_LABEL = 'marinetraffic';
export const MARINETRAFFIC_DEFAULT_API_BASE_URL = 'https://services.marinetraffic.com/api';
export const MARINETRAFFIC_DEFAULT_PRODUCT = 'exportvessel';
export const MARINETRAFFIC_DEFAULT_VERSION = 'v:8';
export const MARINETRAFFIC_API_KEY_PLACEHOLDER = '__MARINETRAFFIC_API_KEY__';
export const MARINETRAFFIC_API_KEY_REDACTED_TOKEN = 'REDACTED';

// Conservative pacing. The MarineTraffic API is metered per-call against a
// subscription credit pool and most plans throttle harder than 60 RPM. One
// request per second with a small burst keeps the adapter well below the
// documented minimum service tier without burning subscription credits.
export const MARINETRAFFIC_REQUESTS_PER_INTERVAL = 1;
export const MARINETRAFFIC_INTERVAL_MS = 1_000;
export const MARINETRAFFIC_BURST = 5;
export const MARINETRAFFIC_CACHE_TTL_MS = 60_000;

const CAPABILITIES = ['vessel_search', 'vessel_position'] as const;

const CAVEATS = Object.freeze([
  'Paid commercial provider — every call consumes subscription credits.',
  'Coverage depends on the active MarineTraffic plan; satellite uplift required for blue-water positions.',
  'Default tests never call the live API; live calls require an operator-supplied credential and an explicit live-test flag.',
  'Not for safety-critical navigation.',
]);

export interface CreateMarineTrafficProviderOptions extends CreatePaidByokProviderOptions {
  readonly apiBaseUrl?: string;
  readonly product?: string;
  readonly version?: string;
}

function buildExportVesselUrl(
  baseUrl: string,
  product: string,
  version: string,
  apiKeySegment: string,
  options: PaidByokQueryOptions,
): string {
  const params = new URLSearchParams();
  params.set('protocol', 'jsono');
  if (options.mmsi !== undefined) params.set('mmsi', String(options.mmsi));
  if (options.imo !== undefined) params.set('imo', String(options.imo));
  // exportvessel REST shape: /api/{product}/{version}/{api_key}?protocol=jsono&mmsi=...
  return `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(product)}/${encodeURIComponent(version)}/${apiKeySegment}?${params.toString()}`;
}

function buildRequestPlan(
  baseUrl: string,
  product: string,
  version: string,
  options: PaidByokQueryOptions,
): PaidByokRequestPlan | { readonly unsupported: true; readonly message?: string } {
  const hasMmsi = options.mmsi !== undefined && Number.isInteger(options.mmsi) && (options.mmsi as number) > 0;
  const hasImo = options.imo !== undefined && Number.isInteger(options.imo) && (options.imo as number) > 0;
  if (!hasMmsi && !hasImo) {
    return {
      unsupported: true,
      message: 'MarineTraffic exportvessel requires a positive mmsi or imo identifier.',
    };
  }
  return {
    method: 'GET',
    url: buildExportVesselUrl(baseUrl, product, version, MARINETRAFFIC_API_KEY_PLACEHOLDER, options),
  };
}

function buildEndpointDescriptor(
  baseUrl: string,
  product: string,
  version: string,
  options: PaidByokQueryOptions,
): string {
  // Diagnostic URL with a literal REDACTED segment in place of the api_key.
  return buildExportVesselUrl(baseUrl, product, version, MARINETRAFFIC_API_KEY_REDACTED_TOKEN, options);
}

export function normalizeMarineTrafficRecord(raw: unknown): PaidByokRecord | undefined {
  if (!isPlainObject(raw)) return undefined;
  const record: PaidByokRecord = {
    mmsi: coerceFiniteNumber(pickFirst(raw.MMSI, raw.mmsi)),
    imo: coerceFiniteNumber(pickFirst(raw.IMO, raw.imo)),
    name: coerceString(pickFirst(raw.SHIPNAME, raw.shipname, raw.NAME, raw.name)),
    callsign: coerceString(pickFirst(raw.CALLSIGN, raw.callsign)),
    latitude: coerceFiniteNumber(pickFirst(raw.LAT, raw.lat, raw.LATITUDE)),
    longitude: coerceFiniteNumber(pickFirst(raw.LON, raw.lon, raw.LONGITUDE)),
    cog: coerceFiniteNumber(pickFirst(raw.COURSE, raw.course, raw.COG)),
    sog: coerceFiniteNumber(pickFirst(raw.SPEED, raw.speed, raw.SOG)),
    heading: coerceFiniteNumber(pickFirst(raw.HEADING, raw.heading)),
    navstat: coerceFiniteNumber(pickFirst(raw.STATUS, raw.status, raw.NAVSTAT)),
    type: coerceFiniteNumber(pickFirst(raw.SHIPTYPE, raw.shiptype, raw.TYPE)),
    destination: coerceString(pickFirst(raw.DESTINATION, raw.destination, raw.DEST)),
    eta: coerceString(pickFirst(raw.ETA, raw.eta)),
    observedAt: coerceString(pickFirst(raw.TIMESTAMP, raw.timestamp, raw.LAST_POS, raw.last_pos)),
  };
  if (
    record.mmsi === undefined &&
    record.imo === undefined &&
    record.name === undefined &&
    record.latitude === undefined &&
    record.longitude === undefined
  ) {
    return undefined;
  }
  return record;
}

function parseMarineTrafficBody(text: string): PaidByokRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('MarineTraffic response body is not valid JSON');
  }
  if (Array.isArray(parsed)) {
    const records: PaidByokRecord[] = [];
    for (const raw of parsed) {
      const normalized = normalizeMarineTrafficRecord(raw);
      if (normalized) records.push(normalized);
    }
    return records;
  }
  // MarineTraffic surfaces invalid queries as an `{ errors: [...] }` object.
  if (isPlainObject(parsed) && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    const firstError = parsed.errors[0];
    const detail = isPlainObject(firstError)
      ? coerceString(firstError.detail) ?? coerceString(firstError.title) ?? 'MarineTraffic returned an error envelope'
      : 'MarineTraffic returned an error envelope';
    throw new Error(detail);
  }
  if (isPlainObject(parsed)) {
    const normalized = normalizeMarineTrafficRecord(parsed);
    return normalized ? [normalized] : [];
  }
  return [];
}

export function createMarineTrafficProvider(
  options: CreateMarineTrafficProviderOptions,
): PaidByokProvider {
  const apiBaseUrl = options.apiBaseUrl ?? MARINETRAFFIC_DEFAULT_API_BASE_URL;
  const product = options.product ?? MARINETRAFFIC_DEFAULT_PRODUCT;
  const version = options.version ?? MARINETRAFFIC_DEFAULT_VERSION;

  const template: PaidByokProviderTemplate = {
    providerId: MARINETRAFFIC_PROVIDER_ID,
    adapterVersion: MARINETRAFFIC_ADAPTER_VERSION,
    displayName: MARINETRAFFIC_DISPLAY_NAME,
    landingUrl: MARINETRAFFIC_LANDING_URL,
    signupUrl: MARINETRAFFIC_LANDING_URL,
    homepage: MARINETRAFFIC_LANDING_URL,
    accessClass: 'byok-commercial',
    tier: 'paid-commercial',
    coverage:
      'Global terrestrial + satellite AIS, events, ports, and vessel data via the MarineTraffic / Kpler subscription API.',
    capabilities: CAPABILITIES,
    caveats: CAVEATS,
    credentialField: MARINETRAFFIC_API_KEY_PROFILE_FIELD,
    credentialEnvVar: 'VESSEL_MCP_PROFILE_MARINETRAFFIC__API_KEY',
    credentialDefaultLabel: MARINETRAFFIC_DEFAULT_LABEL,
    credentialNotes:
      'MarineTraffic issues per-endpoint API keys. Provision the appropriate exportvessel/exportvesseltrack key in the credential profile.',
    auth: { mode: 'path-segment', placeholder: MARINETRAFFIC_API_KEY_PLACEHOLDER },
    rateLimit: {
      requestsPerInterval: MARINETRAFFIC_REQUESTS_PER_INTERVAL,
      intervalMs: MARINETRAFFIC_INTERVAL_MS,
      burst: MARINETRAFFIC_BURST,
      scope: 'per-credential',
      notes:
        'Conservative one-request-per-second pacing with a small burst; well below documented MarineTraffic service-tier limits.',
    },
    cacheTtlMs: MARINETRAFFIC_CACHE_TTL_MS,
    costNote:
      'Per-call subscription credits; satellite uplift required for blue-water positions. Default verification never calls the live API.',
    termsNote:
      'MarineTraffic / Kpler subscription terms; per-call credit accounting and plan-dependent rate limits.',
    buildRequest(opts) {
      return buildRequestPlan(apiBaseUrl, product, version, opts);
    },
    buildEndpointDescriptor(opts) {
      return buildEndpointDescriptor(apiBaseUrl, product, version, opts);
    },
    parseRecords(text) {
      return parseMarineTrafficBody(text);
    },
  };

  return createPaidByokProvider(template, options);
}

export type MarineTrafficRecord = PaidByokRecord;
export type MarineTrafficQueryOptions = PaidByokQueryOptions;
