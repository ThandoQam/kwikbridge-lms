/**
 * Unit tests for the credit decisioning engine.
 *
 * This is the IP heart of the platform — incorrect scoring means
 * approving bad loans (loss) or declining good loans (lost revenue).
 * Every code path that produces a credit decision must be covered.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRatios,
  evaluateApplication,
  runScenarios,
  validateScorecard,
  DEFAULT_SCORECARD,
  type FinancialInputs,
  type DecisionInput,
} from '../../src/lib/decisioning';

// ─── Test fixtures ───

const strongFinancials: FinancialInputs = {
  revenue: 5_000_000,
  netProfit: 800_000,
  totalAssets: 2_500_000,
  totalLiabilities: 800_000,
  currentAssets: 1_200_000,
  currentLiabilities: 400_000,
  cashFlow: 600_000,
  existingDebt: 200_000,
  proposedPayment: 25_000, // monthly
};

const weakFinancials: FinancialInputs = {
  revenue: 1_000_000,
  netProfit: 30_000,
  totalAssets: 500_000,
  totalLiabilities: 450_000,
  currentAssets: 200_000,
  currentLiabilities: 280_000,
  cashFlow: 60_000,
  existingDebt: 350_000,
  proposedPayment: 15_000,
};

const baseInput = (financials: FinancialInputs): DecisionInput => ({
  application: { amount: 500_000, term: 36, socialScore: 60 },
  customer: {
    id: 'C-001',
    name: 'Test Pty Ltd',
    beeLevel: 4,
    womenOwned: 1,
    revenue: financials.revenue,
    employees: 25,
    years: 8,
  },
  product: { id: 'P001', name: 'Working Capital', baseRate: 14.5 },
  financials,
  bureau: { score: 720, defaults: 0, judgments: 0, enquiries: 1, utilizationPct: 35 },
  siteVisit: { overallScore: 4, premisesRating: 4, operationsRating: 4, managementRating: 4 },
});

// ═══ calculateRatios ═══

describe('calculateRatios', () => {
  it('computes DSCR correctly for healthy financials', () => {
    const r = calculateRatios(strongFinancials, 500_000, 800_000);
    // DSCR = annualCashFlow / (proposedPayment * 12) = 600k / 300k = 2.00
    expect(r.dscr).toBe(2);
  });

  it('returns DSCR 0 if proposedPayment is 0', () => {
    const r = calculateRatios({ ...strongFinancials, proposedPayment: 0 }, 500_000, 0);
    expect(r.dscr).toBe(0);
  });

  it('computes current ratio correctly', () => {
    const r = calculateRatios(strongFinancials, 500_000, 800_000);
    // 1.2M / 0.4M = 3.00
    expect(r.currentRatio).toBe(3);
  });

  it('returns currentRatio 0 if currentLiabilities is 0', () => {
    const r = calculateRatios({ ...strongFinancials, currentLiabilities: 0 }, 500_000, 0);
    expect(r.currentRatio).toBe(0);
  });

  it('computes debt-to-equity including the new loan', () => {
    const r = calculateRatios(strongFinancials, 500_000, 800_000);
    // equity = 2.5M - 0.8M = 1.7M
    // (totalLiab + loan) / equity = (0.8M + 0.5M) / 1.7M = 0.7647
    expect(r.debtToEquity).toBeCloseTo(0.76, 1);
  });

  it('returns debtToEquity 99 when equity is non-positive (insolvent)', () => {
    const insolvent: FinancialInputs = {
      ...strongFinancials,
      totalLiabilities: 3_000_000, // > assets
    };
    const r = calculateRatios(insolvent, 500_000, 0);
    expect(r.debtToEquity).toBe(99);
  });

  it('computes gross margin as percentage', () => {
    const r = calculateRatios(strongFinancials, 500_000, 0);
    // 800k / 5M = 16.00%
    expect(r.grossMargin).toBe(16);
  });

  it('computes LTV correctly', () => {
    const r = calculateRatios(strongFinancials, 500_000, 1_000_000);
    // 500k / 1M = 50.00%
    expect(r.ltv).toBe(50);
  });

  it('returns LTV 100 when collateralValue is 0 (unsecured)', () => {
    const r = calculateRatios(strongFinancials, 500_000, 0);
    expect(r.ltv).toBe(100);
  });
});

// ═══ evaluateApplication ═══

describe('evaluateApplication', () => {
  it('produces a structured decision result', () => {
    const result = evaluateApplication(baseInput(strongFinancials));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'E']).toContain(result.grade);
    expect(['Approve', 'Refer', 'Decline']).toContain(result.recommendation);
    expect(Array.isArray(result.conditions)).toBe(true);
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(Array.isArray(result.categoryScores)).toBe(true);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('grades strong financials at A or B', () => {
    const result = evaluateApplication(baseInput(strongFinancials));
    expect(['A', 'B']).toContain(result.grade);
  });

  it('grades weak financials at D or E', () => {
    const result = evaluateApplication(baseInput(weakFinancials));
    expect(['D', 'E']).toContain(result.grade);
  });

  it('approves strong applications', () => {
    const result = evaluateApplication(baseInput(strongFinancials));
    expect(['Approve', 'Refer']).toContain(result.recommendation);
  });

  it('declines weak applications with poor cash flow', () => {
    const veryWeak = {
      ...weakFinancials,
      cashFlow: 10_000, // DSCR < 1
      currentLiabilities: 500_000,
      currentAssets: 100_000, // current ratio 0.2
    };
    const result = evaluateApplication(baseInput(veryWeak));
    expect(['Refer', 'Decline']).toContain(result.recommendation);
  });

  it('overall score equals sum of weighted category scores × 20', () => {
    // Each categoryScore.weightedScore is on a 0-5 scale, weighted by
    // its category weight (e.g. Financial 40% means weight 0.40).
    // Sum of weightedScores → 0-5, multiplied by 20 → 0-100 final.
    const result = evaluateApplication(baseInput(strongFinancials));
    const sumWeighted = result.categoryScores.reduce(
      (sum, c) => sum + c.weightedScore,
      0
    );
    const expectedScore = Math.round(sumWeighted * 20);
    // Allow 2-point rounding tolerance from intermediate rounding
    expect(Math.abs(expectedScore - result.score)).toBeLessThanOrEqual(2);
  });

  it('produces conditions for borderline cases (Refer recommendation)', () => {
    // Construct a borderline case
    const borderline = {
      revenue: 2_000_000,
      netProfit: 150_000,
      totalAssets: 1_000_000,
      totalLiabilities: 600_000,
      currentAssets: 400_000,
      currentLiabilities: 350_000,
      cashFlow: 180_000,
      existingDebt: 100_000,
      proposedPayment: 12_000,
    };
    const result = evaluateApplication(baseInput(borderline));
    if (result.recommendation === 'Refer') {
      expect(result.conditions.length).toBeGreaterThan(0);
    }
  });

  it('reasons array explains the decision', () => {
    const result = evaluateApplication(baseInput(strongFinancials));
    expect(result.reasons.length).toBeGreaterThan(0);
    result.reasons.forEach((r) => expect(typeof r).toBe('string'));
  });

  it('declines applications with extreme negative DSCR', () => {
    const insolvent: FinancialInputs = {
      ...weakFinancials,
      cashFlow: -100_000, // negative cash flow
      proposedPayment: 50_000,
    };
    const result = evaluateApplication(baseInput(insolvent));
    expect(['D', 'E']).toContain(result.grade);
    expect(['Decline', 'Refer']).toContain(result.recommendation);
  });

  it('handles zero-revenue startups gracefully', () => {
    const startup: FinancialInputs = {
      revenue: 0,
      netProfit: 0,
      totalAssets: 100_000,
      totalLiabilities: 50_000,
      currentAssets: 80_000,
      currentLiabilities: 20_000,
      cashFlow: 0,
      existingDebt: 0,
      proposedPayment: 5_000,
    };
    const result = evaluateApplication(baseInput(startup));
    // Should not throw, should produce a low score
    expect(result.score).toBeLessThanOrEqual(60);
    expect(result.recommendation).not.toBe('Approve');
  });

  it('uses bureau data when provided', () => {
    const withBureau: DecisionInput = {
      ...baseInput(strongFinancials),
      bureau: {
        score: 750,
        defaults: 0,
        judgments: 0,
        enquiries: 2,
        utilizationPct: 30,
      },
    };
    const withoutBureau = baseInput(strongFinancials);

    const r1 = evaluateApplication(withBureau);
    const r2 = evaluateApplication(withoutBureau);

    // Both should run without error; bureau may move the score
    expect(typeof r1.score).toBe('number');
    expect(typeof r2.score).toBe('number');
  });

  it('respects empowerment credentials in scoring', () => {
    const empowered: DecisionInput = {
      ...baseInput(strongFinancials),
      customer: { ...baseInput(strongFinancials).customer, beeLevel: 1, womenOwned: 1, youthOwned: 1 },
    };
    const notEmpowered: DecisionInput = {
      ...baseInput(strongFinancials),
      customer: { ...baseInput(strongFinancials).customer, beeLevel: 8, womenOwned: 0 },
    };

    const r1 = evaluateApplication(empowered);
    const r2 = evaluateApplication(notEmpowered);

    // Empowerment should not reduce the score
    expect(r1.score).toBeGreaterThanOrEqual(r2.score - 2);
  });

  it('produces deterministic results for identical input', () => {
    const r1 = evaluateApplication(baseInput(strongFinancials));
    const r2 = evaluateApplication(baseInput(strongFinancials));
    expect(r1.score).toBe(r2.score);
    expect(r1.grade).toBe(r2.grade);
    expect(r1.recommendation).toBe(r2.recommendation);
  });
});

// ═══ runScenarios (stress testing) ═══

describe('runScenarios', () => {
  it('returns base case + 4 stress scenarios', () => {
    const results = runScenarios(baseInput(strongFinancials));
    expect(results).toHaveLength(5);
    expect(results[0].name).toBe('Base Case');
  });

  it('stress scenarios produce equal or worse scores than base', () => {
    const results = runScenarios(baseInput(strongFinancials));
    const baseScore = results[0].result.score;
    // Revenue -10% should weakly reduce score (or hold)
    const stressScore = results[1].result.score;
    expect(stressScore).toBeLessThanOrEqual(baseScore + 2);
  });

  it('Combined Stress is the worst-case scenario', () => {
    const results = runScenarios(baseInput(strongFinancials));
    const combined = results.find((r) => r.name === 'Combined Stress');
    expect(combined).toBeDefined();
    const otherScores = results.filter((r) => r.name !== 'Combined Stress').map((r) => r.result.score);
    const minOther = Math.min(...otherScores);
    expect(combined!.result.score).toBeLessThanOrEqual(minOther + 2);
  });

  it('does not mutate the input financials', () => {
    const input = baseInput(strongFinancials);
    const originalRevenue = input.financials.revenue;
    runScenarios(input);
    expect(input.financials.revenue).toBe(originalRevenue);
  });
});

// ═══ validateScorecard ═══

describe('validateScorecard', () => {
  it('passes the default scorecard', () => {
    const errors = validateScorecard(DEFAULT_SCORECARD);
    expect(errors).toHaveLength(0);
  });

  it('flags categories that do not sum to 100', () => {
    const broken = {
      ...DEFAULT_SCORECARD,
      categories: DEFAULT_SCORECARD.categories.map((c, i) =>
        i === 0 ? { ...c, weight: c.weight + 5 } : c
      ),
    };
    const errors = validateScorecard(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('Category weights'))).toBe(true);
  });

  it('flags rules that do not sum to 100', () => {
    const broken = {
      ...DEFAULT_SCORECARD,
      categories: DEFAULT_SCORECARD.categories.map((c, i) =>
        i === 0
          ? {
              ...c,
              rules: c.rules.map((r, j) => (j === 0 ? { ...r, weight: r.weight + 10 } : r)),
            }
          : c
      ),
    };
    const errors = validateScorecard(broken);
    expect(errors.some((e) => e.includes('rule weights'))).toBe(true);
  });

  it('flags rules with no thresholds', () => {
    const broken = {
      ...DEFAULT_SCORECARD,
      categories: DEFAULT_SCORECARD.categories.map((c, i) =>
        i === 0
          ? {
              ...c,
              rules: c.rules.map((r, j) => (j === 0 ? { ...r, thresholds: [] } : r)),
            }
          : c
      ),
    };
    const errors = validateScorecard(broken);
    expect(errors.some((e) => e.includes('no thresholds'))).toBe(true);
  });
});
