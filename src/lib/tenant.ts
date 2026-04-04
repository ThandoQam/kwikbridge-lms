// KwikBridge LMS — Multi-Tenancy Module (ENH-10)
// Enables multiple organisations to use KwikBridge on a single deployment.
// Matches FinnOne Neo's 200+ FI deployment model.
//
// Architecture:
//   - Tenant config loaded from tenants table or settings
//   - tenant_id column on all tables for data isolation
//   - RLS policies filter by tenant_id from JWT
//   - White-label: theme, logo, NCR number from tenant config

// ═══ Types ═══

export interface TenantConfig {
  id: string;
  name: string;
  shortName: string;
  domain: string;               // e.g. "tqa.kwikbridge.co.za"
  logo: string;                 // URL or base64
  primaryColor: string;         // hex color
  secondaryColor: string;
  ncrReg: string;
  ncrExpiry: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  yearEnd: string;
  status: "active" | "suspended" | "trial";
  plan: "starter" | "professional" | "enterprise";
  maxUsers: number;
  maxLoans: number;
  features: TenantFeatures;
  createdAt: number;
}

export interface TenantFeatures {
  collections: boolean;
  provisioning: boolean;
  statutoryReporting: boolean;
  documentUpload: boolean;
  portalAccess: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  multiCurrency: boolean;
  customScorecard: boolean;
  eodBatch: boolean;
  stressTesting: boolean;
  aiAssistant: boolean;
}

// ═══ Default Tenant (TQA Capital) ═══

export const DEFAULT_TENANT: TenantConfig = {
  id: "tqa-capital",
  name: "TQA Capital (Pty) Ltd",
  shortName: "TQA Capital",
  domain: "kwikbridge.co.za",
  logo: "",
  primaryColor: "#1a1a2e",
  secondaryColor: "#1B5E7D",
  ncrReg: "NCRCP22396",
  ncrExpiry: "31 July 2026",
  branch: "East London, Nahoon Valley",
  address: "Nahoon Valley, East London, Eastern Cape",
  phone: "043 XXX XXXX",
  email: "info@tqacapital.co.za",
  website: "www.tqacapital.co.za",
  yearEnd: "February",
  status: "active",
  plan: "enterprise",
  maxUsers: 50,
  maxLoans: 5000,
  features: {
    collections: true,
    provisioning: true,
    statutoryReporting: true,
    documentUpload: true,
    portalAccess: true,
    apiAccess: true,
    webhooks: true,
    multiCurrency: false,
    customScorecard: true,
    eodBatch: true,
    stressTesting: true,
    aiAssistant: true,
  },
  createdAt: Date.now(),
};

// ═══ Tenant Resolution ═══

let _currentTenant: TenantConfig = DEFAULT_TENANT;

/**
 * Resolve tenant from hostname.
 * e.g. "tqa.kwikbridge.co.za" → tenant "tqa-capital"
 *      "acme.kwikbridge.co.za" → tenant "acme-lending"
 */
export function resolveTenant(hostname?: string): TenantConfig {
  // In production, this would query the tenants table
  // For now, always return default tenant
  return DEFAULT_TENANT;
}

export function getCurrentTenant(): TenantConfig {
  return _currentTenant;
}

export function setCurrentTenant(tenant: TenantConfig) {
  _currentTenant = tenant;
}

/**
 * Check if a feature is enabled for the current tenant.
 */
export function isFeatureEnabled(feature: keyof TenantFeatures): boolean {
  return _currentTenant.features[feature] || false;
}

// ═══ Theme Derivation ═══

/**
 * Generate theme overrides from tenant configuration.
 * Used to apply tenant branding to the UI.
 */
export function getTenantTheme(tenant: TenantConfig): Record<string, string> {
  return {
    "--kb-primary": tenant.primaryColor,
    "--kb-secondary": tenant.secondaryColor,
    "--kb-company": tenant.name,
    "--kb-ncr": tenant.ncrReg,
  };
}

/**
 * Get tenant-branded document footer text.
 */
export function getTenantFooter(tenant?: TenantConfig): string {
  const t = tenant || _currentTenant;
  return `${t.name} | Registered Credit Provider ${t.ncrReg} | ${t.branch}`;
}

// ═══ Tenant Data Scoping ═══

/**
 * Add tenant_id to a record before saving.
 */
export function scopeToTenant<T extends Record<string, any>>(record: T): T & { tenantId: string } {
  return { ...record, tenantId: _currentTenant.id };
}

/**
 * Filter records by current tenant.
 */
export function filterByTenant<T extends { tenantId?: string }>(records: T[]): T[] {
  return records.filter(r => !r.tenantId || r.tenantId === _currentTenant.id);
}

// ═══ Tenant Administration ═══

/**
 * Validate tenant configuration.
 */
export function validateTenantConfig(config: Partial<TenantConfig>): string[] {
  const errors: string[] = [];
  if (!config.name) errors.push("Tenant name is required");
  if (!config.ncrReg) errors.push("NCR registration number is required");
  if (!config.domain) errors.push("Domain is required");
  if (config.primaryColor && !/^#[0-9a-fA-F]{6}$/.test(config.primaryColor)) {
    errors.push("Primary color must be a valid hex color (e.g. #1a1a2e)");
  }
  if (config.maxUsers && config.maxUsers < 1) errors.push("Max users must be at least 1");
  if (config.maxLoans && config.maxLoans < 1) errors.push("Max loans must be at least 1");
  return errors;
}

/**
 * Get tenant usage statistics.
 */
export function getTenantUsage(
  tenant: TenantConfig,
  userCount: number,
  loanCount: number
): { users: { current: number; max: number; pct: number }; loans: { current: number; max: number; pct: number } } {
  return {
    users: { current: userCount, max: tenant.maxUsers, pct: Math.round((userCount / tenant.maxUsers) * 100) },
    loans: { current: loanCount, max: tenant.maxLoans, pct: Math.round((loanCount / tenant.maxLoans) * 100) },
  };
}
