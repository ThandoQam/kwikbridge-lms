// KwikBridge LMS — Credit Decisioning Engine (ENH-03)
// Configurable scorecard-based credit assessment.
// Replaces inline risk scoring with a deterministic, auditable engine.
//
// Features:
//   - Weighted scorecard (Financial 40%, Management 20%, Market 15%, Collateral 15%, Empowerment 10%)
//   - Grade assignment: A (85-100) → E (0-39)
//   - Auto-recommendation: Approve / Refer / Decline with conditions
//   - Sensitivity analysis (what-if scenarios)
//   - Product-specific scorecard overrides
//
// Design: pure functions — no side effects, fully testable

import type { Application, Customer, Product, Loan } from "../types/index";

// ═══ Types ═══

export interface ScorecardConfig {
  id: string;
  name: string;
  productIds: string[];          // which products use this scorecard ("*" = all)
  categories: ScorecardCategory[];
}

export interface ScorecardCategory {
  key: string;
  label: string;
  weight: number;                // 0-100, all weights must sum to 100
  rules: ScorecardRule[];
}

export interface ScorecardRule {
  key: string;
  label: string;
  weight: number;                // weight within category (0-100)
  thresholds: ScorecardThreshold[];
}

export interface ScorecardThreshold {
  min: number;
  max: number;
  score: number;                 // 0-5
  label: string;
}

export interface DecisionInput {
  application: Partial<Application>;
  customer: Partial<Customer>;
  product: Partial<Product>;
  financials: FinancialInputs;
  bureau?: BureauData;
  siteVisit?: SiteVisitData;
}

export interface FinancialInputs {
  revenue: number;
  netProfit: number;
  totalAssets: number;
  totalLiabilities: number;
  currentAssets: number;
  currentLiabilities: number;
  cashFlow: number;
  existingDebt: number;
  proposedPayment: number;
}

export interface BureauData {
  score: number;                 // 0-900
  defaults: number;
  judgments: number;
  enquiries: number;
  utilizationPct: number;
}

export interface SiteVisitData {
  overallScore: number;          // 1-5
  premisesRating: number;
  operationsRating: number;
  managementRating: number;
}

export interface DecisionResult {
  score: number;                 // 0-100
  grade: "A" | "B" | "C" | "D" | "E";
  recommendation: "Approve" | "Refer" | "Decline";
  conditions: string[];
  reasons: string[];
  categoryScores: { key: string; label: string; weight: number; score: number; weightedScore: number }[];
  ratios: FinancialRatios;
  timestamp: number;
}

export interface FinancialRatios {
  dscr: number;
  currentRatio: number;
  debtToEquity: number;
  grossMargin: number;
  returnOnAssets: number;
  ltv: number;
}

export interface ScenarioResult {
  name: string;
  adjustments: Record<string, number>;
  result: DecisionResult;
}

// ═══ Default Scorecard ═══

export const DEFAULT_SCORECARD: ScorecardConfig = {
  id: "SC-DEFAULT",
  name: "Standard SME Scorecard",
  productIds: ["*"],
  categories: [
    {
      key: "financial", label: "Financial Performance", weight: 40,
      rules: [
        {
          key: "dscr", label: "Debt Service Coverage Ratio", weight: 35,
          thresholds: [
            { min: 2.0, max: 999, score: 5, label: "Excellent — strong debt capacity" },
            { min: 1.5, max: 2.0, score: 4, label: "Good — comfortable coverage" },
            { min: 1.2, max: 1.5, score: 3, label: "Adequate — acceptable with conditions" },
            { min: 1.0, max: 1.2, score: 2, label: "Marginal — tight coverage" },
            { min: 0, max: 1.0, score: 1, label: "Insufficient — cannot service debt" },
          ],
        },
        {
          key: "currentRatio", label: "Current Ratio", weight: 20,
          thresholds: [
            { min: 2.0, max: 999, score: 5, label: "Strong liquidity" },
            { min: 1.5, max: 2.0, score: 4, label: "Good liquidity" },
            { min: 1.0, max: 1.5, score: 3, label: "Adequate liquidity" },
            { min: 0.5, max: 1.0, score: 2, label: "Weak liquidity" },
            { min: 0, max: 0.5, score: 1, label: "Liquidity crisis" },
          ],
        },
        {
          key: "debtToEquity", label: "Debt-to-Equity Ratio", weight: 20,
          thresholds: [
            { min: 0, max: 0.5, score: 5, label: "Conservative leverage" },
            { min: 0.5, max: 1.0, score: 4, label: "Moderate leverage" },
            { min: 1.0, max: 2.0, score: 3, label: "Acceptable leverage" },
            { min: 2.0, max: 3.0, score: 2, label: "High leverage" },
            { min: 3.0, max: 999, score: 1, label: "Excessive leverage" },
          ],
        },
        {
          key: "grossMargin", label: "Gross Profit Margin (%)", weight: 15,
          thresholds: [
            { min: 40, max: 100, score: 5, label: "Excellent margins" },
            { min: 25, max: 40, score: 4, label: "Good margins" },
            { min: 15, max: 25, score: 3, label: "Adequate margins" },
            { min: 5, max: 15, score: 2, label: "Thin margins" },
            { min: 0, max: 5, score: 1, label: "Unsustainable margins" },
          ],
        },
        {
          key: "roa", label: "Return on Assets (%)", weight: 10,
          thresholds: [
            { min: 15, max: 100, score: 5, label: "Excellent returns" },
            { min: 8, max: 15, score: 4, label: "Good returns" },
            { min: 3, max: 8, score: 3, label: "Adequate returns" },
            { min: 0, max: 3, score: 2, label: "Low returns" },
            { min: -100, max: 0, score: 1, label: "Negative returns" },
          ],
        },
      ],
    },
    {
      key: "management", label: "Management Quality", weight: 20,
      rules: [
        {
          key: "yearsInBusiness", label: "Years in Business", weight: 35,
          thresholds: [
            { min: 10, max: 999, score: 5, label: "Established — 10+ years" },
            { min: 5, max: 10, score: 4, label: "Mature — 5-10 years" },
            { min: 3, max: 5, score: 3, label: "Growing — 3-5 years" },
            { min: 1, max: 3, score: 2, label: "Early stage — 1-3 years" },
            { min: 0, max: 1, score: 1, label: "Start-up — under 1 year" },
          ],
        },
        {
          key: "bureauScore", label: "Credit Bureau Score", weight: 35,
          thresholds: [
            { min: 700, max: 900, score: 5, label: "Excellent credit history" },
            { min: 600, max: 700, score: 4, label: "Good credit history" },
            { min: 500, max: 600, score: 3, label: "Fair credit history" },
            { min: 400, max: 500, score: 2, label: "Below average" },
            { min: 0, max: 400, score: 1, label: "Poor credit history" },
          ],
        },
        {
          key: "siteVisit", label: "Site Visit Assessment", weight: 30,
          thresholds: [
            { min: 4.5, max: 5, score: 5, label: "Outstanding operations" },
            { min: 3.5, max: 4.5, score: 4, label: "Good operations" },
            { min: 2.5, max: 3.5, score: 3, label: "Adequate operations" },
            { min: 1.5, max: 2.5, score: 2, label: "Below standard" },
            { min: 0, max: 1.5, score: 1, label: "Serious concerns" },
          ],
        },
      ],
    },
    {
      key: "market", label: "Market Position", weight: 15,
      rules: [
        {
          key: "revenue", label: "Annual Revenue (R millions)", weight: 50,
          thresholds: [
            { min: 20, max: 999, score: 5, label: "Large SME — R20M+" },
            { min: 10, max: 20, score: 4, label: "Medium SME — R10-20M" },
            { min: 5, max: 10, score: 3, label: "Small SME — R5-10M" },
            { min: 1, max: 5, score: 2, label: "Micro — R1-5M" },
            { min: 0, max: 1, score: 1, label: "Pre-revenue / <R1M" },
          ],
        },
        {
          key: "employees", label: "Number of Employees", weight: 50,
          thresholds: [
            { min: 50, max: 9999, score: 5, label: "Medium enterprise" },
            { min: 20, max: 50, score: 4, label: "Small enterprise" },
            { min: 10, max: 20, score: 3, label: "Micro enterprise" },
            { min: 3, max: 10, score: 2, label: "Very small" },
            { min: 0, max: 3, score: 1, label: "Solo / pre-employment" },
          ],
        },
      ],
    },
    {
      key: "collateral", label: "Security & Collateral", weight: 15,
      rules: [
        {
          key: "ltv", label: "Loan-to-Value Ratio (%)", weight: 100,
          thresholds: [
            { min: 0, max: 50, score: 5, label: "Strong security — LTV < 50%" },
            { min: 50, max: 70, score: 4, label: "Good security — LTV 50-70%" },
            { min: 70, max: 85, score: 3, label: "Adequate — LTV 70-85%" },
            { min: 85, max: 100, score: 2, label: "Weak — LTV 85-100%" },
            { min: 100, max: 999, score: 1, label: "Under-secured — LTV > 100%" },
          ],
        },
      ],
    },
    {
      key: "empowerment", label: "Empowerment & Social Impact", weight: 10,
      rules: [
        {
          key: "beeLevel", label: "BEE Level", weight: 50,
          thresholds: [
            { min: 0, max: 1, score: 5, label: "Level 1 — maximum contributor" },
            { min: 1, max: 2, score: 5, label: "Level 1-2 — major contributor" },
            { min: 2, max: 4, score: 4, label: "Level 2-4 — significant" },
            { min: 4, max: 6, score: 3, label: "Level 4-6 — moderate" },
            { min: 6, max: 8, score: 2, label: "Level 6-8 — limited" },
            { min: 8, max: 999, score: 1, label: "Non-compliant" },
          ],
        },
        {
          key: "socialScore", label: "Social Impact Score", weight: 50,
          thresholds: [
            { min: 80, max: 100, score: 5, label: "Exceptional impact" },
            { min: 60, max: 80, score: 4, label: "Strong impact" },
            { min: 40, max: 60, score: 3, label: "Moderate impact" },
            { min: 20, max: 40, score: 2, label: "Limited impact" },
            { min: 0, max: 20, score: 1, label: "Minimal impact" },
          ],
        },
      ],
    },
  ],
};

// ═══ Grade Thresholds ═══

const GRADE_MAP: { min: number; grade: DecisionResult["grade"]; recommendation: DecisionResult["recommendation"]; label: string }[] = [
  { min: 85, grade: "A", recommendation: "Approve", label: "Strong — recommend approval" },
  { min: 70, grade: "B", recommendation: "Approve", label: "Good — approve with standard conditions" },
  { min: 55, grade: "C", recommendation: "Refer", label: "Moderate — refer to committee" },
  { min: 40, grade: "D", recommendation: "Decline", label: "Weak — decline unless mitigants" },
  { min: 0, grade: "E", recommendation: "Decline", label: "Poor — recommend decline" },
];

// ═══ Financial Ratio Calculations ═══

export function calculateRatios(fin: FinancialInputs, loanAmount: number, collateralValue: number): FinancialRatios {
  const equity = fin.totalAssets - fin.totalLiabilities;
  return {
    dscr: fin.proposedPayment > 0 ? Math.round((fin.cashFlow / (fin.proposedPayment * 12)) * 100) / 100 : 0,
    currentRatio: fin.currentLiabilities > 0 ? Math.round((fin.currentAssets / fin.currentLiabilities) * 100) / 100 : 0,
    debtToEquity: equity > 0 ? Math.round(((fin.totalLiabilities + loanAmount) / equity) * 100) / 100 : 99,
    grossMargin: fin.revenue > 0 ? Math.round((fin.netProfit / fin.revenue) * 100 * 100) / 100 : 0,
    returnOnAssets: fin.totalAssets > 0 ? Math.round((fin.netProfit / fin.totalAssets) * 100 * 100) / 100 : 0,
    ltv: collateralValue > 0 ? Math.round((loanAmount / collateralValue) * 100 * 100) / 100 : 100,
  };
}

// ═══ Score a Single Rule ═══

function scoreRule(value: number, rule: ScorecardRule): { score: number; label: string } {
  for (const t of rule.thresholds) {
    if (value >= t.min && value < t.max) {
      return { score: t.score, label: t.label };
    }
  }
  // Last threshold is catch-all
  const last = rule.thresholds[rule.thresholds.length - 1];
  return { score: last?.score || 1, label: last?.label || "Unscored" };
}

// ═══ Main Decision Function ═══

export function evaluateApplication(
  input: DecisionInput,
  scorecard?: ScorecardConfig
): DecisionResult {
  const sc = scorecard || DEFAULT_SCORECARD;
  const loanAmount = input.application.amount || 0;
  const collateralValue = (input.application as any).collateralTotal || loanAmount;

  // Calculate financial ratios
  const ratios = calculateRatios(input.financials, loanAmount, collateralValue);

  // Map rule keys to values
  const valueMap: Record<string, number> = {
    dscr: ratios.dscr,
    currentRatio: ratios.currentRatio,
    debtToEquity: ratios.debtToEquity,
    grossMargin: ratios.grossMargin,
    roa: ratios.returnOnAssets,
    ltv: ratios.ltv,
    yearsInBusiness: input.customer.years || 0,
    bureauScore: input.bureau?.score || 550,
    siteVisit: input.siteVisit?.overallScore || 3,
    revenue: (input.customer.revenue || 0) / 1_000_000, // convert to millions
    employees: input.customer.employees || 0,
    beeLevel: input.customer.beeLevel || 8,
    socialScore: input.application.socialScore || 0,
  };

  // Score each category
  const categoryScores = sc.categories.map(cat => {
    let catScore = 0;
    let totalWeight = 0;

    for (const rule of cat.rules) {
      const value = valueMap[rule.key] ?? 0;
      const { score: ruleScore } = scoreRule(value, rule);
      catScore += ruleScore * (rule.weight / 100);
      totalWeight += rule.weight;
    }

    // Normalise to 0-5
    const normalisedScore = totalWeight > 0 ? (catScore / (totalWeight / 100)) : 0;
    const weightedScore = normalisedScore * (cat.weight / 100);

    return {
      key: cat.key,
      label: cat.label,
      weight: cat.weight,
      score: Math.round(normalisedScore * 100) / 100,
      weightedScore: Math.round(weightedScore * 100) / 100,
    };
  });

  // Total score (0-5 → 0-100)
  const totalWeighted = categoryScores.reduce((s, c) => s + c.weightedScore, 0);
  const score = Math.round(totalWeighted * 20); // 5.0 max → 100

  // Grade assignment
  const gradeEntry = GRADE_MAP.find(g => score >= g.min) || GRADE_MAP[GRADE_MAP.length - 1];
  const grade = gradeEntry.grade;
  const recommendation = gradeEntry.recommendation;

  // Generate conditions and reasons
  const conditions: string[] = [];
  const reasons: string[] = [];

  reasons.push(`Overall score: ${score}/100 (Grade ${grade}). ${gradeEntry.label}.`);

  if (ratios.dscr < 1.2) reasons.push(`DSCR of ${ratios.dscr}x is below the 1.2x threshold.`);
  if (ratios.dscr >= 1.2 && ratios.dscr < 1.5) conditions.push(`Maintain DSCR above 1.2x (currently ${ratios.dscr}x).`);
  if (ratios.ltv > 85) reasons.push(`LTV of ${ratios.ltv}% exceeds 85% guideline.`);
  if (ratios.currentRatio < 1.0) reasons.push(`Current ratio of ${ratios.currentRatio} indicates liquidity pressure.`);
  if (ratios.debtToEquity > 2.0) reasons.push(`Debt-to-equity of ${ratios.debtToEquity} indicates high leverage.`);

  if (recommendation === "Approve") {
    conditions.push("Submit quarterly management accounts within 30 days of quarter-end.");
    conditions.push("Maintain adequate insurance on all financed assets.");
    if (input.customer.beeLevel && input.customer.beeLevel <= 2) {
      conditions.push(`Maintain BEE Level ${input.customer.beeLevel} status.`);
    }
    if (ratios.dscr < 1.5) conditions.push("Provide 6-month cash flow forecast prior to disbursement.");
  }

  return {
    score,
    grade,
    recommendation,
    conditions,
    reasons,
    categoryScores,
    ratios,
    timestamp: Date.now(),
  };
}

// ═══ Sensitivity Analysis ═══

export function runScenarios(
  input: DecisionInput,
  scorecard?: ScorecardConfig
): ScenarioResult[] {
  const baseResult = evaluateApplication(input, scorecard);

  const scenarios: { name: string; adjustments: Record<string, number> }[] = [
    { name: "Base Case", adjustments: {} },
    { name: "Revenue -10%", adjustments: { revenue: -0.10, cashFlow: -0.10 } },
    { name: "Revenue -20%", adjustments: { revenue: -0.20, cashFlow: -0.20 } },
    { name: "Rate +2%", adjustments: { proposedPayment: 0.15 } }, // ~15% payment increase for 2% rate bump
    { name: "Combined Stress", adjustments: { revenue: -0.15, cashFlow: -0.15, proposedPayment: 0.10 } },
  ];

  return scenarios.map(scenario => {
    if (Object.keys(scenario.adjustments).length === 0) {
      return { name: scenario.name, adjustments: scenario.adjustments, result: baseResult };
    }

    // Apply adjustments to financials
    const adjustedFin = { ...input.financials };
    for (const [key, pct] of Object.entries(scenario.adjustments)) {
      if (key in adjustedFin) {
        (adjustedFin as any)[key] = (adjustedFin as any)[key] * (1 + pct);
      }
    }

    const result = evaluateApplication({ ...input, financials: adjustedFin }, scorecard);
    return { name: scenario.name, adjustments: scenario.adjustments, result };
  });
}

// ═══ Scorecard Validation ═══

export function validateScorecard(sc: ScorecardConfig): string[] {
  const errors: string[] = [];
  const totalWeight = sc.categories.reduce((s, c) => s + c.weight, 0);
  if (totalWeight !== 100) errors.push(`Category weights sum to ${totalWeight}, expected 100.`);

  for (const cat of sc.categories) {
    const ruleWeight = cat.rules.reduce((s, r) => s + r.weight, 0);
    if (ruleWeight !== 100) errors.push(`${cat.label}: rule weights sum to ${ruleWeight}, expected 100.`);
    for (const rule of cat.rules) {
      if (rule.thresholds.length === 0) errors.push(`${cat.label} → ${rule.label}: no thresholds defined.`);
    }
  }

  return errors;
}
