import { describe, it, expect, beforeEach } from 'vitest';
import {
  pullCreditReport,
  pullCreditScore,
  verifyIdentity,
  screenSanctions,
  performOnboardingChecks,
} from '../../src/lib/bureau';

describe('pullCreditReport', () => {
  const validReq = {
    type: 'individual' as const,
    idNumber: '8001015009087',
    fullName: 'Test Person',
    consentReference: 'CONSENT-001',
    purpose: 'application' as const,
  };

  it('returns a credit report with required fields', async () => {
    const r = await pullCreditReport(validReq);
    expect(r.bureauName).toBeDefined();
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1000);
    expect(r.band).toBeDefined();
    expect(Array.isArray(r.defaults)).toBe(true);
    expect(Array.isArray(r.accounts)).toBe(true);
  });

  it('rejects request without consent reference (POPIA)', async () => {
    await expect(
      pullCreditReport({ ...validReq, consentReference: '' })
    ).rejects.toThrow(/consent/i);
  });

  it('rejects request without identifier', async () => {
    await expect(
      pullCreditReport({ ...validReq, idNumber: undefined, fullName: undefined })
    ).rejects.toThrow(/identifier/i);
  });

  it('produces deterministic results for same input', async () => {
    const a = await pullCreditReport(validReq);
    const b = await pullCreditReport(validReq);
    expect(a.score).toBe(b.score);
  });
});

describe('pullCreditScore', () => {
  it('returns score and band', async () => {
    const r = await pullCreditScore({
      type: 'individual',
      idNumber: '8001015009087',
      consentReference: 'C-001',
      purpose: 'monitoring',
    });
    expect(r.score).toBeGreaterThan(0);
    expect(r.band).toBeDefined();
  });
});

describe('verifyIdentity', () => {
  it('verifies a valid SA ID format', async () => {
    const r = await verifyIdentity({
      idNumber: '8001015009087',
      fullName: 'Test',
      consentReference: 'C-001',
    });
    expect(r.verified).toBe(true);
    expect(r.confidence).toBe('high');
  });

  it('rejects invalid ID format', async () => {
    const r = await verifyIdentity({
      idNumber: '123',
      consentReference: 'C-001',
    });
    expect(r.verified).toBe(false);
    expect(r.errors).toBeDefined();
  });

  it('throws without consent', async () => {
    await expect(
      verifyIdentity({ idNumber: '8001015009087', consentReference: '' })
    ).rejects.toThrow();
  });
});

describe('screenSanctions', () => {
  it('returns clear for ordinary names', async () => {
    const r = await screenSanctions({
      fullName: 'Thando Qamarana',
      consentReference: 'C-001',
    });
    expect(r.clear).toBe(true);
    expect(r.matches).toHaveLength(0);
    expect(r.pepStatus).toBe('none');
  });

  it('flags names with sanctioned in them (mock test fixture)', async () => {
    const r = await screenSanctions({
      fullName: 'John Sanctioned',
      consentReference: 'C-001',
    });
    expect(r.clear).toBe(false);
    expect(r.matches.length).toBeGreaterThan(0);
  });
});

describe('performOnboardingChecks', () => {
  it('produces auto_pass for clean profile', async () => {
    const r = await performOnboardingChecks({
      idNumber: '8001015009087',
      fullName: 'Clean Customer With Decent Credit',
      consentReference: 'C-001',
    });
    expect(['auto_pass', 'manual_review']).toContain(r.decision);
    expect(r.bureau).toBeDefined();
    expect(r.identity).toBeDefined();
    expect(r.sanctions).toBeDefined();
  });

  it('declines on sanctions match', async () => {
    const r = await performOnboardingChecks({
      idNumber: '8001015009087',
      fullName: 'Sanctioned Person',
      consentReference: 'C-001',
    });
    expect(r.decision).toBe('auto_decline');
    expect(r.reasons.some((x) => x.toLowerCase().includes('sanction'))).toBe(true);
  });

  it('declines on invalid ID', async () => {
    const r = await performOnboardingChecks({
      idNumber: 'INVALID',
      fullName: 'Test',
      consentReference: 'C-001',
    });
    expect(r.decision).toBe('auto_decline');
    expect(r.reasons.some((x) => x.toLowerCase().includes('identity'))).toBe(true);
  });

  it('returns reasons array even on auto_pass', async () => {
    const r = await performOnboardingChecks({
      idNumber: '8001015009087',
      fullName: 'Normal Person',
      consentReference: 'C-001',
    });
    expect(Array.isArray(r.reasons)).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
  });
});
