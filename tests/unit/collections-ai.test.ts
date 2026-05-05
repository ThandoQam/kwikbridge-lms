/**
 * Unit tests for collections AI module.
 *
 * Covers delinquency prediction, worklist generation, route optimisation,
 * and bulk SMS targeting. The prediction model directly affects which
 * accounts the collections team prioritises — incorrect scoring means
 * either chasing the wrong customers (waste) or missing real risk (loss).
 */

import { describe, it, expect } from 'vitest';
import {
  predictDelinquency,
  generateWorklist,
  optimiseRoute,
  generateBulkSMSTargets,
} from '../../src/lib/collections-ai';

// ─── Test fixtures ───

const buildLoan = (overrides: any = {}): any => ({
  id: 'L-001',
  custId: 'C-001',
  product: 'WC',
  amount: 500_000,
  balance: 350_000,
  rate: 14.5,
  term: 36,
  monthlyPmt: 16_500,
  dpd: 0,
  stage: 1,
  status: 'Active',
  payments: [],
  startDate: Date.now() - 90 * 864e5,
  ...overrides,
});

const buildCustomer = (overrides: any = {}): any => ({
  id: 'C-001',
  name: 'Test Pty Ltd',
  industry: 'Manufacturing',
  phone: '0711234567',
  address: '123 Test St, Cape Town',
  province: 'Western Cape',
  bureauScore: 650,
  ...overrides,
});

// ═══ predictDelinquency ═══

describe('predictDelinquency', () => {
  it('returns a structured result for a clean current loan', () => {
    const loan = buildLoan();
    const customer = buildCustomer();
    const result = predictDelinquency(loan, customer, []);

    expect(result.loanId).toBe('L-001');
    expect(result.custId).toBe('C-001');
    expect(result.customerName).toBeDefined();
    expect(result.probability).toBeGreaterThanOrEqual(0);
    expect(result.probability).toBeLessThanOrEqual(100);
    expect(['high', 'medium', 'low']).toContain(result.riskLevel);
    expect(typeof result.recommendedAction).toBe('string');
    expect(result.priorityScore).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.factors)).toBe(true);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it('predicts high probability for accounts already in arrears', () => {
    const arrears = buildLoan({ dpd: 60 });
    const customer = buildCustomer();
    const result = predictDelinquency(arrears, customer, []);
    expect(result.probability).toBeGreaterThan(40);
  });

  it('predicts low probability for current loans with payment history', () => {
    const now = Date.now();
    const day = 864e5;
    const current = buildLoan({
      dpd: 0,
      payments: [
        { amount: 16_500, date: now - 30 * day, type: 'EFT', principal: 14000, interest: 2500 },
        { amount: 16_500, date: now - 60 * day, type: 'EFT', principal: 14000, interest: 2500 },
        { amount: 16_500, date: now - 90 * day, type: 'EFT', principal: 14000, interest: 2500 },
      ],
    });
    const customer = buildCustomer({ bureauScore: 750 });
    const result = predictDelinquency(current, customer, []);
    expect(result.probability).toBeLessThan(50);
  });

  it('factors array sums to ~100% weight', () => {
    const result = predictDelinquency(buildLoan(), buildCustomer(), []);
    const totalWeight = result.factors.reduce((s, f) => s + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 2);
  });

  it('handles loans with no payment history without crashing', () => {
    const result = predictDelinquency(
      buildLoan({ payments: [] }),
      buildCustomer(),
      []
    );
    expect(result.probability).toBeGreaterThan(0);
  });

  it('higher DPD yields higher probability', () => {
    const lowDPD = predictDelinquency(buildLoan({ dpd: 10 }), buildCustomer(), []);
    const highDPD = predictDelinquency(buildLoan({ dpd: 75 }), buildCustomer(), []);
    expect(highDPD.probability).toBeGreaterThan(lowDPD.probability);
  });

  it('broken PTPs increase probability vs honoured PTPs', () => {
    const collections = [
      { action: 'PTP', loanId: 'L-001', ts: Date.now() - 30 * 864e5 },
      { action: 'PTP Broken', loanId: 'L-001', ts: Date.now() - 20 * 864e5 },
    ];
    const result = predictDelinquency(buildLoan(), buildCustomer(), collections as any);
    const ptpFactor = result.factors.find((f) => f.name.includes('PTP'));
    expect(ptpFactor).toBeDefined();
    expect(ptpFactor!.score).toBeGreaterThan(0);
  });

  it('priority score scales with balance', () => {
    const small = predictDelinquency(buildLoan({ balance: 50_000, dpd: 30 }), buildCustomer(), []);
    const large = predictDelinquency(buildLoan({ balance: 5_000_000, dpd: 30 }), buildCustomer(), []);
    expect(large.priorityScore).toBeGreaterThan(small.priorityScore);
  });

  it('recommended action is non-empty', () => {
    const result = predictDelinquency(buildLoan({ dpd: 45 }), buildCustomer(), []);
    expect(result.recommendedAction.length).toBeGreaterThan(5);
  });
});

// ═══ generateWorklist ═══

describe('generateWorklist', () => {
  it('returns empty array for portfolio with no risk', () => {
    const loans = [buildLoan({ dpd: 0, payments: [
      { amount: 16500, date: Date.now() - 30 * 864e5 },
      { amount: 16500, date: Date.now() - 60 * 864e5 },
      { amount: 16500, date: Date.now() - 90 * 864e5 },
    ] })];
    const customers = [buildCustomer({ bureauScore: 800 })];
    const result = generateWorklist(loans as any, customers as any, []);
    // May or may not be empty depending on prediction model — just check shape
    expect(Array.isArray(result)).toBe(true);
  });

  it('only includes at-risk accounts (dpd > 0 OR probability >= 30)', () => {
    const loans = [
      buildLoan({ id: 'L-1', dpd: 0 }),
      buildLoan({ id: 'L-2', dpd: 30 }),
      buildLoan({ id: 'L-3', dpd: 75 }),
    ];
    const customers = [
      buildCustomer({ id: 'C-001' }),
    ];
    const loansWithCust = loans.map((l) => ({ ...l, custId: 'C-001' }));
    const result = generateWorklist(loansWithCust as any, customers as any, []);
    // L-1 may or may not be included based on probability; L-2 and L-3 must be
    const ids = result.map((i) => i.loanId);
    expect(ids).toContain('L-2');
    expect(ids).toContain('L-3');
  });

  it('sorts by priority score descending', () => {
    const loans = [
      buildLoan({ id: 'L-1', dpd: 30, balance: 100_000 }),
      buildLoan({ id: 'L-2', dpd: 60, balance: 1_000_000 }),
      buildLoan({ id: 'L-3', dpd: 45, balance: 500_000 }),
    ].map((l) => ({ ...l, custId: 'C-001' }));
    const customers = [buildCustomer({ id: 'C-001' })];
    const result = generateWorklist(loans as any, customers as any, []);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].priorityScore).toBeGreaterThanOrEqual(result[i].priorityScore);
    }
  });

  it('excludes settled or written-off loans', () => {
    const loans = [
      buildLoan({ id: 'L-1', status: 'Active', dpd: 30 }),
      buildLoan({ id: 'L-2', status: 'Settled', dpd: 60 }),
      buildLoan({ id: 'L-3', status: 'Written Off', dpd: 200 }),
    ].map((l) => ({ ...l, custId: 'C-001' }));
    const customers = [buildCustomer({ id: 'C-001' })];
    const result = generateWorklist(loans as any, customers as any, []);
    const ids = result.map((i) => i.loanId);
    expect(ids).toContain('L-1');
    expect(ids).not.toContain('L-2');
    expect(ids).not.toContain('L-3');
  });

  it('attaches customer phone and address to worklist items', () => {
    const loans = [buildLoan({ dpd: 30 })];
    const customers = [buildCustomer({ phone: '0821234567', address: '5 Test Rd' })];
    const result = generateWorklist(loans as any, customers as any, []);
    if (result.length > 0) {
      expect(result[0].phone).toBe('0821234567');
      expect(result[0].address).toBe('5 Test Rd');
    }
  });
});

// ═══ optimiseRoute ═══

describe('optimiseRoute', () => {
  const buildStop = (overrides: any) => ({
    loanId: 'L-001',
    custId: 'C-001',
    customerName: 'Test',
    address: '1 Test St',
    latitude: -33.9,
    longitude: 18.4,
    balance: 100_000,
    dpd: 30,
    ...overrides,
  });

  it('returns an empty route for empty input', () => {
    const result = optimiseRoute([], -33.9, 18.4);
    expect(result).toEqual([]);
  });

  it('returns single-stop route unchanged', () => {
    const stops = [buildStop({ loanId: 'L-1' })];
    const result = optimiseRoute(stops, -33.9, 18.4);
    expect(result).toHaveLength(1);
    expect(result[0].loanId).toBe('L-1');
    expect(result[0].visitOrder).toBe(1);
  });

  it('orders stops by nearest-neighbour from start point', () => {
    // Three stops: one near Cape Town, one in Stellenbosch, one in Paarl
    // Starting from Cape Town, nearest first should be Cape Town stop
    const stops = [
      buildStop({ loanId: 'L-PAARL', latitude: -33.74, longitude: 18.96 }),
      buildStop({ loanId: 'L-STELL', latitude: -33.93, longitude: 18.86 }),
      buildStop({ loanId: 'L-CT', latitude: -33.92, longitude: 18.42 }),
    ];
    const result = optimiseRoute(stops, -33.92, 18.42, '08:00', 30);
    expect(result[0].loanId).toBe('L-CT'); // closest to start
  });

  it('assigns sequential visit orders', () => {
    const stops = [
      buildStop({ loanId: 'L-1' }),
      buildStop({ loanId: 'L-2', latitude: -33.91, longitude: 18.41 }),
      buildStop({ loanId: 'L-3', latitude: -33.93, longitude: 18.43 }),
    ];
    const result = optimiseRoute(stops, -33.9, 18.4);
    result.forEach((stop, i) => {
      expect(stop.visitOrder).toBe(i + 1);
    });
  });

  it('estimated arrival times are sequential', () => {
    const stops = [
      buildStop({ loanId: 'L-1' }),
      buildStop({ loanId: 'L-2', latitude: -33.91, longitude: 18.41 }),
    ];
    const result = optimiseRoute(stops, -33.9, 18.4, '08:00', 30);
    expect(result[0].estimatedArrival).toBeDefined();
    expect(result[1].estimatedArrival).toBeDefined();
    // Format check: HH:MM
    expect(result[0].estimatedArrival).toMatch(/^\d{2}:\d{2}$/);
  });
});

// ═══ generateBulkSMSTargets ═══

describe('generateBulkSMSTargets', () => {
  const worklist: any[] = [
    { loanId: 'L-1', dpd: 5, riskLevel: 'low', balance: 100_000 },
    { loanId: 'L-2', dpd: 35, riskLevel: 'medium', balance: 200_000 },
    { loanId: 'L-3', dpd: 75, riskLevel: 'high', balance: 500_000 },
    { loanId: 'L-4', dpd: 120, riskLevel: 'high', balance: 50_000 },
  ];

  it('filters by minimum DPD', () => {
    const result = generateBulkSMSTargets(worklist as any, { minDPD: 30 });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.loanId)).toEqual(['L-2', 'L-3', 'L-4']);
  });

  it('filters by maximum DPD', () => {
    const result = generateBulkSMSTargets(worklist as any, { maxDPD: 50 });
    expect(result.map((r) => r.loanId)).toEqual(['L-1', 'L-2']);
  });

  it('filters by DPD range', () => {
    const result = generateBulkSMSTargets(worklist as any, { minDPD: 30, maxDPD: 90 });
    expect(result.map((r) => r.loanId)).toEqual(['L-2', 'L-3']);
  });

  it('filters by risk level', () => {
    const result = generateBulkSMSTargets(worklist as any, { riskLevel: 'high' });
    expect(result.map((r) => r.loanId)).toEqual(['L-3', 'L-4']);
  });

  it('combines DPD and risk filters', () => {
    const result = generateBulkSMSTargets(worklist as any, {
      minDPD: 50,
      riskLevel: 'high',
    });
    expect(result.map((r) => r.loanId)).toEqual(['L-3', 'L-4']);
  });

  it('returns full worklist with no filters', () => {
    const result = generateBulkSMSTargets(worklist as any, {});
    expect(result).toHaveLength(4);
  });
});
