export const providerCapabilityValues = [
  'provider_status',
  'data_sources',
  'vessel_search',
  'vessel_position',
  'vessel_area',
  'vessel_track',
  'port_calls',
] as const;

export type ProviderCapability = (typeof providerCapabilityValues)[number];

export const providerTransportValues = ['api', 'websocket', 'fixture', 'capture-fixture'] as const;

export type ProviderTransport = (typeof providerTransportValues)[number];

export const sourceConfidenceValues = ['high', 'medium', 'low', 'unknown'] as const;

export type SourceConfidence = (typeof sourceConfidenceValues)[number];

export const providerAccessClassValues = [
  'fixture',
  'open',
  'community',
  'free-trial',
  'byok-commercial',
  'enterprise',
  'capture-fixture',
] as const;

export type ProviderAccessClass = (typeof providerAccessClassValues)[number];

export const providerTierValues = [
  'requested-byok',
  'terrestrial-open',
  'community',
  'paid-commercial',
  'capture-fixture',
  'fixture',
] as const;

export type ProviderTier = (typeof providerTierValues)[number];

export const upgradeReasonValues = [
  'auth_required',
  'satellite_required',
  'paid_history_required',
  'terrestrial_no_coverage',
  'quota_required',
  'unknown',
] as const;

export type UpgradeReason = (typeof upgradeReasonValues)[number];

export const credentialModeValues = ['none', 'byok-profile', 'one-time'] as const;

export type CredentialMode = (typeof credentialModeValues)[number];

export const captureEligibilityValues = ['allowed', 'unknown', 'blocked', 'needs-terms-review'] as const;

export type CaptureEligibility = (typeof captureEligibilityValues)[number];

export interface SourceMetadata {
  provider: string;
  adapterVersion: string;
  transport: ProviderTransport;
  coverage?: string;
  confidence?: SourceConfidence;
  termsNote?: string;
  landingUrl?: string;
}

export interface ProviderStatus {
  id: string;
  name: string;
  authState: 'not_required' | 'configured' | 'missing' | 'disabled';
  status: 'available' | 'degraded' | 'unavailable';
  capabilities: ProviderCapability[];
  source: SourceMetadata;
  retrievedAt: string;
  quota?: {
    state: 'not_applicable' | 'unknown' | 'available' | 'limited' | 'exhausted';
    note?: string;
  };
  caveats: string[];
}

export interface DataSource {
  id: string;
  name: string;
  transport: SourceMetadata['transport'];
  capabilities: ProviderCapability[];
  coverage: string;
  auth: {
    required: boolean;
    mode: CredentialMode;
  };
  caveats: string[];
  source: SourceMetadata;
}

export interface CredentialRequirement {
  required: boolean;
  mode: CredentialMode;
  profileFields: string[];
  envVars?: string[];
  notes?: string;
}

export interface RateLimitPolicy {
  requestsPerInterval: number;
  intervalMs: number;
  burst?: number;
  scope?: 'per-credential' | 'per-instance' | 'global';
  notes?: string;
}

export interface CacheTtlPolicy {
  defaultTtlMs: number;
  staleAfterMs?: number;
  scope?: 'per-credential' | 'per-instance' | 'global';
  notes?: string;
}

export interface ProviderMetadata {
  id: string;
  displayName: string;
  accessClass: ProviderAccessClass;
  tier: ProviderTier;
  landingUrl?: string;
  signupUrl?: string;
  homepage?: string;
  termsUrl?: string;
  coverage?: string;
  capabilities: ProviderCapability[];
  captureEligibility: CaptureEligibility;
  costNote?: string;
  notes?: string;
}

export interface ProviderUpgradeHint {
  provider: string;
  reason: UpgradeReason;
  landingUrl: string;
  credentialProfileHint?: string;
  coverage?: string;
  costNote?: string;
}

export interface VesselDataProvider {
  id: string;
  capabilities(): ProviderCapability[];
  status(): Promise<ProviderStatus>;
  dataSources(): Promise<DataSource[]>;
  metadata?(): ProviderMetadata;
  credentialRequirement?(): CredentialRequirement;
  rateLimitPolicy?(): RateLimitPolicy;
  cacheTtlPolicy?(): CacheTtlPolicy;
}
