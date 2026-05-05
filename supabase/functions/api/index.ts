// KwikBridge LMS — Unified REST API (ENH-09)
// Backend-for-Frontend (BFF) layer exposing RESTful endpoints.
// Enables mobile apps, third-party integrations, and wholesale funder data feeds.
//
// Deploy: supabase functions deploy api
// Base URL: https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/api
//
// Endpoints:
//   GET    /customers            — list customers (paginated)
//   GET    /customers/:id        — single customer
//   GET    /applications         — list applications (paginated, filterable)
//   POST   /applications         — create application
//   PUT    /applications/:id     — update application status
//   GET    /loans                — list loans (filterable by status, stage)
//   GET    /loans/:id            — single loan with payments
//   POST   /loans/:id/payments   — record payment
//   GET    /portfolio/summary    — portfolio KPIs
//   GET    /portfolio/provisions — IFRS 9 provisioning summary
//   POST   /eod/trigger          — trigger EOD batch (admin only)
//   GET    /products             — list active products

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

// ═══ Helpers ═══

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

const toSnake = (s: string) => s.replace(/([A-Z])/g, "_$1").toLowerCase();
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
const mapKeys = (obj: any, fn: (s: string) => string): any => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) out[fn(k)] = v;
  return out;
};
const fromDb = (row: any) => mapKeys(row, toCamel);
const toDb = (row: any) => mapKeys(row, toSnake);

// ═══ Auth / RBAC ═══

interface UserContext {
  userId: string;
  email: string;
  role: string;
  isStaff: boolean;
  isAdmin: boolean;
  isReadOnly: boolean;
}

async function authenticate(req: Request): Promise<UserContext | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  // Verify token with Supabase Auth
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  const user = await res.json();

  const role = user.user_metadata?.app_role || "BORROWER";
  return {
    userId: user.id,
    email: user.email,
    role,
    isStaff: role !== "BORROWER",
    isAdmin: ["ADMIN", "EXEC"].includes(role),
    isReadOnly: ["AUDITOR", "VIEWER"].includes(role),
  };
}

function requireAuth(user: UserContext | null): Response | null {
  if (!user) return error("Authentication required", 401);
  return null;
}

function requireRole(user: UserContext | null, roles: string[]): Response | null {
  const authErr = requireAuth(user);
  if (authErr) return authErr;
  if (!roles.includes(user!.role)) return error("Insufficient permissions", 403);
  return null;
}

// ═══ Supabase Queries ═══

async function query(table: string, params = "", token?: string) {
  const key = token || SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
  return r.ok ? r.json() : [];
}

async function upsert(table: string, rows: any[]) {
  if (!rows.length) return;
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
}

// ═══ Pagination ═══

function paginate(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ═══ Rate Limiting (token bucket per IP/user) ═══
// In-memory rate limiter — resets when Edge Function instance recycles.
// For production-grade limiting, swap for Redis or Supabase realtime channel.

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_LIMIT_PER_MINUTE = 60;       // 60 requests per minute default
const RATE_LIMIT_PER_MINUTE_AUTH = 300;  // 300 for authenticated users
const REFILL_INTERVAL_MS = 60_000;

function checkRateLimit(key: string, isAuthenticated = false): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const limit = isAuthenticated ? RATE_LIMIT_PER_MINUTE_AUTH : RATE_LIMIT_PER_MINUTE;

  let bucket = rateBuckets.get(key);
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
    rateBuckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= REFILL_INTERVAL_MS) {
    bucket.tokens = limit;
    bucket.lastRefill = now;
  } else {
    // Partial refill
    const refillRate = limit / REFILL_INTERVAL_MS;
    const refilled = Math.floor(elapsed * refillRate);
    if (refilled > 0) {
      bucket.tokens = Math.min(limit, bucket.tokens + refilled);
      bucket.lastRefill = now;
    }
  }

  if (bucket.tokens <= 0) {
    return { allowed: false, remaining: 0, resetAt: bucket.lastRefill + REFILL_INTERVAL_MS };
  }

  bucket.tokens -= 1;
  return { allowed: true, remaining: bucket.tokens, resetAt: bucket.lastRefill + REFILL_INTERVAL_MS };
}

function getRateLimitKey(req: Request, user: UserContext | null): string {
  // Authenticated users: limit per user
  if (user?.userId) return `user:${user.userId}`;
  // Anonymous: limit per IP (Cloudflare/Supabase forwards real IP in CF-Connecting-IP)
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  return `ip:${ip.split(",")[0].trim()}`;
}

// Cleanup stale buckets periodically (prevent memory leak in long-running instances)
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000; // 5 minutes
  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.lastRefill < cutoff) rateBuckets.delete(key);
  }
}, 60_000);

// ═══ Route Handler ═══

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // Extract path after /api (handle both /api/x and /functions/v1/api/x)
  const fullPath = url.pathname;
  const apiIdx = fullPath.indexOf("/api");
  const path = apiIdx >= 0 ? fullPath.slice(apiIdx + 4) : fullPath;
  const segments = path.split("/").filter(Boolean);
  const method = req.method;

  // Authenticate
  const user = await authenticate(req);

  try {
    // ═══ GET /products ═══
    if (method === "GET" && segments[0] === "products") {
      const rows = await query("products", "?order=name&status=eq.Active");
      return json({ data: rows.map(fromDb), count: rows.length });
    }

    // ═══ GET /customers ═══
    if (method === "GET" && segments[0] === "customers" && !segments[1]) {
      const authErr = requireAuth(user);
      if (authErr) return authErr;

      const { limit, offset } = paginate(url);
      let filter = `?order=name&limit=${limit}&offset=${offset}`;

      // Borrowers can only see their own
      if (!user!.isStaff) {
        filter += `&email=eq.${encodeURIComponent(user!.email)}`;
      }

      const rows = await query("customers", filter);
      return json({ data: rows.map(fromDb), page: paginate(url).page, limit });
    }

    // ═══ GET /customers/:id ═══
    if (method === "GET" && segments[0] === "customers" && segments[1]) {
      const authErr = requireAuth(user);
      if (authErr) return authErr;

      const rows = await query("customers", `?id=eq.${segments[1]}`);
      if (!rows.length) return error("Customer not found", 404);
      const cust = fromDb(rows[0]);

      // Borrowers can only see own
      if (!user!.isStaff && cust.email !== user!.email) return error("Access denied", 403);

      return json({ data: cust });
    }

    // ═══ GET /applications ═══
    if (method === "GET" && segments[0] === "applications" && !segments[1]) {
      const authErr = requireAuth(user);
      if (authErr) return authErr;

      const { limit, offset } = paginate(url);
      let filter = `?order=created_at.desc&limit=${limit}&offset=${offset}`;

      const status = url.searchParams.get("status");
      if (status) filter += `&status=eq.${encodeURIComponent(status)}`;

      if (!user!.isStaff) {
        // Get borrower's customer ID first
        const custs = await query("customers", `?email=eq.${encodeURIComponent(user!.email)}&select=id`);
        if (custs.length) filter += `&cust_id=eq.${custs[0].id}`;
        else return json({ data: [], page: 1, limit });
      }

      const rows = await query("applications", filter);
      return json({ data: rows.map(fromDb), page: paginate(url).page, limit });
    }

    // ═══ POST /applications ═══
    if (method === "POST" && segments[0] === "applications" && !segments[1]) {
      const authErr = requireAuth(user);
      if (authErr) return authErr;

      const body = await req.json();
      if (!body.custId || !body.product || !body.amount || !body.term) {
        return error("Missing required fields: custId, product, amount, term");
      }

      const app = toDb({
        id: `APP-${Date.now()}`,
        ...body,
        status: "Draft",
        createdAt: Date.now(),
        createdBy: user!.email,
      });

      await upsert("applications", [app]);
      return json({ data: fromDb(app), message: "Application created" }, 201);
    }

    // ═══ PUT /applications/:id ═══
    if (method === "PUT" && segments[0] === "applications" && segments[1]) {
      const roleErr = requireRole(user, ["ADMIN", "EXEC", "CREDIT_HEAD", "CREDIT_SNR", "CREDIT", "LOAN_OFFICER", "COMPLIANCE"]);
      if (roleErr) return roleErr;

      const body = await req.json();
      const update = toDb({ ...body, id: segments[1] });
      await upsert("applications", [update]);

      return json({ message: "Application updated" });
    }

    // ═══ GET /loans ═══
    if (method === "GET" && segments[0] === "loans" && !segments[1]) {
      const authErr = requireAuth(user);
      if (authErr) return authErr;

      const { limit, offset } = paginate(url);
      let filter = `?order=id&limit=${limit}&offset=${offset}`;

      const status = url.searchParams.get("status");
      if (status) filter += `&status=eq.${encodeURIComponent(status)}`;

      const stageParam = url.searchParams.get("stage");
      if (stageParam) filter += `&stage=eq.${stageParam}`;

      if (!user!.isStaff) {
        const custs = await query("customers", `?email=eq.${encodeURIComponent(user!.email)}&select=id`);
        if (custs.length) filter += `&cust_id=eq.${custs[0].id}`;
        else return json({ data: [], page: 1, limit });
      }

      const rows = await query("loans", filter);
      return json({ data: rows.map(fromDb), page: paginate(url).page, limit });
    }

    // ═══ GET /loans/:id ═══
    if (method === "GET" && segments[0] === "loans" && segments[1] && segments.length === 2) {
      const authErr = requireAuth(user);
      if (authErr) return authErr;

      const rows = await query("loans", `?id=eq.${segments[1]}`);
      if (!rows.length) return error("Loan not found", 404);
      return json({ data: fromDb(rows[0]) });
    }

    // ═══ POST /loans/:id/payments ═══
    if (method === "POST" && segments[0] === "loans" && segments[1] && segments[2] === "payments") {
      const roleErr = requireRole(user, ["ADMIN", "EXEC", "CREDIT_HEAD", "FINANCE", "LOAN_OFFICER", "SERVICING"]);
      if (roleErr) return roleErr;

      const body = await req.json();
      if (!body.amount || body.amount <= 0) return error("Invalid payment amount");

      const loanRows = await query("loans", `?id=eq.${segments[1]}`);
      if (!loanRows.length) return error("Loan not found", 404);

      const loan = fromDb(loanRows[0]);
      if (loan.status !== "Active") return error("Loan is not active");

      const monthlyRate = loan.rate / 100 / 12;
      const interest = Math.round(loan.balance * monthlyRate);
      const principal = Math.max(0, body.amount - interest);
      const newBalance = Math.max(0, loan.balance - principal);

      const payment = {
        date: Date.now(), amount: body.amount, interest, principal,
        type: "Instalment", status: "Cleared", recordedBy: user!.email,
      };

      const payments = [...(loan.payments || []), payment];
      const update = toDb({
        id: loan.id, balance: newBalance, payments,
        dpd: 0, nextDue: Date.now() + 30 * 864e5,
        totalPaid: (loan.totalPaid || 0) + body.amount,
        lastPmt: Date.now(), lastPmtAmt: body.amount,
        status: newBalance === 0 ? "Settled" : "Active",
        stage: newBalance === 0 ? 1 : loan.stage,
      });

      await upsert("loans", [update]);

      // Audit
      await upsert("audit_trail", [toDb({
        id: `AUD-API-${Date.now()}`, action: "Payment Received (API)",
        entity: loan.id, user: user!.email, ts: Date.now(),
        details: `R${body.amount.toFixed(2)} received via API. Balance: R${newBalance.toFixed(2)}.`,
        category: "Servicing",
      })]);

      return json({
        data: { amount: body.amount, interest, principal, newBalance, status: newBalance === 0 ? "Settled" : "Active" },
        message: "Payment recorded",
      });
    }

    // ═══ GET /portfolio/summary ═══
    if (method === "GET" && segments[0] === "portfolio" && segments[1] === "summary") {
      const roleErr = requireRole(user, ["ADMIN", "EXEC", "CREDIT_HEAD", "CREDIT_SNR", "CREDIT", "FINANCE", "AUDITOR", "VIEWER"]);
      if (roleErr) return roleErr;

      const [loansRaw, provisionsRaw, customersRaw, appsRaw] = await Promise.all([
        query("loans"), query("provisions"), query("customers"), query("applications"),
      ]);

      const loans = loansRaw.map(fromDb);
      const provisions = provisionsRaw.map(fromDb);
      const active = loans.filter((l: any) => l.status === "Active");
      const totalBook = active.reduce((s: number, l: any) => s + (l.balance || 0), 0);
      const totalECL = provisions.reduce((s: number, p: any) => s + (p.ecl || 0), 0);
      const arrears = active.filter((l: any) => l.dpd > 0);

      return json({
        data: {
          totalCustomers: customersRaw.length,
          totalApplications: appsRaw.length,
          activeLoans: active.length,
          totalLoans: loans.length,
          totalBookValue: totalBook,
          totalECL,
          coverageRatio: totalBook > 0 ? totalECL / totalBook : 0,
          arrearsCount: arrears.length,
          arrearsBalance: arrears.reduce((s: number, l: any) => s + (l.balance || 0), 0),
          arrearsRate: active.length > 0 ? arrears.length / active.length : 0,
          stage1: active.filter((l: any) => l.stage === 1).length,
          stage2: active.filter((l: any) => l.stage === 2).length,
          stage3: active.filter((l: any) => l.stage === 3).length,
        },
      });
    }

    // ═══ GET /portfolio/provisions ═══
    if (method === "GET" && segments[0] === "portfolio" && segments[1] === "provisions") {
      const roleErr = requireRole(user, ["ADMIN", "EXEC", "CREDIT_HEAD", "FINANCE", "AUDITOR"]);
      if (roleErr) return roleErr;

      const rows = await query("provisions", "?order=loan_id");
      return json({ data: rows.map(fromDb), count: rows.length });
    }

    // ═══ POST /eod/trigger ═══
    if (method === "POST" && segments[0] === "eod" && segments[1] === "trigger") {
      const roleErr = requireRole(user, ["ADMIN"]);
      if (roleErr) return roleErr;

      // Trigger the EOD batch function
      const eodRes = await fetch(`${SUPABASE_URL}/functions/v1/eod-batch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });

      const result = await eodRes.json();
      return json({ data: result, message: "EOD batch triggered" });
    }

    // ═══ 404 ═══
    return error(`Unknown endpoint: ${method} /api/${segments.join("/")}`, 404);

  } catch (err) {
    console.error("[API]", err);
    return error("Internal server error", 500);
  }
});
