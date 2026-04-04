// KwikBridge LMS — Stress Testing Engine (ENH-07)
// Portfolio-level stress testing for IFRS 9 provisioning.
// Calculates stressed ECL under base, moderate, and severe scenarios.
//
// Design: pure functions — input portfolio data, output stressed results

import type { Loan, Provision, Product } from "../types/index";

// ═══ Types ═══

export interface StressScenario {
  id: string;
  name: string;
  description: string;
  pdMultiplier: number;         // multiply base PD
  lgdMultiplier: number;        // multiply base LGD
  recoveryAdjustment: number;   // subtract from recovery rate
  custom?: boolean;
}

export interface StressResult {
  scenario: StressScenario;
  totalECL: number;
  totalEAD: number;
  coverageRatio: number;        // ECL / EAD
  capitalImpact: number;        // difference vs base case
  byStage: {
    stage: number;
    count: number;
    ead: number;
    ecl: number;
    avgPD: number;
    avgLGD: number;
  }[];
  byProduct: {
    productId: string;
    productName: string;
    count: number;
    ead: number;
    ecl: number;
  }[];
  loanDetails: {
    loanId: string;
    stage: number;
    ead: number;
    basePD: number;
    stressedPD: number;
    baseLGD: number;
    stressedLGD: number;
    baseECL: number;
    stressedECL: number;
    delta: number;
  }[];
}

export interface StressTestRun {
  id: string;
  runDate: number;
  runBy: string;
  scenarios: StressResult[];
  portfolioSnapshot: {
    totalLoans: number;
    totalBookValue: number;
    stage1Count: number;
    stage2Count: number;
    stage3Count: number;
  };
}

// ═══ Standard Scenarios ═══

export const STANDARD_SCENARIOS: StressScenario[] = [
  {
    id: "base",
    name: "Base Case",
    description: "Current PD/LGD assumptions — no stress applied.",
    pdMultiplier: 1.0,
    lgdMultiplier: 1.0,
    recoveryAdjustment: 0,
  },
  {
    id: "moderate",
    name: "Moderate Stress",
    description: "Economic downturn — PD +50%, LGD +20%, recovery -15%.",
    pdMultiplier: 1.5,
    lgdMultiplier: 1.2,
    recoveryAdjustment: 0.15,
  },
  {
    id: "severe",
    name: "Severe Stress",
    description: "Deep recession — PD +100%, LGD +50%, recovery -30%.",
    pdMultiplier: 2.0,
    lgdMultiplier: 1.5,
    recoveryAdjustment: 0.30,
  },
];

// Stage PD multipliers (same as eod.ts for consistency)
const STAGE_PD_MULT: Record<number, number> = { 1: 1.0, 2: 3.0, 3: 8.0 };

// ═══ Core Stress Calculation ═══

function stressLoan(
  loan: Loan,
  provision: Provision | undefined,
  product: Product | undefined,
  scenario: StressScenario
): StressResult["loanDetails"][0] {
  const basePD = (product?.s1PD || 0.02) * (STAGE_PD_MULT[loan.stage] || 1.0);
  const baseLGD = product?.lgd || 0.25;
  const ead = loan.balance;

  const stressedPD = Math.min(1.0, basePD * scenario.pdMultiplier);
  const stressedLGD = Math.min(1.0, baseLGD * scenario.lgdMultiplier);

  const baseECL = Math.round(basePD * baseLGD * ead * 100) / 100;
  const stressedECL = Math.round(stressedPD * stressedLGD * ead * 100) / 100;

  return {
    loanId: loan.id,
    stage: loan.stage,
    ead,
    basePD: Math.round(basePD * 10000) / 10000,
    stressedPD: Math.round(stressedPD * 10000) / 10000,
    baseLGD: Math.round(baseLGD * 10000) / 10000,
    stressedLGD: Math.round(stressedLGD * 10000) / 10000,
    baseECL,
    stressedECL,
    delta: Math.round((stressedECL - baseECL) * 100) / 100,
  };
}

// ═══ Run a Single Scenario ═══

export function runScenario(
  loans: Loan[],
  provisions: Provision[],
  products: Product[],
  scenario: StressScenario
): StressResult {
  const activeLoans = loans.filter(l => l.status === "Active");
  const productMap = new Map(products.map(p => [p.id, p]));
  const provisionMap = new Map(provisions.map(p => [p.loanId, p]));

  const loanDetails = activeLoans.map(loan =>
    stressLoan(loan, provisionMap.get(loan.id), productMap.get(loan.product), scenario)
  );

  const totalECL = loanDetails.reduce((s, d) => s + d.stressedECL, 0);
  const totalEAD = loanDetails.reduce((s, d) => s + d.ead, 0);

  // By stage
  const byStage = [1, 2, 3].map(stage => {
    const stageLoans = loanDetails.filter(d => d.stage === stage);
    return {
      stage,
      count: stageLoans.length,
      ead: stageLoans.reduce((s, d) => s + d.ead, 0),
      ecl: stageLoans.reduce((s, d) => s + d.stressedECL, 0),
      avgPD: stageLoans.length > 0 ? stageLoans.reduce((s, d) => s + d.stressedPD, 0) / stageLoans.length : 0,
      avgLGD: stageLoans.length > 0 ? stageLoans.reduce((s, d) => s + d.stressedLGD, 0) / stageLoans.length : 0,
    };
  });

  // By product
  const prodGroups = new Map<string, { name: string; count: number; ead: number; ecl: number }>();
  for (const d of loanDetails) {
    const loan = activeLoans.find(l => l.id === d.loanId);
    const prodId = loan?.product || "unknown";
    const prodName = productMap.get(prodId)?.name || prodId;
    const existing = prodGroups.get(prodId) || { name: prodName, count: 0, ead: 0, ecl: 0 };
    existing.count++;
    existing.ead += d.ead;
    existing.ecl += d.stressedECL;
    prodGroups.set(prodId, existing);
  }
  const byProduct = Array.from(prodGroups.entries()).map(([productId, g]) => ({
    productId,
    productName: g.name,
    count: g.count,
    ead: g.ead,
    ecl: g.ecl,
  }));

  // Capital impact vs base case
  const baseECL = loanDetails.reduce((s, d) => s + d.baseECL, 0);

  return {
    scenario,
    totalECL: Math.round(totalECL * 100) / 100,
    totalEAD: Math.round(totalEAD * 100) / 100,
    coverageRatio: totalEAD > 0 ? Math.round((totalECL / totalEAD) * 10000) / 10000 : 0,
    capitalImpact: Math.round((totalECL - baseECL) * 100) / 100,
    byStage,
    byProduct,
    loanDetails,
  };
}

// ═══ Run Full Stress Test ═══

export function runStressTest(
  loans: Loan[],
  provisions: Provision[],
  products: Product[],
  scenarios?: StressScenario[],
  runBy = "SYSTEM"
): StressTestRun {
  const activeLoans = loans.filter(l => l.status === "Active");
  const scenarioList = scenarios || STANDARD_SCENARIOS;

  const results = scenarioList.map(scenario =>
    runScenario(loans, provisions, products, scenario)
  );

  return {
    id: `ST-${Date.now()}`,
    runDate: Date.now(),
    runBy,
    scenarios: results,
    portfolioSnapshot: {
      totalLoans: activeLoans.length,
      totalBookValue: activeLoans.reduce((s, l) => s + l.balance, 0),
      stage1Count: activeLoans.filter(l => l.stage === 1).length,
      stage2Count: activeLoans.filter(l => l.stage === 2).length,
      stage3Count: activeLoans.filter(l => l.stage === 3).length,
    },
  };
}

// ═══ Portfolio Analytics Calculations ═══

export interface PortfolioAnalytics {
  dpdBuckets: { label: string; count: number; balance: number; pct: number }[];
  productMix: { product: string; count: number; balance: number; pct: number }[];
  stageSummary: { stage: number; label: string; count: number; balance: number; ecl: number }[];
  vintageData: { month: string; originated: number; amount: number; currentArrears: number; arrearsRate: number }[];
  concentrationByIndustry: { industry: string; count: number; balance: number; pct: number }[];
  collectionRates: { period: string; collected: number; due: number; rate: number }[];
}

export function calculatePortfolioAnalytics(
  loans: Loan[],
  provisions: Provision[],
  products: Product[],
  customers: any[]
): PortfolioAnalytics {
  const active = loans.filter(l => l.status === "Active");
  const totalBalance = active.reduce((s, l) => s + l.balance, 0);

  // DPD Buckets
  const buckets = [
    { label: "Current", min: 0, max: 0 },
    { label: "1-30 DPD", min: 1, max: 30 },
    { label: "31-60 DPD", min: 31, max: 60 },
    { label: "61-90 DPD", min: 61, max: 90 },
    { label: "90+ DPD", min: 91, max: 9999 },
  ];
  const dpdBuckets = buckets.map(b => {
    const bucket = active.filter(l => l.dpd >= b.min && l.dpd <= b.max);
    const balance = bucket.reduce((s, l) => s + l.balance, 0);
    return { label: b.label, count: bucket.length, balance, pct: totalBalance > 0 ? balance / totalBalance : 0 };
  });

  // Product Mix
  const prodMap = new Map(products.map(p => [p.id, p.name]));
  const prodGroups = new Map<string, { count: number; balance: number }>();
  for (const l of active) {
    const key = prodMap.get(l.product) || l.product;
    const g = prodGroups.get(key) || { count: 0, balance: 0 };
    g.count++;
    g.balance += l.balance;
    prodGroups.set(key, g);
  }
  const productMix = Array.from(prodGroups.entries()).map(([product, g]) => ({
    product, count: g.count, balance: g.balance, pct: totalBalance > 0 ? g.balance / totalBalance : 0,
  })).sort((a, b) => b.balance - a.balance);

  // Stage Summary
  const stageSummary = [1, 2, 3].map(stage => {
    const stageLoans = active.filter(l => l.stage === stage);
    const stageProvisions = provisions.filter(p => p.stage === stage);
    return {
      stage,
      label: stage === 1 ? "Performing" : stage === 2 ? "Underperforming" : "Non-performing",
      count: stageLoans.length,
      balance: stageLoans.reduce((s, l) => s + l.balance, 0),
      ecl: stageProvisions.reduce((s, p) => s + p.ecl, 0),
    };
  });

  // Vintage Analysis (by booking month)
  const vintageMap = new Map<string, { originated: number; amount: number; arrears: number }>();
  for (const l of loans) {
    const month = l.bookedAt ? new Date(l.bookedAt).toISOString().slice(0, 7) : "unknown";
    const v = vintageMap.get(month) || { originated: 0, amount: 0, arrears: 0 };
    v.originated++;
    v.amount += l.amount;
    if (l.status === "Active" && l.dpd > 0) v.arrears++;
    vintageMap.set(month, v);
  }
  const vintageData = Array.from(vintageMap.entries())
    .map(([month, v]) => ({
      month, originated: v.originated, amount: v.amount,
      currentArrears: v.arrears,
      arrearsRate: v.originated > 0 ? v.arrears / v.originated : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Concentration by Industry
  const custMap = new Map(customers.map((c: any) => [c.id, c]));
  const industryGroups = new Map<string, { count: number; balance: number }>();
  for (const l of active) {
    const cust = custMap.get(l.custId);
    const industry = cust?.industry || "Other";
    const g = industryGroups.get(industry) || { count: 0, balance: 0 };
    g.count++;
    g.balance += l.balance;
    industryGroups.set(industry, g);
  }
  const concentrationByIndustry = Array.from(industryGroups.entries()).map(([industry, g]) => ({
    industry, count: g.count, balance: g.balance, pct: totalBalance > 0 ? g.balance / totalBalance : 0,
  })).sort((a, b) => b.balance - a.balance);

  // Collection Rates (from payment history, last 3 months)
  const now = Date.now();
  const DAY = 864e5;
  const collectionRates = [30, 60, 90].map(days => {
    const cutoff = now - days * DAY;
    let collected = 0;
    let due = 0;
    for (const l of active) {
      due += l.monthlyPmt * (days / 30);
      for (const p of (l.payments || [])) {
        if (p.date >= cutoff) collected += p.amount;
      }
    }
    return {
      period: `${days}-day`,
      collected: Math.round(collected),
      due: Math.round(due),
      rate: due > 0 ? Math.round((collected / due) * 10000) / 10000 : 0,
    };
  });

  return { dpdBuckets, productMix, stageSummary, vintageData, concentrationByIndustry, collectionRates };
}
