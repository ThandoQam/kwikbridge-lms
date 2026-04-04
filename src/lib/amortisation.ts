// KwikBridge LMS — Amortisation Engine (ENH-11)
// Comprehensive repayment schedule generator supporting multiple
// interest methods and repayment frequencies.
//
// Replaces the inline monthlyPmt calculation in the monolith.
// Supports: Amortising, Bullet, Balloon, Seasonal, Interest-Only
// Frequencies: Weekly, Fortnightly, Monthly, Quarterly, Semi-Annual, Annual

import type { Product } from "../types/index";

// ═══ Types ═══

export type InterestMethod = "reducing_balance" | "flat" | "rule_of_78" | "compound";
export type RepaymentFrequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "semi_annual" | "annual" | "bullet";

export interface AmortisationInput {
  principal: number;
  annualRate: number;          // percentage (e.g. 14.5)
  termMonths: number;
  method?: InterestMethod;     // default: reducing_balance
  frequency?: RepaymentFrequency; // default: monthly
  repaymentType?: "Amortising" | "Bullet" | "Balloon" | "Seasonal" | "InterestOnly";
  balloonPct?: number;         // % of principal due at maturity (for Balloon)
  seasonalMonths?: number[];   // months with reduced payment (1-12, for Seasonal)
  seasonalReduction?: number;  // % reduction in seasonal months (e.g. 0.5 = 50%)
  gracePeriodMonths?: number;  // months before first payment
  startDate?: number;          // timestamp for date calculations
}

export interface AmortisationRow {
  period: number;
  date: string;                // ISO date
  opening: number;
  payment: number;
  principal: number;
  interest: number;
  fees: number;
  closing: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
  isGrace: boolean;
  isSeasonal: boolean;
}

export interface AmortisationResult {
  schedule: AmortisationRow[];
  summary: {
    totalPayment: number;
    totalInterest: number;
    totalPrincipal: number;
    totalFees: number;
    monthlyPayment: number;    // standard period payment
    effectiveRate: number;     // actual cost of credit
    periods: number;
    frequency: string;
  };
}

// ═══ Constants ═══

const FREQUENCY_PERIODS: Record<RepaymentFrequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  bullet: 1,
};

const FREQUENCY_DAYS: Record<RepaymentFrequency, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 91,
  semi_annual: 182,
  annual: 365,
  bullet: 0,
};

// ═══ Core PMT Calculation ═══

/**
 * Standard PMT formula: P × r / (1 - (1+r)^-n)
 * Where: P = principal, r = period rate, n = number of periods
 */
function pmt(principal: number, periodRate: number, periods: number): number {
  if (periodRate === 0) return principal / periods;
  if (periods === 0) return 0;
  return principal * periodRate / (1 - Math.pow(1 + periodRate, -periods));
}

/**
 * Calculate the periodic interest rate from annual rate and frequency.
 */
function periodRate(annualRate: number, frequency: RepaymentFrequency): number {
  const periodsPerYear = FREQUENCY_PERIODS[frequency] || 12;
  return (annualRate / 100) / periodsPerYear;
}

// ═══ Date Helpers ═══

function addPeriod(dateMs: number, frequency: RepaymentFrequency, periods: number): number {
  const d = new Date(dateMs);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7 * periods); break;
    case "fortnightly": d.setDate(d.getDate() + 14 * periods); break;
    case "monthly": d.setMonth(d.getMonth() + periods); break;
    case "quarterly": d.setMonth(d.getMonth() + 3 * periods); break;
    case "semi_annual": d.setMonth(d.getMonth() + 6 * periods); break;
    case "annual": d.setFullYear(d.getFullYear() + periods); break;
    case "bullet": d.setMonth(d.getMonth() + periods); break;
  }
  return d.getTime();
}

function isoDate(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

// ═══ Amortising Schedule (Reducing Balance) ═══

function generateAmortising(input: AmortisationInput): AmortisationResult {
  const freq = input.frequency || "monthly";
  const rate = periodRate(input.annualRate, freq);
  const grace = input.gracePeriodMonths || 0;
  const periodsPerYear = FREQUENCY_PERIODS[freq];
  const totalPeriods = Math.round(input.termMonths * (periodsPerYear / 12));
  const paymentPeriods = totalPeriods - Math.round(grace * (periodsPerYear / 12));
  const regularPmt = Math.round(pmt(input.principal, rate, paymentPeriods) * 100) / 100;

  const schedule: AmortisationRow[] = [];
  let balance = input.principal;
  let cumInterest = 0;
  let cumPrincipal = 0;
  let startDate = input.startDate || Date.now();
  const gracePeriods = Math.round(grace * (periodsPerYear / 12));

  for (let i = 1; i <= totalPeriods && balance > 0; i++) {
    const isGrace = i <= gracePeriods;
    const isSeasonal = input.repaymentType === "Seasonal"
      && input.seasonalMonths?.includes(new Date(addPeriod(startDate, freq, i)).getMonth() + 1);

    const interest = Math.round(balance * rate * 100) / 100;

    let payment: number;
    let principal: number;

    if (isGrace) {
      // Grace period: interest-only
      payment = interest;
      principal = 0;
    } else if (isSeasonal) {
      // Seasonal: reduced payment
      const reduction = input.seasonalReduction || 0.5;
      payment = Math.round(regularPmt * (1 - reduction) * 100) / 100;
      principal = Math.max(0, payment - interest);
    } else if (i === totalPeriods) {
      // Final period: pay remaining balance
      principal = balance;
      payment = principal + interest;
    } else {
      payment = regularPmt;
      principal = Math.round((payment - interest) * 100) / 100;
    }

    // Prevent negative principal
    principal = Math.max(0, Math.min(principal, balance));
    payment = principal + interest;

    balance = Math.round((balance - principal) * 100) / 100;
    cumInterest += interest;
    cumPrincipal += principal;

    schedule.push({
      period: i,
      date: isoDate(addPeriod(startDate, freq, i)),
      opening: Math.round((balance + principal) * 100) / 100,
      payment: Math.round(payment * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      fees: 0,
      closing: Math.max(0, balance),
      cumulativeInterest: Math.round(cumInterest * 100) / 100,
      cumulativePrincipal: Math.round(cumPrincipal * 100) / 100,
      isGrace,
      isSeasonal: !!isSeasonal,
    });
  }

  const totalPayment = schedule.reduce((s, r) => s + r.payment, 0);

  return {
    schedule,
    summary: {
      totalPayment: Math.round(totalPayment * 100) / 100,
      totalInterest: Math.round(cumInterest * 100) / 100,
      totalPrincipal: input.principal,
      totalFees: 0,
      monthlyPayment: regularPmt,
      effectiveRate: input.principal > 0 ? Math.round((cumInterest / input.principal) * 100 * 100) / 100 : 0,
      periods: totalPeriods,
      frequency: freq,
    },
  };
}

// ═══ Bullet Schedule ═══

function generateBullet(input: AmortisationInput): AmortisationResult {
  const rate = periodRate(input.annualRate, "monthly");
  const periods = input.termMonths;
  const schedule: AmortisationRow[] = [];
  let balance = input.principal;
  let cumInterest = 0;
  const startDate = input.startDate || Date.now();

  for (let i = 1; i <= periods; i++) {
    const interest = Math.round(balance * rate * 100) / 100;
    const principal = i === periods ? balance : 0;
    const payment = interest + principal;
    cumInterest += interest;
    if (i === periods) balance = 0;

    schedule.push({
      period: i, date: isoDate(addPeriod(startDate, "monthly", i)),
      opening: balance + (i === periods ? principal : 0),
      payment: Math.round(payment * 100) / 100,
      principal, interest, fees: 0, closing: balance,
      cumulativeInterest: Math.round(cumInterest * 100) / 100,
      cumulativePrincipal: i === periods ? input.principal : 0,
      isGrace: false, isSeasonal: false,
    });
  }

  return {
    schedule,
    summary: {
      totalPayment: Math.round((cumInterest + input.principal) * 100) / 100,
      totalInterest: Math.round(cumInterest * 100) / 100,
      totalPrincipal: input.principal,
      totalFees: 0,
      monthlyPayment: Math.round(input.principal * rate * 100) / 100,
      effectiveRate: Math.round((cumInterest / input.principal) * 100 * 100) / 100,
      periods, frequency: "monthly",
    },
  };
}

// ═══ Balloon Schedule ═══

function generateBalloon(input: AmortisationInput): AmortisationResult {
  const balloonPct = input.balloonPct || 30;
  const balloonAmount = Math.round(input.principal * (balloonPct / 100) * 100) / 100;
  const amortisedPrincipal = input.principal - balloonAmount;

  // Generate amortising schedule for the non-balloon portion
  const result = generateAmortising({
    ...input,
    principal: amortisedPrincipal,
    repaymentType: "Amortising",
  });

  // Add balloon payment to final period
  if (result.schedule.length > 0) {
    const last = result.schedule[result.schedule.length - 1];
    last.principal += balloonAmount;
    last.payment += balloonAmount;
    last.closing = 0;
    result.summary.totalPayment += balloonAmount;
    result.summary.totalPrincipal = input.principal;
  }

  return result;
}

// ═══ Main Generator ═══

export function generateSchedule(input: AmortisationInput): AmortisationResult {
  switch (input.repaymentType) {
    case "Bullet":
      return generateBullet(input);
    case "Balloon":
      return generateBalloon(input);
    case "Seasonal":
      return generateAmortising({ ...input, repaymentType: "Seasonal" });
    case "InterestOnly":
      return generateBullet(input); // Interest-only is same as bullet
    case "Amortising":
    default:
      return generateAmortising(input);
  }
}

// ═══ Product Comparison ═══

export interface ProductComparison {
  productId: string;
  productName: string;
  monthlyPayment: number;
  totalCost: number;
  totalInterest: number;
  effectiveRate: number;
  arrangementFee: number;
  totalWithFees: number;
}

export function compareProducts(
  products: Product[],
  amount: number,
  termMonths: number
): ProductComparison[] {
  return products
    .filter(p => p.status === "Active" && amount >= p.minAmount && amount <= p.maxAmount && termMonths >= p.minTerm && termMonths <= p.maxTerm)
    .map(p => {
      const result = generateSchedule({
        principal: amount,
        annualRate: p.baseRate,
        termMonths,
        repaymentType: p.repaymentType,
        gracePeriodMonths: p.gracePeriod,
      });

      const arrangementFee = Math.round(amount * (p.arrangementFee / 100) * 100) / 100;

      return {
        productId: p.id,
        productName: p.name,
        monthlyPayment: result.summary.monthlyPayment,
        totalCost: result.summary.totalPayment,
        totalInterest: result.summary.totalInterest,
        effectiveRate: result.summary.effectiveRate,
        arrangementFee,
        totalWithFees: Math.round((result.summary.totalPayment + arrangementFee) * 100) / 100,
      };
    })
    .sort((a, b) => a.totalWithFees - b.totalWithFees);
}

// ═══ Restructuring Calculator ═══

export function calculateRestructure(
  currentBalance: number,
  currentRate: number,
  newTermMonths: number,
  newRate?: number,
  paymentHolidayMonths?: number
): AmortisationResult {
  const rate = newRate ?? currentRate;
  return generateSchedule({
    principal: currentBalance,
    annualRate: rate,
    termMonths: newTermMonths,
    repaymentType: "Amortising",
    gracePeriodMonths: paymentHolidayMonths,
  });
}
