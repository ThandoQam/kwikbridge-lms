/**
 * Credit Bureau & KYC Adapter (TD-7)
 *
 * Defines the interface for credit bureau and identity verification
 * providers. The current MockBureauProvider produces realistic data
 * for development; real providers (TransUnion, Experian, XDS, DHA NPR)
 * are swapped in by replacing the registered provider.
 *
 * SA-specific providers and their roles:
 *   - TransUnion (CRB): primary commercial/consumer credit reports
 *   - Experian: secondary CRB for cross-checking
 *   - XDS: niche fraud database
 *   - Compuscan: commercial credit reports
 *   - DHA NPR (National Population Register): ID verification
 *   - Refinitiv World-Check / Dow Jones: sanctions / PEP screening
 *
 * Production deployment requires:
 *   - NCR registration as a credit provider (already have NCRCP22396)
 *   - Bureau membership and consent management
 *   - POPIA: explicit consent before bureau pulls
 *   - 30-day retention limits per consent
 */

import { log, timing } from './observability';

export interface BureauProvider {
  name: string;

  // Primary credit report on a SA business or individual
  pullCreditReport(req: BureauRequest): Promise<BureauReport>;

  // Light-touch credit score only (cheaper)
  pullCreditScore(req: BureauRequest): Promise<{ score: number; band: string }>;

  // ID verification against DHA
  verifyIdentity(req: IdentityRequest): Promise<IdentityResult>;

  // Sanctions / PEP screening
  screenSanctions(req: SanctionsRequest): Promise<SanctionsResult>;
}

export interface BureauRequest {
  type: 'individual' | 'business';
  idNumber?: string;        // SA ID or company reg number
  fullName?: string;
  dateOfBirth?: string;
  consentReference: string; // POPIA consent record ID
  purpose: 'application' | 'monitoring' | 'collections' | 'fraud_check';
}

export interface BureauReport {
  bureauName: string;
  pullDate: number;
  score: number;            // 0-1000 (TransUnion scale)
  band: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor' | 'Thin File';
  defaults: BureauDefault[];
  judgments: BureauJudgment[];
  enquiries: BureauEnquiry[];
  accounts: BureauAccount[];
  totalMonthlyExposure: number;
  numActiveAccounts: number;
  oldestAccountAge: number;  // months
  rawData?: unknown;
}

export interface BureauDefault {
  amount: number;
  creditor: string;
  date: number;
  status: 'open' | 'paid' | 'rehabilitated';
}

export interface BureauJudgment {
  amount: number;
  court: string;
  date: number;
  rescinded: boolean;
}

export interface BureauEnquiry {
  enquirer: string;
  date: number;
  purpose: string;
}

export interface BureauAccount {
  creditor: string;
  type: string;             // Personal Loan, Credit Card, Store Card, etc.
  balance: number;
  monthlyInstalment: number;
  status: 'current' | 'arrears_30' | 'arrears_60' | 'arrears_90' | 'defaulted' | 'closed';
  openDate: number;
}

export interface IdentityRequest {
  idNumber: string;
  fullName?: string;
  consentReference: string;
}

export interface IdentityResult {
  verified: boolean;
  confidence: 'high' | 'medium' | 'low' | 'failed';
  matchScore?: number;      // 0-100
  fullNameMatch?: boolean;
  dateOfBirthMatch?: boolean;
  status?: 'alive' | 'deceased' | 'unknown';
  citizenshipStatus?: 'citizen' | 'permanent_resident' | 'temporary_resident' | 'unknown';
  errors?: string[];
}

export interface SanctionsRequest {
  fullName: string;
  idNumber?: string;
  dateOfBirth?: string;
  consentReference: string;
}

export interface SanctionsResult {
  clear: boolean;
  matches: Array<{
    list: string;           // 'OFAC', 'UN', 'EU', 'PEP', 'AdverseMedia'
    name: string;
    score: number;          // similarity score 0-100
    details: string;
  }>;
  pepStatus: 'none' | 'pep' | 'pep_close_associate' | 'pep_family';
  adverseMedia: boolean;
}

// ═══ Mock Provider — for development and testing ═══

class MockBureauProvider implements BureauProvider {
  name = 'MockBureau';

  async pullCreditReport(req: BureauRequest): Promise<BureauReport> {
    return timing(
      'bureau.mock.report',
      async () => {
        log.info('Mock bureau pull initiated', {
          type: req.type,
          purpose: req.purpose,
        });
        await new Promise((r) => setTimeout(r, 350));

        // Deterministic pseudo-random based on ID for consistent dev data
        const hash = simpleHash(req.idNumber || req.fullName || 'unknown');
        const score = 350 + (hash % 600); // 350-950 range
        const band = scoreBand(score);

        const defaults: BureauDefault[] =
          score < 500
            ? [
                {
                  amount: 1000 + (hash % 50000),
                  creditor: 'Mock Retailer',
                  date: Date.now() - 365 * 24 * 60 * 60 * 1000,
                  status: 'open',
                },
              ]
            : [];

        const accounts: BureauAccount[] = Array.from({ length: 1 + (hash % 4) }).map((_, i) => ({
          creditor: ['Standard Bank', 'FNB', 'ABSA', 'Capitec'][i % 4],
          type: ['Personal Loan', 'Credit Card', 'Vehicle Finance', 'Store Card'][i % 4],
          balance: 5000 + (hash * (i + 1)) % 100000,
          monthlyInstalment: 200 + (hash % 3000),
          status: score > 700 ? 'current' : score > 550 ? 'arrears_30' : 'arrears_60',
          openDate: Date.now() - (12 + (hash % 60)) * 30 * 24 * 60 * 60 * 1000,
        }));

        const totalMonthlyExposure = accounts.reduce((s, a) => s + a.monthlyInstalment, 0);

        return {
          bureauName: 'MockBureau',
          pullDate: Date.now(),
          score,
          band,
          defaults,
          judgments: [],
          enquiries: [
            { enquirer: 'KwikBridge LMS', date: Date.now(), purpose: req.purpose },
          ],
          accounts,
          totalMonthlyExposure,
          numActiveAccounts: accounts.length,
          oldestAccountAge: 12 + (hash % 84),
          rawData: { mock: true },
        };
      },
      { type: req.type, purpose: req.purpose }
    );
  }

  async pullCreditScore(req: BureauRequest): Promise<{ score: number; band: string }> {
    const hash = simpleHash(req.idNumber || req.fullName || 'unknown');
    const score = 350 + (hash % 600);
    return { score, band: scoreBand(score) };
  }

  async verifyIdentity(req: IdentityRequest): Promise<IdentityResult> {
    log.info('Mock identity verification', { hasId: !!req.idNumber });
    await new Promise((r) => setTimeout(r, 200));
    // Mock: assume valid 13-digit IDs verify successfully
    const cleaned = req.idNumber.replace(/\s/g, '');
    const validFormat = /^\d{13}$/.test(cleaned);
    return {
      verified: validFormat,
      confidence: validFormat ? 'high' : 'failed',
      matchScore: validFormat ? 95 : 0,
      fullNameMatch: validFormat,
      dateOfBirthMatch: validFormat,
      status: validFormat ? 'alive' : 'unknown',
      citizenshipStatus: validFormat ? 'citizen' : 'unknown',
      errors: validFormat ? undefined : ['Invalid ID format'],
    };
  }

  async screenSanctions(req: SanctionsRequest): Promise<SanctionsResult> {
    log.info('Mock sanctions screening');
    await new Promise((r) => setTimeout(r, 150));
    // Mock: only flag if name contains 'sanctioned' (test fixture)
    const flagged = req.fullName.toLowerCase().includes('sanctioned');
    return {
      clear: !flagged,
      matches: flagged
        ? [
            {
              list: 'OFAC',
              name: req.fullName,
              score: 95,
              details: 'Mock match for testing — replace with real provider',
            },
          ]
        : [],
      pepStatus: 'none',
      adverseMedia: false,
    };
  }
}

// ═══ Helpers ═══

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function scoreBand(score: number): BureauReport['band'] {
  if (score >= 800) return 'Excellent';
  if (score >= 700) return 'Good';
  if (score >= 600) return 'Fair';
  if (score >= 500) return 'Poor';
  if (score === 0) return 'Thin File';
  return 'Very Poor';
}

// ═══ Provider Registry ═══

// ═══ Real Provider Stubs — to be implemented when contracts are signed ═══
// These exist as placeholders so the integration path is explicit. Calling
// any method throws a NotImplementedError with the required action items.

class NotImplementedError extends Error {
  constructor(provider: string, method: string) {
    super(
      `${provider} provider not yet implemented. ` +
      `To enable: (1) sign credit bureau agreement, (2) complete data-sharing ` +
      `compliance review (POPIA + bureau code of conduct), (3) obtain API ` +
      `credentials, (4) implement ${method}() against vendor docs, ` +
      `(5) add credentials via VITE_${provider.toUpperCase()}_API_KEY, ` +
      `(6) call setBureauProvider(new ${provider}BureauProvider()) in bootstrap.`
    );
    this.name = 'NotImplementedError';
  }
}

/**
 * TransUnion South Africa (https://www.transunion.co.za) — Primary credit
 * bureau for SA consumer + commercial credit reports.
 * Capabilities: full credit report, credit score, ID verification (DHA),
 * sanctions screening (DPL).
 * Status: NOT YET CONTRACTED. This stub fails fast to surface the gap.
 */
export class TransUnionBureauProvider implements BureauProvider {
  name = 'TransUnion';

  async pullCreditReport(_req: BureauRequest): Promise<BureauReport> {
    throw new NotImplementedError('TransUnion', 'pullCreditReport');
  }

  async pullCreditScore(_req: BureauRequest): Promise<{ score: number; band: string }> {
    throw new NotImplementedError('TransUnion', 'pullCreditScore');
  }

  async verifyIdentity(_req: { idNumber: string; firstName?: string; lastName?: string }): Promise<{ verified: boolean; confidence: number; details?: Record<string, unknown> }> {
    throw new NotImplementedError('TransUnion', 'verifyIdentity');
  }

  async screenSanctions(_req: { idNumber?: string; name: string }): Promise<{ matches: Array<{ list: string; match: string; confidence: number }> }> {
    throw new NotImplementedError('TransUnion', 'screenSanctions');
  }
}

/**
 * Experian South Africa (https://www.experian.co.za) — Secondary bureau.
 * Used for cross-bureau verification on high-value applications and as
 * primary fallback if TransUnion is unavailable.
 * Status: NOT YET CONTRACTED. This stub fails fast to surface the gap.
 */
export class ExperianBureauProvider implements BureauProvider {
  name = 'Experian';

  async pullCreditReport(_req: BureauRequest): Promise<BureauReport> {
    throw new NotImplementedError('Experian', 'pullCreditReport');
  }

  async pullCreditScore(_req: BureauRequest): Promise<{ score: number; band: string }> {
    throw new NotImplementedError('Experian', 'pullCreditScore');
  }

  async verifyIdentity(_req: { idNumber: string; firstName?: string; lastName?: string }): Promise<{ verified: boolean; confidence: number; details?: Record<string, unknown> }> {
    throw new NotImplementedError('Experian', 'verifyIdentity');
  }

  async screenSanctions(_req: { idNumber?: string; name: string }): Promise<{ matches: Array<{ list: string; match: string; confidence: number }> }> {
    throw new NotImplementedError('Experian', 'screenSanctions');
  }
}


let activeProvider: BureauProvider = new MockBureauProvider();

export const setBureauProvider = (provider: BureauProvider): void => {
  log.info('Bureau provider switched', { from: activeProvider.name, to: provider.name });
  activeProvider = provider;
};

export const getBureauProvider = (): BureauProvider => activeProvider;

// ═══ Public API ═══

/**
 * Pull a full credit report. Always validates consent reference
 * before calling the provider — POPIA requirement.
 */
export const pullCreditReport = async (req: BureauRequest): Promise<BureauReport> => {
  if (!req.consentReference) {
    throw new Error('Consent reference required (POPIA compliance)');
  }
  if (!req.idNumber && !req.fullName) {
    throw new Error('Identifier required (idNumber or fullName)');
  }
  return activeProvider.pullCreditReport(req);
};

export const pullCreditScore = async (req: BureauRequest) => {
  if (!req.consentReference) throw new Error('Consent reference required (POPIA compliance)');
  return activeProvider.pullCreditScore(req);
};

export const verifyIdentity = async (req: IdentityRequest): Promise<IdentityResult> => {
  if (!req.consentReference) throw new Error('Consent reference required (POPIA compliance)');
  if (!req.idNumber) throw new Error('ID number required');
  return activeProvider.verifyIdentity(req);
};

export const screenSanctions = async (req: SanctionsRequest): Promise<SanctionsResult> => {
  if (!req.consentReference) throw new Error('Consent reference required');
  if (!req.fullName) throw new Error('Full name required');
  return activeProvider.screenSanctions(req);
};

// ═══ Composite onboarding check ═══

export interface OnboardingCheckResult {
  identity: IdentityResult;
  sanctions: SanctionsResult;
  bureau: BureauReport;
  decision: 'auto_pass' | 'auto_decline' | 'manual_review';
  reasons: string[];
}

/**
 * Full onboarding check — calls all three providers in parallel
 * and produces a single decision recommendation.
 *
 * Decision logic:
 *   - Sanctions hit → auto_decline (no exceptions)
 *   - Identity failed → auto_decline
 *   - Bureau score < 400 with defaults → auto_decline
 *   - Bureau score < 600 OR PEP → manual_review
 *   - Otherwise → auto_pass
 */
export const performOnboardingChecks = async (
  request: {
    idNumber: string;
    fullName: string;
    consentReference: string;
  }
): Promise<OnboardingCheckResult> => {
  const reasons: string[] = [];

  // Run in parallel for speed
  const [identity, sanctions, bureau] = await Promise.all([
    verifyIdentity({
      idNumber: request.idNumber,
      fullName: request.fullName,
      consentReference: request.consentReference,
    }),
    screenSanctions({
      fullName: request.fullName,
      idNumber: request.idNumber,
      consentReference: request.consentReference,
    }),
    pullCreditReport({
      type: 'individual',
      idNumber: request.idNumber,
      fullName: request.fullName,
      consentReference: request.consentReference,
      purpose: 'application',
    }),
  ]);

  // Decision tree
  let decision: 'auto_pass' | 'auto_decline' | 'manual_review' = 'auto_pass';

  if (!sanctions.clear) {
    decision = 'auto_decline';
    reasons.push(`Sanctions hit on ${sanctions.matches[0]?.list || 'screening'}`);
  } else if (!identity.verified || identity.confidence === 'failed') {
    decision = 'auto_decline';
    reasons.push('Identity verification failed');
  } else if (identity.status === 'deceased') {
    decision = 'auto_decline';
    reasons.push('Identity flagged as deceased');
  } else if (bureau.score < 400 && bureau.defaults.length > 0) {
    decision = 'auto_decline';
    reasons.push(`Bureau score ${bureau.score} with ${bureau.defaults.length} default(s)`);
  } else if (bureau.score < 600) {
    decision = 'manual_review';
    reasons.push(`Bureau score ${bureau.score} below auto-pass threshold`);
  } else if (sanctions.pepStatus !== 'none') {
    decision = 'manual_review';
    reasons.push(`PEP status: ${sanctions.pepStatus} — enhanced due diligence required`);
  } else if (identity.confidence === 'low') {
    decision = 'manual_review';
    reasons.push('Identity match confidence is low');
  } else if (bureau.totalMonthlyExposure > 0) {
    // Just informational, doesn't change decision
    reasons.push(`Existing monthly exposure: R${bureau.totalMonthlyExposure.toLocaleString()}`);
  }

  if (decision === 'auto_pass' && reasons.length === 0) {
    reasons.push('All checks passed — clean record');
  }

  return { identity, sanctions, bureau, decision, reasons };
};
