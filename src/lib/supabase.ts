// KwikBridge LMS — Supabase Client

export const SUPABASE_URL = "https://yioqaluxgqxsifclydmd.supabase.co";
export const SUPABASE_KEY = "sb_publishable_5-mJwKTUJKxdZSTXZMJd-A_89ZkNWrM";


const sb = (path: string) => `${SUPABASE_URL}/rest/v1/${path}`;
const sbHeaders = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" };
const sbAuth = (path: string, body: any) => fetch(`${SUPABASE_URL}/auth/v1/${path}`, { method: "POST", headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
const sbAuthGet = (path: string, token: string) => fetch(`${SUPABASE_URL}/auth/v1/${path}`, { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` } }).then(r => r.ok ? r.json() : null);

export const TABLES = {
  customers: "customers", products: "products", applications: "applications",
  loans: "loans", documents: "documents", collections: "collections",
  alerts: "alerts", audit: "audit_trail", provisions: "provisions",
  comms: "comms", statutoryReports: "statutory_reports", settings: "settings"
};

export const sbGet = async (table) => { const r = await fetch(sb(table) + "?order=id", { headers: sbHeaders }); return r.ok ? r.json() : []; };

export const sbUpsert = async (table, rows) => { if (!rows?.length) return; await fetch(sb(table), { method: "POST", headers: { ...sbHeaders, "Prefer": "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) }); };

export const sbDelete = async (table, id) => { await fetch(sb(table) + `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: sbHeaders }); };

export const authSignIn = async (email, password) => {
  const r = await sbAuth("token?grant_type=password", { email, password });
  return r.json();
};

export const authSignUp = async (email, password, name) => {
  const r = await sbAuth("signup", { email, password, data:{ full_name:name } });
  return r.json();
};

export const authSignOut = async (token) => {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:"POST", headers:{ "apikey":SUPABASE_KEY, "Authorization":`Bearer ${token}` } });
};

export const authGetUser = async (token) => {
  const r = await sbAuthGet("user", token);
  return r.ok ? r.json() : null;
};

export const authOAuthUrl = (provider: string) => `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(window.location.origin)}`;

