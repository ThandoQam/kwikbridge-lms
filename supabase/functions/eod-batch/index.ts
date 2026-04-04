// KwikBridge LMS — EOD Batch Edge Function
// Runs daily via Supabase cron or manual trigger.
// Deploy: supabase functions deploy eod-batch
// Schedule: Set up pg_cron in Supabase Dashboard → Database → Extensions
//
//   SELECT cron.schedule('eod-batch', '0 22 * * *',
//     $$SELECT net.http_post(
//       'https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/eod-batch',
//       '{}', 'application/json',
//       ARRAY[net.http_header('Authorization','Bearer ' || current_setting('app.settings.service_role_key'))]
//     )$$
//   );

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function sbGet(table: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?order=id`, { headers });
  return r.ok ? r.json() : [];
}

async function sbUpsert(table: string, rows: any[]) {
  if (!rows.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

// Snake/camel conversion
const toSnake = (s: string) => s.replace(/([A-Z])/g, "_$1").toLowerCase();
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
const mapKeys = (obj: any, fn: (s: string) => string) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) out[fn(k)] = v;
  return out;
};
const fromDb = (row: any) => mapKeys(row, toCamel);
const toDb = (row: any) => mapKeys(row, toSnake);

// Inline EOD logic (Edge Functions can't import from src/)
const DAY_MS = 864e5;

function calcDPD(nextDue: number, runDate: number): number {
  if (!nextDue) return 0;
  const diff = runDate - nextDue;
  return diff > 0 ? Math.floor(diff / DAY_MS) : 0;
}

function calcStage(dpd: number): number {
  if (dpd <= 30) return 1;
  if (dpd <= 90) return 2;
  return 3;
}

let uidC = 0;
function uid(prefix: string) { return `${prefix}-EOD-${Date.now()}-${++uidC}`; }

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "authorization, content-type, apikey" },
    });
  }

  const startTime = Date.now();
  const runDate = Date.now();

  try {
    // Load data
    const [loansRaw, provisionsRaw, productsRaw, customersRaw, collectionsRaw] = await Promise.all([
      sbGet("loans"), sbGet("provisions"), sbGet("products"), sbGet("customers"), sbGet("collections"),
    ]);

    const loans = loansRaw.map(fromDb);
    const provisions = provisionsRaw.map(fromDb);
    const products = productsRaw.map(fromDb);
    const customers = customersRaw.map(fromDb);

    const activeLoans = loans.filter((l: any) => l.status === "Active");
    const updatedLoans: any[] = [];
    const updatedProvisions: any[] = [];
    const newAudit: any[] = [];
    const newAlerts: any[] = [];
    const newCollections: any[] = [];
    let totalInterest = 0;
    let dpdUpdated = 0;
    const migrations: any[] = [];

    for (const loan of activeLoans) {
      let updated = { ...loan };

      // Step 1: Interest accrual
      const dailyRate = loan.rate / 100 / 365;
      const accrued = Math.round(loan.balance * dailyRate * 100) / 100;
      updated.accruedInterest = (loan.accruedInterest || 0) + accrued;
      totalInterest += accrued;

      // Step 2: DPD
      const newDPD = calcDPD(loan.nextDue, runDate);
      if (newDPD !== loan.dpd) { dpdUpdated++; updated.dpd = newDPD; }

      // Step 3: Stage
      const newStage = calcStage(updated.dpd);
      if (newStage !== loan.stage) {
        migrations.push({ from: loan.stage, to: newStage, loanId: loan.id });
        updated.stage = newStage;
        newAudit.push({
          id: uid("AUD"), action: "Stage Migration", entity: loan.id, user: "SYSTEM", ts: runDate,
          details: `Stage ${loan.stage} → ${newStage} (DPD: ${updated.dpd})`, category: "Risk",
        });
      }

      // Step 4: Provision
      const product = products.find((p: any) => p.id === loan.product);
      const basePD = product?.s1Pd || 0.02;
      const pdMult = newStage === 1 ? 1.0 : newStage === 2 ? 3.0 : 8.0;
      const pd = Math.min(1.0, basePD * pdMult);
      const lgd = product?.lgd || 0.25;
      const existing = provisions.find((p: any) => p.loanId === loan.id);
      updatedProvisions.push({
        id: existing?.id || uid("PROV"), loanId: loan.id, stage: newStage,
        pd, lgd, ead: updated.balance, ecl: Math.round(pd * lgd * updated.balance * 100) / 100,
      });

      // Step 6: Missed payment alert (1 day after)
      if (loan.nextDue && loan.nextDue <= runDate - DAY_MS && updated.dpd === 1) {
        const cust = customers.find((c: any) => c.id === loan.custId);
        newAlerts.push({
          id: uid("ALR"), type: "Collections", severity: "warning",
          title: `Missed Payment — ${cust?.name || loan.custId}`,
          msg: `${loan.id}: payment missed. DPD: 1.`, read: false, ts: runDate,
        });
      }

      // Step 8: Arrears escalation
      const hasAction = (action: string) => collectionsRaw.some((c: any) =>
        fromDb(c).loanId === loan.id && fromDb(c).action === action);

      if (updated.dpd >= 31 && updated.dpd < 35 && !hasAction("Handover to Collections")) {
        const cust = customers.find((c: any) => c.id === loan.custId);
        newCollections.push({
          id: uid("COL"), loanId: loan.id, action: "Handover to Collections",
          notes: `Auto-escalated at ${updated.dpd} DPD.`, officer: "SYSTEM", ts: runDate, channel: "System",
        });
        newAlerts.push({
          id: uid("ALR"), type: "Collections", severity: "warning",
          title: `Collections Handover — ${cust?.name || ""}`, msg: `${loan.id}: ${updated.dpd} DPD.`,
          read: false, ts: runDate,
        });
      }

      if (updated.dpd >= 91 && updated.dpd < 95 && !hasAction("Legal Review")) {
        const cust = customers.find((c: any) => c.id === loan.custId);
        newCollections.push({
          id: uid("COL"), loanId: loan.id, action: "Legal Review",
          notes: `Auto-escalated at ${updated.dpd} DPD.`, officer: "SYSTEM", ts: runDate, channel: "System",
        });
        newAlerts.push({
          id: uid("ALR"), type: "Collections", severity: "error",
          title: `Legal Review — ${cust?.name || ""}`, msg: `${loan.id}: ${updated.dpd} DPD.`,
          read: false, ts: runDate,
        });
      }

      updatedLoans.push(updated);
    }

    // EOD summary audit
    const duration = Date.now() - startTime;
    newAudit.push({
      id: uid("AUD"), action: "EOD Batch Completed", entity: "SYSTEM", user: "SYSTEM", ts: runDate,
      details: `Loans: ${activeLoans.length} | Interest: R${totalInterest.toFixed(2)} | DPD: ${dpdUpdated} | Migrations: ${migrations.length} | Duration: ${duration}ms`,
      category: "System",
    });

    // Persist
    await Promise.all([
      sbUpsert("loans", updatedLoans.map(toDb)),
      sbUpsert("provisions", updatedProvisions.map(toDb)),
      sbUpsert("audit_trail", newAudit.map(toDb)),
      sbUpsert("alerts", newAlerts.map(toDb)),
      sbUpsert("collections", newCollections.map(toDb)),
    ]);

    const summary = {
      status: "completed", runDate, duration, loansProcessed: activeLoans.length,
      interestAccrued: totalInterest, dpdUpdated, stageMigrations: migrations.length,
      provisionsRecalculated: updatedProvisions.length, alertsGenerated: newAlerts.length,
      escalations: newCollections.length,
    };

    console.log("[EOD]", JSON.stringify(summary));

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("[EOD] Error:", error);
    return new Response(JSON.stringify({ status: "failed", error: String(error) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
