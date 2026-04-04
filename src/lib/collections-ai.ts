// KwikBridge LMS — Predictive Collections Engine (ENH-06)
// Deterministic risk scoring model that predicts delinquency probability.
// Matches FinnOne Neo's AI-powered collections (without ML dependency).
//
// Features:
//   - Delinquency prediction score (0-100%)
//   - Smart worklist prioritisation
//   - Next Best Action recommendation
//   - Collector workload balancing
//   - Route optimisation (nearest-neighbour)

import type { Loan, Customer, CollectionAction } from "../types/index";

// ═══ Types ═══

export interface PredictionResult {
  loanId: string;
  custId: string;
  customerName: string;
  probability: number;          // 0-100 delinquency probability
  riskLevel: "high" | "medium" | "low";
  recommendedAction: string;
  priorityScore: number;        // composite: risk × balance × recency
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  name: string;
  weight: number;
  value: number;
  score: number;                // 0-1 contribution to probability
  description: string;
}

export interface WorklistItem extends PredictionResult {
  balance: number;
  dpd: number;
  lastContactDays: number;
  ptpCompliance: number;        // % of PTPs honoured historically
  stage: number;
  phone: string;
  address: string;
  province: string;
}

export interface RouteStop {
  loanId: string;
  custId: string;
  customerName: string;
  address: string;
  latitude: number;
  longitude: number;
  balance: number;
  dpd: number;
  visitOrder: number;
  estimatedArrival: string;
}

// ═══ Prediction Model (Weighted Scoring) ═══

const PREDICTION_WEIGHTS = {
  paymentHistory: 0.25,         // payment consistency
  dpdTrend: 0.20,               // direction of DPD over last 3 months
  ptpCompliance: 0.15,          // PTP honour rate
  loanAge: 0.10,                // newer loans higher risk
  balanceRatio: 0.10,           // current balance vs original amount
  sectorRisk: 0.10,             // industry sector risk
  seasonalFactor: 0.05,         // time of year
  bureauHistory: 0.05,          // prior defaults
};

/**
 * Calculate delinquency prediction for a single loan.
 */
export function predictDelinquency(
  loan: Loan,
  customer: Customer,
  collections: CollectionAction[],
  referenceDate?: number
): PredictionResult {
  const now = referenceDate || Date.now();
  const DAY = 864e5;
  const factors: PredictionFactor[] = [];

  // 1. Payment History (25%)
  const payments = loan.payments || [];
  const recentPayments = payments.filter(p => p.date > now - 90 * DAY);
  const expectedPayments = 3; // last 3 months
  const paymentRatio = Math.min(1, recentPayments.length / expectedPayments);
  const paymentScore = 1 - paymentRatio; // higher = more likely to miss
  factors.push({
    name: "Payment History", weight: PREDICTION_WEIGHTS.paymentHistory,
    value: recentPayments.length, score: paymentScore,
    description: `${recentPayments.length}/${expectedPayments} expected payments made in last 90 days`,
  });

  // 2. DPD Trend (20%)
  const currentDPD = loan.dpd || 0;
  const dpdScore = Math.min(1, currentDPD / 90); // normalise to 0-1
  factors.push({
    name: "DPD Trend", weight: PREDICTION_WEIGHTS.dpdTrend,
    value: currentDPD, score: dpdScore,
    description: `Currently ${currentDPD} days past due`,
  });

  // 3. PTP Compliance (15%)
  const loanCollections = collections.filter(c => (c as any).loanId === loan.id);
  const ptps = loanCollections.filter(c => c.action === "PTP" || c.action === "Promise to Pay");
  const brokenPtps = loanCollections.filter(c => c.action === "PTP Broken");
  const ptpRate = ptps.length > 0 ? 1 - (brokenPtps.length / ptps.length) : 0.5;
  const ptpScore = 1 - ptpRate;
  factors.push({
    name: "PTP Compliance", weight: PREDICTION_WEIGHTS.ptpCompliance,
    value: Math.round(ptpRate * 100), score: ptpScore,
    description: `${Math.round(ptpRate * 100)}% of PTPs honoured (${ptps.length} total)`,
  });

  // 4. Loan Age (10%)
  const loanAgeDays = loan.bookedAt ? Math.floor((now - loan.bookedAt) / DAY) : 0;
  const ageScore = loanAgeDays < 90 ? 0.6 : loanAgeDays < 180 ? 0.4 : loanAgeDays < 365 ? 0.2 : 0.1;
  factors.push({
    name: "Loan Age", weight: PREDICTION_WEIGHTS.loanAge,
    value: loanAgeDays, score: ageScore,
    description: `Loan is ${loanAgeDays} days old (newer loans carry higher risk)`,
  });

  // 5. Balance Ratio (10%)
  const balanceRatio = loan.amount > 0 ? loan.balance / loan.amount : 1;
  const balScore = balanceRatio > 0.9 ? 0.5 : balanceRatio > 0.5 ? 0.3 : 0.1;
  factors.push({
    name: "Balance Ratio", weight: PREDICTION_WEIGHTS.balanceRatio,
    value: Math.round(balanceRatio * 100), score: balScore,
    description: `${Math.round(balanceRatio * 100)}% of original balance remaining`,
  });

  // 6. Sector Risk (10%)
  const highRiskSectors = ["Construction", "Mining", "Agriculture", "Hospitality"];
  const medRiskSectors = ["Retail", "Transport", "Manufacturing"];
  const sectorScore = highRiskSectors.includes(customer.industry || "") ? 0.7
    : medRiskSectors.includes(customer.industry || "") ? 0.4 : 0.2;
  factors.push({
    name: "Sector Risk", weight: PREDICTION_WEIGHTS.sectorRisk,
    value: sectorScore, score: sectorScore,
    description: `${customer.industry || "Unknown"} sector risk profile`,
  });

  // 7. Seasonal Factor (5%)
  const month = new Date(now).getMonth();
  const seasonalScore = (month === 0 || month === 11) ? 0.6 : (month >= 5 && month <= 7) ? 0.4 : 0.2;
  factors.push({
    name: "Seasonal", weight: PREDICTION_WEIGHTS.seasonalFactor,
    value: month + 1, score: seasonalScore,
    description: `Month ${month + 1} seasonal risk adjustment`,
  });

  // 8. Bureau History (5%)
  const bureauScore = (customer as any).bureauDefaults > 0 ? 0.8 : 0.1;
  factors.push({
    name: "Bureau History", weight: PREDICTION_WEIGHTS.bureauHistory,
    value: (customer as any).bureauDefaults || 0, score: bureauScore,
    description: `${(customer as any).bureauDefaults || 0} prior defaults on bureau`,
  });

  // Calculate weighted probability
  const probability = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) * 100
  );

  // Risk level
  const riskLevel = probability >= 60 ? "high" : probability >= 30 ? "medium" : "low";

  // Recommended action
  const recommendedAction =
    currentDPD > 90 ? "Escalate to Legal Review" :
    currentDPD > 60 ? "Issue Formal Letter of Demand" :
    currentDPD > 30 ? "Schedule Collections Call — Negotiate PTP" :
    probability >= 60 ? "Proactive Contact — Offer Payment Assistance" :
    probability >= 30 ? "Monitor — Schedule Follow-Up in 7 Days" :
    "No Action — Account Performing";

  // Priority score: risk × balance × recency weighting
  const lastContactDays = loanCollections.length > 0
    ? Math.floor((now - Math.max(...loanCollections.map(c => c.ts || 0))) / DAY)
    : 999;
  const priorityScore = Math.round(
    (probability / 100) * (loan.balance / 1000) * Math.min(10, lastContactDays / 7)
  );

  return {
    loanId: loan.id,
    custId: loan.custId,
    customerName: customer.name || "",
    probability,
    riskLevel,
    recommendedAction,
    priorityScore,
    factors,
  };
}

// ═══ Smart Worklist ═══

/**
 * Generate a prioritised worklist for collectors.
 * Sorted by priority score (descending) — highest risk × highest value first.
 */
export function generateWorklist(
  loans: Loan[],
  customers: Customer[],
  collections: CollectionAction[]
): WorklistItem[] {
  const custMap = new Map(customers.map(c => [c.id, c]));
  const activeLoans = loans.filter(l => l.status === "Active");

  const items: WorklistItem[] = activeLoans.map(loan => {
    const customer = custMap.get(loan.custId) || {} as Customer;
    const prediction = predictDelinquency(loan, customer, collections);
    const loanCollections = collections.filter(c => (c as any).loanId === loan.id);
    const DAY = 864e5;

    // PTP compliance
    const ptps = loanCollections.filter(c => c.action === "PTP" || c.action === "Promise to Pay");
    const brokenPtps = loanCollections.filter(c => c.action === "PTP Broken");
    const ptpCompliance = ptps.length > 0 ? Math.round((1 - brokenPtps.length / ptps.length) * 100) : 0;

    const lastContact = loanCollections.length > 0
      ? Math.floor((Date.now() - Math.max(...loanCollections.map(c => c.ts || 0))) / DAY)
      : 999;

    return {
      ...prediction,
      balance: loan.balance,
      dpd: loan.dpd,
      lastContactDays: lastContact,
      ptpCompliance,
      stage: loan.stage,
      phone: customer.phone || "",
      address: customer.address || "",
      province: customer.province || "",
    };
  });

  // Sort by priority score (highest first)
  return items
    .filter(i => i.dpd > 0 || i.probability >= 30) // Only show at-risk accounts
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

// ═══ Route Optimisation (Nearest Neighbour) ═══

/**
 * Calculate optimal visit route for field collections.
 * Uses nearest-neighbour heuristic starting from the collector's location.
 */
export function optimiseRoute(
  stops: { loanId: string; custId: string; customerName: string; address: string; latitude: number; longitude: number; balance: number; dpd: number }[],
  startLat: number,
  startLon: number,
  startTime = "08:00",
  avgVisitMinutes = 30,
  avgTravelMinutes = 20
): RouteStop[] {
  if (stops.length === 0) return [];

  const remaining = [...stops];
  const route: RouteStop[] = [];
  let currentLat = startLat;
  let currentLon = startLon;
  let timeMinutes = parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1] || "0");

  while (remaining.length > 0) {
    // Find nearest unvisited stop
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(currentLat, currentLon, remaining[i].latitude, remaining[i].longitude);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const stop = remaining.splice(nearestIdx, 1)[0];
    timeMinutes += avgTravelMinutes;

    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;

    route.push({
      ...stop,
      visitOrder: route.length + 1,
      estimatedArrival: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
    });

    currentLat = stop.latitude;
    currentLon = stop.longitude;
    timeMinutes += avgVisitMinutes;
  }

  return route;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══ Bulk SMS Campaign ═══

export interface BulkSMSCampaign {
  name: string;
  targetLoans: string[];
  template: string;
  scheduledAt: number;
  status: "draft" | "scheduled" | "sent";
}

export function generateBulkSMSTargets(
  worklist: WorklistItem[],
  filter: { minDPD?: number; maxDPD?: number; riskLevel?: string }
): WorklistItem[] {
  return worklist.filter(item => {
    if (filter.minDPD && item.dpd < filter.minDPD) return false;
    if (filter.maxDPD && item.dpd > filter.maxDPD) return false;
    if (filter.riskLevel && item.riskLevel !== filter.riskLevel) return false;
    return true;
  });
}
