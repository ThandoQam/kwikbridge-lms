// KwikBridge LMS — Supabase Client
// All Supabase REST API calls with normalised schema support

export const SUPABASE_URL = "https://yioqaluxgqxsifclydmd.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpb3FhbHV4Z3F4c2lmY2x5ZG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDQwMTQsImV4cCI6MjA5MDcyMDAxNH0.PwccS7acx7syNvsDTV_rp6zNttk1gxrF_ObnwolHFH8";

// Table name mapping (JS camelCase key → Supabase snake_case table)
export const TABLES: Record<string, string> = {
  customers: "customers", products: "products", applications: "applications",
  loans: "loans", documents: "documents", collections: "collections",
  alerts: "alerts", audit: "audit_trail", provisions: "provisions",
  comms: "comms", statutoryReports: "statutory_reports", settings: "settings"
};

// Key mapping utilities
const toSnake = (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase();
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
const mapKeys = (obj: any, fn: (s: string) => string): any => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) out[fn(k)] = v;
  return out;
};
export const toDb = (row: any) => mapKeys(row, toSnake);
export const fromDb = (row: any) => mapKeys(row, toCamel);

// REST helpers
const sb = (path: string) => `${SUPABASE_URL}/rest/v1/${path}`;
const sbHeaders: Record<string, string> = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=minimal"
};

// ═══ CRUD Operations ═══

export const sbGet = async (table: string, query = "?order=id"): Promise<any[]> => {
  const r = await fetch(sb(table) + query, { headers: sbHeaders });
  return r.ok ? r.json() : [];
};

export const sbUpsert = async (table: string, rows: any[]) => {
  if (!rows?.length) return;
  await fetch(sb(table), {
    method: "POST",
    headers: { ...sbHeaders, "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows)
  });
};

export const sbDelete = async (table: string, id: string) => {
  await fetch(sb(table) + `?id=eq.${id}`, { method: "DELETE", headers: sbHeaders });
};

// ═══ Bulk Load — reads all 12 tables in parallel ═══

export const sbLoadAll = async (signal?: AbortSignal): Promise<Record<string, any>> => {
  const results: Record<string, any> = {};
  const fetchOpts = signal ? { headers: sbHeaders, signal } : { headers: sbHeaders };

  const entries = Object.entries(TABLES);
  const responses = await Promise.allSettled(
    entries.map(([, table]) =>
      fetch(sb(table) + "?order=id", fetchOpts).then(r => r.ok ? r.json() : [])
    )
  );

  let hasData = false;
  entries.forEach(([key, _], i) => {
    const result = responses[i];
    const rows = result.status === "fulfilled" ? result.value : [];
    if (key === "settings") {
      results[key] = rows[0] ? fromDb(rows[0]) : null;
    } else {
      results[key] = rows.map(fromDb);
      if (rows.length > 0) hasData = true;
    }
  });

  return hasData ? results : {};
};

// ═══ Differential Save — only upserts changed rows ═══

export const sbSaveChanges = async (prev: any, next: any) => {
  for (const [key, table] of Object.entries(TABLES)) {
    if (key === "settings") {
      if (next[key] && JSON.stringify(next[key]) !== JSON.stringify(prev?.[key])) {
        await sbUpsert(table, [{ ...toDb(next[key]), id: 1 }]);
      }
    } else if (next[key] && next[key] !== prev?.[key]) {
      const prevIds = new Set((prev?.[key] || []).map((r: any) => JSON.stringify(r)));
      const changed = next[key].filter((r: any) => !prevIds.has(JSON.stringify(r)));
      if (changed.length > 0) {
        await sbUpsert(table, changed.map(toDb));
      }
    }
  }
};

// ═══ Auth functions ═══

const sbAuth = (path: string, body: any) =>
  fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json());

const sbAuthGet = (path: string, token: string) =>
  fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
  }).then(r => r.ok ? r.json() : null);

export const authSignIn = async (email: string, password: string) => {
  return sbAuth("token?grant_type=password", { email, password });
};

export const authSignUp = async (email: string, password: string, name: string) => {
  return sbAuth("signup", { email, password, data: { name } });
};

export const authSignOut = async (token: string) => {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
  });
};

export const authGetUser = async (token: string) => {
  return sbAuthGet("user", token);
};

export const authOAuthUrl = (provider: string) =>
  `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(window.location.origin)}`;
