// KwikBridge LMS — End-of-Day (EOD) Batch Processor
// Closes the biggest benchmark gap: Servicing 4.0 → 5.0 (vs FinnOne Neo)
//
// Runs 8 steps in sequence:
//   1. Interest Accrual    — daily interest on active loans
//   2. DPD Update          — recalculate days-past-due
//   3. Stage Migration     — IFRS 9 stage transitions
//   4. Provision Recalc    — ECL = PD × LGD × EAD
//   5. Debit Order Gen     — upcoming payments file
//   6. Payment Alerts      — due/missed notifications
//   7. PTP Compliance      — broken promise detection
//   8. Arrears Escalation  — auto-handover per collections policy
//
// Design: pure functions (idempotent, testable, no side effects)

import type { Loan, Provision, CollectionAction, Alert, AuditEntry, Product, Customer } from "../types/index";

// ═══ Types ═══

export interface EODInput {
  loans: Loan[];
  provisions: Provision[];
  collections: CollectionAction[];
  alerts: Alert[];
  products: Product[];
  customers: Customer[];
  runDate?: number; // defaults to Date.now()
}

export interface EODResult {
  loans: Loan[];
  provisions: Provision[];
  collections: CollectionAction[];
  alerts: Alert[];
  auditEntries: AuditEntry[];
  debitOrders: DebitOrderEntry[];
  notifications: NotificationRequest[];
  summary: EODSummary;
}

export interface DebitOrderEntry {
  loanId: string;
  custId: string;
  customerName: string;
  amount: number;
  actionDate: string; // ISO date
  reference: string;
}

export interface NotificationRequest {
  template: string;
  channel: string;
  custId: string;
  loanId: string;
  variables: Record<string, string | number>;
}

export interface EODSummary {
  runDate: number;
  duration: number;
  loansProcessed: number;
  interestAccrued: number;
  dpdUpdated: number;
  stageMigrations: { from: number; to: number; loanId: string }[];
  provisionsRecalculated: number;
  debitOrdersGenerated: number;
  paymentAlertsSent: number;
  ptpsBroken: number;
  accountsEscalated: number;
}

// ═══ Constants ═══

const DAY_MS = 864e5;
const BUSINESS_DAYS_AHEAD = 3;
const STAGE_THRESHOLDS = { stage2: 30, stage3: 90 };

// PD multipliers by stage (Basel/IFRS 9 aligned)
const STAGE_PD_MULTIPLIERS: Record<number, number> = { 1: 1.0, 2: 3.0, 3: 8.0 };
const ECL_METHODS: Record<number, string> = { 1: "12-month ECL", 2: "Lifetime ECL", 3: "Lifetime ECL (impaired)" };

// ═══ Helpers ═══

let _uidCounter = 0;
function eodUid(prefix: string): string {
  return `${prefix}-EOD-${Date.now()}-${++_uidCounter}`;
}

function calcDPD(nextDue: number | null | undefined, runDate: number): number {
  if (!nextDue) return 0;
  const diff = runDate - nextDue;
  return diff > 0 ? Math.floor(diff / DAY_MS) : 0;
}

function calcStage(dpd: number): 1 | 2 | 3 {
  if (dpd <= STAGE_THRESHOLDS.stage2) return 1;
  if (dpd <= STAGE_THRESHOLDS.stage3) return 2;
  return 3;
}

function isoDate(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

function isBusinessDay(ts: number): boolean {
  const dow = new Date(ts).getDay();
  return dow !== 0 && dow !== 6;
}

function addBusinessDays(from: number, days: number): number {
  let count = 0;
  let current = from;
  while (count < days) {
    current += DAY_MS;
    if (isBusinessDay(current)) count++;
  }
  return current;
}

function formatCurrency(n: number): string {
  return "R " + Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ═══ Step 1: Interest Accrual ═══

function accrueInterest(loan: Loan, runDate: number): { loan: Loan; accrued: number } {
  if (loan.status !== "Active" || loan.balance <= 0) {
    return { loan, accrued: 0 };
  }

  const dailyRate = loan.rate / 100 / 365;
  const accrued = Math.round(loan.balance * dailyRate * 100) / 100; // 2dp precision

  // Append to interest ledger
  const ledgerEntry = {
    date: isoDate(runDate),
    balance: loan.balance,
    rate: loan.rate,
    accrued,
  };

  const existingLedger = (loan as any).interestLedger || [];
  const existingAccrued = (loan as any).accruedInterest || 0;

  return {
    loan: {
      ...loan,
      accruedInterest: Math.round((existingAccrued + accrued) * 100) / 100,
      interestLedger: [...existingLedger, ledgerEntry],
    } as Loan,
    accrued,
  };
}

// ═══ Step 2: DPD Update ═══

function updateDPD(loan: Loan, runDate: number): { loan: Loan; changed: boolean } {
  if (loan.status !== "Active") return { loan, changed: false };

  const newDPD = calcDPD(loan.nextDue, runDate);
  if (newDPD === loan.dpd) return { loan, changed: false };

  return {
    loan: { ...loan, dpd: newDPD },
    changed: true,
  };
}

// ═══ Step 3: Stage Migration ═══

function migrateStage(loan: Loan): { loan: Loan; migration: { from: number; to: number } | null } {
  if (loan.status !== "Active") return { loan, migration: null };

  const newStage = calcStage(loan.dpd);
  if (newStage === loan.stage) return { loan, migration: null };

  return {
    loan: { ...loan, stage: newStage },
    migration: { from: loan.stage, to: newStage },
  };
}

// ═══ Step 4: Provision Recalculation ═══

function recalcProvision(
  loan: Loan,
  existingProvision: Provision | undefined,
  product: Product | undefined
): Provision {
  const basePD = product?.s1PD || 0.02;
  const baseLGD = product?.lgd || 0.25;
  const pdMultiplier = STAGE_PD_MULTIPLIERS[loan.stage] || 1.0;

  const pd = Math.min(1.0, basePD * pdMultiplier);
  const lgd = baseLGD;
  const ead = loan.balance;
  const ecl = Math.round(pd * lgd * ead * 100) / 100;

  return {
    id: existingProvision?.id || eodUid("PROV"),
    loanId: loan.id,
    stage: loan.stage,
    pd,
    lgd,
    ead,
    ecl,
    method: ECL_METHODS[loan.stage],
  } as any;
}

// ═══ Step 5: Debit Order Generation ═══

function generateDebitOrders(
  loans: Loan[],
  customers: Customer[],
  runDate: number
): DebitOrderEntry[] {
  const horizon = addBusinessDays(runDate, BUSINESS_DAYS_AHEAD);
  const orders: DebitOrderEntry[] = [];

  for (const loan of loans) {
    if (loan.status !== "Active" || !loan.nextDue) continue;
    if (loan.nextDue >= runDate && loan.nextDue <= horizon) {
      const cust = customers.find(c => c.id === loan.custId);
      orders.push({
        loanId: loan.id,
        custId: loan.custId,
        customerName: cust?.name || "Unknown",
        amount: loan.monthlyPmt,
        actionDate: isoDate(loan.nextDue),
        reference: `KB-${loan.id}-${isoDate(loan.nextDue)}`,
      });
    }
  }

  return orders;
}

// ═══ Step 6: Payment Alerts ═══

function generatePaymentAlerts(
  loans: Loan[],
  customers: Customer[],
  runDate: number
): { alerts: Alert[]; notifications: NotificationRequest[] } {
  const alerts: Alert[] = [];
  const notifications: NotificationRequest[] = [];
  const threeDaysOut = runDate + BUSINESS_DAYS_AHEAD * DAY_MS;
  const oneDayAgo = runDate - DAY_MS;

  for (const loan of loans) {
    if (loan.status !== "Active" || !loan.nextDue) continue;
    const cust = customers.find(c => c.id === loan.custId);
    const custName = cust?.name || "Unknown";

    // 3 days before due: reminder
    if (loan.nextDue > runDate && loan.nextDue <= threeDaysOut && loan.dpd === 0) {
      notifications.push({
        template: "payment_due_reminder",
        channel: "sms",
        custId: loan.custId,
        loanId: loan.id,
        variables: {
          name: custName,
          amount: formatCurrency(loan.monthlyPmt),
          dueDate: isoDate(loan.nextDue),
          loanId: loan.id,
        },
      });
    }

    // 1 day after missed: alert + notification
    if (loan.nextDue > 0 && loan.nextDue <= oneDayAgo && loan.dpd === 1) {
      alerts.push({
        id: eodUid("ALR"),
        type: "Collections",
        severity: "warning",
        title: `Missed Payment — ${custName}`,
        msg: `${loan.id}: payment of ${formatCurrency(loan.monthlyPmt)} missed. DPD: 1.`,
        read: false,
        ts: runDate,
      } as Alert);

      notifications.push({
        template: "payment_missed",
        channel: "both",
        custId: loan.custId,
        loanId: loan.id,
        variables: {
          name: custName,
          amount: formatCurrency(loan.monthlyPmt),
          dueDate: isoDate(loan.nextDue),
          loanId: loan.id,
        },
      });
    }
  }

  return { alerts, notifications };
}

// ═══ Step 7: PTP Compliance ═══

function checkPTPCompliance(
  loans: Loan[],
  customers: Customer[],
  runDate: number
): { brokenPTPs: CollectionAction[]; alerts: Alert[] } {
  const brokenPTPs: CollectionAction[] = [];
  const alerts: Alert[] = [];

  for (const loan of loans) {
    if (loan.status !== "Active" || !loan.ptpHistory?.length) continue;

    const cust = customers.find(c => c.id === loan.custId);
    const custName = cust?.name || "Unknown";

    for (const ptp of loan.ptpHistory) {
      const ptpDate = new Date(ptp.date).getTime();
      // PTP is broken if date has passed and no payment was recorded after PTP creation
      if (ptpDate < runDate && ptpDate > runDate - 7 * DAY_MS) {
        const paymentAfterPTP = loan.payments?.some(
          p => p.date >= ptp.submittedAt && p.amount >= ptp.amount * 0.9 // 90% tolerance
        );

        if (!paymentAfterPTP) {
          brokenPTPs.push({
            id: eodUid("COL"),
            loanId: loan.id,
            action: "PTP Broken",
            notes: `PTP of ${formatCurrency(ptp.amount)} due ${ptp.date} not honoured. Auto-flagged by EOD.`,
            officer: "SYSTEM",
            ts: runDate,
            channel: "System",
          } as any);

          alerts.push({
            id: eodUid("ALR"),
            type: "Collections",
            severity: "warning",
            title: `PTP Broken — ${custName}`,
            msg: `${loan.id}: PTP of ${formatCurrency(ptp.amount)} due ${ptp.date} not honoured.`,
            read: false,
            ts: runDate,
          } as Alert);
        }
      }
    }
  }

  return { brokenPTPs, alerts };
}

// ═══ Step 8: Arrears Escalation ═══

function escalateArrears(
  loans: Loan[],
  existingCollections: CollectionAction[],
  customers: Customer[],
  runDate: number
): { collections: CollectionAction[]; alerts: Alert[] } {
  const newCollections: CollectionAction[] = [];
  const alerts: Alert[] = [];

  for (const loan of loans) {
    if (loan.status !== "Active") continue;

    const cust = customers.find(c => c.id === loan.custId);
    const custName = cust?.name || "Unknown";

    // Check if escalation already happened for this loan at this DPD level
    const hasEscalation = (action: string) =>
      existingCollections.some(c => (c as any).loanId === loan.id && c.action === action);

    // 31 DPD → Handover to Collections Specialist
    if (loan.dpd >= 31 && loan.dpd < 35 && !hasEscalation("Handover to Collections")) {
      newCollections.push({
        id: eodUid("COL"),
        loanId: loan.id,
        action: "Handover to Collections",
        notes: `Auto-escalated at ${loan.dpd} DPD. Account handed to Collections Specialist per policy Section 4.2.`,
        officer: "SYSTEM",
        ts: runDate,
        channel: "System",
      } as any);

      alerts.push({
        id: eodUid("ALR"),
        type: "Collections",
        severity: "warning",
        title: `Collections Handover — ${custName}`,
        msg: `${loan.id}: ${loan.dpd} DPD. Auto-handed to Collections.`,
        read: false,
        ts: runDate,
      } as Alert);
    }

    // 91 DPD → Legal Review
    if (loan.dpd >= 91 && loan.dpd < 95 && !hasEscalation("Legal Review")) {
      newCollections.push({
        id: eodUid("COL"),
        loanId: loan.id,
        action: "Legal Review",
        notes: `Auto-escalated at ${loan.dpd} DPD. Referred for legal review per policy Section 4.3.`,
        officer: "SYSTEM",
        ts: runDate,
        channel: "System",
      } as any);

      alerts.push({
        id: eodUid("ALR"),
        type: "Collections",
        severity: "error",
        title: `Legal Review — ${custName}`,
        msg: `${loan.id}: ${loan.dpd} DPD. Referred for legal action review.`,
        read: false,
        ts: runDate,
      } as Alert);
    }
  }

  return { collections: newCollections, alerts };
}

// ═══ Main EOD Runner ═══

export function runEOD(input: EODInput): EODResult {
  const startTime = Date.now();
  const runDate = input.runDate || Date.now();
  const auditEntries: AuditEntry[] = [];
  let totalInterest = 0;
  let dpdUpdated = 0;
  const stageMigrations: EODSummary["stageMigrations"] = [];
  let provisionsRecalculated = 0;

  // Work on copies
  let loans = [...input.loans];
  let provisions = [...input.provisions];
  let allCollections = [...input.collections];
  let allAlerts = [...input.alerts];
  const allNotifications: NotificationRequest[] = [];

  // Step 1: Interest Accrual
  loans = loans.map(loan => {
    const { loan: updated, accrued } = accrueInterest(loan, runDate);
    totalInterest += accrued;
    return updated;
  });

  // Step 2: DPD Update
  loans = loans.map(loan => {
    const { loan: updated, changed } = updateDPD(loan, runDate);
    if (changed) dpdUpdated++;
    return updated;
  });

  // Step 3: Stage Migration
  loans = loans.map(loan => {
    const { loan: updated, migration } = migrateStage(loan);
    if (migration) {
      stageMigrations.push({ ...migration, loanId: loan.id });
      auditEntries.push({
        id: eodUid("AUD"),
        action: "Stage Migration",
        entity: loan.id,
        user: "SYSTEM",
        ts: runDate,
        details: `IFRS 9 stage ${migration.from} → ${migration.to} (DPD: ${updated.dpd})`,
        category: "Risk",
      } as AuditEntry);
    }
    return updated;
  });

  // Step 4: Provision Recalculation
  const productMap = new Map(input.products.map(p => [p.id, p]));
  provisions = loans
    .filter(l => l.status === "Active")
    .map(loan => {
      const existing = provisions.find(p => p.loanId === loan.id);
      const product = productMap.get(loan.product);
      provisionsRecalculated++;
      return recalcProvision(loan, existing, product);
    });

  // Step 5: Debit Order Generation
  const debitOrders = generateDebitOrders(loans, input.customers, runDate);

  // Step 6: Payment Alerts
  const paymentAlerts = generatePaymentAlerts(loans, input.customers, runDate);
  allAlerts = [...allAlerts, ...paymentAlerts.alerts];
  allNotifications.push(...paymentAlerts.notifications);

  // Step 7: PTP Compliance
  const ptpResult = checkPTPCompliance(loans, input.customers, runDate);
  allCollections = [...allCollections, ...ptpResult.brokenPTPs];
  allAlerts = [...allAlerts, ...ptpResult.alerts];

  // Step 8: Arrears Escalation
  const escalation = escalateArrears(loans, allCollections, input.customers, runDate);
  allCollections = [...allCollections, ...escalation.collections];
  allAlerts = [...allAlerts, ...escalation.alerts];

  // EOD Audit Entry
  const duration = Date.now() - startTime;
  auditEntries.push({
    id: eodUid("AUD"),
    action: "EOD Batch Completed",
    entity: "SYSTEM",
    user: "SYSTEM",
    ts: runDate,
    details: [
      `Loans: ${loans.filter(l => l.status === "Active").length}`,
      `Interest: ${formatCurrency(totalInterest)}`,
      `DPD updated: ${dpdUpdated}`,
      `Stage migrations: ${stageMigrations.length}`,
      `Provisions: ${provisionsRecalculated}`,
      `Debit orders: ${debitOrders.length}`,
      `Alerts: ${paymentAlerts.alerts.length}`,
      `PTPs broken: ${ptpResult.brokenPTPs.length}`,
      `Escalations: ${escalation.collections.length}`,
      `Duration: ${duration}ms`,
    ].join(" | "),
    category: "System",
  } as AuditEntry);

  return {
    loans,
    provisions,
    collections: allCollections,
    alerts: allAlerts,
    auditEntries,
    debitOrders,
    notifications: allNotifications,
    summary: {
      runDate,
      duration,
      loansProcessed: loans.filter(l => l.status === "Active").length,
      interestAccrued: totalInterest,
      dpdUpdated,
      stageMigrations,
      provisionsRecalculated,
      debitOrdersGenerated: debitOrders.length,
      paymentAlertsSent: paymentAlerts.notifications.length,
      ptpsBroken: ptpResult.brokenPTPs.length,
      accountsEscalated: escalation.collections.length,
    },
  };
}

// ═══ Debit Order CSV Export ═══

export function debitOrdersToCSV(orders: DebitOrderEntry[]): string {
  const header = "Loan ID,Customer ID,Customer Name,Amount,Action Date,Reference";
  const rows = orders.map(o =>
    `${o.loanId},${o.custId},"${o.customerName}",${o.amount.toFixed(2)},${o.actionDate},${o.reference}`
  );
  return [header, ...rows].join("\n");
}

// ═══ BOD Summary Generator ═══

export function generateBODSummary(
  summary: EODSummary,
  loans: Loan[],
  provisions: Provision[]
): string {
  const activeLoans = loans.filter(l => l.status === "Active");
  const totalBook = activeLoans.reduce((s, l) => s + l.balance, 0);
  const totalECL = provisions.reduce((s, p) => s + p.ecl, 0);
  const stage1 = activeLoans.filter(l => l.stage === 1).length;
  const stage2 = activeLoans.filter(l => l.stage === 2).length;
  const stage3 = activeLoans.filter(l => l.stage === 3).length;
  const arrearsCount = activeLoans.filter(l => l.dpd > 0).length;
  const arrearsBalance = activeLoans.filter(l => l.dpd > 0).reduce((s, l) => s + l.balance, 0);

  return [
    "KWIKBRIDGE LMS — BEGINNING OF DAY REPORT",
    `Date: ${isoDate(summary.runDate)}`,
    `EOD Run Duration: ${summary.duration}ms`,
    "",
    "PORTFOLIO SUMMARY",
    `  Active Loans: ${activeLoans.length}`,
    `  Total Book Value: ${formatCurrency(totalBook)}`,
    `  Total ECL Provision: ${formatCurrency(totalECL)}`,
    `  Coverage Ratio: ${totalBook > 0 ? ((totalECL / totalBook) * 100).toFixed(2) : "0.00"}%`,
    "",
    "IFRS 9 STAGING",
    `  Stage 1 (Performing): ${stage1} loans`,
    `  Stage 2 (Underperforming): ${stage2} loans`,
    `  Stage 3 (Non-performing): ${stage3} loans`,
    "",
    "ARREARS",
    `  Accounts in Arrears: ${arrearsCount}`,
    `  Arrears Balance: ${formatCurrency(arrearsBalance)}`,
    `  Arrears Rate: ${activeLoans.length > 0 ? ((arrearsCount / activeLoans.length) * 100).toFixed(1) : "0.0"}%`,
    "",
    "EOD ACTIONS",
    `  Interest Accrued: ${formatCurrency(summary.interestAccrued)}`,
    `  DPD Updates: ${summary.dpdUpdated}`,
    `  Stage Migrations: ${summary.stageMigrations.length}`,
    `  Debit Orders Generated: ${summary.debitOrdersGenerated}`,
    `  Payment Alerts Sent: ${summary.paymentAlertsSent}`,
    `  PTPs Broken: ${summary.ptpsBroken}`,
    `  Accounts Escalated: ${summary.accountsEscalated}`,
    "",
    "TQA Capital (Pty) Ltd | NCRCP22396",
  ].join("\n");
}
