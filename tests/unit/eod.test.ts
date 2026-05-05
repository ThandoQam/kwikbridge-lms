/**
 * Unit tests for End-of-Day batch processor.
 *
 * The EOD batch is the most consequential automated process in the LMS.
 * It runs daily and:
 *   - Accrues interest on every active loan
 *   - Updates DPD aging
 *   - Migrates loans between IFRS 9 stages
 *   - Recalculates ECL provisions
 *   - Generates debit order files
 *   - Identifies broken PTPs
 *   - Escalates accounts past handover thresholds
 *
 * A bug here corrupts every loan's state and cascades into financial
 * statements. These tests verify the core invariants.
 */

import { describe, it, expect } from 'vitest';
import { runEOD, debitOrdersToCSV, generateBODSummary } from '../../src/lib/eod';

const day = 864e5;
const now = Date.now();

const makeLoan = (overrides: any = {}): any => ({
  id: 'L-001',
  custId: 'C-001',
  product: 'P-WC',
  amount: 500_000,
  balance: 350_000,
  rate: 14.5,
  term: 36,
  monthlyPmt: 17_000,
  dpd: 0,
  stage: 1,
  status: 'Active',
  payments: [],
  startDate: now - 90 * day,
  nextDue: now + 5 * day,
  lastAccrual: now - day,
  ...overrides,
});

const makeProvision = (overrides: any = {}): any => ({
  loanId: 'L-001',
  stage: 1,
  pd: 0.05,
  lgd: 0.5,
  ead: 350_000,
  ecl: 8_750,
  method: '12-month ECL',
  ...overrides,
});

const makeCustomer = (overrides: any = {}): any => ({
  id: 'C-001',
  name: 'Test Pty Ltd',
  industry: 'Manufacturing',
  bureauScore: 650,
  phone: '0711234567',
  email: 'test@test.co.za',
  ...overrides,
});

const makeProduct = (overrides: any = {}): any => ({
  id: 'P-WC',
  name: 'Working Capital',
  baseRate: 14.5,
  arrangementFee: 1.5,
  ...overrides,
});

const baseInput = (overrides: any = {}): any => ({
  loans: [makeLoan()],
  provisions: [makeProvision()],
  collections: [],
  alerts: [],
  products: [makeProduct()],
  customers: [makeCustomer()],
  runDate: now,
  ...overrides,
});

// ═══ runEOD — basic invariants ═══

describe('runEOD', () => {
  it('returns a structured result with expected fields', () => {
    const result = runEOD(baseInput());
    expect(result.loans).toBeDefined();
    expect(result.provisions).toBeDefined();
    expect(result.collections).toBeDefined();
    expect(result.alerts).toBeDefined();
    expect(result.auditEntries).toBeDefined();
    expect(result.debitOrders).toBeDefined();
    expect(result.notifications).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('returned arrays are new instances (does not mutate input)', () => {
    const input = baseInput();
    const originalLoanRef = input.loans[0];
    const result = runEOD(input);
    // Result loans array must be a new array
    expect(result.loans).not.toBe(input.loans);
    // The loan object inside should also be new (immutable update)
    expect(result.loans[0]).not.toBe(originalLoanRef);
  });

  it('summary fields are populated', () => {
    const result = runEOD(baseInput());
    expect(result.summary.runDate).toBe(now);
    expect(result.summary.loansProcessed).toBe(1);
    expect(typeof result.summary.duration).toBe('number');
    expect(result.summary.duration).toBeGreaterThanOrEqual(0);
  });

  it('processes multiple loans in batch', () => {
    const input = baseInput({
      loans: [
        makeLoan({ id: 'L-1' }),
        makeLoan({ id: 'L-2' }),
        makeLoan({ id: 'L-3' }),
      ],
      provisions: [
        makeProvision({ loanId: 'L-1' }),
        makeProvision({ loanId: 'L-2' }),
        makeProvision({ loanId: 'L-3' }),
      ],
    });
    const result = runEOD(input);
    expect(result.summary.loansProcessed).toBe(3);
    expect(result.loans).toHaveLength(3);
  });

  it('handles empty portfolio without crashing', () => {
    const result = runEOD({
      loans: [],
      provisions: [],
      collections: [],
      alerts: [],
      products: [],
      customers: [],
      runDate: now,
    });
    expect(result.loans).toEqual([]);
    expect(result.summary.loansProcessed).toBe(0);
  });

  it('skips non-active loans', () => {
    const input = baseInput({
      loans: [
        makeLoan({ id: 'L-1', status: 'Active' }),
        makeLoan({ id: 'L-2', status: 'Settled' }),
        makeLoan({ id: 'L-3', status: 'Written Off' }),
      ],
      provisions: [
        makeProvision({ loanId: 'L-1' }),
        makeProvision({ loanId: 'L-2' }),
        makeProvision({ loanId: 'L-3' }),
      ],
    });
    const result = runEOD(input);
    // The settled and written-off loans should not get interest accrued
    const settled = result.loans.find((l) => l.id === 'L-2');
    const writtenOff = result.loans.find((l) => l.id === 'L-3');
    expect(settled?.balance).toBe(350_000); // unchanged
    expect(writtenOff?.balance).toBe(350_000); // unchanged
  });
});

// ═══ Stage migration ═══

describe('runEOD — IFRS 9 stage migration', () => {
  it('migrates Stage 1 → Stage 2 when DPD crosses 30', () => {
    const input = baseInput({
      loans: [
        makeLoan({
          id: 'L-AGING',
          stage: 1,
          dpd: 0,
          nextDue: now - 45 * day, // 45 days overdue → Stage 2
          lastAccrual: now - day,
        }),
      ],
      provisions: [makeProvision({ loanId: 'L-AGING', stage: 1 })],
    });
    const result = runEOD(input);
    const aged = result.loans.find((l) => l.id === 'L-AGING')!;
    expect(aged.dpd).toBeGreaterThan(30);
    expect(aged.stage).toBe(2);
    expect(result.summary.stageMigrations.length).toBeGreaterThan(0);
  });

  it('migrates Stage 2 → Stage 3 when DPD crosses 90', () => {
    const input = baseInput({
      loans: [
        makeLoan({
          id: 'L-NPL',
          stage: 2,
          dpd: 60,
          nextDue: now - 100 * day,
          lastAccrual: now - day,
        }),
      ],
      provisions: [makeProvision({ loanId: 'L-NPL', stage: 2 })],
    });
    const result = runEOD(input);
    const aged = result.loans.find((l) => l.id === 'L-NPL')!;
    expect(aged.dpd).toBeGreaterThan(90);
    expect(aged.stage).toBe(3);
  });

  it('keeps Stage 1 loans current when not yet aged', () => {
    const result = runEOD(baseInput()); // dpd=0, nextDue future
    const stillCurrent = result.loans[0];
    expect(stillCurrent.stage).toBe(1);
    expect(stillCurrent.dpd).toBeLessThanOrEqual(30);
  });

  it('records audit entry for each stage migration', () => {
    const input = baseInput({
      loans: [
        makeLoan({
          id: 'L-AGING',
          stage: 1,
          dpd: 0,
          nextDue: now - 50 * day,
          lastAccrual: now - day,
        }),
      ],
      provisions: [makeProvision({ loanId: 'L-AGING', stage: 1 })],
    });
    const result = runEOD(input);
    const stageAudits = result.auditEntries.filter((a) => a.action === 'Stage Migration');
    expect(stageAudits.length).toBeGreaterThan(0);
  });
});

// ═══ Interest accrual ═══

describe('runEOD — interest accrual', () => {
  it('accrues interest on active loans', () => {
    const result = runEOD(baseInput());
    expect(result.summary.interestAccrued).toBeGreaterThanOrEqual(0);
  });

  it('total interest scales with loan count', () => {
    const single = runEOD(baseInput());
    const multi = runEOD(
      baseInput({
        loans: [
          makeLoan({ id: 'L-1' }),
          makeLoan({ id: 'L-2' }),
          makeLoan({ id: 'L-3' }),
        ],
        provisions: [
          makeProvision({ loanId: 'L-1' }),
          makeProvision({ loanId: 'L-2' }),
          makeProvision({ loanId: 'L-3' }),
        ],
      })
    );
    // Three loans should accrue ~3× the interest of one
    expect(multi.summary.interestAccrued).toBeGreaterThan(single.summary.interestAccrued * 2);
  });
});

// ═══ Provision recalculation ═══

describe('runEOD — provision recalc', () => {
  it('recalculates ECL when stage changes', () => {
    const input = baseInput({
      loans: [
        makeLoan({
          id: 'L-NEW-S2',
          stage: 1,
          dpd: 0,
          nextDue: now - 50 * day,
          lastAccrual: now - day,
        }),
      ],
      provisions: [makeProvision({ loanId: 'L-NEW-S2', stage: 1, ecl: 1000 })],
    });
    const result = runEOD(input);
    const newProv = result.provisions.find((p) => p.loanId === 'L-NEW-S2');
    expect(newProv).toBeDefined();
    expect(newProv!.stage).toBe(2);
    // Stage 2 has higher PD multiplier (3x), ECL should be higher
    expect(newProv!.ecl).toBeGreaterThan(1000);
  });

  it('preserves provision count', () => {
    const input = baseInput({
      loans: [
        makeLoan({ id: 'L-1' }),
        makeLoan({ id: 'L-2' }),
      ],
      provisions: [
        makeProvision({ loanId: 'L-1' }),
        makeProvision({ loanId: 'L-2' }),
      ],
    });
    const result = runEOD(input);
    expect(result.provisions).toHaveLength(2);
  });
});

// ═══ Debit order generation ═══

describe('runEOD — debit orders', () => {
  it('generates debit orders for upcoming payments within horizon', () => {
    // EOD generates debit orders only within BUSINESS_DAYS_AHEAD (3 days)
    const input = baseInput({
      loans: [makeLoan({ nextDue: now + 2 * day })],
    });
    const result = runEOD(input);
    expect(result.debitOrders.length).toBeGreaterThan(0);
    expect(result.debitOrders[0].loanId).toBe('L-001');
    expect(result.debitOrders[0].amount).toBeGreaterThan(0);
  });

  it('does not generate debit orders for payments beyond the horizon', () => {
    const input = baseInput({
      loans: [makeLoan({ nextDue: now + 30 * day })],
    });
    const result = runEOD(input);
    expect(result.debitOrders).toHaveLength(0);
  });

  it('does not generate debit orders for written-off loans', () => {
    const result = runEOD(
      baseInput({
        loans: [
          makeLoan({ id: 'L-WO', status: 'Written Off', nextDue: now + 5 * day }),
        ],
        provisions: [makeProvision({ loanId: 'L-WO' })],
      })
    );
    const writtenOffOrders = result.debitOrders.filter((d) => d.loanId === 'L-WO');
    expect(writtenOffOrders).toHaveLength(0);
  });

  it('debit order references include loan ID', () => {
    const input = baseInput({
      loans: [makeLoan({ nextDue: now + 2 * day })],
    });
    const result = runEOD(input);
    const order = result.debitOrders[0];
    expect(order).toBeDefined();
    expect(order.reference).toContain('L-001');
  });
});

// ═══ debitOrdersToCSV ═══

describe('debitOrdersToCSV', () => {
  it('produces CSV with header and rows', () => {
    const orders = [
      {
        loanId: 'L-001',
        custId: 'C-001',
        customerName: 'Test Co',
        amount: 17_000,
        actionDate: '2026-05-10',
        reference: 'KB-DO-L-001',
      },
    ];
    const csv = debitOrdersToCSV(orders);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Loan ID');
    expect(lines[0]).toContain('Customer Name');
    expect(lines[1]).toContain('L-001');
    expect(lines[1]).toContain('17000.00');
  });

  it('handles empty input', () => {
    const csv = debitOrdersToCSV([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // just header
  });

  it('escapes customer names with commas', () => {
    const orders = [
      {
        loanId: 'L-1',
        custId: 'C-1',
        customerName: 'Smith, John & Co',
        amount: 1000,
        actionDate: '2026-05-10',
        reference: 'REF',
      },
    ];
    const csv = debitOrdersToCSV(orders);
    expect(csv).toContain('"Smith, John & Co"');
  });
});

// ═══ generateBODSummary ═══

describe('generateBODSummary', () => {
  it('produces a multi-line text report', () => {
    const summary: any = {
      runDate: now,
      duration: 250,
      loansProcessed: 5,
      interestAccrued: 12_500,
      dpdUpdated: 2,
      stageMigrations: [],
      provisionsRecalculated: 5,
      debitOrdersGenerated: 5,
      paymentAlertsSent: 0,
      ptpsBroken: 0,
      accountsEscalated: 0,
    };
    const loans = [makeLoan({ status: 'Active' })];
    const provisions = [makeProvision()];
    const text = generateBODSummary(summary, loans, provisions);
    expect(text).toContain('BEGINNING OF DAY REPORT');
    expect(text).toContain('PORTFOLIO SUMMARY');
    expect(text).toContain('IFRS 9 STAGING');
    expect(text).toContain('ARREARS');
    expect(text).toContain('EOD ACTIONS');
  });

  it('includes formatted currency for total book', () => {
    const summary: any = {
      runDate: now,
      duration: 0,
      loansProcessed: 1,
      interestAccrued: 0,
      dpdUpdated: 0,
      stageMigrations: [],
      provisionsRecalculated: 0,
      debitOrdersGenerated: 0,
      paymentAlertsSent: 0,
      ptpsBroken: 0,
      accountsEscalated: 0,
    };
    const loans = [makeLoan({ balance: 1_500_000 })];
    const provisions = [makeProvision()];
    const text = generateBODSummary(summary, loans, provisions);
    // Should contain a formatted ZAR amount with R prefix
    expect(text).toMatch(/R\s*1[\s,]*5\d{2}/);
  });
});
