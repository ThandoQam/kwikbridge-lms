/**
 * Unit tests for stress testing engine.
 *
 * Stress testing is required by IFRS 9 and SARB regulators for
 * portfolio capital adequacy assessment. A bug in scenario application
 * or ECL calculation could under-state required provisions and breach
 * regulatory capital ratios. These tests pin the behaviour of the base
 * case, moderate and severe scenarios, plus the cross-stage aggregation.
 */

import { describe, it, expect } from 'vitest';
import {
  runScenario,
  runStressTest,
  STANDARD_SCENARIOS,
} from '../../src/lib/stress-test';

const buildLoan = (overrides: any = {}): any => ({
  id: 'L-001',
  custId: 'C-001',
  product: 'P-WC',
  amount: 500_000,
  balance: 350_000,
  status: 'Active',
  stage: 1,
  dpd: 0,
  rate: 14.5,
  term: 36,
  monthlyPmt: 17_000,
  payments: [],
  ...overrides,
});

const buildProvision = (overrides: any = {}): any => ({
  loanId: 'L-001',
  stage: 1,
  pd: 0.02,
  lgd: 0.25,
  ead: 350_000,
  ecl: 1_750,
  method: '12-month ECL',
  ...overrides,
});

const buildProduct = (overrides: any = {}): any => ({
  id: 'P-WC',
  name: 'Working Capital',
  s1PD: 0.02,
  lgd: 0.25,
  status: 'Active',
  ...overrides,
});

// ═══ STANDARD_SCENARIOS sanity ═══

describe('STANDARD_SCENARIOS', () => {
  it('exposes base, moderate, severe', () => {
    const ids = STANDARD_SCENARIOS.map((s) => s.id);
    expect(ids).toContain('base');
    expect(ids).toContain('moderate');
    expect(ids).toContain('severe');
  });

  it('base scenario applies no stress', () => {
    const base = STANDARD_SCENARIOS.find((s) => s.id === 'base')!;
    expect(base.pdMultiplier).toBe(1.0);
    expect(base.lgdMultiplier).toBe(1.0);
    expect(base.recoveryAdjustment).toBe(0);
  });

  it('moderate is between base and severe', () => {
    const moderate = STANDARD_SCENARIOS.find((s) => s.id === 'moderate')!;
    const severe = STANDARD_SCENARIOS.find((s) => s.id === 'severe')!;
    expect(moderate.pdMultiplier).toBeGreaterThan(1.0);
    expect(moderate.pdMultiplier).toBeLessThan(severe.pdMultiplier);
    expect(moderate.lgdMultiplier).toBeLessThan(severe.lgdMultiplier);
  });

  it('severe scenario applies maximum stress', () => {
    const severe = STANDARD_SCENARIOS.find((s) => s.id === 'severe')!;
    expect(severe.pdMultiplier).toBe(2.0);
    expect(severe.lgdMultiplier).toBe(1.5);
    expect(severe.recoveryAdjustment).toBe(0.30);
  });
});

// ═══ runScenario ═══

describe('runScenario', () => {
  const loans = [buildLoan({ id: 'L-1', balance: 100_000, stage: 1 })];
  const provisions = [buildProvision({ loanId: 'L-1', stage: 1 })];
  const products = [buildProduct()];

  it('returns a structured result', () => {
    const result = runScenario(loans, provisions, products, STANDARD_SCENARIOS[0]);
    expect(result.scenario.id).toBe('base');
    expect(result.totalECL).toBeGreaterThanOrEqual(0);
    expect(result.totalEAD).toBe(100_000);
    expect(result.coverageRatio).toBeGreaterThanOrEqual(0);
    expect(result.coverageRatio).toBeLessThanOrEqual(1);
    expect(result.byStage).toHaveLength(3); // stages 1, 2, 3
    expect(Array.isArray(result.byProduct)).toBe(true);
    expect(Array.isArray(result.loanDetails)).toBe(true);
  });

  it('base scenario produces zero capital impact', () => {
    const result = runScenario(loans, provisions, products, STANDARD_SCENARIOS[0]);
    expect(result.capitalImpact).toBeCloseTo(0, 2);
  });

  it('severe scenario produces positive capital impact', () => {
    const severe = STANDARD_SCENARIOS.find((s) => s.id === 'severe')!;
    const result = runScenario(loans, provisions, products, severe);
    expect(result.capitalImpact).toBeGreaterThan(0);
  });

  it('moderate impact is less than severe', () => {
    const moderate = runScenario(loans, provisions, products, STANDARD_SCENARIOS[1]);
    const severe = runScenario(loans, provisions, products, STANDARD_SCENARIOS[2]);
    expect(moderate.capitalImpact).toBeLessThan(severe.capitalImpact);
  });

  it('caps stressed PD at 1.0', () => {
    // Force a Stage 3 loan with high base PD
    const stage3Loans = [buildLoan({ id: 'L-3', stage: 3, balance: 100_000 })];
    const stage3Provs = [buildProvision({ loanId: 'L-3', stage: 3 })];
    // Base PD = 0.02 × 8.0 (stage 3 mult) = 0.16
    // Severe stress: 0.16 × 2.0 = 0.32 — well below 1.0
    // Force higher: increase product PD
    const highPdProduct = [buildProduct({ s1PD: 0.5 })];
    // Base PD = 0.5 × 8.0 = 4.0, stressed = 4.0 × 2.0 = 8.0 → capped to 1.0
    const severe = STANDARD_SCENARIOS[2];
    const result = runScenario(stage3Loans, stage3Provs, highPdProduct, severe);
    expect(result.loanDetails[0].stressedPD).toBeLessThanOrEqual(1.0);
  });

  it('caps stressed LGD at 1.0', () => {
    const products = [buildProduct({ lgd: 0.9 })];
    const severe = STANDARD_SCENARIOS[2];
    const result = runScenario(loans, provisions, products, severe);
    // 0.9 × 1.5 = 1.35 → should cap to 1.0
    expect(result.loanDetails[0].stressedLGD).toBeLessThanOrEqual(1.0);
  });

  it('only includes Active loans', () => {
    const mixed = [
      buildLoan({ id: 'L-A', status: 'Active', balance: 100_000 }),
      buildLoan({ id: 'L-S', status: 'Settled', balance: 100_000 }),
      buildLoan({ id: 'L-W', status: 'Written Off', balance: 100_000 }),
    ];
    const provs = mixed.map((l) => buildProvision({ loanId: l.id }));
    const result = runScenario(mixed, provs, products, STANDARD_SCENARIOS[0]);
    expect(result.totalEAD).toBe(100_000); // only active
    expect(result.loanDetails).toHaveLength(1);
  });

  it('aggregates by stage correctly', () => {
    const multi = [
      buildLoan({ id: 'L-1', stage: 1, balance: 100_000 }),
      buildLoan({ id: 'L-2', stage: 1, balance: 200_000 }),
      buildLoan({ id: 'L-3', stage: 2, balance: 150_000 }),
      buildLoan({ id: 'L-4', stage: 3, balance: 50_000 }),
    ];
    const provs = multi.map((l) => buildProvision({ loanId: l.id, stage: l.stage }));
    const result = runScenario(multi, provs, products, STANDARD_SCENARIOS[0]);
    const stage1 = result.byStage.find((s) => s.stage === 1)!;
    const stage2 = result.byStage.find((s) => s.stage === 2)!;
    const stage3 = result.byStage.find((s) => s.stage === 3)!;
    expect(stage1.count).toBe(2);
    expect(stage1.ead).toBe(300_000);
    expect(stage2.count).toBe(1);
    expect(stage2.ead).toBe(150_000);
    expect(stage3.count).toBe(1);
    expect(stage3.ead).toBe(50_000);
  });

  it('handles empty portfolio without crashing', () => {
    const result = runScenario([], [], [], STANDARD_SCENARIOS[0]);
    expect(result.totalECL).toBe(0);
    expect(result.totalEAD).toBe(0);
    expect(result.coverageRatio).toBe(0);
    expect(result.loanDetails).toEqual([]);
    expect(result.byStage.every((s) => s.count === 0)).toBe(true);
  });

  it('coverage ratio reflects ECL/EAD', () => {
    const result = runScenario(loans, provisions, products, STANDARD_SCENARIOS[0]);
    if (result.totalEAD > 0) {
      expect(result.coverageRatio).toBeCloseTo(result.totalECL / result.totalEAD, 4);
    }
  });

  it('loan details include base and stressed values', () => {
    const result = runScenario(loans, provisions, products, STANDARD_SCENARIOS[2]);
    const detail = result.loanDetails[0];
    expect(detail.basePD).toBeGreaterThan(0);
    expect(detail.stressedPD).toBeGreaterThanOrEqual(detail.basePD);
    expect(detail.baseLGD).toBeGreaterThan(0);
    expect(detail.stressedLGD).toBeGreaterThanOrEqual(detail.baseLGD);
    expect(detail.delta).toBeGreaterThanOrEqual(0);
  });

  it('Stage 3 loans have higher PD than Stage 1 (multiplier applied)', () => {
    const portfolio = [
      buildLoan({ id: 'L-S1', stage: 1, balance: 100_000 }),
      buildLoan({ id: 'L-S3', stage: 3, balance: 100_000 }),
    ];
    const provs = portfolio.map((l) => buildProvision({ loanId: l.id, stage: l.stage }));
    const result = runScenario(portfolio, provs, products, STANDARD_SCENARIOS[0]);
    const s1 = result.loanDetails.find((d) => d.loanId === 'L-S1')!;
    const s3 = result.loanDetails.find((d) => d.loanId === 'L-S3')!;
    expect(s3.basePD).toBeGreaterThan(s1.basePD);
  });
});

// ═══ runStressTest ═══

describe('runStressTest', () => {
  const loans = [buildLoan()];
  const provisions = [buildProvision()];
  const products = [buildProduct()];

  it('returns a structured run with all 3 standard scenarios', () => {
    const run = runStressTest(loans, provisions, products);
    expect(run.id).toMatch(/^ST-\d+$/);
    expect(run.runDate).toBeGreaterThan(0);
    expect(run.scenarios).toHaveLength(3);
    expect(run.scenarios.map((s) => s.scenario.id)).toEqual(['base', 'moderate', 'severe']);
  });

  it('records portfolio snapshot', () => {
    const run = runStressTest(loans, provisions, products);
    expect(run.portfolioSnapshot.totalLoans).toBe(1);
    expect(run.portfolioSnapshot.totalBookValue).toBe(350_000);
    expect(run.portfolioSnapshot.stage1Count).toBe(1);
    expect(run.portfolioSnapshot.stage2Count).toBe(0);
    expect(run.portfolioSnapshot.stage3Count).toBe(0);
  });

  it('runBy defaults to SYSTEM', () => {
    const run = runStressTest(loans, provisions, products);
    expect(run.runBy).toBe('SYSTEM');
  });

  it('records custom runBy', () => {
    const run = runStressTest(loans, provisions, products, undefined, 'thando@tqacapital.co.za');
    expect(run.runBy).toBe('thando@tqacapital.co.za');
  });

  it('accepts custom scenarios', () => {
    const custom = [
      {
        id: 'extreme',
        name: 'Extreme',
        description: 'Black swan',
        pdMultiplier: 5.0,
        lgdMultiplier: 2.0,
        recoveryAdjustment: 0.6,
        custom: true,
      },
    ];
    const run = runStressTest(loans, provisions, products, custom);
    expect(run.scenarios).toHaveLength(1);
    expect(run.scenarios[0].scenario.id).toBe('extreme');
  });

  it('total ECL increases monotonically across base → moderate → severe', () => {
    const run = runStressTest(loans, provisions, products);
    const base = run.scenarios.find((s) => s.scenario.id === 'base')!;
    const moderate = run.scenarios.find((s) => s.scenario.id === 'moderate')!;
    const severe = run.scenarios.find((s) => s.scenario.id === 'severe')!;
    expect(moderate.totalECL).toBeGreaterThanOrEqual(base.totalECL);
    expect(severe.totalECL).toBeGreaterThanOrEqual(moderate.totalECL);
  });
});
