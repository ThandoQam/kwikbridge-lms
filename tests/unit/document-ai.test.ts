/**
 * Unit tests for document-ai module.
 *
 * Document verification powers KYC/KYB compliance — incorrect type
 * detection or false-match verification creates regulatory exposure
 * (FICA breaches) and operational risk. These tests pin the
 * detection patterns and verification logic against representative
 * SA document samples.
 */

import { describe, it, expect } from 'vitest';
import {
  detectDocumentType,
  verifyExtraction,
  extractedToFinancials,
} from '../../src/lib/document-ai';

// ═══ detectDocumentType ═══

describe('detectDocumentType', () => {
  it('detects SA ID document', () => {
    const text = 'REPUBLIC OF SOUTH AFRICA\nIDENTITY DOCUMENT\nDepartment of Home Affairs\nIdentity Number: 8501234567083';
    const result = detectDocumentType(text);
    expect(result.type).toBe('sa_id');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects CIPC company registration', () => {
    const text = 'Companies and Intellectual Property Commission\nRegistration Certificate\nCK Number: 2019/123456/07\nCompany Registration: ACTIVE';
    const result = detectDocumentType(text);
    expect(result.type).toBe('cipc');
  });

  it('detects bank confirmation letter', () => {
    const text = 'Bank Confirmation\nAccount Holder: Test Pty Ltd\nBanking Details\nAccount confirmation as at...';
    const result = detectDocumentType(text);
    expect(result.type).toBe('bank_confirm');
  });

  it('detects financial statements', () => {
    const text = 'Annual Financial Statements\nIncome Statement\nBalance Sheet\nStatement of Comprehensive Income';
    const result = detectDocumentType(text);
    expect(result.type).toBe('financials');
  });

  it('detects BEE certificate', () => {
    const text = 'B-BBEE Verification Certificate\nBroad-Based Black Economic Empowerment\nBEE Level 2 Contributor';
    const result = detectDocumentType(text);
    expect(result.type).toBe('bee_cert');
  });

  it('detects tax clearance', () => {
    const text = 'SARS Tax Clearance Certificate\nSouth African Revenue Service\nTax Compliance Status: GOOD';
    const result = detectDocumentType(text);
    expect(result.type).toBe('tax_clearance');
  });

  it('returns "other" for unrelated text', () => {
    const text = 'This is a general business letter with no specific document indicators.';
    const result = detectDocumentType(text);
    expect(result.type).toBe('other');
    expect(result.confidence).toBe(0);
  });

  it('is case-insensitive', () => {
    const upper = 'IDENTITY DOCUMENT FROM THE DEPARTMENT OF HOME AFFAIRS';
    const lower = 'identity document from the department of home affairs';
    expect(detectDocumentType(upper).type).toBe(detectDocumentType(lower).type);
  });

  it('confidence scales with pattern match count', () => {
    const oneMatch = 'identity number is somewhere on this page';
    const manyMatches =
      'IDENTITY DOCUMENT\nidentity number\nDepartment of Home Affairs\nRepublic of South Africa\nID Document';
    const r1 = detectDocumentType(oneMatch);
    const r2 = detectDocumentType(manyMatches);
    expect(r2.confidence).toBeGreaterThan(r1.confidence);
  });

  it('caps confidence at 1.0', () => {
    const allPatterns = 'identity id document department of home affairs identity number republic of south africa';
    const result = detectDocumentType(allPatterns);
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });
});

// ═══ verifyExtraction ═══

describe('verifyExtraction', () => {
  const buildExtraction = (overrides: any = {}): any => ({
    documentType: 'sa_id',
    extractedFields: {},
    confidence: 0.9,
    ...overrides,
  });

  it('verifies SA ID number match', () => {
    const extraction = buildExtraction({
      documentType: 'sa_id',
      extractedFields: {
        idNumber: { value: '8501234567083', confidence: 0.95 },
        fullName: { value: 'JOHN SMITH', confidence: 0.92 },
      },
    });
    const customer = { idNum: '8501234567083', name: 'John Smith' };
    const result = verifyExtraction(extraction, customer, {});
    expect(result.documentType).toBe('sa_id');
    expect(result.checks).toHaveLength(2);
    expect(result.checks.every((c) => c.match)).toBe(true);
    expect(result.overallStatus).toBe('verified');
    expect(result.autoVerified).toBe(true);
  });

  it('flags ID number mismatch', () => {
    const extraction = buildExtraction({
      documentType: 'sa_id',
      extractedFields: {
        idNumber: { value: '9999999999999', confidence: 0.95 },
      },
    });
    const customer = { idNum: '8501234567083' };
    const result = verifyExtraction(extraction, customer, {});
    const idCheck = result.checks.find((c) => c.field === 'idNumber')!;
    expect(idCheck.match).toBe(false);
    expect(result.overallStatus).toBe('mismatch');
  });

  it('verifies CIPC registration number ignoring whitespace', () => {
    const extraction = buildExtraction({
      documentType: 'cipc',
      extractedFields: {
        regNumber: { value: '2019 / 123456 / 07', confidence: 0.9 },
      },
    });
    const customer = { regNum: '2019/123456/07' };
    const result = verifyExtraction(extraction, customer, {});
    const regCheck = result.checks.find((c) => c.field === 'regNumber')!;
    expect(regCheck.match).toBe(true);
  });

  it('verifies BEE level match', () => {
    const extraction = buildExtraction({
      documentType: 'bee_cert',
      extractedFields: {
        beeLevel: { value: '2', confidence: 0.88 },
      },
    });
    const customer = { beeLevel: 2 };
    const result = verifyExtraction(extraction, customer, {});
    const levelCheck = result.checks.find((c) => c.field === 'beeLevel')!;
    expect(levelCheck.match).toBe(true);
    expect(result.overallStatus).toBe('verified');
  });

  it('flags BEE level mismatch', () => {
    const extraction = buildExtraction({
      documentType: 'bee_cert',
      extractedFields: {
        beeLevel: { value: '5', confidence: 0.88 },
      },
    });
    const customer = { beeLevel: 2 };
    const result = verifyExtraction(extraction, customer, {});
    expect(result.overallStatus).toBe('mismatch');
  });

  it('returns review_required when no checks possible', () => {
    const extraction = buildExtraction({
      documentType: 'tax_clearance',
      extractedFields: {},
    });
    const result = verifyExtraction(extraction, {}, {});
    expect(result.checks).toHaveLength(0);
    expect(result.overallStatus).toBe('review_required');
    expect(result.autoVerified).toBe(false);
  });

  it('autoVerified requires high confidence (≥ 0.8)', () => {
    const extraction = buildExtraction({
      documentType: 'sa_id',
      extractedFields: {
        idNumber: { value: '8501234567083', confidence: 0.65 }, // below 0.8
      },
    });
    const customer = { idNum: '8501234567083' };
    const result = verifyExtraction(extraction, customer, {});
    expect(result.checks[0].match).toBe(true);
    // overallStatus is verified (match) but autoVerified is false (confidence too low)
    expect(result.autoVerified).toBe(false);
  });

  it('partial name match counts as match (first-name basis)', () => {
    const extraction = buildExtraction({
      documentType: 'sa_id',
      extractedFields: {
        idNumber: { value: '8501234567083', confidence: 0.95 },
        fullName: { value: 'JOHN MICHAEL SMITH', confidence: 0.9 },
      },
    });
    const customer = { idNum: '8501234567083', name: 'John Smith' };
    const result = verifyExtraction(extraction, customer, {});
    const nameCheck = result.checks.find((c) => c.field === 'fullName')!;
    expect(nameCheck.match).toBe(true);
  });

  it('returns documentId from passed document', () => {
    const result = verifyExtraction(
      buildExtraction({ documentType: 'other' }),
      {},
      { id: 'DOC-123' }
    );
    expect(result.documentId).toBe('DOC-123');
  });
});

// ═══ extractedToFinancials ═══

describe('extractedToFinancials', () => {
  it('returns empty object for non-financials documents', () => {
    const extraction: any = { documentType: 'sa_id', extractedFields: {} };
    expect(extractedToFinancials(extraction)).toEqual({});
  });

  it('parses revenue from extracted financials', () => {
    const extraction: any = {
      documentType: 'financials',
      extractedFields: {
        revenue: { value: '15000000', confidence: 0.9 },
        netProfit: { value: '2500000', confidence: 0.85 },
      },
    };
    const result = extractedToFinancials(extraction);
    expect(result.revenue).toBe(15_000_000);
    expect(result.netProfit).toBe(2_500_000);
  });

  it('returns zero for missing fields', () => {
    const extraction: any = {
      documentType: 'financials',
      extractedFields: {},
    };
    const result = extractedToFinancials(extraction);
    expect(result.revenue).toBe(0);
    expect(result.netProfit).toBe(0);
    expect(result.totalAssets).toBe(0);
    expect(result.totalLiabilities).toBe(0);
    expect(result.currentAssets).toBe(0);
    expect(result.currentLiabilities).toBe(0);
  });

  it('coerces non-numeric strings to 0', () => {
    const extraction: any = {
      documentType: 'financials',
      extractedFields: {
        revenue: { value: 'not a number', confidence: 0.5 },
      },
    };
    const result = extractedToFinancials(extraction);
    expect(result.revenue).toBe(0);
  });

  it('handles all 6 financial fields', () => {
    const extraction: any = {
      documentType: 'financials',
      extractedFields: {
        revenue: { value: '10000', confidence: 0.9 },
        netProfit: { value: '2000', confidence: 0.9 },
        totalAssets: { value: '50000', confidence: 0.9 },
        totalLiabilities: { value: '20000', confidence: 0.9 },
        currentAssets: { value: '15000', confidence: 0.9 },
        currentLiabilities: { value: '8000', confidence: 0.9 },
      },
    };
    const result = extractedToFinancials(extraction);
    expect(Object.keys(result)).toHaveLength(6);
    expect(result.revenue).toBe(10_000);
    expect(result.totalAssets).toBe(50_000);
    expect(result.currentLiabilities).toBe(8_000);
  });
});
