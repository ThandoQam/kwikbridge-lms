/**
 * Unit tests for the loan assistant module.
 *
 * The loan assistant handles conversational pre-qualification on the
 * public landing page. While the LLM call itself touches an external
 * API and isn't tested here, the pure helpers — extracted-data → form
 * conversion and dynamic document checklists — are critical because
 * they determine which documents customers are asked to upload.
 *
 * A bug in `getRequiredDocuments` either (a) asks for too few docs
 * (FICA exposure) or (b) asks for too many (UX friction → abandoned
 * applications).
 */

import { describe, it, expect } from 'vitest';
import {
  createAssistantState,
  extractedToAppForm,
  getRequiredDocuments,
} from '../../src/lib/loan-assistant';

// ═══ createAssistantState ═══

describe('createAssistantState', () => {
  it('starts with a single greeting message from assistant', () => {
    const state = createAssistantState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('assistant');
    expect(state.messages[0].content.length).toBeGreaterThan(20);
  });

  it('greeting timestamp is current', () => {
    const before = Date.now();
    const state = createAssistantState();
    const after = Date.now();
    expect(state.messages[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(state.messages[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('initial extractedData has zero confidence', () => {
    const state = createAssistantState();
    expect(state.extractedData.confidence).toBe(0);
  });

  it('starts at greeting stage with no suggested product or error', () => {
    const state = createAssistantState();
    expect(state.stage).toBe('greeting');
    expect(state.suggestedProduct).toBeNull();
    expect(state.error).toBeNull();
  });

  it('greeting mentions financing and asks an open question', () => {
    const state = createAssistantState();
    const greeting = state.messages[0].content.toLowerCase();
    expect(greeting).toMatch(/financ/);
    // Should end with a question or invitation
    expect(greeting).toMatch(/\?|tell me|let me know/);
  });
});

// ═══ extractedToAppForm ═══

describe('extractedToAppForm', () => {
  const buildExtracted = (overrides: any = {}): any => ({
    confidence: 0.9,
    ...overrides,
  });

  it('returns full form object with safe defaults when nothing extracted', () => {
    const form = extractedToAppForm(buildExtracted(), null, null);
    expect(form.custId).toBe('');
    expect(form.product).toBe('');
    expect(form.amount).toBe(0);
    expect(form.term).toBe(12);
    expect(form.purpose).toBe('');
    expect(form.businessName).toBe('');
    expect(form.industry).toBe('');
    expect(form.revenue).toBe(0);
    expect(form.employees).toBe(0);
    expect(form.yearsInBusiness).toBe(0);
    expect(form.beeLevel).toBe(0);
  });

  it('uses extracted values when present', () => {
    const extracted = buildExtracted({
      loanAmount: 750_000,
      loanTerm: 24,
      purpose: 'equipment purchase',
      businessName: 'Acme Pty Ltd',
      industry: 'Manufacturing',
      revenue: 5_000_000,
      employees: 18,
      yearsInBusiness: 6,
      beeLevel: 2,
      recommendedProduct: 'P-EQUIPMENT',
    });
    const form = extractedToAppForm(extracted, null, null);
    expect(form.product).toBe('P-EQUIPMENT');
    expect(form.amount).toBe(750_000);
    expect(form.term).toBe(24);
    expect(form.purpose).toBe('equipment purchase');
    expect(form.businessName).toBe('Acme Pty Ltd');
    expect(form.industry).toBe('Manufacturing');
    expect(form.revenue).toBe(5_000_000);
    expect(form.employees).toBe(18);
    expect(form.yearsInBusiness).toBe(6);
    expect(form.beeLevel).toBe(2);
  });

  it('falls back to product param when no recommendedProduct extracted', () => {
    const product: any = { id: 'P-WC', name: 'WC' };
    const form = extractedToAppForm(buildExtracted(), product, null);
    expect(form.product).toBe('P-WC');
  });

  it('extracted recommendedProduct beats product param', () => {
    const product: any = { id: 'P-DEFAULT' };
    const extracted = buildExtracted({ recommendedProduct: 'P-EQUIPMENT' });
    const form = extractedToAppForm(extracted, product, null);
    expect(form.product).toBe('P-EQUIPMENT');
  });

  it('falls back to customer fields when no extracted values', () => {
    const customer: any = {
      id: 'C-001',
      name: 'Existing Co',
      industry: 'Retail',
      revenue: 2_000_000,
      employees: 8,
      years: 5,
      beeLevel: 4,
    };
    const form = extractedToAppForm(buildExtracted(), null, customer);
    expect(form.custId).toBe('C-001');
    expect(form.businessName).toBe('Existing Co');
    expect(form.industry).toBe('Retail');
    expect(form.revenue).toBe(2_000_000);
    expect(form.employees).toBe(8);
    expect(form.yearsInBusiness).toBe(5);
    expect(form.beeLevel).toBe(4);
  });

  it('extracted values override customer fallback', () => {
    const customer: any = { id: 'C-001', name: 'Existing', revenue: 1_000_000 };
    const extracted = buildExtracted({ revenue: 3_000_000, businessName: 'New Name' });
    const form = extractedToAppForm(extracted, null, customer);
    expect(form.businessName).toBe('New Name');
    expect(form.revenue).toBe(3_000_000);
    expect(form.custId).toBe('C-001'); // not overridden
  });
});

// ═══ getRequiredDocuments ═══

describe('getRequiredDocuments', () => {
  it('returns the 6 mandatory base FICA/KYB documents for any application', () => {
    const docs = getRequiredDocuments(null, 0);
    const mandatoryTypes = docs.filter((d) => d.mandatory).map((d) => d.type);
    expect(mandatoryTypes).toContain('sa_id');
    expect(mandatoryTypes).toContain('proof_of_address');
    expect(mandatoryTypes).toContain('cipc');
    expect(mandatoryTypes).toContain('bank_confirm');
    expect(mandatoryTypes).toContain('financials');
    expect(mandatoryTypes).toContain('business_plan');
  });

  it('every base document has a non-empty reason', () => {
    const docs = getRequiredDocuments(null, 0);
    for (const doc of docs) {
      expect(doc.reason).toBeTruthy();
      expect(doc.label).toBeTruthy();
      expect(doc.type).toBeTruthy();
    }
  });

  it('BEE certificate is mandatory when beeLevel ≤ 4', () => {
    const docs = getRequiredDocuments(null, 2);
    const bee = docs.find((d) => d.type === 'bee_cert');
    expect(bee).toBeDefined();
    expect(bee!.mandatory).toBe(true);
  });

  it('BEE certificate is optional when beeLevel > 4', () => {
    const docs = getRequiredDocuments(null, 6);
    const bee = docs.find((d) => d.type === 'bee_cert');
    expect(bee).toBeDefined();
    expect(bee!.mandatory).toBe(false);
  });

  it('BEE certificate is optional when beeLevel = 0 (unknown)', () => {
    const docs = getRequiredDocuments(null, 0);
    const bee = docs.find((d) => d.type === 'bee_cert');
    expect(bee).toBeDefined();
    expect(bee!.mandatory).toBe(false);
  });

  it('Tax clearance is always optional', () => {
    const docs1 = getRequiredDocuments(null, 0);
    const docs2 = getRequiredDocuments(null, 4);
    const tax1 = docs1.find((d) => d.type === 'tax_clearance');
    const tax2 = docs2.find((d) => d.type === 'tax_clearance');
    expect(tax1?.mandatory).toBe(false);
    expect(tax2?.mandatory).toBe(false);
  });

  it('collateral document required for amortising loans above R500,000', () => {
    const product: any = { repaymentType: 'Amortising', maxAmount: 1_000_000 };
    const docs = getRequiredDocuments(product, 4);
    const collateral = docs.find((d) => d.type === 'collateral');
    expect(collateral).toBeDefined();
    expect(collateral!.mandatory).toBe(true);
  });

  it('collateral NOT required for amortising loans at or below R500,000', () => {
    const product: any = { repaymentType: 'Amortising', maxAmount: 500_000 };
    const docs = getRequiredDocuments(product, 4);
    const collateral = docs.find((d) => d.type === 'collateral');
    expect(collateral).toBeUndefined();
  });

  it('collateral NOT required for non-amortising products regardless of amount', () => {
    const product: any = { repaymentType: 'Bullet', maxAmount: 5_000_000 };
    const docs = getRequiredDocuments(product, 4);
    const collateral = docs.find((d) => d.type === 'collateral');
    expect(collateral).toBeUndefined();
  });

  it('returns at least 8 documents for a typical SME application', () => {
    // Empowerment SME (BEE level 2) applying for amortising loan above R500k
    const product: any = { repaymentType: 'Amortising', maxAmount: 1_500_000 };
    const docs = getRequiredDocuments(product, 2);
    expect(docs.length).toBeGreaterThanOrEqual(8);
  });

  it('document list has stable structure (label + type + mandatory + reason)', () => {
    const docs = getRequiredDocuments(null, 4);
    for (const doc of docs) {
      expect(typeof doc.type).toBe('string');
      expect(typeof doc.label).toBe('string');
      expect(typeof doc.mandatory).toBe('boolean');
      expect(typeof doc.reason).toBe('string');
    }
  });
});
