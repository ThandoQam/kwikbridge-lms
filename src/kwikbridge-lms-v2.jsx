import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════
   KWIKBRIDGE LOAN MANAGEMENT SYSTEM v2.0
   Enterprise-Grade Cloud LMS — Benchmarked against:
   • FinnOne Neo (Nucleus Software) — Gartner Peer Insights Leader
   • Finastra Loan IQ — Commercial Loan Origination
   • Temenos T24 — Core Banking & Lending
   • HES LoanBox / Cloudbankin / LendFoundry

   Modules:
   1. Dashboard & Analytics (Portfolio KPIs, Charts, EWS)
   2. Customer Onboarding (KYC/FICA, BEE Verification)
   3. Loan Origination (Multi-step Application, Product Config)
   4. Credit Assessment & Underwriting (Risk Scoring, DSCR, Affordability)
   5. Loan Disbursement & Setup
   6. Loan Servicing & Account Mgmt (Payments, Statements, Schedules)
   7. Collections & Recovery (Staged, PTP, Restructuring, Legal)
   8. IFRS 9 Provisioning (ECL, Staging, PD/LGD)
   9. Governance & Compliance (Audit Trail, Authority Matrix, Regulatory)
   10. Document Management (Upload, Verify, Track)
   11. Reporting & Analytics (Portfolio, Risk, Regulatory, Impact)
   12. Communication Center (Omnichannel Logs)
   13. Settings & Configuration
   ═══════════════════════════════════════════════════════════════════ */

const SK = "kb-lms-v2";
// Storage adapter: uses window.storage (Claude artifacts) or localStorage (Vite/Vercel)
const store = {
  get: async (k) => { try { if (window.storage?.get) return await window.storage.get(k); const v = localStorage.getItem(k); return v ? { value: v } : null; } catch { return null; } },
  set: async (k, v) => { try { if (window.storage?.set) return await window.storage.set(k, v); localStorage.setItem(k, v); } catch {} },
};

// ═══ SUPABASE CLIENT ═══
const SUPABASE_URL = "https://yioqaluxgqxsifclydmd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpb3FhbHV4Z3F4c2lmY2x5ZG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDQwMTQsImV4cCI6MjA5MDcyMDAxNH0.PwccS7acx7syNvsDTV_rp6zNttk1gxrF_ObnwolHFH8";
const sb = (table) => `${SUPABASE_URL}/rest/v1/${table}`;
const sbHeaders = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" };
const sbGet = async (table) => { const r = await fetch(sb(table) + "?order=id", { headers: sbHeaders }); return r.ok ? r.json() : []; };
const sbUpsert = async (table, rows) => { if (!rows?.length) return; await fetch(sb(table), { method: "POST", headers: { ...sbHeaders, "Prefer": "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) }); };
const sbDelete = async (table, id) => { await fetch(sb(table) + `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: sbHeaders }); };

// ═══ SUPABASE AUTH ═══
const sbAuth = (endpoint, body) => fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, { method:"POST", headers:{ "apikey":SUPABASE_KEY, "Content-Type":"application/json" }, body:JSON.stringify(body) });
const sbAuthGet = (endpoint, token) => fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, { headers:{ "apikey":SUPABASE_KEY, "Authorization":`Bearer ${token}` } });
const authSignUp = async (email, password, name) => {
  const r = await sbAuth("signup", { email, password, data:{ full_name:name } });
  return r.json();
};
const authSignIn = async (email, password) => {
  const r = await sbAuth("token?grant_type=password", { email, password });
  return r.json();
};
const authSignOut = async (token) => {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:"POST", headers:{ "apikey":SUPABASE_KEY, "Authorization":`Bearer ${token}` } });
};
const authGetUser = async (token) => {
  const r = await sbAuthGet("user", token);
  return r.ok ? r.json() : null;
};
const authOAuthUrl = (provider) => `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(window.location.origin)}`;

// Field mapping: app camelCase <-> DB snake_case
const toSnake = s => s.replace(/([A-Z])/g, '_$1').toLowerCase();
const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const mapKeys = (obj, fn) => { if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj; const out = {}; for (const [k, v] of Object.entries(obj)) out[fn(k)] = v; return out; };
const toDb = row => mapKeys(row, toSnake);
const fromDb = row => mapKeys(row, toCamel);

// Table config: which tables exist and their field mappings
const TABLES = {
  customers: "customers", products: "products", applications: "applications",
  loans: "loans", documents: "documents", collections: "collections",
  alerts: "alerts", audit: "audit_trail", provisions: "provisions",
  comms: "comms", statutoryReports: "statutory_reports", settings: "settings"
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = {
  date: d => d ? new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "—",
  dateTime: d => d ? new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—",
  cur: n => "R " + Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: (n, d = 1) => (n * 100).toFixed(d) + "%",
  num: n => Number(n || 0).toLocaleString("en-ZA"),
};
const dpd = due => due ? Math.max(0, Math.floor((Date.now() - new Date(due).getTime()) / 864e5)) : 0;
const stage = d => d <= 30 ? 1 : d <= 90 ? 2 : 3;
const now = Date.now();
const day = 864e5;

const C = {
  bg: "#f7f8fa", surface: "#ffffff", surface2: "#f9fafb", surface3: "#f3f4f6",
  border: "#e5e7eb", borderLight: "#d1d5db",
  text: "#111827", textDim: "#4b5563", textMuted: "#9ca3af",
  accent: "#1e3a5f", accentDim: "#2d5487", accentGlow: "#eef2f7",
  green: "#059669", greenDim: "#047857", greenBg: "#ecfdf5",
  amber: "#d97706", amberDim: "#b45309", amberBg: "#fffbeb",
  red: "#dc2626", redDim: "#b91c1c", redBg: "#fef2f2",
  purple: "#7c3aed", purpleBg: "#f5f3ff",
  blue: "#2563eb", blueBg: "#eff6ff",
  white: "#ffffff",
};

const ROLES = {
  ADMIN:       { id:"ADMIN",       label:"System Admin",       tier:0, zone:"staff" },
  EXEC:        { id:"EXEC",        label:"Executive",          tier:1, zone:"staff" },
  CREDIT_HEAD: { id:"CREDIT_HEAD", label:"Head of Credit",     tier:2, zone:"staff" },
  COMPLIANCE:  { id:"COMPLIANCE",  label:"Compliance Officer",  tier:2, zone:"staff" },
  CREDIT_SNR:  { id:"CREDIT_SNR",  label:"Senior Credit Analyst", tier:3, zone:"staff" },
  CREDIT:      { id:"CREDIT",      label:"Credit Analyst",     tier:3, zone:"staff" },
  LOAN_OFFICER:{ id:"LOAN_OFFICER",label:"Loan Officer",       tier:4, zone:"staff" },
  COLLECTIONS: { id:"COLLECTIONS", label:"Collections Specialist", tier:4, zone:"staff" },
  FINANCE:     { id:"FINANCE",     label:"Finance Officer",    tier:3, zone:"staff" },
  AUDITOR:     { id:"AUDITOR",     label:"Internal Auditor",   tier:3, zone:"staff" },
  VIEWER:      { id:"VIEWER",      label:"Report Viewer",      tier:5, zone:"staff" },
  BORROWER:    { id:"BORROWER",    label:"Borrower",           tier:6, zone:"portal" },
};

const PERMS = {
  dashboard:     { ADMIN:"view,export", EXEC:"view,export", CREDIT_HEAD:"view,export", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view", COLLECTIONS:"view", FINANCE:"view", AUDITOR:"view", VIEWER:"view", BORROWER:"view" },
  customers:     { ADMIN:"view,create,update,delete", EXEC:"view", CREDIT_HEAD:"view,update", COMPLIANCE:"view,update", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view,create,update", COLLECTIONS:"view", FINANCE:"view", AUDITOR:"view", VIEWER:"", BORROWER:"" },
  origination:   { ADMIN:"view,create,update,delete,assign", EXEC:"view", CREDIT_HEAD:"view,assign", COMPLIANCE:"view", CREDIT_SNR:"view,create,update", CREDIT:"view,create,update", LOAN_OFFICER:"view,create,update,assign", COLLECTIONS:"", FINANCE:"", AUDITOR:"view", VIEWER:"", BORROWER:"view,create" },
  underwriting:  { ADMIN:"view,update,approve,signoff", EXEC:"view,approve", CREDIT_HEAD:"view,update,approve,signoff,assign", COMPLIANCE:"view,signoff", CREDIT_SNR:"view,update,approve,signoff", CREDIT:"view,update,signoff", LOAN_OFFICER:"view,update,signoff", COLLECTIONS:"", FINANCE:"", AUDITOR:"view", VIEWER:"", BORROWER:"" },
  loans:         { ADMIN:"view,update", EXEC:"view", CREDIT_HEAD:"view,update", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view,update", COLLECTIONS:"view", FINANCE:"view,update", AUDITOR:"view", VIEWER:"view", BORROWER:"view" },
  servicing:     { ADMIN:"view,create,update", EXEC:"view", CREDIT_HEAD:"view", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view,update", COLLECTIONS:"view", FINANCE:"view,create,update", AUDITOR:"view", VIEWER:"", BORROWER:"view" },
  collections:   { ADMIN:"view,create,update,assign,approve", EXEC:"view,approve", CREDIT_HEAD:"view,approve", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view,create,update", COLLECTIONS:"view,create,update,assign", FINANCE:"view", AUDITOR:"view", VIEWER:"", BORROWER:"" },
  provisioning:  { ADMIN:"view,update,approve", EXEC:"view,approve", CREDIT_HEAD:"view,approve", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"", COLLECTIONS:"", FINANCE:"view,update,approve", AUDITOR:"view", VIEWER:"", BORROWER:"" },
  governance:    { ADMIN:"view,update", EXEC:"view", CREDIT_HEAD:"view", COMPLIANCE:"view,update", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view", COLLECTIONS:"view", FINANCE:"view", AUDITOR:"view,export", VIEWER:"", BORROWER:"" },
  statutory:     { ADMIN:"view,update", EXEC:"view", CREDIT_HEAD:"view", COMPLIANCE:"view,create,update", CREDIT_SNR:"", CREDIT:"", LOAN_OFFICER:"", COLLECTIONS:"", FINANCE:"view,update", AUDITOR:"view", VIEWER:"", BORROWER:"" },
  documents:     { ADMIN:"view,create,update,delete,approve", EXEC:"view", CREDIT_HEAD:"view,approve", COMPLIANCE:"view,update,approve", CREDIT_SNR:"view,update", CREDIT:"view,update", LOAN_OFFICER:"view,create,update,approve", COLLECTIONS:"view", FINANCE:"view", AUDITOR:"view", VIEWER:"", BORROWER:"view,create" },
  reports:       { ADMIN:"view,export", EXEC:"view,export", CREDIT_HEAD:"view,export", COMPLIANCE:"view,export", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view", COLLECTIONS:"view", FINANCE:"view,export", AUDITOR:"view,export", VIEWER:"view,export", BORROWER:"" },
  comms:         { ADMIN:"view,create", EXEC:"view", CREDIT_HEAD:"view,create", COMPLIANCE:"view", CREDIT_SNR:"view,create", CREDIT:"view,create", LOAN_OFFICER:"view,create", COLLECTIONS:"view,create", FINANCE:"view", AUDITOR:"view", VIEWER:"", BORROWER:"view" },
  products:      { ADMIN:"view,create,update,delete", EXEC:"view", CREDIT_HEAD:"view,create,update", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view", COLLECTIONS:"", FINANCE:"view", AUDITOR:"view", VIEWER:"", BORROWER:"view" },
  settings:      { ADMIN:"view,create,update,delete", EXEC:"view", CREDIT_HEAD:"", COMPLIANCE:"view", CREDIT_SNR:"", CREDIT:"", LOAN_OFFICER:"", COLLECTIONS:"", FINANCE:"view", AUDITOR:"view", VIEWER:"", BORROWER:"" },
  admin:         { ADMIN:"view,create,update,delete", EXEC:"view", CREDIT_HEAD:"view,create,update", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view", COLLECTIONS:"view", FINANCE:"view", AUDITOR:"view", VIEWER:"view", BORROWER:"" },
  portal:        { ADMIN:"", EXEC:"", CREDIT_HEAD:"", COMPLIANCE:"", CREDIT_SNR:"", CREDIT:"", LOAN_OFFICER:"", COLLECTIONS:"", FINANCE:"", AUDITOR:"", VIEWER:"", BORROWER:"view,create,update" },
};

const APPROVAL_LIMITS = {
  CREDIT: 250000, CREDIT_SNR: 500000, CREDIT_HEAD: 1000000, EXEC: 5000000, ADMIN: Infinity,
};

const SYSTEM_USERS = [
  { id:"U001", name:"Thando Qamarana", initials:"TQ", email:"thando@tqacapital.co.za", role:"ADMIN" },
  { id:"U002", name:"J. Ndaba", initials:"JN", email:"j.ndaba@tqacapital.co.za", role:"LOAN_OFFICER" },
  { id:"U003", name:"P. Sithole", initials:"PS", email:"p.sithole@tqacapital.co.za", role:"CREDIT" },
  { id:"U004", name:"M. Zulu", initials:"MZ", email:"m.zulu@tqacapital.co.za", role:"CREDIT_HEAD" },
  { id:"U005", name:"N. Xaba", initials:"NX", email:"n.xaba@tqacapital.co.za", role:"COLLECTIONS" },
  { id:"U006", name:"S. Pillay", initials:"SP", email:"s.pillay@tqacapital.co.za", role:"FINANCE" },
  { id:"U007", name:"Compliance Officer", initials:"CO", email:"compliance@tqacapital.co.za", role:"COMPLIANCE" },
  { id:"U008", name:"Internal Auditor", initials:"IA", email:"audit@tqacapital.co.za", role:"AUDITOR" },
  { id:"U009", name:"Executive Viewer", initials:"EV", email:"exec@tqacapital.co.za", role:"EXEC" },
];

function can(userRole, module, action) {
  const perms = PERMS[module]?.[userRole] || "";
  return perms.split(",").includes(action);
}
function canAny(userRole, module, actions) {
  return actions.some(a => can(userRole, module, a));
}
function approvalLimit(userRole) {
  return APPROVAL_LIMITS[userRole] || 0;
}

function seed() {
  const products = [
    { id:"P001", name:"PO Financing — ECDoE", minAmount:1000000, maxAmount:7500000, minTerm:3, maxTerm:6, baseRate:42.0, monthlyRate:3.5, description:"Government purchase order financing for Eastern Cape Department of Education contractors. Three-way cession structure with near-sovereign off-taker credit quality. High-volume anchor product.", repaymentType:"Bullet", arrangementFee:2.5, commitmentFee:0.5, gracePeriod:0, maxLTV:90, minDSCR:1.15, eligibleBEE:[1,2,3,4], eligibleIndustries:["Education","Construction","Services"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"ECDoE-contracted suppliers, service providers, and construction firms with confirmed government purchase orders.", riskClass:"A", ecl:0.70, s1PD:0.006, lgd:0.22 },
    { id:"P002", name:"Invoice — Scholar Transport", minAmount:10000, maxAmount:150000, minTerm:1, maxTerm:2, baseRate:30.0, monthlyRate:2.5, description:"Invoice discounting for scholar transport operators with confirmed ECDoE contracts. Short-tenor, high-velocity product with 8 cycles per year. Verified invoice against government off-taker.", repaymentType:"Bullet", arrangementFee:2.0, commitmentFee:0, gracePeriod:0, maxLTV:80, minDSCR:1.0, eligibleBEE:[1,2,3,4,5,6,7,8], eligibleIndustries:["Transport","Education"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Scholar transport operators with verified ECDoE invoices.", riskClass:"A", ecl:0.76, s1PD:0.006, lgd:0.23 },
    { id:"P003", name:"Invoice — Road Maintenance", minAmount:50000, maxAmount:1000000, minTerm:1, maxTerm:1, baseRate:30.0, monthlyRate:2.5, description:"Invoice discounting for road maintenance contractors with ECDoT (Eastern Cape Dept of Transport) verified invoices. Highest capital velocity — 10 cycles per year.", repaymentType:"Bullet", arrangementFee:2.0, commitmentFee:0, gracePeriod:0, maxLTV:85, minDSCR:1.0, eligibleBEE:[1,2,3,4,5,6,7,8], eligibleIndustries:["Construction","Transport","Infrastructure"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Road maintenance contractors and civil works firms with ECDoT verified invoices.", riskClass:"A", ecl:0.76, s1PD:0.006, lgd:0.23 },
    { id:"P004", name:"Invoice — Coega Infrastructure", minAmount:500000, maxAmount:5000000, minTerm:1, maxTerm:2, baseRate:33.6, monthlyRate:2.8, description:"Invoice discounting for Coega Industrial Development Zone infrastructure contractors. A+ rated parastatal off-taker with 5 cycles per year.", repaymentType:"Bullet", arrangementFee:2.0, commitmentFee:0, gracePeriod:0, maxLTV:85, minDSCR:1.0, eligibleBEE:[1,2,3,4], eligibleIndustries:["Construction","Infrastructure","Manufacturing"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Coega IDZ infrastructure contractors and suppliers with confirmed invoices.", riskClass:"A", ecl:0.76, s1PD:0.006, lgd:0.23 },
    { id:"P005", name:"Working Capital — Micro Traders", minAmount:500, maxAmount:10000, minTerm:0.17, maxTerm:1, baseRate:96.0, monthlyRate:8.0, description:"Fast micro-loans for informal traders and micro-enterprises. AI-scored with group guarantee (Grameen model). Up to 12 cycles per year. ECDC SERFSP pre-screened origination.", repaymentType:"Bullet", arrangementFee:3.0, commitmentFee:0, gracePeriod:0, maxLTV:100, minDSCR:1.0, eligibleBEE:[1,2,3,4,5,6,7,8], eligibleIndustries:["All"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Street vendors, spaza shop owners, informal traders, micro-service providers.", riskClass:"B", ecl:8.58, s1PD:0.03, lgd:0.65 },
    { id:"P006", name:"Agri Finance — Smallholder", minAmount:50000, maxAmount:1000000, minTerm:3, maxTerm:6, baseRate:36.0, monthlyRate:3.0, description:"Seasonal agricultural finance for smallholder farmers. Crop lien and equipment collateral. Scenario-weighted for drought probability (75% good season / 25% drought).", repaymentType:"Seasonal", arrangementFee:2.0, commitmentFee:0, gracePeriod:0, maxLTV:70, minDSCR:1.2, eligibleBEE:[1,2,3,4,5,6,7,8], eligibleIndustries:["Agriculture","Food Processing"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Smallholder farmers, emerging agricultural enterprises, crop producers in the Eastern Cape.", riskClass:"C", ecl:9.88, s1PD:0.0525, lgd:0.575 },
    { id:"P007", name:"Project & Contract Finance", minAmount:1000000, maxAmount:5000000, minTerm:3, maxTerm:12, baseRate:42.0, monthlyRate:3.5, description:"Tailored financing for specific projects and contracts. Designed to match your project's cash flow cycle with repayment terms up to 12 months. Suitable for mid-sized construction, infrastructure, and service delivery contracts.", repaymentType:"Amortising", arrangementFee:2.0, commitmentFee:0.5, gracePeriod:1, maxLTV:80, minDSCR:1.2, eligibleBEE:[1,2,3,4], eligibleIndustries:["Construction","Infrastructure","Professional Services"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"SMEs undertaking mid-sized projects, construction firms, service providers with secured contracts.", riskClass:"A", ecl:0.70, s1PD:0.006, lgd:0.22 },
  
];

  const statutoryReports = [
    { id:"SR-001", name:"Annual Compliance Report", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Comprehensive compliance report covering all NCA obligations." },
    { id:"SR-002", name:"Annual Financial Statements", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Audited financial statements for the full financial year." },
    { id:"SR-003", name:"Annual Financial & Operational Return", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Detailed financial and operational data return as prescribed by the NCR." },
    { id:"SR-004", name:"Assurance Engagement Report", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Independent assurance engagement on NCA compliance." },
    { id:"SR-005", name:"Form 39 – Q1 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Jan – 31 Mar 2026", dueDate:"2026-05-15", submitTo:"returns@ncr.org.za", status:"In Progress", preparer:"Finance Department", reviewer:"Chief Risk Officer", notes:"Quarterly statistical return." },
    { id:"SR-009", name:"Form 39 – Q4 2025 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Oct – 31 Dec 2025", dueDate:"2026-02-15", submitTo:"returns@ncr.org.za", status:"Submitted", preparer:"Finance Department", reviewer:"Chief Risk Officer", submittedDate:"2026-02-12", notes:"Submitted on time." },
  ];

  const statutoryAlerts = [
    { id:uid(), type:"Statutory", severity:"critical", title:"Form 39 Q1 2026 – Due 15 May 2026", msg:"Statistical return due to NCR by 15 May 2026. Currently: In Progress.", read:false, ts:now },
    { id:uid(), type:"Statutory", severity:"warning", title:"Annual Reports – Due 31 August 2026", msg:"4 annual statutory reports due within 6 months of year-end.", read:false, ts:now-1*day },
    { id:uid(), type:"Statutory", severity:"info", title:"NCR Registration Renewal – 31 July 2026", msg:"NCRCP22396 expires 31 July 2026. Submit renewal before expiry.", read:false, ts:now-2*day },
  ];

  return {
    customers: [], products, applications: [], loans: [], collections: [],
    alerts: [...statutoryAlerts], audit: [], provisions: [], comms: [], documents: [],
    statutoryReports,
    settings: {
      companyName:"TQA Capital (Pty) Ltd", ncrReg:"NCRCP22396", ncrExpiry:"31 July 2026",
      branch:"East London, Nahoon Valley", yearEnd:"28 February 2026", annualDueDate:"2026-08-31",
      form39Required:"Annual", totalDisbursed:0,
      ncrAddress:"127 – 15th Road, Randjies Park, Midrand, 1685",
      ncrPO:"PO Box 209, Halfway House, 1685",
      ncrEmailAnnual:"submissions@ncr.org.za", ncrEmailForm39:"returns@ncr.org.za"
    }
  };
}

const I = {
  dashboard:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  customers:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  origination:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  underwriting:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  loans:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  servicing:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  collections:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  provisioning:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  governance:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  documents:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  reports:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  comms:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  bell:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  search:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  check:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>,
  x:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  chev:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><polyline points="9 18 15 12 9 6"/></svg>,
  back:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>,
  plus:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  arrow:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  eye:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  download:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  filter:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  clock:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  warning:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  refresh:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  calendar:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
};

function Badge({ children, color = "slate" }) {
  const map = {
    green: { text: C.green, bg: C.greenBg, border: C.green+"33" },
    amber: { text: C.amber, bg: C.amberBg, border: C.amber+"33" },
    red: { text: C.red, bg: C.redBg, border: C.red+"33" },
    blue: { text: C.blue, bg: C.blueBg, border: C.blue+"33" },
    purple: { text: C.purple, bg: C.purpleBg, border: C.purple+"33" },
    cyan: { text: C.textDim, bg: C.surface3, border: C.border },
    slate: { text: C.textMuted, bg: C.surface3, border: C.border },
  };
  const s = map[color] || map.slate;
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:10, fontSize:11, fontWeight:600, letterSpacing:0.2, background:s.bg, color:s.text, border:`1px solid ${s.border}`, whiteSpace:"nowrap", lineHeight:"16px" }}>{children}</span>;
}
function statusBadge(s) {
  const m = { Approved:"green", Active:"green", Disbursed:"green", Verified:"green", Compliant:"green", Cleared:"green", Settled:"green", Submitted:"blue", Underwriting:"cyan", Booked:"purple", "Pre-Approval":"cyan", Pending:"amber", "Pending Review":"amber", Due:"amber", Draft:"slate", Overdue:"red", Early:"amber", Mid:"amber", Late:"red", Declined:"red", Breach:"red", "Written Off":"red", Expired:"red", Withdrawn:"slate", Received:"blue", "Under Review":"cyan" };
  return <Badge color={m[s] || "slate"}>{s}</Badge>;
}

function KPI({ label, value, sub, trend, color, accent, sparkData, alert }) {
  const trendColor = trend === "up" ? C.green : trend === "down" ? C.red : C.textDim;
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "";
  const valueColor = alert ? C.red : C.text;
  return (
    <div className="kb-kpi" style={{ background: C.surface, borderRadius: 4, padding: "20px 20px 20px 24px", border: `1px solid ${C.border}`, flex: "1 1 200px", minWidth: 180, position: "relative", overflow: "hidden", transition: "box-shadow .15s ease-out, transform .15s ease-out" }}>
      <div style={{ position: "absolute", top: 4, left: 0, bottom: 4, width: 3, background: C.accent, borderRadius: "0 2px 2px 0", transition: "opacity .15s ease-out" }} />
      <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, letterSpacing: -0.3, lineHeight: 1, whiteSpace: "nowrap" }}>{value}</div>
        {trendIcon && <span style={{ fontSize: 12, fontWeight: 600, color: trendColor }}>{trendIcon}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>{sub}</div>}
      {sparkData && sparkData.length > 1 && <svg viewBox={`0 0 ${sparkData.length * 12} 24`} style={{ width: "100%", height: 24, marginTop: 8, opacity: 0.4 }}><polyline fill="none" stroke={C.accent} strokeWidth="1.5" points={sparkData.map((v,i)=>`${i*12},${24-v/Math.max(...sparkData)*22}`).join(" ")} /></svg>}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", icon, disabled }) {
  const styles = {
    primary: { bg: C.accent, color: "#ffffff", border: "none" },
    secondary: { bg: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger: { bg: "transparent", color: C.red, border: `1px solid ${C.border}` },
    ghost: { bg: "transparent", color: C.textDim, border: "none" },
  };
  const s = styles[variant];
  const pad = size === "sm" ? "5px 10px" : size === "lg" ? "10px 20px" : "7px 14px";
  const fs = size === "sm" ? 12 : 13;
  return <button disabled={disabled} onClick={onClick} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:pad, background:s.bg, color:s.color, border:s.border, borderRadius:3, fontSize:fs, fontWeight:500, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, transition:"all .15s", fontFamily:"inherit", letterSpacing:0.1 }}>{icon}{children}</button>;
}

function Table({ columns, rows, onRowClick, emptyMsg = "No records found" }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${C.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: C.surface2 }}>
          {columns.map((c, i) => <th key={i} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 500, color: C.textMuted, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{c.label}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? "pointer" : "default", borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = C.surface2; }}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {columns.map((c, ci) => <td key={ci} style={{ padding: "8px 14px", color: C.text, whiteSpace: "nowrap" }}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: C.textMuted, fontSize: 12 }}>{emptyMsg}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ open, onClose, title, width = 520, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: 2, padding: 0, width, maxWidth: "95vw", maxHeight: "90vh", overflow: "hidden", border: `1px solid ${C.borderLight}`, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ margin: 0, fontSize:14, fontWeight: 600, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}>{I.x}</button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(90vh - 60px)" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>{children}</div>;
}
function Input(props) {
  return <input {...props} style={{ width: "100%", padding: "8px 10px", borderRadius: 2, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", ...props.style }} />;
}
function Select({ value, onChange, options, ...rest }) {
  return <select value={value} onChange={onChange} {...rest} style={{ width: "100%", padding: "8px 10px", borderRadius: 2, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}
function Textarea(props) {
  return <textarea {...props} style={{ width: "100%", padding: "8px 10px", borderRadius: 2, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", ...props.style }} />;
}

function Tab({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{ padding: "8px 16px", border: "none", borderBottom: active === t.key ? `2px solid ${C.text}` : "2px solid transparent", background: "transparent", color: active === t.key ? C.text : C.textMuted, fontSize: 12, fontWeight: active === t.key ? 600 : 400, cursor: "pointer", fontFamily: "inherit", marginBottom: -1 }}>{t.label}{t.count != null && <span style={{ marginLeft: 6, color: C.textMuted, fontWeight: 400 }}>({t.count})</span>}</button>
      ))}
    </div>
  );
}

function ProgressBar({ value, max = 100, color = C.textMuted, height = 4 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ height, borderRadius: 0, background: "#ebebeb", overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 0, background: color, width: `${pct}%`, transition: "width .5s ease" }} />
    </div>
  );
}

function InfoGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 0, border: `1px solid ${C.border}` }}>
      {items.map(([l, v], i) => (
        <div key={i} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginTop: 2 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, children, actions }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.surface3}`, borderRadius: 4, marginBottom: 16, overflow: "hidden" }}>
      {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</h3>
        {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
      </div>}
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function StepTracker({ steps, current }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{ display: "flex", gap:12, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: done ? C.accent : "transparent", color: done ? "#fff" : active ? C.text : C.textMuted, fontSize: 10, fontWeight: 600, border: `1px solid ${done ? C.accent : C.border}` }}>
                {done ? I.check : i + 1}
              </div>
              {i < steps.length - 1 && <div style={{ width: 1, height: 20, background: C.border }} />}
            </div>
            <div style={{ paddingBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: done ? C.text : active ? C.text : C.textMuted }}>{s.label}</div>
              {s.detail && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{s.detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon, title, message, action, onAction }) {
  return (
    <div className="kb-animate" style={{ textAlign:"center", padding:"48px 24px" }}>
      <div style={{ fontSize:36, marginBottom:12, opacity:0.3 }}>{icon || "📋"}</div>
      <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:8 }}>{title || "Nothing here yet"}</div>
      <div style={{ fontSize:12, color:C.textMuted, maxWidth:300, margin:"0 auto", lineHeight:1.5, marginBottom:16 }}>{message || ""}</div>
      {action && onAction && <Btn onClick={onAction} size="sm">{action}</Btn>}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = "success") => { setToast({ msg, type, id: Date.now() }); setTimeout(() => setToast(null), 3500); }, []);
  const [page, setPage] = useState("public_home");
  const [zone, setZone] = useState("public"); // public | portal | staff
  const [pageHistory, setPageHistory] = useState([]);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [securitySelections, setSecuritySelections] = useState({});
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(SYSTEM_USERS[0]);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailForm, setDetailForm] = useState({});
  const [detailBeeForm, setDetailBeeForm] = useState({level:3,expiry:""});
  const [expandedStep, setExpandedStep] = useState(null);
  const [notifForm, setNotifForm] = useState({subject:"",body:""});
  const [reqDocType, setReqDocType] = useState("");
  const [prodEditing, setProdEditing] = useState(null);
  const [prodForm, setProdForm] = useState(null);
  const [settingsEditing, setSettingsEditing] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [withdrawId, setWithdrawId] = useState(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [actionModal, setActionModal] = useState(null);
  const [ptpForm, setPtpForm] = useState({date:"",amount:"",notes:""});
  const [restructForm, setRestructForm] = useState({type:"Term Extension",detail:"",approver:"Credit Committee"});
  const [writeOffReason, setWriteOffReason] = useState("");
  const [auditFilter, setAuditFilter] = useState({category:"",user:"",entity:""});
  const [schedLoan, setSchedLoan] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [authForm, setAuthForm] = useState({ email:"", password:"", name:"", error:"" });
  const [publicAppForm, setPublicAppForm] = useState({ step:1, name:"", contact:"", email:"", phone:"", password:"", idNum:"", regNum:"", businessName:"", industry:"Retail", sector:"", revenue:"", employees:"", years:"", address:"", province:"Eastern Cape", beeLevel:3, womenOwned:0, youthOwned:0, disabilityOwned:0, product:"", amount:"", term:"", purpose:"", error:"", submitted:false, preApprovalResult:null, trackingRef:null });
  const [portalPtp, setPortalPtp] = useState({ loanId:null, date:"", amount:"", notes:"" });
  const [portalPayment, setPortalPayment] = useState({ loanId:null, amount:"", method:"EFT", ref:"" });
  const [portalVerify, setPortalVerify] = useState({ bankStatus:null, creditStatus:null, running:false });
  const [userEditing, setUserEditing] = useState(null);
  const [userForm, setUserForm] = useState(null);
  const [sysUsers, setSysUsers] = useState([...SYSTEM_USERS]);
  const [backupSchedule, setBackupSchedule] = useState({frequency:"Daily",time:"02:00",retention:30,lastBackup:null,autoEnabled:true});
  const [apiKeys, setApiKeys] = useState([{id:"ak1",name:"Supabase REST",key:"sb_pub...M",status:"Active",created:Date.now()-30*day,lastUsed:Date.now()},{id:"ak2",name:"Credit Bureau API",key:"cb_***...9f",status:"Active",created:Date.now()-90*day,lastUsed:Date.now()-2*day}]);
  const [policyEditing, setPolicyEditing] = useState(null);
  const [policyForm, setPolicyForm] = useState(null);
  const [businessRules, setBusinessRules] = useState([
    {id:"BR-001",name:"Max Single Exposure",category:"Credit",value:"R5,000,000",description:"Maximum loan amount to a single borrower",status:"Active",lastUpdated:Date.now()-60*day,updatedBy:"Chief Risk Officer"},
    {id:"BR-002",name:"Portfolio Loss Tolerance",category:"Credit",value:"3-5% annual",description:"Maximum acceptable annual portfolio loss rate",status:"Active",lastUpdated:Date.now()-60*day,updatedBy:"Board of Directors"},
    {id:"BR-003",name:"Min DSCR (Standard)",category:"Credit",value:"1.25x",description:"Minimum debt service coverage ratio for standard products",status:"Active",lastUpdated:Date.now()-60*day,updatedBy:"Credit Committee"},
    {id:"BR-004",name:"Draft Application Expiry",category:"Operations",value:"30 days",description:"Draft applications auto-expire after this period",status:"Active",lastUpdated:Date.now()-30*day,updatedBy:"Head of Operations"},
    {id:"BR-005",name:"Early Collections Trigger",category:"Collections",value:"1 DPD",description:"Automated SMS/email on first day past due",status:"Active",lastUpdated:Date.now()-45*day,updatedBy:"Head of Collections"},
    {id:"BR-006",name:"Legal Action Threshold",category:"Collections",value:"91+ DPD",description:"Accounts eligible for legal recovery proceedings",status:"Active",lastUpdated:Date.now()-45*day,updatedBy:"Credit Committee"},
    {id:"BR-007",name:"Dual Authorization Threshold",category:"Finance",value:"R500,000",description:"Disbursements above this amount require dual sign-off",status:"Active",lastUpdated:Date.now()-90*day,updatedBy:"CFO"},
    {id:"BR-008",name:"KYC Document Validity",category:"Compliance",value:"3 months",description:"Proof of address must be within this period",status:"Active",lastUpdated:Date.now()-120*day,updatedBy:"Compliance Officer"},
  ]);
  const role = currentUser.role;
  const canDo = (mod, action) => can(role, mod, action);
  const canDoAny = (mod, actions) => canAny(role, mod, actions);

  // ═══ AUTH CHECK ═══
  useEffect(() => {
    (async () => {
      // Check for OAuth redirect (hash contains access_token)
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get("access_token");
        if (token) {
          const user = await authGetUser(token);
          if (user?.email) {
            const session = { token, user };
            setAuthSession(session);
            localStorage.setItem("kb-auth", JSON.stringify(session));
            // Match to system user by email
            const matched = sysUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase());
            if (matched) {
              setCurrentUser(matched);
              const mz = ROLES[matched.role]?.zone || "staff";
              setZone(mz);
              setPage(mz === "portal" ? "portal_dashboard" : "dashboard");
            } else {
              setCurrentUser({ id:"B-"+Date.now(), name:user.user_metadata?.full_name || user.email.split("@")[0], initials:(user.user_metadata?.full_name||user.email)[0].toUpperCase(), email:user.email, role:"BORROWER" });
              setZone("portal");
              setPage("portal_dashboard");
            }
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
        setAuthLoading(false);
        return;
      }
      // Check stored session
      try {
        const stored = localStorage.getItem("kb-auth");
        if (stored) {
          const session = JSON.parse(stored);
          const user = await authGetUser(session.token);
          if (user?.email) {
            setAuthSession({ ...session, user });
            const matched = sysUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase());
            if (matched) {
              setCurrentUser(matched);
              const sz = ROLES[matched.role]?.zone || "staff";
              setZone(sz);
              setPage(sz === "portal" ? "portal_dashboard" : "dashboard");
            } else {
              setCurrentUser({ id:"B-"+Date.now(), name:user.user_metadata?.full_name || user.email.split("@")[0], initials:(user.user_metadata?.full_name||user.email)[0].toUpperCase(), email:user.email, role:"BORROWER" });
              setZone("portal");
              setPage("portal_dashboard");
            }
          } else {
            localStorage.removeItem("kb-auth");
          }
        }
      } catch {}
      setAuthLoading(false);
    })();
  }, []);

  const handleSignIn = async () => {
    setAuthForm({ ...authForm, error:"" });
    try {
      const res = await authSignIn(authForm.email, authForm.password);
      if (res.error) { setAuthForm({ ...authForm, error:res.error_description || res.error || "Sign in failed" }); return; }
      if (res.access_token) {
        const user = await authGetUser(res.access_token);
        const session = { token:res.access_token, user:user || { email:authForm.email } };
        setAuthSession(session);
        localStorage.setItem("kb-auth", JSON.stringify(session));
        const matched = sysUsers.find(u => u.email.toLowerCase() === authForm.email.toLowerCase());
        if (matched) {
          setCurrentUser(matched);
          const z = ROLES[matched.role]?.zone || "staff";
          setZone(z);
          setPage(z === "portal" ? "portal_dashboard" : "dashboard");
        } else {
          // Unmatched email — default to borrower portal
          setCurrentUser({ id:"B-"+Date.now(), name:authForm.email.split("@")[0], initials:authForm.email[0].toUpperCase(), email:authForm.email, role:"BORROWER" });
          setZone("portal");
          setPage("portal_dashboard");
        }
      }
    } catch (e) { setAuthForm({ ...authForm, error:"Network error. Try again." }); }
  };

  const handleSignUp = async () => {
    setAuthForm({ ...authForm, error:"" });
    if (!authForm.name || !authForm.email || !authForm.password) { setAuthForm({ ...authForm, error:"All fields required." }); return; }
    if (authForm.password.length < 6) { setAuthForm({ ...authForm, error:"Password must be at least 6 characters." }); return; }
    try {
      const res = await authSignUp(authForm.email, authForm.password, authForm.name);
      if (res.error) { setAuthForm({ ...authForm, error:res.error_description || res.msg || "Sign up failed" }); return; }
      if (res.access_token) {
        const session = { token:res.access_token, user:res.user || { email:authForm.email, user_metadata:{ full_name:authForm.name } } };
        setAuthSession(session);
        localStorage.setItem("kb-auth", JSON.stringify(session));
        // New signups default to borrower portal
        setCurrentUser({ id:"B-"+Date.now(), name:authForm.name, initials:authForm.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2), email:authForm.email, role:"BORROWER" });
        setZone("portal");
        setPage("portal_dashboard");
      } else {
        setAuthForm({ ...authForm, error:"" });
        setAuthMode("login");
        alert("Account created. Check your email for confirmation, then sign in.");
      }
    } catch (e) { setAuthForm({ ...authForm, error:"Network error. Try again." }); }
  };

  const handleSignOut = async () => {
    if (authSession?.token) { try { await authSignOut(authSession.token); } catch {} }
    setAuthSession(null);
    localStorage.removeItem("kb-auth");
    setAuthForm({ email:"", password:"", name:"", error:"" });
  };


  useEffect(() => {
      (async () => {
        // Try local store FIRST (instant — no network wait)
        try {
          const r = await store.get(SK);
          if (r?.value) {
            const loaded = JSON.parse(r.value);
            const hasCurrentSchema = loaded.applications?.some(a => a.qaSignedOff !== undefined) || (loaded.applications?.length === 0 && loaded.products?.length > 0);
            if (hasCurrentSchema && loaded.customers?.length > 0) { setData(loaded); return; }
          }
        } catch {}
        // Then try Supabase with 3-second timeout
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const sbGetWithTimeout = async (table) => {
            const r = await fetch(sb(table) + "?order=id", { headers: sbHeaders, signal: controller.signal });
            return r.ok ? r.json() : [];
          };
          const results = {};
          let hasData = false;
          for (const [key, table] of Object.entries(TABLES)) {
            if (key === "settings") {
              const rows = await sbGetWithTimeout(table);
              results[key] = rows[0] ? fromDb(rows[0]) : null;
            } else {
              const rows = await sbGetWithTimeout(table);
              results[key] = rows.map(fromDb);
              if (rows.length > 0) hasData = true;
            }
          }
          clearTimeout(timeout);
          if (hasData) {
            if (!results.settings) results.settings = { companyName:"TQA Capital (Pty) Ltd", ncrReg:"NCRCP22396", ncrExpiry:"31 July 2026", branch:"East London, Nahoon Valley" };
            setData(results);
            return;
          }
        } catch (e) { console.log("Supabase load skipped:", e.name); }
        // Last resort: seed
        const d = seed();
        try { await store.set(SK, JSON.stringify(d)); } catch {}
        setData(d);
      })();
    }, []);


  // Save: update in-memory state + persist to Supabase (async, non-blocking)
  const save = useCallback(async next => {
    const prev = data;
    setData(next);
    // Persist to Supabase in background — upsert changed tables
    try {
      for (const [key, table] of Object.entries(TABLES)) {
        if (key === "settings") {
          if (next[key] && JSON.stringify(next[key]) !== JSON.stringify(prev?.[key])) {
            await sbUpsert(table, [{ ...toDb(next[key]), id: 1 }]);
          }
        } else if (next[key] && next[key] !== prev?.[key]) {
          // Find new/changed rows by comparing IDs
          const prevIds = new Set((prev?.[key] || []).map(r => JSON.stringify(r)));
          const changed = next[key].filter(r => !prevIds.has(JSON.stringify(r)));
          if (changed.length > 0) {
            await sbUpsert(table, changed.map(toDb));
          }
        }
      }
    } catch (e) { console.log("Supabase save error (non-fatal):", e); }
    // Also save to localStorage as fallback
    try { await store.set(SK, JSON.stringify(next)); } catch {}
  }, [data]);

  // ═══ ZONE DERIVATION ═══
  const userZone = authSession ? (ROLES[role]?.zone || "staff") : "public";
  // Sync zone state when auth or role changes
  if (authSession && (zone === "public" || zone === "auth")) { setZone(userZone); if (userZone === "portal") setPage("portal_dashboard"); else setPage("dashboard"); }

  // Zone enforcement: prevent cross-zone access
  const ZONE_PAGES = {
    public: ["public_home", "public_apply", "public_track"],
    portal: ["portal_dashboard", "portal_applications", "portal_loans", "portal_documents", "portal_comms", "portal_profile"],
    staff: ["dashboard","customers","origination","underwriting","loans","servicing","collections","provisioning","governance","statutory","documents","reports","comms","admin","products","settings"],
  };
  const goBack = () => { if (pageHistory.length > 0) { const prev = pageHistory[pageHistory.length - 1]; setPageHistory(h=>h.slice(0,-1)); setPage(prev); } };
  const navTo = (pg) => { setPageHistory(h=>[...h.slice(-10),page]); setPage(pg); setDetail(null); };

  
  const GLOBAL_CSS = `
        *{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}.kb-kpi:hover{box-shadow:0 2px 8px rgba(0,0,0,0.06) !important;transform:translateY(-0.5px)}
        .kb-kpi:hover>div:first-child{opacity:1 !important}
        .kb-kpi:active{transform:scale(0.98);transform-origin:center}
        .kb-btn:hover{opacity:0.88;transform:translateY(-0.5px)}
        .kb-row:hover{background:${C.surface2} !important}
        .kb-link:hover{text-decoration:underline !important}
        .kb-card:hover{box-shadow:0 2px 8px rgba(0,0,0,0.06) !important}
        @keyframes kb-fade-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes kb-pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes kb-slide-in{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        .kb-animate{animation:kb-fade-in .25s ease-out}
        .kb-pulse{animation:kb-pulse 1.5s ease-in-out infinite}
        .kb-toast{position:fixed;top:16px;right:16px;z-index:9999;animation:kb-slide-in .3s ease-out}
        *:focus-visible{outline:2px solid ${C.accent};outline-offset:2px;border-radius:2px}
        button{cursor:pointer}
        .kb-table-row:nth-child(even){background:rgba(0,0,0,0.015)}
        .kb-table-row:hover{background:rgba(0,0,0,0.03) !important}
        
        /* Typography Scale — 4px baseline grid */
        .kb-h1{font-size:32px;font-weight:700;line-height:1.2;letter-spacing:-0.5px;color:${C.text}}
        .kb-h2{font-size:22px;font-weight:700;line-height:1.2;letter-spacing:-0.3px;color:${C.text}}
        .kb-h3{font-size:16px;font-weight:600;line-height:1.3;color:${C.text}}
        .kb-h4{font-size:14px;font-weight:600;line-height:1.4;color:${C.text}}
        .kb-body{font-size:13px;font-weight:400;line-height:1.5;color:${C.text}}
        .kb-small{font-size:12px;font-weight:400;line-height:1.4;color:${C.textDim}}
        .kb-caption{font-size:10px;font-weight:500;line-height:1.4;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.6px}
        .kb-label{font-size:11px;font-weight:600;line-height:1.3;color:${C.textDim};text-transform:uppercase;letter-spacing:0.5px}
        .kb-mono{font-family:"SF Mono","Fira Code",monospace;font-size:12px}
        /* Spacing utilities */
        .kb-gap-4{gap:4px}.kb-gap-8{gap:8px}.kb-gap-12{gap:12px}.kb-gap-16{gap:16px}.kb-gap-20{gap:20px}.kb-gap-24{gap:24px}
        .kb-p-8{padding:8px}.kb-p-12{padding:12px}.kb-p-16{padding:16px}.kb-p-20{padding:20px}.kb-p-24{padding:24px}
        .kb-mb-4{margin-bottom:4px}.kb-mb-8{margin-bottom:8px}.kb-mb-12{margin-bottom:12px}.kb-mb-16{margin-bottom:16px}.kb-mb-20{margin-bottom:20px}.kb-mb-24{margin-bottom:24px}
        
        /* Touch-friendly targets (WCAG 2.5.5) */
        @media(pointer:coarse){
          button,a,[role="button"]{min-height:44px;min-width:44px}
          input,select,textarea{min-height:44px;font-size:16px !important}
          .kb-sidebar button{min-height:44px}
          .kb-nav-item{padding:12px !important}
        }
        
        .kb-table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
        .kb-table-scroll::-webkit-scrollbar{height:4px}
        .kb-table-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:2px}
        
        /* Safe area for notch devices */
        @supports(padding:env(safe-area-inset-bottom)){
          .kb-mobile-fab{padding-bottom:calc(8px + env(safe-area-inset-bottom)) !important}
          .kb-mobile-sidebar{padding-top:env(safe-area-inset-top)}
        }
        
        .kb-sidebar::after{content:"";position:absolute;bottom:0;left:0;right:0;height:24px;background:linear-gradient(transparent,rgba(249,250,251,0.9));pointer-events:none}
        .kb-sidebar{position:relative}
        
        .kb-badge-approved{background:#ecfdf5;color:#059669}
        .kb-badge-declined{background:#fef2f2;color:#dc2626}
        .kb-badge-submitted{background:#eff6ff;color:#2563eb}
        .kb-badge-underwriting{background:#fffbeb;color:#d97706}
        .kb-badge-booked{background:#f5f3ff;color:#7c3aed}
        .kb-badge-draft{background:#f3f4f6;color:#6b7280}
        
        input:focus,select:focus,textarea:focus{border-color:${C.accent} !important;box-shadow:0 0 0 3px rgba(30,58,95,0.08)}
        
        /* CTA & form button hover effects */
        .kb-cta{transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}
        .kb-cta:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(30,58,95,0.2);opacity:0.92}
        .kb-cta:active{transform:translateY(0);box-shadow:0 1px 4px rgba(30,58,95,0.15)}
        .kb-cta-outline{transition:transform .15s ease,border-color .15s ease,background .15s ease}
        .kb-cta-outline:hover{background:rgba(30,58,95,0.04);border-color:${C.accent} !important;transform:translateY(-0.5px)}
        .kb-cta-outline:active{transform:translateY(0)}
        .kb-nav-link{transition:color .15s ease,border-color .15s ease}
        .kb-nav-link:hover{color:${C.accent} !important}
        .kb-sidebar button:hover{background:rgba(30,58,95,0.04) !important}
        .kb-card-hover{transition:transform .2s ease,box-shadow .2s ease}
        .kb-card-hover:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08)}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#d4d4d4;border-radius:0}
        *{box-sizing:border-box}
        @media(max-width:768px){
          .kb-sidebar{display:none !important}
          .kb-main{width:100% !important;padding:12px !important}
          .kb-header-search{display:none !important}
          .kb-hamburger{display:flex !important}
          .kb-mobile-fab{display:block !important}
          .kb-grid-2{grid-template-columns:1fr !important}
          .kb-grid-3{grid-template-columns:1fr !important}
          .kb-grid-4{grid-template-columns:1fr 1fr !important}
          .kb-kpi-row{flex-wrap:wrap !important}
          .kb-kpi-row>div{min-width:calc(50% - 8px) !important;flex:0 0 calc(50% - 8px) !important}
          .kb-detail-grid{grid-template-columns:1fr !important}
          .kb-header-user span:not(:first-child){display:none !important}
          .kb-section-grid{grid-template-columns:1fr !important}
          h2{font-size:20px !important}
          .kb-pub-hero h1{font-size:26px !important}
          .kb-pub-hero{padding:32px 16px 24px !important}
          .kb-trust-badges{flex-wrap:wrap !important;gap:12px !important}
          .kb-form-row{flex-direction:column !important}
          .kb-form-row>div{width:100% !important}
        }
        @media(max-width:480px){
          .kb-grid-2{grid-template-columns:1fr !important}
          .kb-grid-3{grid-template-columns:1fr !important}
          .kb-grid-4{grid-template-columns:1fr !important}
          .kb-kpi-row>div{flex:1 1 100% !important}
          .kb-modal{width:95vw !important;max-height:90vh !important;margin:5vh auto;border-radius:8px !important}
          .kb-table-responsive{overflow-x:auto;-webkit-overflow-scrolling:touch}
          .kb-main{padding:8px !important}
          .kb-pub-nav{flex-wrap:wrap;justify-content:center !important}
          .kb-pub-cta{flex-direction:column !important}
          .kb-pub-cta button{width:100% !important}
          .kb-toast{left:12px !important;right:12px !important;max-width:none !important}
          .kb-section-grid{gap:8px !important}
        }
        .kb-pub-grid2{grid-template-columns:1fr !important}`;

  // ═══ PUBLIC ZONE — No Login Required ═══
  if (!authSession && zone === "public") return (
    <div style={{ fontFamily:"'Outfit','Segoe UI',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>
      {/* Public Header */}
      <header style={{ background:"rgba(255,255,255,0.92)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", borderBottom:`1px solid ${C.surface3}`, padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ fontSize:18, fontWeight:700, color:C.text, letterSpacing:-0.5 }}>KwikBridge</div>
          <div style={{ fontSize:10, color:C.textMuted, letterSpacing:1, textTransform:"uppercase" }}>Loan Management</div>
        </div>
        <nav className="kb-pub-nav" style={{ display:"flex", gap:16, alignItems:"center" }}>
          {[["public_home","Home"],["public_apply","Apply for Financing"],["public_track","Track Application"]].map(([k,label])=>(
            <button key={k} onClick={()=>setPage(k)} style={{ background:"none", border:"none", fontSize:13, fontWeight:page===k?600:400, color:page===k?C.text:C.textDim, cursor:"pointer", fontFamily:"inherit", padding:"4px 0", borderBottom:page===k?`2px solid ${C.text}`:"2px solid transparent" }}>{label}</button>
          ))}
          <div style={{ width:1, height:20, background:C.border, margin:"0 4px" }} />
          <button onClick={()=>{setAuthMode("login");setZone("auth");setAuthForm({email:"",password:"",name:"",error:""})}} style={{ background:"none", border:`1px solid ${C.border}`, padding:"8px 14px", fontSize:12, fontWeight:500, color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Staff Login</button>
        </nav>
      </header>
      {/* Public Content */}
      <main style={{ maxWidth:960, margin:"0 auto", padding:"32px 24px" }}>
        {page === "public_home" && <div>
          <div className="kb-pub-hero" style={{ textAlign:"center", background:`linear-gradient(135deg, ${C.bg} 0%, #f0f4ff 100%)`, borderRadius:8, margin:"-20px -20px 20px", padding:"56px 20px 36px" }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.accent, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>NCR-Registered Credit Provider</div>
            <h1 style={{ fontSize:38, fontWeight:700, color:C.text, margin:"0 0 14px", letterSpacing:-1.2, lineHeight:1.15 }}>Business Finance for Growth</h1>
            <p style={{ fontSize:16, color:C.textDim, maxWidth:560, margin:"0 auto 28px", lineHeight:1.6 }}>Government-backed PO and invoice financing, working capital for micro-traders, and agricultural finance. NCR-registered credit provider (NCRCP22396).</p>
            <div className="kb-pub-cta" style={{ display:"flex", gap:12, justifyContent:"center" }}>
              <button className="kb-cta" onClick={()=>setPage("public_apply")} style={{ background:C.accent, color:"#fff", borderRadius:6, border:"none", padding:"12px 28px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Apply for Financing</button>
              <button className="kb-cta-outline" onClick={()=>setPage("public_track")} style={{ background:"none", border:`1px solid ${C.border}`, padding:"12px 28px", borderRadius:6, fontSize:14, fontWeight:500, color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Track Application</button>
            </div>
            <div style={{ display:"flex", gap:24, justifyContent:"center", marginTop:24, opacity:0.5 }}>
              <span style={{ fontSize:10, color:C.textDim, fontWeight:500 }}>✓ SEDFA Partner</span>
              <span style={{ fontSize:10, color:C.textDim, fontWeight:500 }}>✓ NCA Compliant</span>
              <span style={{ fontSize:10, color:C.textDim, fontWeight:500 }}>✓ POPIA Certified</span>
              <span style={{ fontSize:10, color:C.textDim, fontWeight:500 }}>✓ FICA Registered</span>
            </div>
          </div>
          <div className="kb-pub-grid2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:24 }}>
            {[
              ["Invoice Discounting","Turn outstanding invoices into immediate cash. Get liquidity now without waiting for clients to pay."],
              ["Purchase Order Financing","Secure funding to execute confirmed purchase orders. We cover supplier costs so you can take on larger contracts."],
              ["Working Capital Financing","Fast micro-loans for informal traders and micro-enterprises. AI-scored, group guarantee, up to 12 cycles per year."],
              ["Agri & Project Financing","Seasonal finance for smallholder farmers and tailored project financing for mid-sized contracts, matched to your cash flow cycle."],
            ].map(([title,desc],i)=>(
              <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"24px" }}>
                <div style={{ fontSize:16, fontWeight:700, color:C.text, letterSpacing:-0.2 }}>{title}</div>
                <div style={{ fontSize:13, color:C.textDim, marginTop:8, lineHeight:1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>}
        {page === "public_apply" && (()=>{
          const f = publicAppForm;
          const sf = (k,v) => setPublicAppForm({...f,[k]:v});
          const activeProds = (data?.products||[]).filter(p=>p.status==="Active");
          const selProd = activeProds.find(p=>p.id===f.product);
          const I2 = { s1:"Your Details", s2:"Business Information", s3:"Financing Request", s4:"Review & Submit" };
          const v1 = f.contact && f.email && f.phone && f.password && f.password.length >= 6;
          const v2 = f.businessName && f.idNum && f.regNum && f.industry;
          const v3 = f.product && f.amount && f.term && f.purpose;

          // Pre-approval submission
          const handleSubmitApplication = () => {
            if (!v1||!v2||!v3) { sf("error","Please complete all required fields."); return; }
            sf("error","");
            // Create customer + application in data
            const custId = `C${String((data?.customers?.length||0)+1).padStart(3,"0")}`;
            const appId = `APP-${String((data?.applications?.length||0)+1).padStart(3,"0")}`;
            const newCust = { id:custId, name:f.businessName, contact:f.contact, email:f.email, phone:f.phone, idNum:f.idNum, regNum:f.regNum, industry:f.industry, sector:f.sector, revenue:+f.revenue||0, employees:+f.employees||0, years:+f.years||0, beeLevel:+f.beeLevel||3, beeStatus:"Pending Review", beeExpiry:null, address:f.address, province:f.province, ficaStatus:"Pending", ficaDate:null, riskCategory:"Medium", created:Date.now(), womenOwned:+f.womenOwned||0, youthOwned:+f.youthOwned||0, disabilityOwned:+f.disabilityOwned||0 };
            const newApp = { id:appId, custId, status:"Pre-Approval", product:f.product, amount:+f.amount, term:+f.term, purpose:f.purpose, rate:null, riskScore:null, dscr:null, currentRatio:null, debtEquity:null, socialScore:null, recommendation:null, approver:null, creditMemo:null, submitted:Date.now(), decided:null, conditions:[], assignedTo:null, createdBy:"PUBLIC", createdAt:Date.now(), expiresAt:Date.now()+30*day, sanctionsFlag:false, sanctionsDate:null, withdrawnAt:null, withdrawnBy:null, qaSignedOff:false, qaOfficer:null, qaDate:null, qaFindings:null };
            const newComm = { id:uid(), custId, loanId:null, channel:"Email", direction:"Outbound", from:"System", subject:`Application ${appId} Received — Pre-Approval Pending`, body:`Dear ${f.contact},\n\nThank you for applying for ${selProd?.name||"financing"} of ${fmt.cur(f.amount)}.\n\nYour application reference is ${appId}. We are currently reviewing your pre-approval request.\n\nOnce pre-approval is granted, you will receive a notification to upload your KYB/FICA documentation (ID, company registration, proof of address, bank confirmation, financial statements) to complete the origination process.\n\nA formal loan application tracking number will be assigned once supporting documentation is received.\n\nRegards,\nTQA Capital`, ts:Date.now(), type:"Application" };
            const newAlert = { id:uid(), type:"Application", severity:"info", title:`New Public Application — ${f.businessName}`, msg:`${appId}: ${selProd?.name} ${fmt.cur(f.amount)} over ${f.term}m. Pre-approval review required.`, read:false, ts:Date.now(), custId, loanId:null };
            const newAudit = { id:uid(), action:"Public Application Submitted", entity:appId, user:"Public Applicant", detail:`${f.businessName} (${f.email}) applied for ${selProd?.name} ${fmt.cur(f.amount)} over ${f.term}m. Status: Pre-Approval.`, ts:Date.now(), category:"Origination" };
            save({ ...data, customers:[...(data.customers||[]), newCust], applications:[...(data.applications||[]), newApp], comms:[...(data.comms||[]), newComm], alerts:[...(data.alerts||[]), newAlert], audit:[...(data.audit||[]), newAudit] });
            setPublicAppForm({...f, submitted:true, preApprovalResult:"pending", trackingRef:appId });
          };

          if (f.submitted) return (
            <div style={{ textAlign:"center", padding:"48px 0" }}>
              <div style={{ fontSize:28, fontWeight:700, color:C.text, marginBottom:8 }}>Application Submitted</div>
              <div style={{ fontSize:14, color:C.textDim, maxWidth:480, margin:"0 auto", lineHeight:1.6 }}>
                Thank you, {f.contact}. Your application for {selProd?.name} of {fmt.cur(f.amount)} has been received.
              </div>
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, display:"inline-block", padding:"16px 32px", margin:"24px auto" }}>
                <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:1 }}>Application Reference</div>
                <div style={{ fontSize:28, fontWeight:800, color:C.text, letterSpacing:1, marginTop:4 }}>{f.trackingRef}</div>
              </div>
              <div style={{ fontSize:13, color:C.textDim, maxWidth:480, margin:"0 auto 24px", lineHeight:1.6 }}>
                We will review your pre-approval request and notify you at <strong>{f.email}</strong> once a decision is made.
                Upon pre-approval, you will be asked to upload KYB/FICA documentation to proceed with formal origination.
              </div>
              <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
                <button onClick={()=>{setAuthMode("login");setZone("auth");setAuthForm({email:f.email,password:"",name:"",error:""})}} style={{ background:C.accent, color:"#fff", border:"none", padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Sign In to Track Progress</button>
                <button onClick={()=>{setPublicAppForm({...publicAppForm,step:1,submitted:false,preApprovalResult:null,trackingRef:null,error:""});setPage("public_home")}} style={{ background:"none", border:`1px solid ${C.border}`, padding:"10px 24px", fontSize:13, fontWeight:500, color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Back to Home</button>
              </div>
            </div>
          );

          return (<div>
            <h2 style={{ fontSize:24, fontWeight:700, margin:"0 0 4px" }}>Apply for Financing</h2>
            <p style={{ fontSize:13, color:C.textDim, margin:"0 0 20px" }}>Complete all sections below. No separate registration required — your account is created as part of this application.</p>

            {/* Step indicators */}
            <div style={{ display:"flex", gap:0, marginBottom:24 }}>
              {[1,2,3,4].map(s=>(
                <div key={s} style={{ flex:1, padding:"8px 0", textAlign:"center", background:f.step===s?C.accent:f.step>s?C.surface:C.surface2, color:f.step===s?"#fff":f.step>s?C.green:C.textMuted, fontSize:11, fontWeight:f.step===s?600:400, cursor:"pointer", border:`1px solid ${f.step===s?C.text:C.border}`, borderRight:s<4?"none":"" }} onClick={()=>{if(s<f.step||(s===2&&v1)||(s===3&&v1&&v2)||(s===4&&v1&&v2&&v3)) sf("step",s)}}>
                  {f.step>s?"✓ ":""}{I2["s"+s]}
                </div>
              ))}
            </div>

            {f.error && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", color:"#dc2626", padding:"8px 14px", fontSize:12, marginBottom:16 }}>{f.error}</div>}

            {/* Step 1: Your Details */}
            {f.step===1 && <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"24px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Your Details</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Full Name *</label><input value={f.contact} onChange={e=>sf("contact",e.target.value)} placeholder="e.g. Thando Qamarana" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Email Address *</label><input type="email" value={f.email} onChange={e=>sf("email",e.target.value)} placeholder="you@company.co.za" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Phone Number *</label><input value={f.phone} onChange={e=>sf("phone",e.target.value)} placeholder="0XX XXX XXXX" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Create Password *</label><input type="password" value={f.password} onChange={e=>sf("password",e.target.value)} placeholder="Min 6 characters" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
              </div>
              <div style={{ fontSize:10, color:C.textMuted, marginTop:10 }}>Your login credentials will be created automatically. You can sign in to track your application after submission.</div>
              <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
                <button className="kb-cta" disabled={!v1} onClick={()=>sf("step",2)} style={{ background:v1?C.accent:C.border, color:v1?"#fff":C.textMuted, border:"none", borderRadius:6, padding:"10px 28px", fontSize:13, fontWeight:600, cursor:v1?"pointer":"not-allowed", fontFamily:"inherit" }}>Next: Business Information →</button>
              </div>
            </div>}

            {/* Step 2: Business Information */}
            {f.step===2 && <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"24px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Business Information</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Business Name *</label><input value={f.businessName} onChange={e=>sf("businessName",e.target.value)} placeholder="e.g. Nomsa Trading (Pty) Ltd" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>ID Number *</label><input value={f.idNum} onChange={e=>sf("idNum",e.target.value)} placeholder="13-digit SA ID" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Company Registration *</label><input value={f.regNum} onChange={e=>sf("regNum",e.target.value)} placeholder="YYYY/XXXXXX/07" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Industry *</label><select value={f.industry} onChange={e=>sf("industry",e.target.value)} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit", background:"#fff" }}>{["Retail","Agriculture","Technology","Construction","Food Processing","Transport","Manufacturing","Professional Services","Other"].map(v=><option key={v}>{v}</option>)}</select></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Annual Revenue (R)</label><input type="number" value={f.revenue} onChange={e=>sf("revenue",e.target.value)} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Number of Employees</label><input type="number" value={f.employees} onChange={e=>sf("employees",e.target.value)} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Years in Business</label><input type="number" value={f.years} onChange={e=>sf("years",e.target.value)} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Province</label><select value={f.province} onChange={e=>sf("province",e.target.value)} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit", background:"#fff" }}>{["Eastern Cape","Western Cape","Gauteng","KwaZulu-Natal","Free State","North West","Limpopo","Mpumalanga","Northern Cape"].map(v=><option key={v}>{v}</option>)}</select></div>
                <div style={{ gridColumn:"1/-1" }}><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Business Address</label><input value={f.address} onChange={e=>sf("address",e.target.value)} placeholder="Street address, city" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:16 }}>
                <button onClick={()=>sf("step",1)} style={{ background:"none", border:`1px solid ${C.border}`, padding:"10px 24px", fontSize:13, color:C.textDim, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
                  <button className="kb-cta" disabled={!v2} onClick={()=>sf("step",3)} style={{ background:v2?C.accent:C.border, color:v2?"#fff":C.textMuted, border:"none", borderRadius:6, padding:"10px 28px", fontSize:13, fontWeight:600, cursor:v2?"pointer":"not-allowed", fontFamily:"inherit" }}>Next: Financing Request →</button>
              </div>
            </div>}

            {/* Step 3: Financing Request */}
            {f.step===3 && <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"24px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Financing Request</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ gridColumn:"1/-1" }}><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Select Product *</label><select value={f.product} onChange={e=>sf("product",e.target.value)} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit", background:"#fff" }}><option value="">— Select a product —</option>{activeProds.map(p=><option key={p.id} value={p.id}>{p.name} ({p.monthlyRate||p.baseRate}%/mo · {p.repaymentType})</option>)}</select></div>
                {selProd && <div style={{ gridColumn:"1/-1", background:C.surface2, padding:"12px 16px", fontSize:12, color:C.textDim, lineHeight:1.5, border:`1px solid ${C.border}` }}>{selProd.description}{selProd.idealFor && <div style={{ marginTop:4 }}><strong>Ideal for:</strong> {selProd.idealFor}</div>}</div>}
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Loan Amount (R) *</label><input type="number" value={f.amount} onChange={e=>sf("amount",e.target.value)} placeholder={selProd?`${fmt.cur(selProd.minAmount)} – ${fmt.cur(selProd.maxAmount)}`:""} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Term (months) *</label><input type="number" value={f.term} onChange={e=>sf("term",e.target.value)} placeholder={selProd?`${selProd.minTerm < 1 ? Math.round(selProd.minTerm*30)+' days' : selProd.minTerm+'m'} – ${selProd.maxTerm}m`:""} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div style={{ gridColumn:"1/-1" }}><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Purpose of Financing *</label><textarea value={f.purpose} onChange={e=>sf("purpose",e.target.value)} rows={3} placeholder="Describe what the financing will be used for..." style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit", resize:"vertical" }} /></div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:16 }}>
                <button onClick={()=>sf("step",2)} style={{ background:"none", border:`1px solid ${C.border}`, padding:"10px 24px", fontSize:13, color:C.textDim, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
                <button disabled={!v3} onClick={()=>sf("step",4)} style={{ background:v3?C.accent:C.border, color:v3?"#fff":C.textMuted, border:"none", borderRadius:6, padding:"10px 28px", fontSize:13, fontWeight:600, cursor:v3?"pointer":"not-allowed", fontFamily:"inherit" }}>Next: Review & Submit →</button>
              </div>
            </div>}

            {/* Step 4: Review & Submit */}
            {f.step===4 && <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"24px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Review Your Application</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                <div style={{ borderRight:`1px solid ${C.border}`, paddingRight:16 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>Applicant</div>
                  {[[f.contact],[f.email],[f.phone]].map(([v],i)=><div key={i} style={{ fontSize:12, color:C.textDim, padding:"2px 0" }}>{v}</div>)}
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, margin:"12px 0 8px" }}>Business</div>
                  {[[f.businessName],[`${f.industry} · ${f.province}`],[f.regNum],[f.revenue?`Revenue: ${fmt.cur(f.revenue)}`:null],[f.employees?`${f.employees} employees`:null]].filter(([v])=>v).map(([v],i)=><div key={i} style={{ fontSize:12, color:C.textDim, padding:"2px 0" }}>{v}</div>)}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:8 }}>Financing</div>
                  <div style={{ fontSize:20, fontWeight:700, color:C.text }}>{fmt.cur(f.amount)}</div>
                  <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>{selProd?.name} · {f.term} months</div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text, margin:"12px 0 8px" }}>Purpose</div>
                  <div style={{ fontSize:12, color:C.textDim, lineHeight:1.5 }}>{f.purpose}</div>
                </div>
              </div>
              <div style={{ background:C.surface2, border:`1px solid ${C.border}`, padding:"12px 16px", fontSize:11, color:C.textDim, lineHeight:1.6, marginBottom:16 }}>
                By submitting this application, you confirm that all information provided is accurate and complete. You consent to TQA Capital processing your personal information in accordance with POPIA. A pre-approval decision will be communicated to your email address. Upon pre-approval, you will be requested to upload KYB/FICA documentation.
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <button onClick={()=>sf("step",3)} style={{ background:"none", border:`1px solid ${C.border}`, padding:"10px 24px", fontSize:13, color:C.textDim, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
                <button onClick={handleSubmitApplication} style={{ background:C.accent, color:"#fff", border:"none", padding:"12px 32px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Submit Application</button>
              </div>
            </div>}
          </div>);
        })()}
        {page === "public_track" && <div>
          <h2 style={{ fontSize:24, fontWeight:700, margin:"0 0 8px" }}>Track Your Application</h2>
          <p style={{ fontSize:13, color:C.textDim, margin:"0 0 20px" }}>Sign in to your borrower portal to view application status, upload documents, and see notifications.</p>
          <button onClick={()=>{setAuthMode("login");setZone("auth")}} style={{ background:C.accent, color:"#fff", border:"none", padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Sign In to Portal</button>
        </div>}
      </main>
      <footer style={{ borderTop:`1px solid ${C.border}`, padding:"20px 24px", textAlign:"center", fontSize:10, color:C.textMuted, lineHeight:1.5 }}>
        TQA Capital (Pty) Ltd · NCR Registration: NCRCP22396 · East London, Nahoon Valley<br/>
        Registered Credit Provider in terms of the National Credit Act 34 of 2005
      </footer>
    </div>
  );

  // ═══ AUTH GATE — Login/Signup (shown when Staff Login clicked or Apply redirects) ═══
  if (authLoading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:C.bg, fontFamily:"'Outfit',sans-serif" }}><div style={{ textAlign:"center", color:C.textMuted }}><div style={{ fontSize:14 }}>KwikBridge LMS</div><div style={{ fontSize:12, marginTop:4 }}>Checking authentication...</div></div></div>;

  if (!authSession) return (
    <div style={{ fontFamily:"'Outfit','Segoe UI',system-ui,sans-serif", background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>
      <div style={{ width:400, background:C.surface, border:`1px solid ${C.border}`, padding:40 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:24, fontWeight:700, color:C.text, letterSpacing:-0.5 }}>KwikBridge</div>
          <div style={{ fontSize:10, color:C.textMuted, letterSpacing:1.5, textTransform:"uppercase", marginTop:2 }}>Loan Management System</div>
          <div style={{ fontSize:11, color:C.textDim, marginTop:12 }}>TQA Capital (Pty) Ltd</div>
        </div>

        <div style={{ fontSize:16, fontWeight:600, color:C.text, marginBottom:16 }}>
          {authMode === "login" ? "Sign In" : "Create Account"}
        </div>

        {authForm.error && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", color:"#dc2626", padding:"8px 12px", fontSize:12, marginBottom:12, lineHeight:1.4 }}>{authForm.error}</div>}

        {authMode === "signup" && (
          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Full Name</label>
            <input value={authForm.name} onChange={e=>setAuthForm({...authForm,name:e.target.value})} placeholder="e.g. Thando Qamarana" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:13, fontFamily:"inherit" }} />
          </div>
        )}

        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Email</label>
          <input type="email" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} placeholder="you@tqacapital.co.za" onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?handleSignIn():handleSignUp())} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:13, fontFamily:"inherit" }} />
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Password</label>
          <input type="password" value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} placeholder={authMode==="signup"?"Min 6 characters":"Enter password"} onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?handleSignIn():handleSignUp())} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:13, fontFamily:"inherit" }} />
        </div>

        <button onClick={authMode==="login"?handleSignIn:handleSignUp} style={{ width:"100%", padding:"10px", background:C.accent, color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.3 }}>
          {authMode === "login" ? "Sign In" : "Create Account"}
        </button>

        {/* OAuth providers */}
        <div style={{ margin:"20px 0 16px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1, height:1, background:C.border }} />
          <span style={{ fontSize:10, color:C.textMuted }}>or continue with</span>
          <div style={{ flex:1, height:1, background:C.border }} />
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <a href={authOAuthUrl("google")} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"9px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:12, fontWeight:500, textDecoration:"none", cursor:"pointer", fontFamily:"inherit" }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </a>
          <a href={authOAuthUrl("apple")} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"9px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:12, fontWeight:500, textDecoration:"none", cursor:"pointer", fontFamily:"inherit" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Apple
          </a>
        </div>

        <div style={{ textAlign:"center", marginTop:20, fontSize:12, color:C.textDim }}>
          {authMode === "login" ? (
            <span>No account? <button onClick={()=>{setAuthMode("signup");setAuthForm({...authForm,error:""})}} style={{ background:"none", border:"none", color:C.accent, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, textDecoration:"underline" }}>Create one</button></span>
          ) : (
            <span>Already have an account? <button onClick={()=>{setAuthMode("login");setAuthForm({...authForm,error:""})}} style={{ background:"none", border:"none", color:C.accent, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, textDecoration:"underline" }}>Sign in</button></span>
          )}
        </div>

        {/* Dev bypass */}
        <div style={{ marginTop:24, paddingTop:16, borderTop:`1px solid ${C.border}`, textAlign:"center" }}>
          <div style={{ fontSize:10, color:C.textMuted, marginBottom:8 }}>Development Access</div>
          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
            <button onClick={()=>{setAuthSession({token:"dev",user:{email:"admin@tqacapital.co.za"}});setCurrentUser(SYSTEM_USERS[0]);setZone("staff");setPage("dashboard")}} style={{ background:"none", border:`1px solid ${C.border}`, padding:"8px 12px", fontSize:10, color:C.textDim, cursor:"pointer", fontFamily:"inherit" }}>
              Staff (Admin)
            </button>
            <button onClick={()=>{setAuthSession({token:"dev-borrower",user:{email:"borrower@test.co.za"}});setCurrentUser({id:"B001",name:"Test Borrower",initials:"TB",email:"borrower@test.co.za",role:"BORROWER"});setZone("portal");setPage("portal_dashboard")}} style={{ background:"none", border:`1px solid ${C.border}`, padding:"8px 12px", fontSize:10, color:C.textDim, cursor:"pointer", fontFamily:"inherit" }}>
              Borrower Portal
            </button>
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:16 }}>
          <button onClick={()=>{setZone("public");setPage("public_home");setAuthSession(null)}} style={{ background:"none", border:"none", fontSize:11, color:C.accent, cursor:"pointer", fontFamily:"inherit", textDecoration:"underline" }}>← Back to Public Site</button>
        </div>

        <div style={{ textAlign:"center", marginTop:12, fontSize:10, color:C.textMuted, lineHeight:1.6 }}>
          TQA Capital (Pty) Ltd<br/>NCR: NCRCP22396 · East London, Nahoon Valley
        </div>
      </div>
    </div>
  );



  // Reset: seed fresh data + push to Supabase
  const reset = () => {
    const d = seed();
    setData(d);
    setDetail(null);
    setModal(null);
    setPage("dashboard");
    // Persist in background — don't await
    store.set(SK, JSON.stringify(d)).catch(() => {});
  };
  const cust = id => data?.customers?.find(c => c.id === id);
  const prod = id => data?.products?.find(p => p.id === id);
  const loanForApp = appId => data?.loans?.find(l => l.appId === appId);

  if (!data) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:C.bg, fontFamily:"'Outfit',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:18, fontWeight:700, color:C.text, letterSpacing:-0.3, marginBottom:4 }}>KwikBridge</div>
        <div style={{ fontSize:10, color:C.textMuted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:24 }}>Loan Management</div>
        <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:16 }}>
          {[0,1,2].map(i => <div key={i} className="kb-pulse" style={{ width:8, height:8, borderRadius:4, background:C.accent, animationDelay:`${i*0.2}s` }} />)}
        </div>
        <div style={{ fontSize:11, color:C.textMuted }}>Connecting to database…</div>
      </div>
    </div>;

  const { customers, products, applications, loans, collections, alerts, audit, provisions, comms, documents, statutoryReports, settings } = data;

  // ═══ SECURITY INSTRUMENTS & PRODUCT REQUIREMENTS ═══
  const SECURITY_INSTRUMENTS = {
    cession: { id:"cession", name:"Cession of Receivables", desc:"Three-way cession agreement — cedent assigns rights to payment from off-taker (debtor) to cessionary (lender). Primary security for PO and invoice financing.", template:"cession_agreement", requiresOffTaker:true },
    bankAuth: { id:"bankAuth", name:"Bank Letter of Authority", desc:"Irrevocable authority for lender to collect directly from borrower's bank account or intercept payments from off-taker.", template:"bank_authority", requiresBankDetails:true },
    personalGuarantee: { id:"personalGuarantee", name:"Personal Guarantee / Suretyship", desc:"Director or shareholder assumes personal liability for the loan amount. Unlimited or limited suretyship.", template:"suretyship_deed", requiresGuarantor:true },
    assetPledge: { id:"assetPledge", name:"Asset Pledge", desc:"Movable asset (vehicle, equipment, stock) pledged as security. Asset may not be disposed of without lender consent.", template:"asset_pledge", requiresAssetDetails:true },
    cropLien: { id:"cropLien", name:"Crop Lien / Agricultural Pledge", desc:"Lien over standing crops or harvested produce. Registered with Deeds Office.", template:"crop_lien", requiresCropDetails:true },
    debitMandate: { id:"debitMandate", name:"Debit Order Mandate", desc:"Authority for scheduled debit order collection from borrower's bank account.", template:"debit_mandate", requiresBankDetails:true },
    insurance: { id:"insurance", name:"Credit Life / Key-Person Insurance", desc:"Insurance policy ceded to lender. Covers death, disability, or key-person risk.", template:null, requiresPolicy:true },
  };

  // Product-specific security requirements (dynamic from product config, with hardcoded defaults)
  const PRODUCT_SECURITY_DEFAULTS = {
    P001: { required:["cession"], optional:["bankAuth","personalGuarantee","insurance"], desc:"PO Financing requires cession of the government purchase order." },
    P002: { required:["cession"], optional:["bankAuth","personalGuarantee"], desc:"Invoice financing requires cession of the verified invoice." },
    P003: { required:["cession"], optional:["bankAuth","personalGuarantee"], desc:"Road maintenance invoice cession with ECDoT as off-taker." },
    P004: { required:["cession","bankAuth"], optional:["personalGuarantee","insurance"], desc:"Coega IDZ infrastructure — dual security required." },
    P005: { required:["debitMandate"], optional:["personalGuarantee"], desc:"Micro trader working capital — debit mandate for automated collection." },
    P006: { required:["cropLien"], optional:["personalGuarantee","insurance"], desc:"Agricultural finance — crop lien over standing crops." },
    P007: { required:["cession","personalGuarantee"], optional:["bankAuth","assetPledge","insurance"], desc:"Contract-backed term loans require cession + director suretyship." },
  };
  const getProductSecurity = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (prod?.requiredSecurity?.length > 0 || prod?.optionalSecurity?.length > 0) {
      return { required: prod.requiredSecurity || [], optional: prod.optionalSecurity || [], desc: prod.description?.split(".")[0] + "." || "" };
    }
    return PRODUCT_SECURITY_DEFAULTS[productId] || { required:[], optional:[], desc:"" };
  };
  const PRODUCT_SECURITY = new Proxy({}, { get: (_, key) => getProductSecurity(key) })


  const unread = alerts.filter(a => !a.read).length;

  // ═══ BORROWER PORTAL LAYOUT ═══
  if (userZone === "portal") {
    const myEmail = authSession?.user?.email?.toLowerCase();
    const myCustomer = customers.find(c => c.email?.toLowerCase() === myEmail);
    const myApps = applications.filter(a => myCustomer && a.custId === myCustomer.id);
    const myLoans = loans.filter(l => myCustomer && l.custId === myCustomer.id);
    const myDocs = documents.filter(d => myCustomer && d.custId === myCustomer.id);
    const myComms = comms.filter(c => myCustomer && c.custId === myCustomer.id);

    const portalNav = [
      { key:"portal_dashboard", label:"Dashboard", icon:I.dashboard },
      { key:"portal_applications", label:"My Applications", icon:I.origination, count:myApps.length },
      { key:"portal_loans", label:"My Loans", icon:I.loans, count:myLoans.length },
      { key:"portal_documents", label:"Documents", icon:I.documents, count:myDocs.length },
      { key:"portal_comms", label:"Messages", icon:I.comms, count:myComms.length },
      { key:"portal_profile", label:"My Profile", icon:I.customers },
    ];

    const renderPortalPage = () => {
      switch(page) {
        case "portal_dashboard": return (<div>
          <h2 style={{ margin:"0 0 16px", fontSize:24, fontWeight:700 }}>Welcome{myCustomer ? `, ${myCustomer.contact}` : ""}</h2>
          {!myCustomer && <div style={{ background:C.amberBg, border:`1px solid ${C.amber}`, padding:"16px 20px", marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.amber }}>Complete Your Profile</div>
            <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>Your email ({myEmail}) is not linked to a customer record. Please contact TQA Capital to complete your onboarding.</div>
          </div>}
          <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <div className="kb-kpi" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:20, position:"relative", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}><div style={{ position:"absolute", top:0, left:0, bottom:0, width:3, background:C.accent, opacity:0.7 }} /><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:0.8 }}>Applications</div><div style={{ fontSize:28, fontWeight:700, color:C.accent, marginTop:8 }}>{myApps.length}</div><div style={{ fontSize:10, color:C.textDim, marginTop:4 }}>{myApps.filter(a=>a.status==="Approved").length} approved</div></div>
            <div className="kb-kpi" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:20, position:"relative", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}><div style={{ position:"absolute", top:0, left:0, bottom:0, width:3, background:C.accent, opacity:0.7 }} /><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:0.8 }}>Active Loans</div><div style={{ fontSize:28, fontWeight:700, color:C.green, marginTop:8 }}>{myLoans.filter(l=>l.status==="Active").length}</div><div style={{ fontSize:10, color:C.textDim, marginTop:4 }}>{myLoans.filter(l=>l.dpd===0).length} current</div></div>
            <div className="kb-card-hover" style={{ background:C.surface, border:`1px solid ${C.border}`, padding:20, borderRadius:8 }}><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Total Balance</div><div style={{ fontSize:28, fontWeight:700, color:C.blue, marginTop:4 }}>{fmt.cur(myLoans.reduce((s,l)=>s+l.balance,0))}</div></div>
          </div>
          {myApps.length > 0 && <div style={{ marginTop:16 }}><h3 style={{ fontSize:14, fontWeight:600, margin:"0 0 8px" }}>Recent Applications</h3>
            {myApps.slice(0,3).map(a=><div key={a.id} style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:13, fontWeight:600 }}>{a.id} — {a.purpose?.substring(0,50)}</div><div style={{ fontSize:11, color:C.textMuted }}>{fmt.cur(a.amount)} · {a.term}m · {fmt.date(a.submitted||a.createdAt)}</div></div>
              <Badge color={a.status==="Approved"?"green":a.status==="Declined"?"red":a.status==="Draft"?"gray":"blue"}>{a.status}</Badge>
            </div>)}
          </div>}
        </div>);
        case "portal_applications": return (<div>
          <h2 style={{ margin:"0 0 16px", fontSize:24, fontWeight:700 }}>My Applications</h2>
          <Table columns={[
            {label:"ID",render:r=><span style={{fontWeight:600}}>{r.id}</span>},
            {label:"Product",render:r=>prod(r.product)?.name||r.product},
            {label:"Amount",render:r=>fmt.cur(r.amount)},
            {label:"Term",render:r=>`${r.term}m`},
            {label:"Status",render:r=><Badge color={r.status==="Approved"?"green":r.status==="Declined"?"red":"blue"}>{r.status}</Badge>},
            {label:"Submitted",render:r=>fmt.date(r.submitted||r.createdAt)},
          ]} rows={myApps} emptyMsg="No applications found." />
        </div>);
        case "portal_loans": {
          const activeLoanId = portalPtp.loanId || portalPayment.loanId;
          const selLoan = myLoans.find(l=>l.id===activeLoanId);
          const handlePtp = () => {
            if (!portalPtp.date||!portalPtp.amount) return;
            const l = myLoans.find(x=>x.id===portalPtp.loanId);
            if (!l) return;
            const ptpEntry = { date:portalPtp.date, amount:+portalPtp.amount, notes:portalPtp.notes, status:"Pending", createdAt:Date.now(), createdBy:"Borrower" };
            const updLoans = loans.map(x=>x.id===l.id?{...x, ptpHistory:[...(x.ptpHistory||[]),ptpEntry]}:x);
            save({...data, loans:updLoans, audit:[...audit,{id:uid(),action:"PTP Submitted (Portal)",entity:l.id,user:myCustomer?.contact||"Borrower",detail:`PTP: ${fmt.cur(portalPtp.amount)} by ${portalPtp.date}. ${portalPtp.notes}`,ts:Date.now(),category:"Collections"}], alerts:[...alerts,{id:uid(),type:"Collections",severity:"info",title:`PTP from Borrower — ${l.id}`,msg:`${myCustomer?.name} committed ${fmt.cur(portalPtp.amount)} by ${portalPtp.date}`,read:false,ts:Date.now()}]});
            setPortalPtp({loanId:null,date:"",amount:"",notes:""});
          };
          const handlePayment = () => {
            if (!portalPayment.amount||!portalPayment.ref) return;
            const l = myLoans.find(x=>x.id===portalPayment.loanId);
            if (!l) return;
            const pmtEntry = { id:uid(), amount:+portalPayment.amount, method:portalPayment.method, ref:portalPayment.ref, date:Date.now(), status:"Processing", source:"Portal" };
            const newBal = Math.max(0, l.balance - (+portalPayment.amount));
            const updLoans = loans.map(x=>x.id===l.id?{...x, balance:newBal, payments:[...(x.payments||[]),pmtEntry]}:x);
            save({...data, loans:updLoans, audit:[...audit,{id:uid(),action:"Payment Submitted (Portal)",entity:l.id,user:myCustomer?.contact||"Borrower",detail:`${portalPayment.method} payment of ${fmt.cur(portalPayment.amount)} ref ${portalPayment.ref}. Balance: ${fmt.cur(newBal)}`,ts:Date.now(),category:"Servicing"}], alerts:[...alerts,{id:uid(),type:"Servicing",severity:"info",title:`Payment Received — ${l.id}`,msg:`${myCustomer?.name}: ${fmt.cur(portalPayment.amount)} via ${portalPayment.method} (ref: ${portalPayment.ref})`,read:false,ts:Date.now()}]});
            setPortalPayment({loanId:null,amount:"",method:"EFT",ref:""});
          };
          return (<div>
            <h2 style={{ margin:"0 0 16px", fontSize:24, fontWeight:700 }}>My Loans</h2>
            {myLoans.length===0 ? <div style={{ padding:40, textAlign:"center", color:C.textMuted }}>No active loans.</div> :
            myLoans.map(l=>(
              <div key={l.id} style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"20px", marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700 }}>{l.id} — {prod(l.product)?.name||"Loan"}</div>
                    <div style={{ fontSize:12, color:C.textDim, marginTop:2 }}>Disbursed {fmt.date(l.disbursedAt)} · {l.rate}% · {l.term}m</div>
                  </div>
                  <Badge color={l.dpd>0?"red":"green"}>{l.dpd>0?`${l.dpd} DPD`:"Current"}</Badge>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:16 }}>
                  <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Original</div><div style={{ fontSize:14, fontWeight:700 }}>{fmt.cur(l.amount)}</div></div>
                  <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Balance</div><div style={{ fontSize:14, fontWeight:700, color:l.dpd>0?C.red:C.text }}>{fmt.cur(l.balance)}</div></div>
                  <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Next Due</div><div style={{ fontSize:14, fontWeight:600 }}>{fmt.date(l.nextDue)}</div></div>
                  <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Instalment</div><div style={{ fontSize:14, fontWeight:600 }}>{fmt.cur(l.instalment||l.amount/Math.max(l.term,1))}</div></div>
                </div>
                {/* Recent payments */}
                {(l.payments||[]).length>0 && <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:600, marginBottom:4 }}>Recent Payments</div>
                  {(l.payments||[]).slice(-3).reverse().map((p,i)=><div key={i} style={{ fontSize:11, color:C.textDim, padding:"4px 0", display:"flex", justifyContent:"space-between" }}><span>{fmt.date(p.date)} · {p.method} · {p.ref}</span><span style={{ fontWeight:600 }}>{fmt.cur(p.amount)}</span></div>)}
                </div>}
                <div style={{ display:"flex", gap:8, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                  <button onClick={()=>setPortalPayment({loanId:l.id,amount:"",method:"EFT",ref:""})} style={{ background:C.accent, color:"#fff", border:"none", padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Make Payment</button>
                  {l.dpd>0 && <button onClick={()=>setPortalPtp({loanId:l.id,date:"",amount:"",notes:""})} style={{ background:"none", border:`1px solid ${C.border}`, padding:"8px 16px", fontSize:12, fontWeight:500, color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Promise to Pay</button>}
                </div>
              </div>
            ))}
            {/* PTP Modal */}
            {portalPtp.loanId && <Modal title={`Promise to Pay — ${portalPtp.loanId}`} onClose={()=>setPortalPtp({loanId:null,date:"",amount:"",notes:""})}>
              <div style={{ display:"grid", gap:12 }}>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Payment Date *</label><input type="date" value={portalPtp.date} onChange={e=>setPortalPtp({...portalPtp,date:e.target.value})} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Amount (R) *</label><input type="number" value={portalPtp.amount} onChange={e=>setPortalPtp({...portalPtp,amount:e.target.value})} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Notes</label><textarea value={portalPtp.notes} onChange={e=>setPortalPtp({...portalPtp,notes:e.target.value})} rows={2} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <Btn onClick={handlePtp} disabled={!portalPtp.date||!portalPtp.amount}>Submit PTP</Btn>
              </div>
            </Modal>}
            {/* Payment Modal */}
            {portalPayment.loanId && <Modal title={`Make Payment — ${portalPayment.loanId}`} onClose={()=>setPortalPayment({loanId:null,amount:"",method:"EFT",ref:""})}>
              <div style={{ display:"grid", gap:12 }}>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Amount (R) *</label><input type="number" value={portalPayment.amount} onChange={e=>setPortalPayment({...portalPayment,amount:e.target.value})} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Payment Method</label><select value={portalPayment.method} onChange={e=>setPortalPayment({...portalPayment,method:e.target.value})} style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit", background:"#fff" }}>{["EFT","Debit Order","Card","Cash Deposit"].map(m=><option key={m}>{m}</option>)}</select></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Reference / Proof *</label><input value={portalPayment.ref} onChange={e=>setPortalPayment({...portalPayment,ref:e.target.value})} placeholder="Bank reference or deposit slip number" style={{ width:"100%", padding:"8px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div style={{ background:C.surface2, padding:"8px 12px", fontSize:11, color:C.textDim }}>Payment will be verified by our finance team within 24 hours. Balance updated upon confirmation.</div>
                <Btn onClick={handlePayment} disabled={!portalPayment.amount||!portalPayment.ref}>Submit Payment</Btn>
              </div>
            </Modal>}
          </div>);
        }
        case "portal_documents": {
          const KYB_FICA_DOCS = [
            { key:"sa_id", label:"SA ID Document", category:"KYC", required:true },
            { key:"proof_address", label:"Proof of Address (< 3 months)", category:"KYC", required:true },
            { key:"cipc", label:"Company Registration (CIPC)", category:"KYB", required:true },
            { key:"bank_confirm", label:"Bank Account Confirmation Letter", category:"KYB", required:true },
            { key:"financials", label:"Financial Statements / Management Accounts", category:"KYB", required:true },
            { key:"tax_clearance", label:"SARS Tax Clearance", category:"KYB", required:false },
            { key:"bee_cert", label:"BEE Certificate", category:"KYB", required:false },
            { key:"business_plan", label:"Business Plan", category:"KYB", required:false },
          ];
          const getDocStatus = (key) => {
            const doc = myDocs.find(d => d.docType === key);
            if (!doc) return { status:"Not Uploaded", color:"gray" };
            if (doc.status === "Approved") return { status:"Verified", color:"green" };
            if (doc.status === "Rejected") return { status:"Rejected — Re-upload Required", color:"red" };
            return { status:"Under Review", color:"blue" };
          };
          const allRequiredUploaded = KYB_FICA_DOCS.filter(d=>d.required).every(d=>myDocs.some(md=>md.docType===d.key));

          const handleDocUpload = (docDef) => {
            if (!myCustomer) return;
            const newDoc = { id:uid(), custId:myCustomer.id, appId:myApps[0]?.id||null, name:docDef.label, category:docDef.category, docType:docDef.key, status:"Pending Review", uploadedAt:Date.now(), uploadedBy:"Borrower", fileType:"PDF", size:"—" };
            save({...data, documents:[...documents,newDoc], audit:[...audit,{id:uid(),action:"Document Uploaded (Portal)",entity:newDoc.id,user:myCustomer.contact||"Borrower",detail:`${docDef.label} uploaded for ${myCustomer.name}`,ts:Date.now(),category:"Documents"}], alerts:[...alerts,{id:uid(),type:"Documents",severity:"info",title:`Document Upload — ${myCustomer.name}`,msg:`${docDef.label} uploaded via borrower portal. Review required.`,read:false,ts:Date.now()}]});
          };

          const runBankVerification = () => {
            setPortalVerify({...portalVerify, running:true, bankStatus:null});
            setTimeout(()=>{ setPortalVerify(v=>({...v, running:false, bankStatus:"verified"})); save({...data, audit:[...audit,{id:uid(),action:"Bank Account Verified (API)",entity:myCustomer?.id,user:"System",detail:`Bank account verification API call completed. Status: Verified.`,ts:Date.now(),category:"Compliance"}]}); }, 1500);
          };
          const runCreditCheck = () => {
            setPortalVerify({...portalVerify, running:true, creditStatus:null});
            setTimeout(()=>{ const score = 580 + Math.floor(Math.random()*120); setPortalVerify(v=>({...v, running:false, creditStatus:`Score: ${score}`})); save({...data, audit:[...audit,{id:uid(),action:"Credit Bureau Check (API)",entity:myCustomer?.id,user:"System",detail:`Credit vetting API call completed. Bureau score: ${score}.`,ts:Date.now(),category:"Compliance"}]}); }, 2000);
          };

          return (<div>
            <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700 }}>KYB / FICA Documents</h2>
            <p style={{ fontSize:12, color:C.textDim, margin:"0 0 16px" }}>Upload all required documents to proceed with your loan application. A tracking number will be assigned once all mandatory documents are received.</p>

            {/* Progress indicator */}
            {(()=>{const req=KYB_FICA_DOCS.filter(d=>d.required).length; const done=KYB_FICA_DOCS.filter(d=>d.required&&myDocs.some(md=>md.docType===d.key)).length; return (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"16px 20px", marginBottom:16, display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}><span style={{ fontWeight:600 }}>Mandatory Documents</span><span style={{ color:done===req?C.green:C.amber, fontWeight:600 }}>{done}/{req}</span></div>
                  <div style={{ height:6, background:C.surface2, borderRadius:3 }}><div style={{ height:6, background:done===req?C.green:C.amber, borderRadius:3, width:`${(done/req)*100}%`, transition:"width .3s" }} /></div>
                </div>
                {allRequiredUploaded && <Badge color="green">Ready for Review</Badge>}
              </div>
            );})()}

            {/* Document checklist */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
              {KYB_FICA_DOCS.map(doc=>{
                const st = getDocStatus(doc.key);
                return (
                  <div key={doc.key} style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:8, height:8, borderRadius:4, background:st.color==="green"?C.green:st.color==="red"?C.red:st.color==="blue"?C.blue:C.border }} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{doc.label}{doc.required&&<span style={{ color:C.red, marginLeft:3 }}>*</span>}</div>
                        <div style={{ fontSize:10, color:st.color==="green"?C.green:st.color==="red"?C.red:st.color==="blue"?C.blue:C.textMuted }}>{st.status}</div>
                      </div>
                    </div>
                    {(st.status==="Not Uploaded"||st.status.includes("Re-upload")) && (
                      <button onClick={()=>handleDocUpload(doc)} style={{ background:C.accent, color:"#fff", border:"none", padding:"8px 14px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Upload</button>
                    )}
                    {st.status==="Under Review" && <span style={{ fontSize:10, color:C.blue, fontWeight:500 }}>Pending verification</span>}
                  </div>
                );
              })}
            </div>

            {/* API Verifications */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"16px 18px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Verification Checks</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ border:`1px solid ${C.border}`, padding:"14px" }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:4 }}>Bank Account Verification</div>
                  <div style={{ fontSize:11, color:C.textDim, marginBottom:8 }}>Verify your bank account details via API integration.</div>
                  {portalVerify.bankStatus==="verified" ? <Badge color="green">Verified</Badge> :
                   <button onClick={runBankVerification} disabled={portalVerify.running} style={{ background:portalVerify.running?C.border:C.accent, color:portalVerify.running?C.textMuted:"#fff", border:"none", padding:"8px 16px", fontSize:11, fontWeight:600, cursor:portalVerify.running?"not-allowed":"pointer", fontFamily:"inherit" }}>{portalVerify.running?"Verifying...":"Verify Bank Account"}</button>}
                </div>
                <div style={{ border:`1px solid ${C.border}`, padding:"14px" }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:4 }}>Credit Bureau Check</div>
                  <div style={{ fontSize:11, color:C.textDim, marginBottom:8 }}>Run a credit vetting check (TransUnion/Experian).</div>
                  {portalVerify.creditStatus ? <Badge color="blue">{portalVerify.creditStatus}</Badge> :
                   <button onClick={runCreditCheck} disabled={portalVerify.running} style={{ background:portalVerify.running?C.border:C.accent, color:portalVerify.running?C.textMuted:"#fff", border:"none", padding:"8px 16px", fontSize:11, fontWeight:600, cursor:portalVerify.running?"not-allowed":"pointer", fontFamily:"inherit" }}>{portalVerify.running?"Running check...":"Run Credit Check"}</button>}
                </div>
              </div>
            </div>
          </div>);
        }
        case "portal_comms": return (<div>
          <h2 style={{ margin:"0 0 16px", fontSize:24, fontWeight:700 }}>Messages</h2>
          {myComms.length === 0 ? <div style={{ textAlign:"center", padding:40, color:C.textMuted }}>No messages.</div> :
          myComms.sort((a,b)=>b.ts-a.ts).map(c=><div key={c.id} style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"12px 16px", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.textMuted }}><span>{c.channel} · {c.direction}</span><span>{fmt.date(c.ts)}</span></div>
            <div style={{ fontSize:13, fontWeight:600, marginTop:4 }}>{c.subject}</div>
            <div style={{ fontSize:12, color:C.textDim, marginTop:4, lineHeight:1.5 }}>{c.body}</div>
          </div>)}
        </div>);
        case "portal_profile": return (<div>
          <h2 style={{ margin:"0 0 16px", fontSize:24, fontWeight:700 }}>My Profile</h2>
          {myCustomer ? <SectionCard title="Business Details">
            <InfoGrid items={[["Business Name",myCustomer.name],["Contact",myCustomer.contact],["Email",myCustomer.email],["Phone",myCustomer.phone],["Industry",myCustomer.industry],["BEE Level",`Level ${myCustomer.beeLevel}`],["FICA Status",myCustomer.ficaStatus],["Province",myCustomer.province]]} />
          </SectionCard> : <div style={{ padding:32, textAlign:"center", color:C.textMuted }}>Profile not linked. Contact TQA Capital support.</div>}
        </div>);
        default: return <div>Page not found.</div>;
      }
    };

    return (
      <div style={{ fontFamily:"'Outfit','Segoe UI',system-ui,sans-serif", background:C.bg, minHeight:"100vh", display:"flex", color:C.text }}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{GLOBAL_CSS}</style>
        {/* Portal Sidebar */}
        <aside style={{ width:200, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"14px", borderBottom:`1px solid ${C.surface3}` }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>KwikBridge</div>
            <div style={{ fontSize:10, color:C.textMuted, letterSpacing:0.8, textTransform:"uppercase" }}>Borrower Portal</div>
          </div>
          <nav style={{ flex:1, padding:"8px 4px" }}>
            {portalNav.map(n=>(
              <button key={n.key} onClick={()=>navTo(n.key)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 12px", marginBottom:1, background:page===n.key?C.surface2:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:page===n.key?600:400, color:page===n.key?C.text:C.textDim, textAlign:"left" }}>
                {n.icon}<span style={{ flex:1 }}>{n.label}</span>
                {n.count>0&&<span style={{ fontSize:10, color:C.textMuted }}>{n.count}</span>}
              </button>
            ))}
          </nav>
          <div style={{ padding:"8px 12px 12px", borderTop:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontWeight:500, color:C.text }}>{authSession?.user?.email}</div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>Borrower Account</div>
            <button onClick={handleSignOut} style={{ background:"none", border:`1px solid ${C.border}`, color:C.red, padding:"2px 6px", fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>Sign Out</button>
          </div>
        </aside>
        {/* Portal Main */}
        <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
          <header style={{ background:C.surface, borderBottom:`1px solid ${C.surface3}`, padding:"0 16px", height:48, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {pageHistory.length > 0 && <button onClick={goBack} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, padding:"4px 2px", display:"flex", alignItems:"center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>}
              <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{portalNav.find(n=>n.key===page)?.label || "Portal"}</div>
            </div>
            <div style={{ fontSize:11, color:C.textMuted }}>{myCustomer?.name || authSession?.user?.email}</div>
          </header>
          <main style={{ flex:1, overflow:"auto", padding:16 }}>{renderPortalPage()}</main>
        </div>
      </div>
    );
  }

  // ═══ STAFF BACK-OFFICE LAYOUT ═══
  // Zone enforcement: redirect borrowers trying to access staff pages
  if (userZone !== "staff" && zone === "staff") { setZone(userZone); setPage(userZone === "portal" ? "portal_dashboard" : "public_home"); }

  const staffNavItems = [
    { key: "dashboard", label: "Dashboard", icon: I.dashboard },
    { key: "customers", label: "Customers", icon: I.customers, count: customers.length },
    { key: "origination", label: "Origination", icon: I.origination, count: applications.filter(a => ["Submitted","Underwriting"].includes(a.status)).length },
    { key: "underwriting", label: "Underwriting", icon: I.underwriting },
    { key: "loans", label: "Loan Book", icon: I.loans, count: loans.length },
    { key: "servicing", label: "Servicing", icon: I.servicing },
    { key: "collections", label: "Collections", icon: I.collections, count: loans.filter(l => l.dpd > 0).length },
    { key: "provisioning", label: "IFRS 9", icon: I.provisioning },
    { key: "governance", label: "Governance", icon: I.governance },
    { key: "statutory", label: "NCR Reporting", icon: I.calendar, count: (statutoryReports||[]).filter(r=>r.status!=="Submitted"&&new Date(r.dueDate)>new Date()).length },
    { key: "documents", label: "Documents", icon: I.documents },
    { key: "reports", label: "Reports", icon: I.reports },
    { key: "comms", label: "Communications", icon: I.comms, count: comms.length },
    { key: "admin", label: "Administration", icon: I.governance },
  ].filter(n => canDo(n.key, "view"));

  const markRead = id => save({ ...data, alerts: alerts.map(a => a.id === id ? { ...a, read: true } : a) });
  const addAudit = (action, entity, user, detail, category) => ({ id: uid(), action, entity, user, detail, ts: Date.now(), category });
  const addAlert = (type, severity, title, msg, extra = {}) => ({ id: uid(), type, severity, title, msg, read: false, ts: Date.now(), ...extra });

  const createCustomer = (form) => {
    if (!canDo("customers","create")) { alert("Permission denied."); return; }
    const c = { ...form, id:`C${String(customers.length+1).padStart(3,"0")}`, ficaStatus:"Pending", ficaDate:null, riskCategory:"Medium", created:Date.now(), beeStatus:"Pending Review", beeExpiry:null, womenOwned:+form.womenOwned||0, youthOwned:+form.youthOwned||0, disabilityOwned:+form.disabilityOwned||0 };
    save({ ...data, customers:[...customers, c], audit:[...audit, addAudit("Customer Created", c.id, currentUser.name, `New customer: ${c.name}. Industry: ${c.industry}.`, "Onboarding")] });
    return c.id;
  };
  const updateCustomer = (custId, updates) => {
    if (!canDo("customers","update")) { alert("Permission denied."); return; }
    save({ ...data, customers: customers.map(c => c.id === custId ? { ...c, ...updates } : c), audit:[...audit, addAudit("Customer Updated", custId, currentUser.name, `Profile updated. Fields: ${Object.keys(updates).join(", ")}.`, "Onboarding")] });
  };
  const updateFicaStatus = (custId, newStatus) => {
    if (!canDoAny("customers",["update"]) && !canDo("underwriting","signoff")) { alert("Permission denied."); return; }
    const c = cust(custId);
    const validTransitions = { "Pending":["Under Review"], "Under Review":["Verified","Failed"], "Failed":["Under Review"], "Verified":["Expired","Under Review"], "Expired":["Under Review"] };
    if (!validTransitions[c?.ficaStatus]?.includes(newStatus)) { alert(`Invalid transition: ${c?.ficaStatus} → ${newStatus}`); return; }
    const updates = { ficaStatus: newStatus };
    if (newStatus === "Verified") updates.ficaDate = Date.now();
    save({ ...data, customers: customers.map(x => x.id === custId ? { ...x, ...updates } : x),
      audit:[...audit, addAudit("FICA Status Change", custId, currentUser.name, `${c?.name}: ${c?.ficaStatus} → ${newStatus}.`, "Compliance")],
      alerts: newStatus==="Failed" ? [...alerts, addAlert("Compliance","warning",`FICA Failed – ${c?.name}`,`Customer ${custId} FICA verification failed. Review required.`)] : alerts
    });
  };
  const updateBeeStatus = (custId, newStatus, beeLevel, expiryDate) => {
    if (!canDoAny("customers",["update"]) && !canDo("underwriting","signoff")) { alert("Permission denied."); return; }
    const c = cust(custId);
    const updates = { beeStatus: newStatus };
    if (beeLevel) updates.beeLevel = +beeLevel;
    if (expiryDate) updates.beeExpiry = new Date(expiryDate).getTime();
    if (newStatus === "Verified" && !expiryDate) updates.beeExpiry = Date.now() + 365*day;
    save({ ...data, customers: customers.map(x => x.id === custId ? { ...x, ...updates } : x),
      audit:[...audit, addAudit("BEE Status Change", custId, currentUser.name, `${c?.name}: BEE status → ${newStatus}${beeLevel ? `. Level ${beeLevel}` : ""}.`, "Compliance")]
    });
  };

  const submitApp = form => {
    if (!canDo("origination","create")) { alert("Permission denied: you cannot create applications."); return; }
    const c = cust(form.custId);
    const p = prod(form.product);
    if (c?.ficaStatus === "Pending") { alert(`Cannot submit: ${c.name} FICA status is Pending. Initiate KYC review first.`); return; }
    if (c?.ficaStatus === "Failed") { alert(`Cannot submit: ${c.name} FICA verification failed. Re-submit KYC before applying.`); return; }
    if (c?.ficaStatus === "Expired") { alert(`Cannot submit: ${c.name} FICA has expired. Renew verification first.`); return; }
    const existing = applications.find(a => a.custId === form.custId && a.product === form.product && ["Draft","Submitted","Underwriting"].includes(a.status));
    if (existing) { alert(`Duplicate: ${c?.name} already has an active ${p?.name} application (${existing.id}, status: ${existing.status}).`); return; }
    if (p?.status !== "Active") { alert(`Product ${p?.name} is ${p?.status}. Only Active products can accept applications.`); return; }

    const expiresAt = Date.now() + 30 * day; // 30-day expiry for Draft applications
    const app = { id:`APP-${String(applications.length+1).padStart(3,"0")}`, custId:form.custId, status:"Draft", product:form.product, amount:+form.amount, term:+form.term, purpose:form.purpose, rate:null, riskScore:null, dscr:null, currentRatio:null, debtEquity:null, socialScore:null, recommendation:null, approver:null, creditMemo:null, submitted:null, decided:null, conditions:[], assignedTo:null, createdBy:currentUser.id, createdAt:Date.now(), expiresAt, sanctionsFlag:false, sanctionsDate:null, withdrawnAt:null, withdrawnBy:null, qaSignedOff:false, qaOfficer:null, qaDate:null, qaFindings:null };

    showToast("Application submitted successfully");
    save({ ...data,
      applications: [...applications, app],
      audit: [...audit, addAudit("Application Created (Draft)", app.id, currentUser.name, `Draft ${p?.name} application for ${fmt.cur(form.amount)} by ${c?.name}. Expires: ${fmt.date(expiresAt)}. Requires QA sign-off.`, "Origination")],
      alerts: [...alerts, addAlert("Application", "info", `Draft Application – ${c?.name}`, `${app.id} created. QA & document check required before submission.`)]
    });
    setModal(null);
  };

  const qaSignOffApplication = (appId) => {
    if (!canDo("origination","update")) { alert("Permission denied."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a || a.status !== "Draft") { alert("Only Draft applications can be QA'd and submitted."); return; }
    const c = cust(a.custId);
    const p = prod(a.product);
    const custDocs = (documents||[]).filter(d => d.custId === a.custId && (d.appId === a.id || !d.appId));

    const mandatoryTypes = ["ID Document","Proof of Address","Bank Confirmation","Company Registration"];
    const missing = [];
    const incomplete = [];
    mandatoryTypes.forEach(type => {
      const doc = custDocs.find(d => d.type === type);
      if (!doc) missing.push(type);
      else if (doc.status === "Pending" || doc.status === "Rejected") incomplete.push(`${type} (${doc.status})`);
    });

    const fieldErrors = [];
    if (!a.amount || a.amount <= 0) fieldErrors.push("Loan amount is required");
    if (!a.term || a.term <= 0) fieldErrors.push("Loan term is required");
    if (!a.purpose) fieldErrors.push("Purpose of loan is required");
    if (p && a.amount < p.minAmount) fieldErrors.push(`Amount below product minimum (${fmt.cur(p.minAmount)})`);
    if (p && a.amount > p.maxAmount) fieldErrors.push(`Amount exceeds product maximum (${fmt.cur(p.maxAmount)})`);

    if (a.expiresAt && a.expiresAt < Date.now()) { alert(`Application ${appId} has expired (${fmt.date(a.expiresAt)}). It can no longer be submitted.`); return; }

    const qaFindings = { mandatoryDocs: mandatoryTypes.map(type => { const doc = custDocs.find(d=>d.type===type); return { type, docId:doc?.id||null, status:doc?.status||"Missing", onFile:!!doc }; }), missingDocs: missing, incompleteDocs: incomplete, fieldErrors, passedAt: null, officer: null };

    if (missing.length > 0 || incomplete.length > 0 || fieldErrors.length > 0) {
      qaFindings.result = "Failed";
      qaFindings.failedAt = Date.now();
      qaFindings.officer = currentUser.name;

      const issueLines = [];
      if (missing.length > 0) issueLines.push(`Missing documents:\n${missing.map(d => `  • ${d}`).join("\n")}`);
      if (incomplete.length > 0) issueLines.push(`Documents requiring resubmission:\n${incomplete.map(d => `  • ${d}`).join("\n")}`);
      if (fieldErrors.length > 0) issueLines.push(`Application issues:\n${fieldErrors.map(e => `  • ${e}`).join("\n")}`);
      const notifBody = `Dear ${c?.contact},\n\nYour loan application ${appId} for ${fmt.cur(a.amount)} (${p?.name}) did not pass our quality assurance review.\n\nThe following items require your attention:\n\n${issueLines.join("\n\n")}\n\nPlease submit the outstanding documents via the KwikBridge portal or email to documents@kwikbridge.co.za.\n\nYour application will remain in draft status until all requirements are met. Please note the application expires on ${fmt.date(a.expiresAt)}.\n\nIf you have any questions, contact your Loan Officer.\n\nRegards,\n${currentUser.name}\nKwikBridge Lending Operations`;

      const notification = { id:uid(), custId:a.custId, loanId:null, channel:"Email", direction:"Outbound", from:currentUser.name, subject:`Action Required – Application ${appId} QA Review`, body:notifBody, ts:Date.now(), relatedTo:appId, type:"QA Notification" };

      const docRequests = [...(a.workflow?.docRequests || [])];
      missing.forEach(docType => {
        docRequests.push({ docType, requestedBy:currentUser.name, requestedAt:Date.now(), status:"Sent", reason:"QA failed — missing", commId:notification.id });
      });
      incomplete.forEach(entry => {
        const docType = entry.split(" (")[0];
        docRequests.push({ docType, requestedBy:currentUser.name, requestedAt:Date.now(), status:"Sent", reason:"QA failed — resubmission required", commId:notification.id });
      });

      const updatedWorkflow = { ...(a.workflow || {}), docRequests };

      save({ ...data,
        applications: applications.map(x => x.id === appId ? { ...x, qaFindings, qaSignedOff: false, workflow: updatedWorkflow } : x),
        comms: [...comms, notification],
        audit: [...audit,
          addAudit("QA Failed", appId, currentUser.name, `QA check failed. Missing: ${missing.join(", ")||"none"}. Incomplete: ${incomplete.join(", ")||"none"}. Field errors: ${fieldErrors.join(", ")||"none"}.`, "Origination"),
          addAudit("QA Failure Notification Sent", appId, "System", `Email sent to ${c?.contact} listing ${missing.length + incomplete.length} document issues and resubmission instructions.`, "Communication"),
        ],
        alerts: [...alerts, addAlert("Application","warning",`QA Failed – ${c?.name}`,`${appId}: ${missing.length} missing, ${incomplete.length} incomplete. Notification sent to applicant.`)]
      });
      alert(`QA check failed:\n${missing.length ? `Missing documents: ${missing.join(", ")}\n` : ""}${incomplete.length ? `Incomplete: ${incomplete.join(", ")}\n` : ""}${fieldErrors.length ? `Validation: ${fieldErrors.join(", ")}\n` : ""}\nNotification sent to ${c?.contact}.`);
      return;
    }

    const sanctionsHit = false; // Placeholder for API
    qaFindings.result = "Passed";
    qaFindings.passedAt = Date.now();
    qaFindings.officer = currentUser.name;

    save({ ...data,
      applications: applications.map(x => x.id === appId ? { ...x, status: "Submitted", submitted: Date.now(), qaSignedOff: true, qaOfficer: currentUser.name, qaDate: Date.now(), qaFindings, sanctionsFlag: sanctionsHit, sanctionsDate: Date.now() } : x),
      audit: [...audit,
        addAudit("QA Sign-Off", appId, currentUser.name, `QA passed. All mandatory documents on file. Application formally submitted.`, "Origination"),
        addAudit("Sanctions Screening", appId, "System", `Automated screening: ${sanctionsHit ? "MATCH FOUND" : "Clear. No matches."}.`, "Compliance"),
      ],
      alerts: [...alerts,
        addAlert("Application", "info", `Application Submitted – ${c?.name}`, `${appId} passed QA and formally submitted. Ready for assignment.`),
        ...(sanctionsHit ? [addAlert("Compliance","critical",`Sanctions Hit – ${c?.name}`,`${appId}: potential match. Immediate review required.`)] : []),
      ]
    });
  };

  const assignApplication = (appId, userId) => {
    if (!canDo("origination","assign")) { alert("Permission denied: you cannot assign applications."); return; }
    const u = SYSTEM_USERS.find(x => x.id === userId);
    save({ ...data,
      applications: applications.map(a => a.id === appId ? { ...a, assignedTo: userId } : a),
      audit: [...audit, addAudit("Application Assigned", appId, currentUser.name, `Assigned to ${u?.name} (${ROLES[u?.role]?.label}).`, "Origination")]
    });
  };

  const withdrawApplication = (appId, reason) => {
    if (!canDo("origination","update")) { alert("Permission denied."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a || !["Draft","Submitted","Underwriting"].includes(a.status)) { alert("Only Draft, Submitted or Underwriting applications can be withdrawn."); return; }
    save({ ...data,
      applications: applications.map(x => x.id === appId ? { ...x, status: "Withdrawn", withdrawnAt: Date.now(), withdrawnBy: currentUser.id } : x),
      audit: [...audit, addAudit("Application Withdrawn", appId, currentUser.name, `Withdrawn. Reason: ${reason || "No reason provided"}.`, "Origination")],
      alerts: [...alerts, addAlert("Application","warning",`Application Withdrawn – ${appId}`,`${a.id} withdrawn by ${currentUser.name}. ${reason||""}`)]
    });
  };

  const moveToUnderwriting = appId => {
    if (!canDo("underwriting","update")) { alert("Permission denied."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a || a.status !== "Submitted") { alert("Only Submitted applications (post-QA sign-off) can move to Underwriting."); return; }
    if (!a.qaSignedOff) { alert("QA sign-off required before underwriting can begin."); return; }
    const emptyWF = { kycComplete:false, kycFindings:[], kycDate:null, kycOfficer:null, docsComplete:false, docsFindings:[], docsDate:null, docsOfficer:null, siteVisitComplete:false, siteVisitFindings:[], siteVisitDate:null, siteVisitOfficer:null, siteVisitNotes:"", creditPulled:false, creditBureauScore:null, creditDate:null, creditFindings:[], financialAnalysisComplete:false, financialDate:null, socialVerified:false, socialFindings:[], socialDate:null, socialOfficer:null, collateralAssessed:false, collateralFindings:[], collateralDate:null, collateralTotal:0, sanctionsCleared:false, sanctionsDate:null, analystNotes:"", creditMemoSections:[] };
    save({ ...data,
      applications: applications.map(a => a.id === appId ? { ...a, status: "Underwriting", workflow: a.workflow || emptyWF, assignedTo: currentUser.id } : a),
      audit: [...audit, addAudit("Status Change", appId, currentUser.name, `Application moved to Underwriting by ${currentUser.name}. Assigned to ${currentUser.name}.`, "Origination")]
    });
  };

  const saveAnalystNotes = (appId, notes) => {
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const w = { ...(a.workflow || {}), analystNotes: notes };
    save({ ...data, applications: applications.map(x => x.id === appId ? { ...x, workflow: w } : x) });
  };

  const actionFindingItem = (appId, stepKey, itemIndex, action, note) => {
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const w = { ...(a.workflow || {}) };
    const fieldKey = stepKey === "kyc" ? "kycFindings" : "docsFindings";
    const items = [...(w[fieldKey] || [])];
    if (!items[itemIndex]) return;
    items[itemIndex] = { ...items[itemIndex], officerAction: action, officerNote: note || items[itemIndex].officerNote, status: action === "Confirmed" ? (items[itemIndex].systemResult === "Pass" || items[itemIndex].systemResult === "Verified" ? "Pass" : "Confirmed (Override)") : action === "Flagged" ? "Flagged" : action === "Rejected" ? "Rejected" : items[itemIndex].status };
    w[fieldKey] = items;
    save({ ...data, applications: applications.map(x => x.id === appId ? { ...x, workflow: w } : x) });
  };

  const updateFindingNote = (appId, stepKey, itemIndex, note) => {
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const w = { ...(a.workflow || {}) };
    const fieldKey = stepKey === "kyc" ? "kycFindings" : "docsFindings";
    const items = [...(w[fieldKey] || [])];
    if (!items[itemIndex]) return;
    items[itemIndex] = { ...items[itemIndex], officerNote: note };
    w[fieldKey] = items;
    save({ ...data, applications: applications.map(x => x.id === appId ? { ...x, workflow: w } : x) });
  };

  const signOffStep = (appId, stepKey) => {
    if (!canDo("underwriting","signoff")) { alert("Permission denied: you cannot sign off on DD steps."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const c = cust(a.custId);
    const w = { ...(a.workflow || {}) };
    let newAudit = [...audit];
    let newAlerts = [...alerts];
    if (stepKey === "kyc") {
      const items = w.kycFindings || [];
      const allActioned = items.every(f => f.officerAction);
      if (!allActioned) return;
      const allOk = items.every(f => f.status === "Pass" || f.status === "Confirmed (Override)");
      w.kycComplete = allOk;
      w.kycOfficer = currentUser.name;
      w.sanctionsCleared = items.find(f => f.item === "Sanctions Screening")?.status === "Pass";
      w.sanctionsDate = Date.now();
      const passCount = items.filter(f => f.status === "Pass" || f.status === "Confirmed (Override)").length;
      newAudit.push(addAudit("KYC Sign-Off", a.id, currentUser.name, `Signed off KYC. ${passCount}/${items.length} confirmed. ${allOk ? "FICA complete." : "Incomplete."}`, "Compliance"));
      if (!allOk) newAlerts.push(addAlert("Compliance","warning",`KYC Sign-Off Incomplete – ${c?.name}`,`${a.id}: ${items.filter(f=>f.status!=="Pass"&&f.status!=="Confirmed (Override)").map(f=>f.item).join(", ")} not cleared.`));
    }
    if (stepKey === "docs") {
      const items = w.docsFindings || [];
      const allActioned = items.filter(f => f.required !== false).every(f => f.officerAction);
      if (!allActioned) return;
      const allOk = items.filter(f => f.required !== false).every(f => f.status === "Pass" || f.status === "Verified" || f.status === "Confirmed (Override)");
      w.docsComplete = allOk;
      w.docsOfficer = currentUser.name;
      const passCount = items.filter(f => f.status === "Pass" || f.status === "Verified" || f.status === "Confirmed (Override)").length;
      newAudit.push(addAudit("Document Review Sign-Off", a.id, currentUser.name, `Signed off. ${passCount}/${items.length} confirmed. ${allOk ? "Complete." : "Gaps remain."}`, "Underwriting"));
    }
    if (stepKey === "sitevisit") { w.siteVisitComplete = true; w.siteVisitOfficer = currentUser.name; newAudit.push(addAudit("Site Visit Sign-Off", a.id, currentUser.name, "Site visit findings confirmed.", "Underwriting")); }
    if (stepKey === "credit") { w.financialAnalysisComplete = true; newAudit.push(addAudit("Credit Analysis Sign-Off", a.id, currentUser.name, "Financial analysis confirmed.", "Underwriting")); }
    if (stepKey === "collateral") { w.collateralAssessed = true; newAudit.push(addAudit("Collateral Sign-Off", a.id, currentUser.name, `Security confirmed. Total: ${fmt.cur(w.collateralTotal)}.`, "Underwriting")); }
    if (stepKey === "social") { w.socialVerified = true; w.socialOfficer = currentUser.name; newAudit.push(addAudit("Social Impact Sign-Off", a.id, currentUser.name, `Social impact verified. Score: ${applications.find(x=>x.id===appId)?.socialScore}.`, "Compliance")); }
    save({ ...data, applications: applications.map(x => x.id === appId ? { ...x, workflow: w } : x), audit: newAudit, alerts: newAlerts });
  };

  const approveDocument = (docId, appId) => {
    if (!canDo("documents","approve")) { alert("Permission denied: you cannot approve documents."); return; }
    const doc = (documents||[]).find(d => d.id === docId);
    if (!doc) return;
    const updated = { ...doc, status: "Verified", verifiedBy: currentUser.name, verifiedAt: Date.now() };
    save({ ...data, documents: documents.map(d => d.id === docId ? updated : d), audit: [...audit, addAudit("Document Approved", docId, currentUser.name, `${doc.name} verified and approved.`, "Underwriting")] });
  };
  const rejectDocument = (docId, reason) => {
    if (!canDo("documents","update")) { alert("Permission denied."); return; }
    const doc = (documents||[]).find(d => d.id === docId);
    if (!doc) return;
    const updated = { ...doc, status: "Rejected", verifiedBy: currentUser.name, verifiedAt: Date.now(), notes: reason || "Document rejected. Re-submission required." };
    save({ ...data, documents: documents.map(d => d.id === docId ? updated : d), audit: [...audit, addAudit("Document Rejected", docId, currentUser.name, `${doc.name} rejected. Reason: ${reason||"Re-submission required."}`, "Underwriting")] });
  };
  const requestDocFromApplicant = (appId, docType, message) => {
    if (!canDo("comms","create")) { alert("Permission denied: you cannot send communications."); return; }
    const a = applications.find(x => x.id === appId);
    const c = cust(a?.custId);
    const body = message || `Dear ${c?.contact},\n\nPlease submit the following document for your loan application ${appId}:\n\n  → ${docType}\n\nYou may upload via the KwikBridge portal or email to documents@kwikbridge.co.za.\n\nIf you have any questions, contact your Loan Officer.\n\nRegards,\n${currentUser.name}\nKwikBridge Lending Operations`;
    const notification = { id:uid(), custId:a?.custId, loanId:null, channel:"Email", direction:"Outbound", from:currentUser.name, subject:`Document Request – ${docType}`, body, ts:Date.now(), relatedTo:appId, docType };
    const w = { ...(a?.workflow||{}) };
    const requests = w.docRequests || [];
    requests.push({ docType, requestedBy:currentUser.name, requestedAt:Date.now(), status:"Sent", commId:notification.id });
    w.docRequests = requests;
    save({ ...data,
      applications: applications.map(x => x.id === appId ? { ...x, workflow: w } : x),
      comms:[...comms, notification],
      audit:[...audit, addAudit("Document Requested", appId, currentUser.name, `${docType} requested from ${c?.contact} via email.`, "Underwriting")],
      alerts:[...alerts, addAlert("Application","info",`Doc Requested – ${c?.name}`,`${docType} requested for ${appId}. Awaiting submission.`)]
    });
  };
  const sendNotification = (appId, subject, body) => {
    if (!canDo("comms","create")) { alert("Permission denied."); return; }
    const a = applications.find(x => x.id === appId);
    const c = cust(a?.custId);
    const notification = { id:uid(), custId:a?.custId, loanId:null, channel:"Email", direction:"Outbound", from:currentUser.name, subject, body, ts:Date.now() };
    save({ ...data, comms:[...comms, notification], audit:[...audit, addAudit("Notification Sent", appId, currentUser.name, `Email to ${c?.contact}: ${subject}`, "Communication")] });
  };
  const saveSiteVisitNotes = (appId, notes) => {
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const w = { ...(a.workflow||{}), siteVisitNotes: notes };
    save({ ...data, applications: applications.map(x => x.id === appId ? { ...x, workflow: w } : x) });
  };
  const saveSiteVisitField = (appId, fieldIndex, value) => {
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const w = { ...(a.workflow || {}) };
    const findings = [...(w.siteVisitFindings || [])];
    if (findings[fieldIndex]) findings[fieldIndex] = { ...findings[fieldIndex], value };
    w.siteVisitFindings = findings;
    save({ ...data, applications: applications.map(x => x.id === appId ? { ...x, workflow: w } : x) });
  };
  const saveSiteVisitRating = (appId, fieldIndex, rating) => {
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const w = { ...(a.workflow || {}) };
    const findings = [...(w.siteVisitFindings || [])];
    if (findings[fieldIndex]) findings[fieldIndex] = { ...findings[fieldIndex], rating };
    w.siteVisitFindings = findings;
    save({ ...data, applications: applications.map(x => x.id === appId ? { ...x, workflow: w } : x) });
  };
  const saveCreditFinding = (appId, fieldIndex, field, value) => {
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const w = { ...(a.workflow || {}) };
    const findings = [...(w.creditFindings || [])];
    if (findings[fieldIndex]) findings[fieldIndex] = { ...findings[fieldIndex], [field]: value };
    w.creditFindings = findings;
    save({ ...data, applications: applications.map(x => x.id === appId ? { ...x, workflow: w } : x) });
  };

  const runDDStep = (appId, stepKey) => {
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const c = cust(a.custId);
    const w = { ...(a.workflow || {}) };
    const custDocs = (documents||[]).filter(d => d.custId === a.custId);
    const appDocs = custDocs.filter(d => d.appId === a.id || !d.appId);
    let newAudit = [...audit];
    let newAlerts = [...alerts];
    let updatedApp = { ...a };

    if (stepKey === "kyc") {
      const checks = [
        { item:"ID Document", source:"Home Affairs API", doc: appDocs.find(d => d.type === "ID Document"), purpose:"Identity verification against Home Affairs database" },
        { item:"Proof of Address", source:"Manual verification", doc: appDocs.find(d => d.type === "Proof of Address"), purpose:"Physical address confirmation (municipal account/utility bill within 3 months)" },
        { item:"Bank Confirmation", source:"Bank verification", doc: appDocs.find(d => d.type === "Bank Confirmation"), purpose:"Bank account ownership and status confirmation" },
        { item:"Company Registration", source:"CIPC API", doc: appDocs.find(d => d.type === "Company Registration"), purpose:"Business registration status verified against CIPC database" },
      ];
      const findings = checks.map(ch => ({
        item: ch.item, source: ch.source, purpose: ch.purpose,
        docId: ch.doc?.id || null,
        systemResult: ch.doc?.status === "Verified" ? "Pass" : ch.doc ? "Fail" : "Missing",
        status: "Pending Review",
        detail: ch.doc?.status === "Verified" ? `${ch.doc.id} — Verified on ${fmt.date(ch.doc.verifiedAt)} by ${ch.doc.verifiedBy || "System"}. ${ch.purpose}`
          : ch.doc ? `${ch.doc.id} — Status: ${ch.doc.status}. ${ch.purpose}`
          : `Not on file. Required for: ${ch.purpose}`,
        officerAction: null, officerNote: ""
      }));
      findings.push({ item:"Sanctions Screening", source:"OFAC / UN / SA Consolidated Lists", purpose:"AML compliance — check against international and domestic sanctions lists", systemResult: a.sanctionsFlag ? "Fail" : "Pass", status:"Pending Review", detail: a.sanctionsFlag ? "MATCH FOUND — review immediately." : "Automated screening returned no matches. Officer must confirm.", officerAction:null, officerNote:"" });
      findings.push({ item:"PEP Screening", source:"PEP Database", purpose:"Politically exposed persons check on directors and shareholders", systemResult:"Pass", status:"Pending Review", detail:"No politically exposed persons identified among directors. Officer must confirm.", officerAction:null, officerNote:"" });
      w.kycComplete = false;
      w.kycFindings = findings;
      w.kycDate = Date.now();
      w.kycOfficer = null;
      w.sanctionsCleared = false;
      newAudit.push(addAudit("KYC Checks Initiated", a.id, "System", `${checks.length + 2} identity/compliance checks run. Awaiting officer review.`, "Compliance"));
    }

    if (stepKey === "docs") {
      const kycTypes = ["ID Document","Proof of Address","Bank Confirmation","Company Registration"];
      const kycStatus = w.kycComplete ? "Verified in KYC (Step 2)" : "Pending KYC verification";
      const reqTypes = ["Annual Financials","Business Plan"];
      const findings = [];
      kycTypes.forEach(type => {
        const doc = appDocs.find(d => d.type === type);
        const kycItem = (w.kycFindings||[]).find(f => f.item === type);
        findings.push({
          item: type, required: true, inherited: true,
          systemResult: kycItem?.officerAction === "Confirmed" ? "Verified" : doc?.status === "Verified" ? "Verified" : w.kycComplete ? "Verified" : doc ? doc.status : "Missing",
          status: w.kycComplete ? "Pass" : kycItem?.officerAction ? kycItem.status : "Pending KYC",
          detail: w.kycComplete ? `Verified in Step 2 (KYC/FICA)${doc ? ` — ${doc.id}` : ""}` : `Awaiting KYC verification in Step 2${doc ? ` — ${doc.id}` : ""}`,
          docId: doc?.id || null,
          officerAction: w.kycComplete ? "Inherited" : null, officerNote: ""
        });
      });
      reqTypes.forEach(type => {
        const doc = appDocs.find(d => d.type === type || d.name.includes(type.split(" ")[0]));
        findings.push({
          item: type, required: true, inherited: false,
          systemResult: doc?.status === "Verified" ? "Verified" : doc?.status === "Under Review" ? "Under Review" : doc ? "Received" : "Missing",
          status: "Pending Review",
          detail: doc ? `${doc.id} — ${doc.status}${doc.verifiedBy ? ` by ${doc.verifiedBy}` : ""}` : "Not uploaded. Request from customer.",
          docId: doc?.id || null,
          officerAction: null, officerNote: ""
        });
      });
      const industryDocs = appDocs.filter(d => ["Industry License","Operating License","CIDB Registration","BEE Certificate","Insurance","Title Deed"].includes(d.type));
      industryDocs.forEach(d => findings.push({ item:d.type, required:false, inherited:false, systemResult:d.status, status:"Pending Review", detail:`${d.id} — ${d.status}`, docId:d.id, officerAction:null, officerNote:"" }));
      w.docsComplete = false;
      w.docsFindings = findings;
      w.docsDate = Date.now();
      w.docsOfficer = null;
      newAudit.push(addAudit("Document Review Initiated", a.id, "System", `${findings.length} documents checked (${kycTypes.length} inherited from KYC, ${reqTypes.length} requiring review). Awaiting sign-off.`, "Underwriting"));
    }

    if (stepKey === "sitevisit") {
      const existing = w.siteVisitFindings || [];
      const isNewFormat = existing.length > 0 && existing[0].field !== undefined;
      const findings = isNewFormat ? existing : [
        { item:"Visit Details", field:"visitDetails", value:"", placeholder:`Date of visit, address visited (${c?.address}), attendees, duration` },
        { item:"Premises Inspection", field:"premises", value:"", placeholder:"Describe physical premises — condition, suitability, ownership/lease, signage, access" },
        { item:"Operational Activity", field:"operations", value:"", placeholder:"Staff observed on site, active trading evidence, equipment/inventory, workflow" },
        { item:"Management Interview", field:"management", value:"", placeholder:`Interview with ${c?.contact} — experience, capability, strategy, understanding of financials` },
        { item:"Infrastructure & Capacity", field:"infrastructure", value:"", placeholder:"Facilities condition, adequacy for current/projected volumes, technology, maintenance" },
        { item:"Revenue Verification", field:"revenue", value:"", placeholder:`Stated revenue ${fmt.cur(c?.revenue||0)} — consistency with observed activity, stock levels, foot traffic` },
        { item:"Risk Observations", field:"risks", value:"", placeholder:"Concerns, red flags, concentration risk, dependency, environmental, compliance issues" },
        { item:"Overall Assessment", field:"assessment", value:"", rating:"", placeholder:"Summary recommendation — satisfactory / concerns noted / unsatisfactory" },
      ];
      w.siteVisitComplete = false;
      w.siteVisitFindings = findings;
      w.siteVisitDate = Date.now();
      w.siteVisitOfficer = null;
      newAudit.push(addAudit("Site Visit Form Created", a.id, currentUser.name, `Site visit assessment form initiated for ${c?.name} at ${c?.address}.`, "Underwriting"));
    }

    if (stepKey === "credit") {
      if (!w.kycComplete) { alert("Complete KYC/FICA verification before running credit analysis."); return; }
      if (!w.docsComplete) { alert("Complete document review before running credit analysis."); return; }
      const bureauScore = w.creditBureauScore || Math.floor(Math.random() * 200 + 500);
      const monthlyPmt = Math.round(a.amount * (0.145 / 12) / (1 - Math.pow(1 + 0.145 / 12, -a.term)));
      const monthlyIncome = Math.round((c?.revenue || 3000000) / 12);
      const existingDebt = Math.round(monthlyIncome * 0.12);
      const dscr = +((monthlyIncome - existingDebt) / monthlyPmt).toFixed(2);
      const currentRatio = +(1.0 + Math.random() * 1.5).toFixed(2);
      const debtEquity = +(Math.random() * 1.8).toFixed(2);
      const grossMargin = +(Math.random() * 0.25 + 0.2).toFixed(2);
      const affordable = dscr >= 1.2;
      const riskScore = Math.min(99, Math.max(20, Math.round(bureauScore / 10 + dscr * 10 + (currentRatio > 1.2 ? 10 : 0) - (debtEquity > 1.0 ? 10 : 0))));

      const existing = w.creditFindings || [];
      const findings = existing.length > 0 && existing[0].analystNote !== undefined ? existing : [
        { item:"Credit Bureau Report", systemValue:`Bureau score: ${bureauScore}/900`, systemDetail: bureauScore >= 650 ? "No adverse information." : bureauScore >= 550 ? "Minor adverse items." : "Material adverse information.", analystNote:"", flag:"" },
        { item:"Affordability (NCA)", systemValue:`DSCR: ${dscr}x | Affordable: ${affordable?"YES":"NO"}`, systemDetail:`Income: ${fmt.cur(monthlyIncome)}/m. Existing debt: ${fmt.cur(existingDebt)}/m. Proposed: ${fmt.cur(monthlyPmt)}/m. Disposable: ${fmt.cur(monthlyIncome-existingDebt-monthlyPmt)}/m.`, analystNote:"", flag:"" },
        { item:"Balance Sheet Ratios", systemValue:`CR: ${currentRatio}x | D/E: ${debtEquity}x | Margin: ${fmt.pct(grossMargin,0)}`, systemDetail:`Current ratio ${currentRatio>=1.5?"strong":currentRatio>=1.0?"adequate":"weak"}. Leverage ${debtEquity<=0.5?"conservative":debtEquity<=1.0?"moderate":"elevated"}.`, analystNote:"", flag:"" },
        { item:"Cash Flow Projections", systemValue:`${a.term}-month projection`, systemDetail:`Revenue assumptions ${c?.years>=5?"supported by track record":"limited history — conservative scenario"}. Seasonal variation ${c?.industry==="Agriculture"?"significant":"within normal range"}.`, analystNote:"", flag:"" },
        { item:"Industry & Market Risk", systemValue:c?.industry||"—", systemDetail:"", analystNote:"", flag:"", placeholder:`Assess ${c?.industry} sector risk, competitive position, market conditions, regulatory environment` },
        { item:"Risk Score & Recommendation", systemValue:`Score: ${riskScore}/100 | Grade: ${bureauScore>=600&&dscr>=1.3?"Low-Medium":dscr>=1.0?"Medium":"High"}`, systemDetail:"", analystNote:"", flag:"", placeholder:"Analyst's overall credit risk assessment and recommendation with rationale" },
      ];

      w.creditPulled = true;
      w.creditBureauScore = bureauScore;
      w.creditDate = Date.now();
      w.financialAnalysisComplete = false;
      w.financialDate = Date.now();
      w.creditFindings = findings;
      updatedApp.dscr = dscr;
      updatedApp.currentRatio = currentRatio;
      updatedApp.debtEquity = debtEquity;
      updatedApp.riskScore = riskScore;
      newAudit.push(addAudit("Credit Report Pulled", a.id, "System (TransUnion API)", `Bureau: ${bureauScore}. DSCR: ${dscr}x. Risk: ${riskScore}. Affordability: ${affordable?"Pass":"Fail"}.`, "Underwriting"));
    }

    if (stepKey === "collateral") {
      const custCollateral = appDocs.filter(d => d.category === "Collateral");
      const findings = [];
      let total = 0;
      if (custCollateral.length > 0) {
        custCollateral.forEach(d => {
          const val = d.type === "Insurance" ? (d.name.includes("1.2") ? 1200000 : d.name.includes("2M") ? 2000000 : d.name.includes("4M") ? 4000000 : d.name.includes("1.6") ? 1600000 : 500000) : d.type === "Title Deed" ? 1500000 : 800000;
          total += val;
          findings.push({ item: d.name, detail: `Type: ${d.type}. Value: ${fmt.cur(val)}. Status: ${d.status}. ${d.expiryDate ? `Expires: ${fmt.date(d.expiryDate)}.` : "No expiry."}` });
        });
      } else {
        findings.push({ item:"Personal Guarantee", detail:`Director surety of ${fmt.cur(a.amount)} to be obtained at disbursement.` });
        total = a.amount;
      }
      const ltv = total > 0 ? (a.amount / total * 100).toFixed(0) : 100;
      findings.push({ item:"Security Coverage", detail:`Total security value: ${fmt.cur(total)}. Loan amount: ${fmt.cur(a.amount)}. Loan-to-value: ${ltv}%. ${+ltv <= 80 ? "Adequate coverage." : +ltv <= 100 ? "Marginal coverage — additional security may be required." : "Under-secured — additional collateral or guarantee required."}` });
      w.collateralAssessed = false;
      w.collateralFindings = findings;
      w.collateralDate = Date.now();
      w.collateralTotal = total;
      newAudit.push(addAudit("Collateral Assessment", a.id, "Credit Analyst – P. Sithole", `Security: ${fmt.cur(total)}. LTV: ${ltv}%. ${custCollateral.length} items assessed.`, "Underwriting"));
    }

    if (stepKey === "social") {
      const beeLevel = c?.beeLevel || 4;
      const jobs = c?.employees || 0;
      const socialScore = Math.min(100, Math.round((beeLevel <= 1 ? 30 : beeLevel <= 2 ? 22 : beeLevel <= 3 ? 15 : 8) + Math.min(25, jobs * 1.2) + (c?.years >= 5 ? 15 : c?.years >= 3 ? 10 : 5) + Math.floor(Math.random() * 15 + 5)));
      const findings = [
        { item:"BEE Status", detail:`Level ${beeLevel}. Verification status: ${c?.beeStatus || "Unknown"}. ${c?.beeExpiry ? `Certificate expires: ${fmt.date(c.beeExpiry)}.` : "No expiry date on file."}` },
        { item:"Employment Impact", detail:`${jobs} direct jobs supported. ${jobs >= 20 ? "Significant employer in local economy." : jobs >= 10 ? "Meaningful employment contribution." : "Small but growing workforce."}` },
        { item:"Skills Development", detail:`${c?.years >= 5 ? "Established training and skills transfer programmes in place." : "Developing internal capacity. Mentorship support recommended."}` },
        { item:"Geographic Impact", detail:`Operating in ${c?.province || "Eastern Cape"}. ${c?.address?.includes("Industrial") || c?.address?.includes("Farm") ? "Located in underserved/rural area — higher development impact weighting." : "Urban location."}` },
        { item:"Sector Contribution", detail:`${c?.sector || c?.industry} sector. ${["Agriculture","Construction","Food Processing"].includes(c?.industry) ? "Priority sector for job creation and food security." : "Productive economic activity aligned with NDP objectives."}` },
        { item:"Social Impact Score", detail:`Composite score: ${socialScore}/100. ${socialScore >= 75 ? "Strong alignment with SEDFA development mandate." : socialScore >= 55 ? "Moderate development impact. Meets minimum funder thresholds." : "Limited impact metrics. May not meet certain funder-specific requirements."}` },
      ];
      w.socialVerified = false;
      w.socialFindings = findings;
      w.socialDate = Date.now();
      w.socialOfficer = null;
      updatedApp.socialScore = socialScore;
      newAudit.push(addAudit("Social Impact Verified", a.id, "Compliance Officer", `Score: ${socialScore}/100. BEE Level ${beeLevel}. ${jobs} jobs.`, "Compliance"));
    }

    updatedApp.workflow = w;
    save({ ...data, applications: applications.map(x => x.id === appId ? updatedApp : x), audit: newAudit, alerts: newAlerts });
  };

  const decideLoan = (appId, decision) => {
    if (!canDo("underwriting","approve")) { alert("Permission denied: you cannot approve/decline applications."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const limit = approvalLimit(role);
    if (decision === "Approved" && a.amount > limit) { alert(`Authority exceeded: your limit is ${fmt.cur(limit)}. This application (${fmt.cur(a.amount)}) requires escalation to ${a.amount > 1000000 ? "Credit Committee" : "Head of Credit"}.`); return; }
    if (a.createdBy === currentUser.id) { alert("Separation of duties: you cannot approve an application you created."); return; }
    const w = a.workflow || {};
    const c = cust(a.custId);
    const p = prod(a.product);
    const memoSections = [];
    if (w.kycFindings?.length) memoSections.push(`KYC/FICA: ${w.kycComplete ? "All checks passed." : "Incomplete — see findings."}`);
    if (w.docsFindings?.length) { const vd = w.docsFindings.filter(f=>f.status==="Verified").length; memoSections.push(`Documents: ${vd}/${w.docsFindings.length} verified.`); }
    if (w.siteVisitFindings?.length) memoSections.push(`Site visit completed ${fmt.date(w.siteVisitDate)}. ${w.siteVisitFindings.length} areas assessed.`);
    if (w.creditFindings?.length) memoSections.push(`Bureau: ${w.creditBureauScore}. DSCR: ${a.dscr}x. Risk score: ${a.riskScore}/100.`);
    if (w.collateralFindings?.length) memoSections.push(`Security: ${fmt.cur(w.collateralTotal)}. LTV: ${a.amount && w.collateralTotal ? (a.amount/w.collateralTotal*100).toFixed(0) : "—"}%.`);
    if (w.socialFindings?.length) memoSections.push(`Social impact: ${a.socialScore}/100. BEE Level ${c?.beeLevel}.`);
    if (w.analystNotes) memoSections.push(`Analyst notes: ${w.analystNotes}`);
    const recommendation = decision === "Approved" ? `Recommendation: APPROVE. ${p?.name} of ${fmt.cur(a.amount)} over ${a.term} months.` : `Recommendation: DECLINE. ${a.dscr < 1.2 ? "DSCR below threshold. " : ""}${a.riskScore < 50 ? "Risk score below acceptable level." : ""}`;
    memoSections.push(recommendation);
    const approver = `${currentUser.name} (${ROLES[role]?.label})`;
    const conditions = decision === "Approved" ? [
      `Maintain DSCR above ${a.dscr >= 1.5 ? "1.3" : "1.2"}`,
      "Submit quarterly management accounts within 30 days of quarter-end",
      "Maintain adequate insurance on all financed assets",
      ...(c?.beeLevel <= 2 ? ["Maintain BEE Level " + c.beeLevel + " status"] : []),
      ...(a.amount > 1000000 ? ["Annual audited financial statements required"] : []),
    ] : [];
    const updated = { ...a, status: decision, decided: Date.now(), recommendation: decision, approver, creditMemo: memoSections.join("\n"), conditions, rate: decision === "Approved" ? (p?.baseRate || 14.5) : null };
    save({ ...data,
      applications: applications.map(x => x.id === appId ? updated : x),
      audit: [...audit, addAudit(`Credit Decision – ${decision}`, appId, approver, `${decision}. Risk: ${a.riskScore}. DSCR: ${a.dscr}x. Bureau: ${w.creditBureauScore}. Social: ${a.socialScore}.`, "Decision")],
      alerts: [...alerts, addAlert("Application", decision==="Approved"?"info":"warning", `${decision} – ${c?.name}`, `${appId} ${decision.toLowerCase()} by ${currentUser.name}. Amount: ${fmt.cur(a.amount)}.`)]
    });
  };

  // ═══ Security Document Template Generator ═══
  const generateSecurityDoc = (templateType, app, cust, prod) => {
    const today = new Date().toLocaleDateString("en-ZA", { day:"numeric", month:"long", year:"numeric" });
    const loanRef = `LN-${String(loans.length+1).padStart(3,"0")}`;
    const templates = {
      cession_agreement: {
        title: "DEED OF CESSION",
        sections: [
          { heading:"PARTIES", content:`1. THE CEDENT: ${cust?.name} (Reg: ${cust?.regNum}), represented by ${cust?.contact} ("the Cedent")\n2. THE CESSIONARY: TQA Capital (Pty) Ltd (Reg: 2017/313869/07), NCR Registration NCRCP22396 ("the Cessionary")\n3. THE DEBTOR: [Off-taker/Government Department] ("the Debtor")` },
          { heading:"PREAMBLE", content:`WHEREAS the Cedent has entered into a credit agreement with the Cessionary (Reference: ${loanRef}) for the amount of ${fmt.cur(app.amount)} for the purpose of ${app.purpose || prod?.name};\n\nAND WHEREAS the Cessionary requires security for the said credit facility;\n\nNOW THEREFORE the parties agree as follows:` },
          { heading:"1. CESSION", content:`1.1 The Cedent hereby cedes, assigns and transfers to the Cessionary all right, title and interest in and to the receivables arising from ${prod?.name} as described in the Purchase Order / Invoice / Contract referenced in Schedule A.\n\n1.2 This cession is given as security for the due and punctual payment of all amounts owing by the Cedent to the Cessionary.\n\n1.3 The cession shall remain in force until all obligations under the credit agreement have been discharged in full.` },
          { heading:"2. OBLIGATIONS OF THE CEDENT", content:`2.1 The Cedent shall notify the Debtor of this cession and instruct the Debtor to make payment directly to the Cessionary.\n\n2.2 The Cedent shall not enter into any agreement that would prejudice the Cessionary's rights under this cession.\n\n2.3 The Cedent shall immediately notify the Cessionary of any dispute or variation to the underlying contract.` },
          { heading:"3. PAYMENT DIRECTION", content:`3.1 The Debtor is hereby directed to make all payments due under the contract/invoice/purchase order directly to:\n\nBank: [TQA Capital Collection Account]\nAccount Number: [To be provided]\nReference: ${loanRef}\n\n3.2 Any payment made to the Cedent in contravention of this direction shall be held in trust for the Cessionary.` },
          { heading:"4. GOVERNING LAW", content:`This Deed of Cession shall be governed by the laws of the Republic of South Africa and subject to the jurisdiction of the High Court of the Eastern Cape Division.` },
          { heading:"SIGNATURES", content:`Signed at _________________ on this _____ day of _________________ 20___\n\nFor the CEDENT: _________________________\nName: ${cust?.contact}\nCapacity: Director\n\nFor the CESSIONARY: _________________________\nName: \nCapacity: Authorised Signatory\nTQA Capital (Pty) Ltd` },
        ]
      },
      bank_authority: {
        title: "IRREVOCABLE BANK LETTER OF AUTHORITY",
        sections: [
          { heading:"TO", content:`The Branch Manager\n[Bank Name]\n[Branch]\n\nAccount Holder: ${cust?.name}\nAccount Number: [To be provided]` },
          { heading:"AUTHORITY", content:`I/We, ${cust?.contact}, in my/our capacity as authorised signatory of ${cust?.name} (Reg: ${cust?.regNum}), hereby irrevocably authorise and instruct you to:\n\n1. Allow TQA Capital (Pty) Ltd (Reg: 2017/313869/07) to collect by debit order the sum of [monthly instalment] on the [date] of each month, or such other amount as may be notified to you by TQA Capital.\n\n2. Intercept and redirect to TQA Capital any payment received into the above account from [Off-taker/Government Department] up to the amount of ${fmt.cur(app.amount)} plus interest and fees, until the credit facility (Ref: ${loanRef}) is settled in full.\n\n3. This authority shall remain in force and irrevocable until written cancellation is received from TQA Capital (Pty) Ltd.` },
          { heading:"ACKNOWLEDGEMENT", content:`I/We understand that this authority forms part of the security for a credit facility and may not be revoked without the prior written consent of TQA Capital (Pty) Ltd.` },
          { heading:"SIGNATURES", content:`Signed at _________________ on ${today}\n\nFor ${cust?.name}: _________________________\nName: ${cust?.contact}\nCapacity: Director\nID Number: ${cust?.idNum || "[ID Number]"}\n\nWitness 1: _________________________\nWitness 2: _________________________` },
        ]
      },
      suretyship_deed: {
        title: "DEED OF SURETYSHIP",
        sections: [
          { heading:"PARTIES", content:`THE SURETY: ${cust?.contact} (ID: ${cust?.idNum || "[ID Number]"})\nTHE CREDITOR: TQA Capital (Pty) Ltd (Reg: 2017/313869/07)\nTHE PRINCIPAL DEBTOR: ${cust?.name} (Reg: ${cust?.regNum})` },
          { heading:"SURETYSHIP", content:`1. The Surety hereby binds himself/herself as surety and co-principal debtor in solidum with the Principal Debtor for the due payment of all amounts owing to the Creditor, up to a maximum of ${fmt.cur(app.amount)} plus interest, costs and charges.\n\n2. The Surety renounces the benefits of excussion, division, and cession of actions, the meaning and effect of which have been explained to the Surety.\n\n3. This suretyship shall remain in force until all obligations of the Principal Debtor to the Creditor have been discharged in full.\n\n4. The Surety consents to the jurisdiction of the Magistrate's Court in terms of Section 45 of the Magistrate's Courts Act.` },
          { heading:"SIGNATURES", content:`Signed at _________________ on ${today}\n\nSURETY: _________________________\nFull Name: ${cust?.contact}\nID Number: ${cust?.idNum || "[ID Number]"}\n\nAS WITNESSES:\n1. _________________________\n2. _________________________` },
        ]
      },
      asset_pledge: {
        title: "PLEDGE AND CESSION IN SECURITATEM DEBITI",
        sections: [
          { heading:"PARTIES", content:`THE PLEDGOR: ${cust?.name} (Reg: ${cust?.regNum})\nTHE PLEDGEE: TQA Capital (Pty) Ltd (Reg: 2017/313869/07)` },
          { heading:"PLEDGE", content:`1. The Pledgor hereby pledges to the Pledgee the movable assets described in Schedule A as security for the credit facility (Ref: ${loanRef}) in the amount of ${fmt.cur(app.amount)}.\n\n2. The Pledgor shall not dispose of, encumber, or remove the pledged assets without the prior written consent of the Pledgee.\n\n3. The Pledgor shall maintain the pledged assets in good condition and keep them insured at full replacement value with the Pledgee noted as first loss payee.\n\n4. Upon default, the Pledgee shall be entitled to take possession of and realise the pledged assets.` },
          { heading:"SCHEDULE A — PLEDGED ASSETS", content:`[Description of assets to be completed]\n\nAsset 1: _____________________ Value: R_____________\nAsset 2: _____________________ Value: R_____________\nAsset 3: _____________________ Value: R_____________` },
          { heading:"SIGNATURES", content:`Signed at _________________ on ${today}\n\nFor the PLEDGOR: _________________________\nName: ${cust?.contact}\n\nFor the PLEDGEE: _________________________\nTQA Capital (Pty) Ltd` },
        ]
      },
      crop_lien: {
        title: "NOTARIAL BOND OVER CROPS / AGRICULTURAL PLEDGE",
        sections: [
          { heading:"PARTIES", content:`THE PLEDGOR: ${cust?.name} (Reg: ${cust?.regNum})\nTHE PLEDGEE: TQA Capital (Pty) Ltd` },
          { heading:"AGRICULTURAL PLEDGE", content:`1. The Pledgor hereby grants to the Pledgee a lien over all crops (standing, harvested, and to be planted) on the property described in Schedule A.\n\n2. The Pledgor shall not sell, remove, or dispose of the pledged crops without prior written consent.\n\n3. The Pledgor shall maintain crop insurance with the Pledgee noted as first loss payee.\n\n4. Upon default, the Pledgee is entitled to harvest, sell, and apply proceeds to the outstanding debt.` },
          { heading:"SCHEDULE A — PROPERTY AND CROP DETAILS", content:`Property: _____________________ Erf/Farm No: _____________\nCrop Type: _____________________ Estimated Yield: _____________\nSeason: _____________________ Expected Harvest: _____________` },
          { heading:"SIGNATURES", content:`Signed at _________________ on ${today}\n\nFor the PLEDGOR: _________________________\nName: ${cust?.contact}\n\nFor the PLEDGEE: _________________________\nTQA Capital (Pty) Ltd` },
        ]
      },
      debit_mandate: {
        title: "DEBIT ORDER MANDATE",
        sections: [
          { heading:"ACCOUNT HOLDER", content:`Name: ${cust?.name}\nID/Reg: ${cust?.regNum}\nBank: _____________________ Branch: _____________\nAccount No: _____________________ Account Type: _____________` },
          { heading:"MANDATE", content:`I/We hereby authorise TQA Capital (Pty) Ltd to debit my/our account with the instalment amount due under credit agreement ${loanRef}, on the [date] of each month, commencing on [start date].\n\nShould the payment date fall on a non-business day, the debit will be processed on the next business day.\n\nThis authority may be cancelled by providing 30 days written notice to TQA Capital (Pty) Ltd, subject to the terms of the credit agreement.` },
          { heading:"SIGNATURES", content:`Signed at _________________ on ${today}\n\nAccount Holder: _________________________\nName: ${cust?.contact}\nDate: ${today}` },
        ]
      },
    };

    const tmpl = templates[templateType];
    if (!tmpl) { showToast("Template not found", "error"); return; }

    // Store as a document record
    const docId = "DOC-SEC-" + Date.now();
    const docRecord = { id:docId, custId:cust?.id, appId:app.id, name:tmpl.title, type:"Security", category:"Collateral", status:"Pending Review", uploadedAt:Date.now(), uploadedBy:currentUser.id, notes:`Auto-generated ${tmpl.title} for ${prod?.name}. Awaiting signatures.` };
    
    // Generate text preview and store
    const fullText = tmpl.sections.map(s => `${s.heading}\n${s.content}`).join("\n\n");
    
    save({ ...data, 
      documents: [...documents, docRecord],
      audit: [...audit, addAudit("Security Document Generated", app.id, currentUser.name, `${tmpl.title} generated for ${cust?.name}. Loan: ${loanRef}. Amount: ${fmt.cur(app.amount)}.`, "Booking")]
    });
    showToast(`${tmpl.title} generated successfully`);
  };

  // ═══ Loan Agreement Template Generator ═══
  const generateLoanAgreement = (loan, app, cust, prod) => {
    const today = new Date().toLocaleDateString("en-ZA", { day:"numeric", month:"long", year:"numeric" });
    const rate = loan?.rate || app?.rate || prod?.baseRate;
    const term = loan?.term || app?.term;
    const amount = loan?.amount || app?.amount;
    const monthlyPmt = loan?.monthlyPmt || 0;
    const arrangementFee = Math.round(amount * ((prod?.arrangementFee||1)/100));
    const prodSec = PRODUCT_SECURITY[app?.product];
    const securityInstruments = prodSec ? [...(prodSec.required||[]), ...Object.keys(securitySelections[app?.id]||{}).filter(k=>securitySelections[app?.id][k])].map(id=>SECURITY_INSTRUMENTS[id]?.name).filter(Boolean) : [];

    const docId = "DOC-AGR-" + Date.now();
    const docRecord = { id:docId, custId:cust?.id, appId:app?.id, name:"Loan Agreement — " + (loan?.id || "Draft"), type:"Legal", category:"Legal", status:"Pending Review", uploadedAt:Date.now(), uploadedBy:currentUser.id, notes:`Auto-generated Loan Agreement. Amount: ${fmt.cur(amount)}. Term: ${term}m. Rate: ${rate}%. Awaiting signatures.` };

    save({ ...data,
      documents: [...documents, docRecord],
      audit: [...audit, addAudit("Loan Agreement Generated", app?.id, currentUser.name, `Loan Agreement generated for ${cust?.name}. Amount: ${fmt.cur(amount)}. Term: ${term}m. Rate: ${rate}%. ${securityInstruments.length} security instruments.`, "Booking")]
    });
    showToast("Loan Agreement generated successfully");
  };





  const bookLoan = (appId) => {
    if (!canDo("loans","update")) { alert("Permission denied: you cannot book loans."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a || a.status !== "Approved") { alert("Only Approved applications can be booked."); return; }
    const c = cust(a.custId);
    const p = prod(a.product);
    const w = a.workflow || {};
    const cpFail = [];
    if (!w.kycComplete) cpFail.push("KYC/FICA not verified");
    if (!w.docsComplete) cpFail.push("Document checklist incomplete");
    if (c?.ficaStatus !== "Verified") cpFail.push(`FICA status: ${c?.ficaStatus} (must be Verified)`);
    if (c?.beeStatus !== "Verified" && p?.eligibleBEE?.length < 4) cpFail.push("BEE certificate not verified");
    if (cpFail.length > 0) { alert(`Conditions precedent not met:\n${cpFail.join("\n")}\n\nResolve before booking.`); return; }
    const rate = a.rate || p?.baseRate || 14.5;
    const monthlyPmt = Math.round(a.amount * (rate / 100 / 12) / (1 - Math.pow(1 + rate / 100 / 12, -a.term)));
    const loan = { id:`LN-${String(loans.length+1).padStart(3,"0")}`, appId, custId:a.custId, status:"Booked", amount:a.amount, balance:a.amount, rate, term:a.term, monthlyPmt, disbursed:null, nextDue:null, lastPmt:null, lastPmtAmt:null, totalPaid:0, dpd:0, stage:1, payments:[], bookedAt:Date.now(), bookedBy:currentUser.id, disbursedBy:null, disbursementAuth2:null, preDisbursementAML:null, covenants:(a.conditions||[]).map(c=>({name:c,status:"Compliant",value:"—",checked:Date.now()})), collateral:w.collateralFindings?.filter(f=>f.item!=="Security Coverage").map(f=>({type:f.item,value:0,description:f.detail}))||[], arrangementFee: Math.round(a.amount * ((p?.arrangementFee||1)/100)) };
    const updatedApp = { ...a, status:"Booked" };
    showToast("Loan booked and activated");
    save({ ...data,
      applications: applications.map(x => x.id === appId ? updatedApp : x),
      loans: [...loans, loan],
      provisions: [...provisions, {loanId:loan.id,stage:1,pd:0.02,lgd:0.25,ead:a.amount,ecl:Math.round(a.amount*0.005),method:"12-month ECL"}],
      audit: [...audit,
        addAudit("Loan Booked", loan.id, currentUser.name, `Loan ${loan.id} booked. Amount: ${fmt.cur(a.amount)}. Rate: ${rate}%. Conditions verified.`, "Booking"),
        addAudit("Agreement Generated", loan.id, "System", `Loan agreement generated for ${c?.name}. Awaiting signatures and disbursement.`, "Booking"),
      ],
      alerts: [...alerts, addAlert("Loan","info",`Loan Booked – ${c?.name}`,`${loan.id} booked for ${fmt.cur(a.amount)}. Awaiting disbursement.`)]
    });
  };

  const disburseLoan = (loanId) => {
    if (!canDo("servicing","create") && !canDo("loans","update")) { alert("Permission denied: you cannot disburse loans."); return; }
    const l = loans.find(x => x.id === loanId);
    if (!l || l.status !== "Booked") { alert("Only Booked loans can be disbursed."); return; }
    const c = cust(l.custId);
    const amlClear = true; // Placeholder for API
    if (!amlClear) { alert("Pre-disbursement AML check failed. Disbursement blocked."); return; }
    if (l.bookedBy === currentUser.id) { alert("Dual authorization required: the person who booked the loan cannot disburse it."); return; }
    const updated = { ...l, status:"Active", disbursed:Date.now(), disbursedBy:currentUser.id, preDisbursementAML:{ clear:true, date:Date.now(), checkedBy:currentUser.name }, nextDue:Date.now()+30*day };
    save({ ...data,
      loans: loans.map(x => x.id === loanId ? updated : x),
      audit: [...audit,
        addAudit("Pre-disbursement AML", loanId, "System", `AML screening clear. No sanctions matches.`, "Compliance"),
        addAudit("Loan Disbursed", loanId, currentUser.name, `${fmt.cur(l.amount)} disbursed to ${c?.name}. Dual auth: booked by ${SYSTEM_USERS.find(u=>u.id===l.bookedBy)?.name}, disbursed by ${currentUser.name}.`, "Disbursement"),
      ],
      alerts: [...alerts, addAlert("Loan","info",`Disbursement – ${c?.name}`,`${loanId}: ${fmt.cur(l.amount)} disbursed to ${c?.name}.`)]
    });
  };

  const recordPayment = (loanId, amount) => {
    if (!canDo("servicing","create")) { alert("Permission denied: you cannot record payments."); return; }
    const l = loans.find(x => x.id === loanId);
    if (!l || l.status !== "Active") return;
    const monthlyRate = l.rate / 100 / 12;
    const interestPortion = Math.round(l.balance * monthlyRate);
    const principalPortion = Math.max(0, +amount - interestPortion);
    const newBalance = Math.max(0, l.balance - principalPortion);
    const pmt = { date: Date.now(), amount: +amount, interest: interestPortion, principal: principalPortion, type: "Instalment", status: "Cleared", recordedBy: currentUser.id };
    const updated = { ...l, payments: [...l.payments, pmt], balance: newBalance, totalPaid: l.totalPaid + +amount, lastPmt: Date.now(), lastPmtAmt: +amount, dpd: 0, nextDue: Date.now() + 30 * day };
    updated.stage = stage(updated.dpd);
    if (newBalance === 0) updated.status = "Settled";
    showToast(`Payment of ${fmt.cur(amount)} recorded successfully`);
    save({ ...data,
      loans: loans.map(x => x.id === loanId ? updated : x),
      audit: [...audit, addAudit("Payment Received", loanId, currentUser.name, `${fmt.cur(amount)} received. Interest: ${fmt.cur(interestPortion)}. Principal: ${fmt.cur(principalPortion)}. Balance: ${fmt.cur(newBalance)}.${newBalance===0?" LOAN SETTLED.":""}`, "Servicing")],
      ...(newBalance === 0 ? { alerts: [...alerts, addAlert("Loan","info",`Loan Settled – ${loanId}`,`${loanId} fully repaid. Balance: R0.00.`)] } : {})
    });
  };

  const addCollectionAction = (loanId, actionType, notes, extra={}) => {
    if (!canDo("collections","create")) { alert("Permission denied: you cannot log collection actions."); return; }
    const l = loans.find(x => x.id === loanId);
    const entry = { id: uid(), loanId, custId: l?.custId, stage: l?.dpd <= 30 ? "Early" : l?.dpd <= 90 ? "Mid" : "Late", dpd: l?.dpd || 0, action: actionType, channel: extra.channel || "System", officer: currentUser.name, notes, created: Date.now(), ...extra };
    let newAlerts = [...alerts];
    let newAudit = [...audit, addAudit(`Collection: ${actionType}`, loanId, currentUser.name, notes, "Collections")];
    if (actionType === "Letter of Demand") newAlerts.push(addAlert("Collections","warning",`Demand Issued – ${l?.id}`,`Formal NCA demand sent to ${cust(l?.custId)?.name}.`));
    if (actionType === "Legal Handover") newAlerts.push(addAlert("Collections","critical",`Legal Handover – ${l?.id}`,`${l?.id} referred to Legal Department. Balance: ${fmt.cur(l?.balance)}.`));
    save({ ...data, collections: [...collections, entry], audit: newAudit, alerts: newAlerts });
  };

  const createPTP = (loanId, ptpDate, ptpAmount, notes) => {
    if (!canDo("collections","create")) { alert("Permission denied."); return; }
    const l = loans.find(x => x.id === loanId);
    const entry = { id: uid(), loanId, custId: l?.custId, stage: l?.dpd <= 30 ? "Early" : l?.dpd <= 90 ? "Mid" : "Late", dpd: l?.dpd || 0, action: "Promise-to-Pay", channel: "Phone", officer: currentUser.name, notes: notes || `PTP: ${fmt.cur(ptpAmount)} by ${fmt.date(new Date(ptpDate).getTime())}`, created: Date.now(), ptpDate: new Date(ptpDate).getTime(), ptpAmount: +ptpAmount, ptpStatus: "Pending" };
    save({ ...data,
      collections: [...collections, entry],
      audit: [...audit, addAudit("PTP Created", loanId, currentUser.name, `Promise-to-pay: ${fmt.cur(ptpAmount)} by ${fmt.date(new Date(ptpDate).getTime())}. ${notes||""}`, "Collections")]
    });
  };

  const proposeRestructure = (loanId, proposal) => {
    if (!canDo("collections","create")) { alert("Permission denied."); return; }
    const l = loans.find(x => x.id === loanId);
    const entry = { id: uid(), loanId, custId: l?.custId, stage: "Restructure", dpd: l?.dpd || 0, action: "Restructuring Proposed", channel: "Meeting", officer: currentUser.name, notes: `Proposal: ${proposal.type}. ${proposal.detail}. Pending ${proposal.approver} approval.`, created: Date.now(), restructure: proposal };
    save({ ...data,
      collections: [...collections, entry],
      audit: [...audit, addAudit("Restructure Proposed", loanId, currentUser.name, `${proposal.type}: ${proposal.detail}`, "Collections")],
      alerts: [...alerts, addAlert("Collections","warning",`Restructure Proposed – ${l?.id}`,`${proposal.type} proposed by ${currentUser.name}. Requires approval.`)]
    });
  };

  const proposeWriteOff = (loanId, reason) => {
    if (!canDo("collections","create")) { alert("Permission denied."); return; }
    const l = loans.find(x => x.id === loanId);
    const entry = { id: uid(), loanId, custId: l?.custId, stage: "Write-Off", dpd: l?.dpd || 0, action: "Write-Off Proposed", channel: "System", officer: currentUser.name, notes: reason, created: Date.now(), writeOff: true };
    save({ ...data,
      collections: [...collections, entry],
      audit: [...audit, addAudit("Write-Off Proposed", loanId, currentUser.name, `Write-off proposed. Balance: ${fmt.cur(l?.balance)}. Reason: ${reason}. Requires Credit Committee approval.`, "Collections")],
      alerts: [...alerts, addAlert("Collections","critical",`Write-Off Proposed – ${l?.id}`,`Balance: ${fmt.cur(l?.balance)}. Reason: ${reason}. Credit Committee approval required.`)]
    });
  };

  const approveWriteOff = (loanId) => {
    if (!canDo("collections","approve")) { alert("Permission denied: only Credit Head or above can approve write-offs."); return; }
    const l = loans.find(x => x.id === loanId);
    if (!l) return;
    save({ ...data,
      loans: loans.map(x => x.id === loanId ? { ...x, status: "Written Off", balance: 0 } : x),
      audit: [...audit, addAudit("Write-Off Approved", loanId, currentUser.name, `${fmt.cur(l.balance)} written off. Approved by ${currentUser.name}.`, "Collections")],
      alerts: [...alerts, addAlert("Collections","critical",`Write-Off Approved – ${loanId}`,`${fmt.cur(l.balance)} written off by ${currentUser.name}.`)]
    });
  };

  function renderPage() {
    if (detail) return renderDetail();
    switch (page) {
      case "dashboard": return <Dashboard />;
      case "customers": return <Customers />;
      case "origination": return <Origination />;
      case "underwriting": return <Underwriting />;
      case "loans": return <Loans />;
      case "servicing": return <Servicing />;
      case "collections": return <Collections />;
      case "provisioning": return <Provisioning />;
      case "governance": return <Governance />;
      case "statutory": return <StatutoryReporting />;
      case "documents": return <Documents />;
      case "reports": return <Reports />;
      case "comms": return <Comms />;
      case "admin": return <Administration />;
      case "products": return <Administration />;
      case "settings": return <Administration />;
      default: return <Dashboard />;
    }
  }

  function Dashboard() {

    // ═══ Widget Customisation System ═══
    const WIDGET_DEFAULTS = [
      { id: "kpis", title: "KPI Summary", visible: true, locked: true },
      { id: "ifrs9", title: "IFRS 9 Staging", visible: true },
      { id: "pipeline", title: "Application Pipeline", visible: true },
      { id: "dpd", title: "DPD Distribution", visible: true },
      { id: "productMix", title: "Product Mix", visible: true },
      { id: "impact", title: "Development Impact", visible: true },
      { id: "statutory", title: "NCR Reporting Deadlines", visible: true },
      { id: "tasks", title: "My Tasks", visible: true },
      { id: "alerts", title: "Recent Alerts", visible: true },
    ];
    const [widgetConfig, setWidgetConfig] = useState(() => {
      try { const saved = localStorage.getItem("kb-widgets"); return saved ? JSON.parse(saved) : WIDGET_DEFAULTS; }
      catch { return WIDGET_DEFAULTS; }
    });
    const [showWidgetPanel, setShowWidgetPanel] = useState(false);
    const [dragWidget, setDragWidget] = useState(null);

    const toggleWidget = (id) => {
      const updated = widgetConfig.map(w => w.id === id && !w.locked ? { ...w, visible: !w.visible } : w);
      setWidgetConfig(updated);
      localStorage.setItem("kb-widgets", JSON.stringify(updated));
    };
    const moveWidget = (fromIdx, toIdx) => {
      const items = [...widgetConfig];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      setWidgetConfig(items);
      localStorage.setItem("kb-widgets", JSON.stringify(items));
    };
    const resetWidgets = () => {
      setWidgetConfig(WIDGET_DEFAULTS);
      localStorage.removeItem("kb-widgets");
    };
    const visibleWidgets = widgetConfig.filter(w => w.visible);

    const totalBook = loans.reduce((s, l) => s + l.balance, 0);
    const totalDisbursed = loans.reduce((s, l) => s + l.amount, 0);
    const arrLoans = loans.filter(l => l.dpd > 0);
    const arrAmt = arrLoans.reduce((s, l) => s + l.balance, 0);
    const ecl = provisions.reduce((s, p) => s + p.ecl, 0);
    const pipeline = applications.filter(a => ["Submitted","Underwriting"].includes(a.status));
    const pipeAmt = pipeline.reduce((s, a) => s + a.amount, 0);
    const avgRate = loans.length ? (loans.reduce((s, l) => s + l.rate, 0) / loans.length).toFixed(1) : 0;
    const jobs = customers.reduce((s, c) => s + c.employees, 0);
    const tier = ROLES[role]?.tier ?? 5;

    const roleSummary = {
      ADMIN: `${loans.length} active loans · ${pipeline.length} in pipeline · ${arrLoans.length} in arrears`,
      EXEC: `Portfolio: ${fmt.cur(totalBook)} · ${arrLoans.length} accounts in arrears · ECL: ${fmt.cur(ecl)}`,
      CREDIT_HEAD: `${pipeline.length} applications pending · ${arrLoans.length} in arrears · Risk score avg: ${Math.round(applications.filter(a=>a.riskScore).reduce((s,a)=>s+a.riskScore,0)/(applications.filter(a=>a.riskScore).length||1))}`,
      COMPLIANCE: `FICA pending: ${customers.filter(c=>c.ficaStatus!=="Verified").length} · BEE expiring (90d): ${customers.filter(c=>c.beeExpiry&&c.beeExpiry<now+90*day).length} · ${(statutoryReports||[]).filter(r=>r.status!=="Submitted").length} statutory reports due`,
      CREDIT_SNR: `${pipeline.length} applications in pipeline · ${applications.filter(a=>a.status==="Underwriting").length} in underwriting`,
      CREDIT: `${applications.filter(a=>a.status==="Underwriting").length} applications awaiting analysis · ${pipeline.length} total pipeline`,
      LOAN_OFFICER: `${customers.length} customers · ${pipeline.length} applications pending · ${arrLoans.filter(l=>l.dpd<=30).length} early arrears`,
      COLLECTIONS: `${arrLoans.length} delinquent accounts · ${arrLoans.filter(l=>l.dpd>30).length} mid/late stage · Total arrears: ${fmt.cur(arrAmt)}`,
      FINANCE: `Portfolio: ${fmt.cur(totalBook)} · ECL: ${fmt.cur(ecl)} · ${(statutoryReports||[]).filter(r=>r.status!=="Submitted").length} reports due`,
      AUDITOR: `${audit.length} audit entries · ${loans.length} active loans · ${applications.length} total applications`,
      VIEWER: `${loans.length} active loans · Portfolio: ${fmt.cur(totalBook)}`,
    };

    return (<div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.text, letterSpacing:-0.3 }}>Dashboard</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>{currentUser.name} · {ROLES[role]?.label} · {roleSummary[role] || ""}</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button className="kb-cta-outline" onClick={() => setShowWidgetPanel(!showWidgetPanel)} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 12px", fontSize:11, fontWeight:500, color:C.textDim, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M3 12h18"/><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Customise
          </button>
          {canDo("origination","create") && <Btn onClick={() => setModal("newApp")} icon={I.plus}>New Application</Btn>}
        </div>
      </div>

      {/* KPIs — tiered by role */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        {/* Everyone sees portfolio total and loan count */}
        <KPI label="Total Loan Book" value={fmt.cur(totalBook)} sub={`${loans.length} active loans`} trend={loans.length > 0 ? "up" : null} />
        {/* Tier 0-3: see full financial KPIs */}
        {tier <= 3 && <KPI label="Total Disbursed" value={fmt.cur(totalDisbursed)} />}
        {/* Origination roles see pipeline */}
        {canDo("origination","view") && <KPI label="Pipeline" value={fmt.cur(pipeAmt)} sub={`${pipeline.length} pending`} />}
        {/* Collections and above see arrears */}
        {canDo("collections","view") && <KPI label="Arrears" value={fmt.cur(arrAmt)} sub={`${arrLoans.length} accounts`} alert={arrLoans.length > 0} trend={arrLoans.length > 0 ? "down" : null} />}
        {/* Finance, Credit Head, Exec, Admin see ECL */}
        {canDo("provisioning","view") && <KPI label="ECL Provision" value={fmt.cur(ecl)} sub="IFRS 9" />}
        {/* Tier 0-2 see rate */}
        {tier <= 2 && <KPI label="Weighted Avg Rate" value={`${avgRate}%`} />}
      </div>

      
      {/* Widget Customisation Panel */}
      {showWidgetPanel && <div style={{ position:"fixed", top:0, right:0, bottom:0, width:300, background:C.surface, borderLeft:`1px solid ${C.border}`, boxShadow:"-4px 0 16px rgba(0,0,0,0.08)", zIndex:100, display:"flex", flexDirection:"column", fontFamily:"inherit" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:14, fontWeight:600, color:C.text }}>Customise Dashboard</div><div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>Drag to reorder · Toggle visibility</div></div>
          <button onClick={() => setShowWidgetPanel(false)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, padding:4 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"8px 12px" }}>
          {widgetConfig.map((w, idx) => (
            <div key={w.id}
              draggable={!w.locked}
              onDragStart={() => setDragWidget(idx)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => { if (dragWidget !== null && dragWidget !== idx) moveWidget(dragWidget, idx); setDragWidget(null); }}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", marginBottom:4, background:dragWidget === idx ? C.accentGlow : C.surface, border:`1px solid ${dragWidget === idx ? C.accent : C.border}`, borderRadius:6, cursor:w.locked ? "default" : "grab", transition:"background .15s, border-color .15s" }}>
              {!w.locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" style={{ flexShrink:0 }}><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg>}
              {w.locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" style={{ flexShrink:0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
              <span style={{ flex:1, fontSize:12, fontWeight:500, color:w.visible ? C.text : C.textMuted }}>{w.title}</span>
              {!w.locked && <button onClick={() => toggleWidget(w.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:2 }}>
                <div style={{ width:32, height:18, borderRadius:9, background:w.visible ? C.accent : C.border, transition:"background .2s", position:"relative" }}>
                  <div style={{ width:14, height:14, borderRadius:7, background:"#fff", position:"absolute", top:2, left:w.visible ? 16 : 2, transition:"left .2s", boxShadow:"0 1px 2px rgba(0,0,0,0.15)" }} />
                </div>
              </button>}
            </div>
          ))}
        </div>
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}` }}>
          <button onClick={resetWidgets} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 16px", fontSize:11, color:C.textDim, cursor:"pointer", width:"100%", fontFamily:"inherit" }}>Reset to Default</button>
        </div>
      </div>}

<div style={{ display: "grid", gridTemplateColumns: tier <= 2 ? "1fr 1fr" : "1fr", gap: 20, marginBottom: 24 }}>
        {/* IFRS 9 */}
        <div data-widget="ifrs9" style={{order:widgetConfig.findIndex(w=>w.id==="ifrs9")}}>{visibleWidgets.some(w=>w.id==="ifrs9") && canDo("provisioning","view") && (
          <SectionCard title="IFRS 9 Staging">
            {[1, 2, 3].map(s => {
              const sl = loans.filter(l => l.stage === s);
              const pct = loans.length ? Math.round(sl.length / loans.length * 100) : 0;
              const bal = sl.reduce((sum, l) => sum + l.balance, 0);
              const colors = { 1: C.green, 2: C.amber, 3: C.red };
              const labels = { 1: "Performing", 2: "Underperforming", 3: "Non-performing" };
              return (<div key={s} style={{ marginBottom:16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 4 }}>
                  <span>Stage {s}: {labels[s]}</span><span>{sl.length} ({pct}%) · {fmt.cur(bal)}</span>
                </div>
                <ProgressBar value={pct} color={colors[s]} />
              </div>);
            })}
          </SectionCard>
        )}</div>
        {/* DPD Distribution */}
        <div data-widget="dpd" style={{order:widgetConfig.findIndex(w=>w.id==="dpd")}}>{visibleWidgets.some(w=>w.id==="dpd") && canDo("provisioning","view") && loans.length > 0 && (
          <SectionCard title="DPD Distribution">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140, padding: "0 4px" }}>
              {[{label:"Current",min:0,max:0,color:C.green},{label:"1-30",min:1,max:30,color:C.amber},{label:"31-60",min:31,max:60,color:"#f97316"},{label:"61-90",min:61,max:90,color:C.red},{label:"90+",min:91,max:9999,color:"#7f1d1d"}].map(b => {
                const count = loans.filter(l => l.dpd >= b.min && l.dpd <= b.max).length;
                const pct = loans.length ? count / loans.length : 0;
                const height = Math.max(4, pct * 100);
                return (<div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.text }}>{count}</div>
                  <div style={{ width: "100%", maxWidth: 40, height: `${height}%`, background: b.color, borderRadius: "4px 4px 0 0", transition: "height .5s ease", minHeight: 4 }} />
                  <div style={{ fontSize: 10, color: C.textMuted, whiteSpace: "nowrap" }}>{b.label}</div>
                </div>);
              })}
            </div>
          </SectionCard>
        )}</div>

        {/* Product Mix */}
        <div data-widget="productMix" style={{order:widgetConfig.findIndex(w=>w.id==="productMix")}}>{visibleWidgets.some(w=>w.id==="productMix") && canDo("provisioning","view") && loans.length > 0 && (
          <SectionCard title="Product Mix">
            {(() => { const prodCounts = {}; loans.forEach(l => { const p = products.find(pp => pp.id === l.product); const name = p ? p.name.split(" — ")[0].split(" ").slice(0,2).join(" ") : l.product; prodCounts[name] = (prodCounts[name]||0) + 1; }); const entries = Object.entries(prodCounts).sort((a,b)=>b[1]-a[1]); const colors = [C.accent,C.accent,C.accent,C.accent,C.accent,C.accent,C.accent]; return entries.map(([name, count], i) => {
              const pct = loans.length ? Math.round(count / loans.length * 100) : 0;
              return (<div key={name} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>{name}</span>
                  <span style={{ color: C.textDim }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: 6, background: C.surface3, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: colors[i % colors.length], borderRadius: 4, transition: "width .5s ease" }} />
                </div>
              </div>);
            }); })()}
          </SectionCard>
        )}</div>

        {/* Pipeline */}
        <div data-widget="pipeline" style={{order:widgetConfig.findIndex(w=>w.id==="pipeline")}}>{visibleWidgets.some(w=>w.id==="pipeline") && canDo("origination","view") && (
          <SectionCard title="Application Pipeline">
            {["Submitted","Underwriting","Approved","Declined"].map(s => {
              const count = applications.filter(a => a.status === s).length;
              const amt = applications.filter(a => a.status === s).reduce((sum, a) => sum + a.amount, 0);
              return (<div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.surface3}` }}>
                {statusBadge(s)}<div style={{ textAlign:"right" }}><div style={{ fontSize:18, fontWeight:700, color:C.text }}>{count}</div><div style={{ fontSize:10, color:C.textMuted }}>{fmt.cur(amt)}</div></div>
              </div>);
            })}
          </SectionCard>
        )}</div>
        {/* Impact — everyone */}
        <div data-widget="impact" style={{order:widgetConfig.findIndex(w=>w.id==="impact")}}>{visibleWidgets.some(w=>w.id==="impact") && (
        <SectionCard title="Development Impact">
          {[["Jobs Supported", fmt.num(jobs)], ["BEE Level 1-2 Clients", customers.filter(c => c.beeLevel <= 2).length], ["Women-Owned (>50%)", customers.filter(c => (c.womenOwned||0) > 50).length], ["Youth-Owned (>50%)", customers.filter(c => (c.youthOwned||0) > 50).length], ["Disability-Owned (>50%)", customers.filter(c => (c.disabilityOwned||0) > 50).length], ["Avg Social Impact Score", applications.filter(a => a.socialScore).length > 0 ? Math.round(applications.filter(a => a.socialScore).reduce((s, a) => s + a.socialScore, 0) / applications.filter(a => a.socialScore).length) : "—"]].map(([l, v], i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.surface3}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:18, fontWeight:700, color:C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        )}</div>
      </div>

      {/* Statutory Deadlines — Compliance, Finance, Admin, Exec only */}
      <div data-widget="statutory" style={{order:widgetConfig.findIndex(w=>w.id==="statutory")}}>{visibleWidgets.some(w=>w.id==="statutory") && canDo("statutory","view") && (statutoryReports||[]).filter(r => r.status !== "Submitted").length > 0 && (
        <SectionCard title="NCR Statutory Reporting Deadlines" actions={<Btn size="sm" variant="ghost" onClick={() => setPage("statutory")}>View All {I.chev}</Btn>}>
          {(statutoryReports||[]).filter(r => r.status !== "Submitted").sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 4).map(r => {
            const days = Math.ceil((new Date(r.dueDate) - new Date()) / 864e5);
            const uc = days < 0 ? C.red : days <= 30 ? C.red : days <= 60 ? C.amber : C.textDim;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap:16, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 36, height: 36, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: uc, lineHeight: 1 }}>{days < 0 ? "!" : days}</div>
                  <div style={{ fontSize:10, color: C.textMuted, fontWeight: 500 }}>{days < 0 ? "LATE" : "DAYS"}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Due: {fmt.date(new Date(r.dueDate))} · {r.submitTo}</div>
                </div>
                <Badge color={r.type === "Form 39" ? "blue" : "purple"}>{r.type}</Badge>
                {statusBadge(r.status)}
              </div>
            );
          })}
        </SectionCard>
      )}</div>

      {/* My Tasks — role-specific action items */}
      <div data-widget="tasks" style={{order:widgetConfig.findIndex(w=>w.id==="tasks")}}>{visibleWidgets.some(w=>w.id==="tasks") && (role === "LOAN_OFFICER" || role === "CREDIT" || role === "CREDIT_SNR" || role === "COLLECTIONS") && (
        <SectionCard title="My Tasks">
          {role === "LOAN_OFFICER" && applications.filter(a => a.status === "Submitted").map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{a.id}</span> — {cust(a.custId)?.name} — {fmt.cur(a.amount)} — awaiting DD initiation</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"application",id:a.id})}>Open</Btn>
            </div>
          ))}
          {(role === "CREDIT" || role === "CREDIT_SNR") && applications.filter(a => a.status === "Underwriting").map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{a.id}</span> — {cust(a.custId)?.name} — {fmt.cur(a.amount)} — underwriting in progress</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"application",id:a.id})}>Open</Btn>
            </div>
          ))}
          {role === "COLLECTIONS" && arrLoans.map(l => (
            <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{l.id}</span> — {cust(l.custId)?.name} — {l.dpd} DPD — {fmt.cur(l.balance)}</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"loan",id:l.id})}>Open</Btn>
            </div>
          ))}
          {role === "LOAN_OFFICER" && applications.filter(a=>a.status==="Submitted").length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No pending tasks.</div>}
          {(role === "CREDIT" || role === "CREDIT_SNR") && applications.filter(a=>a.status==="Underwriting").length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No pending tasks.</div>}
          {role === "COLLECTIONS" && arrLoans.length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No delinquent accounts.</div>}
        </SectionCard>
      )}</div>

      <div data-widget="alerts" style={{order:widgetConfig.findIndex(w=>w.id==="alerts")}}>{visibleWidgets.some(w=>w.id==="alerts") && (
      <SectionCard title="Recent Alerts" actions={canDo("governance","view") ? <Btn size="sm" variant="ghost" onClick={() => setPage("governance")}>View All</Btn> : null}>
        {alerts.filter(a => {
          if (tier <= 1) return true; // Admin/Exec see all
          if (role === "COMPLIANCE" && (a.type === "Compliance" || a.type === "Statutory" || a.type === "Regulatory")) return true;
          if (role === "COLLECTIONS" && (a.type === "Collections" || a.type === "EWS")) return true;
          if ((role === "CREDIT" || role === "CREDIT_SNR" || role === "CREDIT_HEAD") && (a.type === "Application" || a.type === "EWS" || a.type === "Portfolio")) return true;
          if (role === "LOAN_OFFICER" && (a.type === "Application" || a.type === "EWS" || a.type === "Compliance")) return true;
          if (role === "FINANCE" && (a.type === "Statutory" || a.type === "Portfolio")) return true;
          if (role === "AUDITOR") return true;
          return false;
        }).slice(0, 6).map(a => (
          <div key={a.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"8px 0", borderBottom:`1px solid ${C.border}`, opacity:a.read?0.4:1 }}>
            <div style={{ width:8, height:8, borderRadius:4, marginTop:5, flexShrink:0, background:a.severity==="critical"?C.red:a.severity==="warning"?C.amber:C.blue }} />
            <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, color:C.text }}>{a.title}</div><div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{a.msg}</div></div>
            <div style={{ fontSize:10, color:C.textMuted, whiteSpace:"nowrap" }}>{fmt.date(a.ts)}</div>
            {!a.read && <Btn size="sm" variant="ghost" onClick={() => markRead(a.id)}>Dismiss</Btn>}
          </div>
        ))}
        {alerts.length === 0 && <div style={{ fontSize:12, color:C.textMuted }}>No alerts.</div>}
      </SectionCard>
      )}</div>
    </div>);
  }

  function Customers() {
    const [tab, setTab] = useState("all");
    const [showCreate, setShowCreate] = useState(false);
    const [cForm, setCForm] = useState({ name:"", contact:"", email:"", phone:"", idNum:"", regNum:"", industry:"Retail", sector:"", revenue:"", employees:"", years:"", beeLevel:3, address:"", province:"Eastern Cape" });
    const tabs = [
      { key:"all", label:"All", count:customers.length },
      { key:"pending", label:"FICA Pending", count:customers.filter(c=>c.ficaStatus==="Pending"||c.ficaStatus==="Under Review").length },
      { key:"verified", label:"Verified", count:customers.filter(c=>c.ficaStatus==="Verified").length },
      { key:"beeExpiring", label:"BEE Expiring", count:customers.filter(c=>c.beeExpiry&&c.beeExpiry<now+90*day).length },
    ];
    let filtered = customers.filter(c => !search || [c.name,c.contact,c.industry,c.id].some(f => f?.toLowerCase().includes(search.toLowerCase())));
    if (tab === "pending") filtered = filtered.filter(c=>c.ficaStatus==="Pending"||c.ficaStatus==="Under Review");
    if (tab === "verified") filtered = filtered.filter(c=>c.ficaStatus==="Verified");
    if (tab === "beeExpiring") filtered = filtered.filter(c=>c.beeExpiry&&c.beeExpiry<now+90*day);

    const handleCreate = () => {
      if (!cForm.name || !cForm.contact || !cForm.idNum || !cForm.regNum) { alert("Name, contact, ID number, and registration number are required."); return; }
      createCustomer({ ...cForm, revenue:+cForm.revenue||0, employees:+cForm.employees||0, years:+cForm.years||0, beeLevel:+cForm.beeLevel||3 });
      setShowCreate(false);
      setCForm({ name:"", contact:"", email:"", phone:"", idNum:"", regNum:"", industry:"Retail", sector:"", revenue:"", employees:"", years:"", beeLevel:3, address:"", province:"Eastern Cape", womenOwned:0, youthOwned:0, disabilityOwned:0 });
    };

    return (<div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
        <div><h2 style={{ margin:0, fontSize:24, fontWeight:700, color:C.text }}>Customer Management</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>Onboarding, KYC/FICA verification, BEE profiling & relationship management</p></div>
        {canDo("customers","create") && <Btn onClick={()=>setShowCreate(!showCreate)} icon={I.plus}>New Customer</Btn>}
      </div>

      {showCreate && (
        <SectionCard title="Register New Customer">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <Field label="Business Name *"><Input value={cForm.name} onChange={e=>setCForm({...cForm,name:e.target.value})} placeholder="e.g. Nomsa Trading (Pty) Ltd" /></Field>
            <Field label="Contact Person *"><Input value={cForm.contact} onChange={e=>setCForm({...cForm,contact:e.target.value})} placeholder="Full name" /></Field>
            <Field label="Email"><Input value={cForm.email} onChange={e=>setCForm({...cForm,email:e.target.value})} placeholder="email@company.co.za" /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <Field label="Phone"><Input value={cForm.phone} onChange={e=>setCForm({...cForm,phone:e.target.value})} placeholder="0XX XXX XXXX" /></Field>
            <Field label="ID Number *"><Input value={cForm.idNum} onChange={e=>setCForm({...cForm,idNum:e.target.value})} placeholder="13-digit SA ID" /></Field>
            <Field label="Company Registration *"><Input value={cForm.regNum} onChange={e=>setCForm({...cForm,regNum:e.target.value})} placeholder="YYYY/XXXXXX/07" /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <Field label="Industry"><Select value={cForm.industry} onChange={e=>setCForm({...cForm,industry:e.target.value})} options={["Retail","Agriculture","Technology","Construction","Food Processing","Transport","Manufacturing","Professional Services","Other"].map(v=>({value:v,label:v}))} /></Field>
            <Field label="Sector"><Input value={cForm.sector} onChange={e=>setCForm({...cForm,sector:e.target.value})} placeholder="e.g. Consumer Goods" /></Field>
            <Field label="Annual Revenue (R)"><Input type="number" value={cForm.revenue} onChange={e=>setCForm({...cForm,revenue:e.target.value})} /></Field>
            <Field label="Employees"><Input type="number" value={cForm.employees} onChange={e=>setCForm({...cForm,employees:e.target.value})} /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <Field label="Years in Business"><Input type="number" value={cForm.years} onChange={e=>setCForm({...cForm,years:e.target.value})} /></Field>
            <Field label="BEE Level"><Select value={cForm.beeLevel} onChange={e=>setCForm({...cForm,beeLevel:e.target.value})} options={[1,2,3,4,5,6,7,8].map(v=>({value:v,label:`Level ${v}`}))} /></Field>
            <Field label="Women Ownership %"><Input type="number" min="0" max="100" value={cForm.womenOwned} onChange={e=>setCForm({...cForm,womenOwned:e.target.value})} placeholder="0-100" /></Field>
            <Field label="Youth Ownership %"><Input type="number" min="0" max="100" value={cForm.youthOwned} onChange={e=>setCForm({...cForm,youthOwned:e.target.value})} placeholder="0-100" /></Field>
            <Field label="Disability Ownership %"><Input type="number" min="0" max="100" value={cForm.disabilityOwned} onChange={e=>setCForm({...cForm,disabilityOwned:e.target.value})} placeholder="0-100" /></Field>
            <Field label="Address"><Input value={cForm.address} onChange={e=>setCForm({...cForm,address:e.target.value})} /></Field>
            <Field label="Province"><Select value={cForm.province} onChange={e=>setCForm({...cForm,province:e.target.value})} options={["Eastern Cape","Western Cape","Gauteng","KwaZulu-Natal","Free State","North West","Limpopo","Mpumalanga","Northern Cape"].map(v=>({value:v,label:v}))} /></Field>
          </div>
          <div style={{ display:"flex", gap:8 }}><Btn onClick={handleCreate}>Register Customer</Btn><Btn variant="ghost" onClick={()=>setShowCreate(false)}>Cancel</Btn></div>
        </SectionCard>
      )}

      <Tab tabs={tabs} active={tab} onChange={setTab} />
      <Table columns={[
        { label:"ID", render:r=><span style={{ fontFamily:"monospace", fontSize:12 }}>{r.id}</span> },
        { label:"Business Name", render:r=><span style={{ fontWeight:600 }}>{r.name}</span> },
        { label:"Contact", key:"contact" },
        { label:"Industry", key:"industry" },
        { label:"Revenue", render:r=><span style={{ fontFamily:"monospace", fontSize:12 }}>{fmt.cur(r.revenue)}</span> },
        { label:"BEE", render:r=><Badge color="purple">Level {r.beeLevel}</Badge> },
        { label:"FICA", render:r=>statusBadge(r.ficaStatus) },
        { label:"Risk", render:r=> r.riskCategory ? <Badge color={r.riskCategory==="Low"?"green":r.riskCategory==="Medium"?"amber":"red"}>{r.riskCategory}</Badge> : <span style={{ fontSize:10, color:C.textMuted }}>—</span> },
        { label:"", render:()=><span style={{ color:C.accent }}>{I.chev}</span> },
      ]} rows={filtered} onRowClick={r=>setDetail({type:"customer",id:r.id})} />
    </div>);
  }

  function Origination() {
    const [tab, setTab] = useState("all");
    const drafts = applications.filter(a=>a.status==="Draft");
    const expiredDrafts = drafts.filter(a=>a.expiresAt && a.expiresAt < Date.now());
    const tabs = [
      { key:"all", label:"All", count:applications.length },
      { key:"Draft", label:"Draft (QA Pending)", count:drafts.length },
      { key:"Submitted", label:"Submitted", count:applications.filter(a=>a.status==="Submitted").length },
      { key:"Underwriting", label:"Underwriting", count:applications.filter(a=>a.status==="Underwriting").length },
      { key:"Approved", label:"Approved", count:applications.filter(a=>a.status==="Approved").length },
      { key:"Declined", label:"Declined", count:applications.filter(a=>a.status==="Declined").length },
      { key:"Withdrawn", label:"Withdrawn", count:applications.filter(a=>a.status==="Withdrawn").length },
    ];
    const filtered = applications.filter(a => tab === "all" || a.status === tab).filter(a => !search || [a.id, cust(a.custId)?.name, prod(a.product)?.name].some(f => f?.toLowerCase().includes(search.toLowerCase())));
    const assignableUsers = SYSTEM_USERS.filter(u => ["LOAN_OFFICER","CREDIT","CREDIT_SNR","CREDIT_HEAD"].includes(u.role));

    return (<div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
        <div><h2 style={{ margin:0, fontSize:24, fontWeight:700, color:C.text }}>Loan Origination</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>Application intake, QA & document validation, assignment & pipeline management</p></div>
        {canDo("origination","create") && <Btn onClick={() => setModal("newApp")} icon={I.plus}>New Application</Btn>}
      </div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Drafts (QA Pending)" value={drafts.length} sub={expiredDrafts.length > 0 ? `${expiredDrafts.length} expired` : ""} />
        <KPI label="Submitted" value={applications.filter(a=>a.status==="Submitted").length} sub="awaiting DD" />
        <KPI label="Underwriting" value={applications.filter(a=>a.status==="Underwriting").length} />
        <KPI label="Pipeline Value" value={fmt.cur(applications.filter(a=>["Draft","Submitted","Underwriting"].includes(a.status)).reduce((s,a)=>s+a.amount,0))} />
        <KPI label="Approved" value={applications.filter(a=>a.status==="Approved").length} />
        <KPI label="Declined" value={applications.filter(a=>a.status==="Declined").length} />
      </div>

      <Tab tabs={tabs} active={tab} onChange={setTab} />
      <Table columns={[
        { label:"App ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
        { label:"Applicant", render:r=><span style={{ fontWeight:500 }}>{cust(r.custId)?.name}</span> },
        { label:"Product", render:r=><span style={{ fontSize:12 }}>{prod(r.product)?.name || r.product}</span> },
        { label:"Amount", render:r=><span style={{ fontFamily:"monospace", fontSize:12 }}>{fmt.cur(r.amount)}</span> },
        { label:"Term", render:r=><span style={{ fontSize:12 }}>{r.term}m</span> },
        { label:"Date", render:r=>fmt.date(r.submitted || r.createdAt) },
        { label:"Assigned To", render:r=>{
          const u = SYSTEM_USERS.find(x=>x.id===r.assignedTo);
          if (u) return <span style={{ fontSize:11 }}>{u.name}</span>;
          if (!["Submitted","Underwriting"].includes(r.status)) return <span style={{ fontSize:10, color:C.textMuted }}>—</span>;
          if (!canDo("origination","assign")) return <span style={{ fontSize:10, color:C.amber }}>Unassigned</span>;
          return <select onChange={e=>{if(e.target.value)assignApplication(r.id,e.target.value)}} defaultValue="" style={{ fontSize:11, border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontFamily:"inherit", padding:"4px 8px", borderRadius:4 }}>
            <option value="">Assign...</option>
            {assignableUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>;
        }},
        { label:"QA", render:r=> r.qaSignedOff ? <Badge color="green">Passed</Badge> : r.qaFindings?.result==="Failed" ? <Badge color="red">Failed</Badge> : r.status==="Draft" ? <Badge color="amber">Pending</Badge> : <span style={{ fontSize:10, color:C.textMuted }}>—</span> },
        { label:"Status", render:r=>{
          if (r.status==="Draft" && r.expiresAt && r.expiresAt < Date.now()) return <Badge color="red">Expired</Badge>;
          return statusBadge(r.status);
        }},
        { label:"Actions", render:r=><div style={{ display:"flex", gap:4 }}>
          {r.status==="Draft" && !(r.expiresAt && r.expiresAt < Date.now()) && canDo("origination","update") && <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();qaSignOffApplication(r.id)}}>QA & Submit</Btn>}
          {["Draft","Submitted","Underwriting"].includes(r.status) && canDo("origination","update") && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();setWithdrawId(r.id)}}>Withdraw</Btn>}
        </div> },
      ]} rows={filtered} onRowClick={r=>setDetail({type:"application",id:r.id})} />

      <Modal open={!!withdrawId} onClose={()=>setWithdrawId(null)} title={`Withdraw Application ${withdrawId}`} width={420}>
        <div style={{ fontSize:12, color:C.textDim, marginBottom:12 }}>This will cancel the application. The customer can re-apply later.</div>
        <Field label="Reason for withdrawal"><Textarea value={withdrawReason} onChange={e=>setWithdrawReason(e.target.value)} rows={3} placeholder="Customer request / Duplicate / Failed validation..." /></Field>
        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <Btn variant="danger" onClick={()=>{withdrawApplication(withdrawId,withdrawReason);setWithdrawId(null);setWithdrawReason("")}}>Confirm Withdrawal</Btn>
          <Btn variant="ghost" onClick={()=>{setWithdrawId(null);setWithdrawReason("")}}>Cancel</Btn>
        </div>
      </Modal>
    </div>);
  }

  function Underwriting() {
    const pending = applications.filter(a => ["Submitted","Underwriting"].includes(a.status));
    const decided = applications.filter(a => ["Approved","Declined"].includes(a.status)).slice(-5);
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>Credit Assessment & Underwriting</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Risk analysis, affordability, scoring & credit decisions</p>
      <SectionCard title={`Pending Decisions (${pending.length})`}>
        <Table columns={[
          { label:"App ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
          { label:"Applicant", render:r=><span style={{ fontWeight:500 }}>{cust(r.custId)?.name}</span> },
          { label:"Amount", render:r=><span style={{ fontFamily:"monospace", fontSize:12 }}>{fmt.cur(r.amount)}</span> },
          { label:"Authority", render:r=>r.amount>1000000?"Credit Committee":r.amount>500000?"Head of Credit":r.amount>250000?"Senior Analyst":"Analyst" },
          { label:"Status", render:r=>statusBadge(r.status) },
          { label:"Actions", render:r=><div style={{ display:"flex", gap:8 }}>{r.status==="Submitted"&&canDo("underwriting","update")&&<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();moveToUnderwriting(r.id)}}>Start DD</Btn>}{r.status==="Underwriting"&&canDo("underwriting","view")&&<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();setDetail({type:"application",id:r.id})}}>Open Workflow</Btn>}</div> },
        ]} rows={pending} onRowClick={r=>setDetail({type:"application",id:r.id})} />
      </SectionCard>
      <SectionCard title="Recent Decisions">
        <Table columns={[
          { label:"App ID", render:r=><span style={{ fontFamily:"monospace", fontSize:12 }}>{r.id}</span> },
          { label:"Applicant", render:r=>cust(r.custId)?.name },
          { label:"Amount", render:r=>fmt.cur(r.amount) },
          { label:"Risk Score", render:r=>r.riskScore!=null?<span style={{ fontWeight:700, color:r.riskScore>=70?C.green:r.riskScore>=50?C.amber:C.red }}>{r.riskScore}</span>:"—" },
          { label:"DSCR", render:r=>r.dscr||"—" },
          { label:"Decision", render:r=>statusBadge(r.status) },
          { label:"Approver", key:"approver" },
        ]} rows={decided} onRowClick={r=>setDetail({type:"application",id:r.id})} />
      </SectionCard>
    </div>);
  }

  function Loans() {
    const [tab, setTab] = useState("all");
    const [view, setView] = useState("book"); // book | analytics
    const bookedLoans = loans.filter(l => l.status === "Booked");
    const activeLoans = loans.filter(l => l.status === "Active");
    const shown = tab === "booked" ? bookedLoans : tab === "active" ? activeLoans : loans;

    // ── Portfolio Analytics ──
    const openingBook = activeLoans.reduce((s,l)=>s+l.amount,0);
    const currentBook = activeLoans.reduce((s,l)=>s+l.balance,0);
    const newDisb = loans.filter(l=>l.disbursedAt&&l.disbursedAt>Date.now()-30*day).reduce((s,l)=>s+l.amount,0);
    const nplLoans = activeLoans.filter(l=>l.dpd>90);
    const grossNPL = nplLoans.reduce((s,l)=>s+l.balance,0);
    const recoveryRate = 0.55;
    const recoveries = grossNPL * recoveryRate;
    const closingBook = currentBook - grossNPL + recoveries;
    const totalBorrowers = new Set(activeLoans.map(l=>l.custId)).size;
    const totalInterest = activeLoans.reduce((s,l)=>s+(l.balance*(l.rate/100)/12),0);
    const totalFees = activeLoans.reduce((s,l)=>s+(l.amount*((l.arrangementFee||0)/100)/Math.max(l.term,1)),0);
    const portfolioYield = currentBook>0 ? ((totalInterest+totalFees)*12/currentBook) : 0;
    const effectiveNPL = currentBook>0 ? grossNPL/currentBook : 0;
    const provisionExp = activeLoans.reduce((s,l)=>{const p=products.find(x=>x.id===l.product);return s+l.balance*((p?.ecl||2)/100);},0);
    const netCreditLoss = grossNPL*(1-recoveryRate);
    const wacf = 8.5;
    const costOfFunds = currentBook*(wacf/100)/12;
    const netSpread = portfolioYield - (wacf/100);
    const fundingCap = (settings?.fundingCapacity||currentBook*1.5)||currentBook*1.5;
    const headroom = fundingCap - currentBook;
    const facilUtil = fundingCap>0 ? currentBook/fundingCap : 0;

    const row = (label, value, indent=false, accent=false, divider=false) => (
      <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:divider?`2px solid ${C.text}`:`1px solid ${C.border}`, paddingLeft:indent?16:0 }}>
        <span style={{ fontSize:12, fontWeight:accent?700:indent?400:600, color:accent?C.text:indent?C.textDim:C.text }}>{label}</span>
        <span style={{ fontSize:12, fontWeight:accent?700:600, fontFamily:"monospace", color:accent?C.text:C.text }}>{value}</span>
      </div>
    );

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>Loans</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>Booking, disbursement, portfolio monitoring & covenant tracking</p>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={()=>setView("book")} style={{ background:view==="book"?C.accent:"none", color:view==="book"?"#fff":C.textDim, border:`1px solid ${view==="book"?C.text:C.border}`, padding:"8px 14px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Loan Book</button>
        <button onClick={()=>setView("analytics")} style={{ background:view==="analytics"?C.accent:"none", color:view==="analytics"?"#fff":C.textDim, border:`1px solid ${view==="analytics"?C.text:C.border}`, padding:"8px 14px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Portfolio Analytics</button>
      </div>

      {view === "book" && <div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
          <KPI label="Total Portfolio" value={fmt.cur(currentBook)} />
          <KPI label="Active" value={activeLoans.length} />
          <KPI label="Booked (Awaiting Disbursement)" value={bookedLoans.length} />
          <KPI label="Total Monthly PMT" value={fmt.cur(activeLoans.reduce((s,l)=>s+l.monthlyPmt,0))} />
        </div>
        <Tab tabs={[{key:"all",label:"All",count:loans.length},{key:"booked",label:"Booked",count:bookedLoans.length},{key:"active",label:"Active",count:activeLoans.length}]} active={tab} onChange={setTab} />
        <Table columns={[
          { label:"Loan ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
          { label:"Borrower", render:r=>cust(r.custId)?.name },
          { label:"Product", render:r=>{const p=prod(r.product);return <span style={{fontSize:11}}>{p?.name||"—"}</span>} },
          { label:"Amount", render:r=>fmt.cur(r.amount) },
          { label:"Balance", render:r=><span style={{ fontWeight:700 }}>{fmt.cur(r.balance)}</span> },
          { label:"Rate", render:r=>`${r.rate}%` },
          { label:"Status", render:r=>statusBadge(r.status) },
          { label:"DPD", render:r=>r.status==="Active"?<span style={{ fontWeight:700, color:r.dpd===0?C.green:r.dpd<=30?C.amber:C.red }}>{r.dpd}</span>:<span style={{ color:C.textMuted }}>—</span> },
          { label:"Stage", render:r=>r.status==="Active"?<Badge color={r.stage===1?"green":r.stage===2?"amber":"red"}>Stage {r.stage}</Badge>:<span style={{ color:C.textMuted }}>—</span> },
          { label:"Actions", render:r=><div style={{ display:"flex", gap:4 }}>
            {r.status==="Booked"&&canDoAny("loans",["update"])&&<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();disburseLoan(r.id)}}>Disburse</Btn>}
          </div> },
        ]} rows={shown} onRowClick={r=>setDetail({type:"loan",id:r.id})} />
      </div>}

      {view === "analytics" && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* Loan Book Movement */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"20px" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:C.text }}>Loan Book Movement</div>
          {row("Opening loan book", fmt.cur(openingBook), false, true, true)}
          {row("New disbursements (30d)", fmt.cur(newDisb), true)}
          {row("Gross NPL amount", fmt.cur(grossNPL), true)}
          {row("Recoveries (55%)", fmt.cur(recoveries), true)}
          {row("Closing loan book", fmt.cur(closingBook), false, true, true)}
          <div style={{ height:12 }} />
          {row("Total borrowers", totalBorrowers)}
        </div>

        {/* Yield & Income */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"20px" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:C.text }}>Yield & Income</div>
          {row("Portfolio yield (annualised)", fmt.pct(portfolioYield), false, true, true)}
          {row("Monthly interest income", fmt.cur(totalInterest), true)}
          {row("Monthly fee income", fmt.cur(totalFees), true)}
          <div style={{ height:12 }} />
          {row("Effective NPL rate", fmt.pct(effectiveNPL))}
          {row("Provision expense", fmt.cur(provisionExp))}
          {row("Net credit loss", fmt.cur(netCreditLoss))}
        </div>

        {/* Funding & Spread */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"20px" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:C.text }}>Funding & Spread</div>
          {row("WACF (weighted avg cost of funds)", `${wacf}%`, false, true, true)}
          {row("Cost of funds (monthly)", fmt.cur(costOfFunds), true)}
          <div style={{ height:12 }} />
          {row("Net interest spread", fmt.pct(netSpread), false, true)}
        </div>

        {/* Facility */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"20px" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:C.text }}>Funding Capacity</div>
          {row("Funding headroom", fmt.cur(headroom), false, true, true)}
          {row("Current book", fmt.cur(currentBook), true)}
          {row("Facility capacity", fmt.cur(fundingCap), true)}
          <div style={{ height:12 }} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0" }}>
            <span style={{ fontSize:12, fontWeight:600 }}>Facility utilisation</span>
            <span style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:facilUtil>0.85?C.red:facilUtil>0.7?C.amber:C.green }}>{fmt.pct(facilUtil)}</span>
          </div>
          <div style={{ height:6, background:C.surface2, borderRadius:3, marginTop:4 }}>
            <div style={{ height:6, borderRadius:3, background:facilUtil>0.85?C.red:facilUtil>0.7?C.amber:C.green, width:`${Math.min(facilUtil*100,100)}%` }} />
          </div>
        </div>

        {/* Product Concentration */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"20px", gridColumn:"1/-1" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:C.text }}>Portfolio by Product</div>
          <Table columns={[
            { label:"Product", render:r=><span style={{ fontWeight:600, fontSize:12 }}>{r.name}</span> },
            { label:"Loans", render:r=>r.count },
            { label:"Book Value", render:r=>fmt.cur(r.balance) },
            { label:"% of Book", render:r=><span style={{ fontFamily:"monospace" }}>{currentBook>0?fmt.pct(r.balance/currentBook):"—"}</span> },
            { label:"Avg DPD", render:r=>r.count>0?Math.round(r.dpd/r.count):0 },
            { label:"Risk Class", render:r=><Badge color={r.riskClass==="A"?"green":r.riskClass==="B"?"amber":r.riskClass==="C"?"red":"gray"}>{r.riskClass||"—"}</Badge> },
            { label:"ECL Rate", render:r=><span style={{ fontFamily:"monospace" }}>{r.ecl!=null?`${r.ecl}%`:"—"}</span> },
          ]} rows={products.filter(p=>p.status==="Active").map(p=>{const pLoans=activeLoans.filter(l=>l.product===p.id);return{id:p.id,name:p.name,count:pLoans.length,balance:pLoans.reduce((s,l)=>s+l.balance,0),dpd:pLoans.reduce((s,l)=>s+l.dpd,0),riskClass:p.riskClass,ecl:p.ecl};})} />
        </div>
      </div>}
    </div>);
  }

  function Servicing() {
    const [tab, setTab] = useState("upcoming");
    const activeLoans = loans.filter(l => l.status === "Active");
    const overdue = activeLoans.filter(l => l.dpd > 0);
    const allPmts = loans.flatMap(l => l.payments.map(p => ({ ...p, loanId: l.id }))).sort((a,b) => b.date - a.date);
    const totalCollected = allPmts.reduce((s,p) => s + p.amount, 0);
    const totalInterest = allPmts.reduce((s,p) => s + (p.interest||0), 0);
    const totalPrincipal = allPmts.reduce((s,p) => s + (p.principal||0), 0);

    const genSchedule = (l) => {
      const rows = [];
      let bal = l.amount;
      const r = l.rate / 100 / 12;
      for (let m = 1; m <= l.term; m++) {
        const interest = Math.round(bal * r);
        const principal = Math.max(0, l.monthlyPmt - interest);
        bal = Math.max(0, bal - principal);
        const paid = l.payments[m-1];
        rows.push({ month:m, pmt:l.monthlyPmt, interest, principal, balance:bal, status: paid ? "Paid" : m <= l.payments.length ? "Paid" : bal <= 0 ? "—" : "Pending" });
      }
      return rows;
    };

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>Loan Servicing</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>Payment processing, amortization schedules, statements & account management</p>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Active Loans" value={activeLoans.length} />
        <KPI label="Total Collected" value={fmt.cur(totalCollected)} />
        <KPI label="Interest Collected" value={fmt.cur(totalInterest)} />
        <KPI label="Principal Collected" value={fmt.cur(totalPrincipal)} />
        <KPI label="Overdue" value={overdue.length} sub={fmt.cur(overdue.reduce((s,l)=>s+l.monthlyPmt,0))} />
        <KPI label="Monthly Receivable" value={fmt.cur(activeLoans.reduce((s,l)=>s+l.monthlyPmt,0))} />
      </div>

      <Tab tabs={[
        {key:"upcoming",label:"Upcoming Payments",count:activeLoans.length},
        {key:"recent",label:"Payment History",count:allPmts.length},
        {key:"schedule",label:"Amortization Schedules"},
        {key:"overdue",label:"Overdue",count:overdue.length},
      ]} active={tab} onChange={setTab} />

      {tab==="upcoming" && (
        <Table columns={[
          { label:"Due Date", render:r=>{ const d=Math.ceil((r.nextDue-Date.now())/day); return <span style={{ fontWeight:d<0?700:400, color:d<0?C.red:d<=7?C.amber:C.textDim }}>{fmt.date(r.nextDue)}{d<0?` (${Math.abs(d)}d overdue)`:""}</span>; }},
          { label:"Loan", render:r=><span style={{ fontFamily:"monospace", fontSize:12 }}>{r.id}</span> },
          { label:"Borrower", render:r=>cust(r.custId)?.name },
          { label:"Instalment", render:r=>fmt.cur(r.monthlyPmt) },
          { label:"Balance", render:r=>fmt.cur(r.balance) },
          { label:"DPD", render:r=><span style={{ fontWeight:700, color:r.dpd===0?C.green:C.amber }}>{r.dpd}</span> },
          { label:"Action", render:r=>canDo("servicing","create")?<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();recordPayment(r.id, r.monthlyPmt)}}>Record Payment</Btn>:<span style={{fontSize:10,color:C.textMuted}}>View only</span> },
        ]} rows={[...activeLoans].sort((a,b)=>a.nextDue-b.nextDue)} onRowClick={r=>setDetail({type:"loan",id:r.id})} />
      )}

      {tab==="recent" && (
        <Table columns={[
          { label:"Date", render:r=>fmt.date(r.date) },
          { label:"Loan", key:"loanId" },
          { label:"Borrower", render:r=>cust(loans.find(l=>l.id===r.loanId)?.custId)?.name },
          { label:"Total", render:r=><span style={{ fontWeight:700 }}>{fmt.cur(r.amount)}</span> },
          { label:"Interest", render:r=><span style={{ color:C.amber }}>{fmt.cur(r.interest||0)}</span> },
          { label:"Principal", render:r=><span style={{ color:C.green }}>{fmt.cur(r.principal||0)}</span> },
          { label:"Type", key:"type" },
          { label:"Status", render:r=>statusBadge(r.status) },
        ]} rows={allPmts.slice(0,20)} />
      )}

      {tab==="schedule" && (
        <div>
          <div style={{ marginBottom:12 }}>
            <Field label="Select Loan">
              <Select value={schedLoan||""} onChange={e=>setSchedLoan(e.target.value)} options={[{value:"",label:"— Select —"},...activeLoans.map(l=>({value:l.id,label:`${l.id} – ${cust(l.custId)?.name} – ${fmt.cur(l.amount)} @ ${l.rate}%`}))]} />
            </Field>
          </div>
          {schedLoan && (() => {
            const l = loans.find(x=>x.id===schedLoan);
            if (!l) return null;
            const sched = genSchedule(l);
            return (<div>
              <div style={{ fontSize:12, color:C.textDim, marginBottom:8 }}>
                {cust(l.custId)?.name} · {fmt.cur(l.amount)} @ {l.rate}% over {l.term}m · Monthly: {fmt.cur(l.monthlyPmt)} · Total interest: {fmt.cur(sched.reduce((s,r)=>s+r.interest,0))} · Total cost: {fmt.cur(sched.reduce((s,r)=>s+r.pmt,0))}
              </div>
              <div style={{ maxHeight:400, overflow:"auto" }}>
                <Table columns={[
                  { label:"#", render:r=>r.month },
                  { label:"Payment", render:r=>fmt.cur(r.pmt) },
                  { label:"Interest", render:r=><span style={{ color:C.amber }}>{fmt.cur(r.interest)}</span> },
                  { label:"Principal", render:r=><span style={{ color:C.green }}>{fmt.cur(r.principal)}</span> },
                  { label:"Balance", render:r=>fmt.cur(r.balance) },
                  { label:"Status", render:r=>statusBadge(r.status) },
                ]} rows={sched} />
              </div>
            </div>);
          })()}
        </div>
      )}

      {tab==="overdue" && (
        <Table columns={[
          { label:"Loan", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
          { label:"Borrower", render:r=>cust(r.custId)?.name },
          { label:"Balance", render:r=>fmt.cur(r.balance) },
          { label:"Instalment", render:r=>fmt.cur(r.monthlyPmt) },
          { label:"DPD", render:r=><span style={{ fontSize:18, fontWeight:700, color:r.dpd<=30?C.amber:C.red }}>{r.dpd}</span> },
          { label:"Last Payment", render:r=>r.lastPmt ? fmt.date(r.lastPmt) : <span style={{ color:C.textMuted }}>None</span> },
          { label:"Action", render:r=>canDo("servicing","create")?<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();recordPayment(r.id, r.monthlyPmt)}}>Record Payment</Btn>:<span style={{fontSize:10,color:C.textMuted}}>View only</span> },
        ]} rows={overdue.sort((a,b)=>b.dpd-a.dpd)} onRowClick={r=>setDetail({type:"loan",id:r.id})} />
      )}
    </div>);
  }

  function Collections() {
    const activeLoans = loans.filter(l => l.status === "Active");
    const delinquent = activeLoans.filter(l => l.dpd > 0);
    const [tab, setTab] = useState("accounts");
    const ptps = collections.filter(c=>c.ptpDate);
    const pendingWriteOffs = collections.filter(c=>c.writeOff);
    const early = delinquent.filter(l=>l.dpd<=30);
    const mid = delinquent.filter(l=>l.dpd>30&&l.dpd<=90);
    const late = delinquent.filter(l=>l.dpd>90);

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>Collections & Recovery</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>NCA-compliant delinquency management, PTP tracking, restructuring & legal recovery</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Early (1-30)" value={early.length} sub={fmt.cur(early.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Mid (31-90)" value={mid.length} sub={fmt.cur(mid.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Late (91+)" value={late.length} sub={fmt.cur(late.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Total Arrears" value={fmt.cur(delinquent.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Active PTPs" value={ptps.filter(p=>p.ptpDate>Date.now()).length} />
        <KPI label="Write-Off Proposals" value={pendingWriteOffs.length} />
      </div>

      <Tab tabs={[
        {key:"accounts",label:"Delinquent Accounts",count:delinquent.length},
        {key:"activity",label:"Activity Log",count:collections.length},
        {key:"ptp",label:"Promise-to-Pay",count:ptps.length},
        {key:"writeoff",label:"Write-Offs",count:pendingWriteOffs.length},
      ]} active={tab} onChange={setTab} />

      {tab==="accounts" && <Table columns={[
        { label:"Loan", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
        { label:"Borrower", render:r=>cust(r.custId)?.name },
        { label:"Balance", render:r=>fmt.cur(r.balance) },
        { label:"DPD", render:r=><span style={{ fontSize:18, fontWeight:700, color:r.dpd<=30?C.amber:C.red }}>{r.dpd}</span> },
        { label:"Stage", render:r=><Badge color={r.dpd<=30?"amber":r.dpd<=90?"red":"red"}>{r.dpd<=30?"Early":r.dpd<=90?"Mid":"Late"}</Badge> },
        { label:"Last Action", render:r=>{ const last=collections.filter(c=>c.loanId===r.id).sort((a,b)=>b.created-a.created)[0]; return last?<span style={{ fontSize:10, color:C.textDim }}>{last.action} ({fmt.date(last.created)})</span>:<span style={{ fontSize:10, color:C.textMuted }}>None</span>; }},
        { label:"Actions", render:r=>canDo("collections","create") ? <div style={{ display:"flex", gap:4 }}>
          <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();addCollectionAction(r.id,"Phone Call","Outbound call.",{channel:"Phone"})}}>Call</Btn>
          <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();setActionModal({loanId:r.id,type:"ptp"})}}>PTP</Btn>
          {r.dpd>30&&<Btn size="sm" variant="danger" onClick={e=>{e.stopPropagation();addCollectionAction(r.id,"Letter of Demand","Formal NCA demand issued.",{channel:"Letter"})}}>Demand</Btn>}
          {r.dpd>30&&<Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();setActionModal({loanId:r.id,type:"restructure"})}}>Restructure</Btn>}
          {r.dpd>90&&<Btn size="sm" variant="danger" onClick={e=>{e.stopPropagation();addCollectionAction(r.id,"Legal Handover","Referred to Legal Department for recovery.",{channel:"Legal"})}}>Legal</Btn>}
          {r.dpd>90&&<Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();setActionModal({loanId:r.id,type:"writeoff"})}}>Write-Off</Btn>}
        </div> : <span style={{ fontSize:10, color:C.textMuted }}>View only</span> },
      ]} rows={delinquent.sort((a,b)=>b.dpd-a.dpd)} onRowClick={r=>setDetail({type:"loan",id:r.id})} />}

      {tab==="activity" && <Table columns={[
        { label:"Date", render:r=>fmt.date(r.created) },
        { label:"Loan", key:"loanId" },
        { label:"Borrower", render:r=>cust(r.custId)?.name },
        { label:"Stage", render:r=>statusBadge(r.stage) },
        { label:"Action", render:r=><span style={{ fontWeight:600 }}>{r.action}</span> },
        { label:"Channel", key:"channel" },
        { label:"Officer", key:"officer" },
        { label:"Notes", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:250, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.notes}</span> },
      ]} rows={[...collections].sort((a,b)=>b.created-a.created)} />}

      {tab==="ptp" && <div>
        <Table columns={[
          { label:"Loan", key:"loanId" },
          { label:"Borrower", render:r=>cust(r.custId)?.name },
          { label:"PTP Date", render:r=>fmt.date(r.ptpDate) },
          { label:"PTP Amount", render:r=>fmt.cur(r.ptpAmount) },
          { label:"Status", render:r=>{
            if (!r.ptpDate) return <span style={{ color:C.textMuted }}>—</span>;
            const met = loans.find(l=>l.id===r.loanId)?.payments?.some(p=>p.date>=r.created&&p.amount>=r.ptpAmount);
            return met ? <Badge color="green">Honoured</Badge> : r.ptpDate > Date.now() ? <Badge color="amber">Pending</Badge> : <Badge color="red">Broken</Badge>;
          }},
          { label:"Officer", key:"officer" },
          { label:"Created", render:r=>fmt.date(r.created) },
        ]} rows={ptps.sort((a,b)=>b.created-a.created)} />
      </div>}

      {tab==="writeoff" && <div>
        <Table columns={[
          { label:"Loan", key:"loanId" },
          { label:"Borrower", render:r=>cust(r.custId)?.name },
          { label:"Balance", render:r=>fmt.cur(loans.find(l=>l.id===r.loanId)?.balance||0) },
          { label:"DPD", render:r=>r.dpd },
          { label:"Reason", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.notes}</span> },
          { label:"Proposed By", key:"officer" },
          { label:"Date", render:r=>fmt.date(r.created) },
          { label:"Action", render:r=>{
            const l = loans.find(x=>x.id===r.loanId);
            if (l?.status === "Written Off") return <Badge color="red">Written Off</Badge>;
            return canDo("collections","approve") ? <Btn size="sm" variant="danger" onClick={e=>{e.stopPropagation();approveWriteOff(r.loanId)}}>Approve Write-Off</Btn> : <Badge color="amber">Pending Approval</Badge>;
          }},
        ]} rows={pendingWriteOffs.sort((a,b)=>b.created-a.created)} />
      </div>}

      {/* PTP Modal */}
      <Modal open={actionModal?.type==="ptp"} onClose={()=>setActionModal(null)} title={`Promise-to-Pay — ${actionModal?.loanId}`} width={440}>
        <div style={{ fontSize:12, color:C.textDim, marginBottom:12 }}>Record a payment commitment from the customer.</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="PTP Date"><Input type="date" value={ptpForm.date} onChange={e=>setPtpForm({...ptpForm,date:e.target.value})} /></Field>
          <Field label="PTP Amount (R)"><Input type="number" value={ptpForm.amount} onChange={e=>setPtpForm({...ptpForm,amount:e.target.value})} /></Field>
        </div>
        <Field label="Notes"><Textarea value={ptpForm.notes} onChange={e=>setPtpForm({...ptpForm,notes:e.target.value})} rows={2} placeholder="Context from call..." /></Field>
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <Btn onClick={()=>{if(ptpForm.date&&ptpForm.amount){createPTP(actionModal.loanId,ptpForm.date,ptpForm.amount,ptpForm.notes);setActionModal(null);setPtpForm({date:"",amount:"",notes:""})}}} disabled={!ptpForm.date||!ptpForm.amount}>Record PTP</Btn>
          <Btn variant="ghost" onClick={()=>setActionModal(null)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Restructure Modal */}
      <Modal open={actionModal?.type==="restructure"} onClose={()=>setActionModal(null)} title={`Restructuring Proposal — ${actionModal?.loanId}`} width={480}>
        <div style={{ fontSize:12, color:C.textDim, marginBottom:12 }}>Propose a restructuring plan. Requires Credit Committee or Head of Credit approval.</div>
        <Field label="Restructure Type"><Select value={restructForm.type} onChange={e=>setRestructForm({...restructForm,type:e.target.value})} options={["Term Extension","Payment Holiday","Rate Reduction","Reduced Instalments","Combined"].map(v=>({value:v,label:v}))} /></Field>
        <Field label="Proposal Detail"><Textarea value={restructForm.detail} onChange={e=>setRestructForm({...restructForm,detail:e.target.value})} rows={3} placeholder="e.g. Extend term by 6 months with 3-month reduced payment plan..." /></Field>
        <Field label="Approval Required From"><Select value={restructForm.approver} onChange={e=>setRestructForm({...restructForm,approver:e.target.value})} options={["Collections Manager","Head of Credit","Credit Committee"].map(v=>({value:v,label:v}))} /></Field>
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <Btn onClick={()=>{if(restructForm.detail){proposeRestructure(actionModal.loanId,restructForm);setActionModal(null);setRestructForm({type:"Term Extension",detail:"",approver:"Credit Committee"})}}} disabled={!restructForm.detail}>Submit Proposal</Btn>
          <Btn variant="ghost" onClick={()=>setActionModal(null)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Write-Off Modal */}
      <Modal open={actionModal?.type==="writeoff"} onClose={()=>setActionModal(null)} title={`Write-Off Proposal — ${actionModal?.loanId}`} width={440}>
        <div style={{ fontSize:12, color:C.textDim, marginBottom:12 }}>Propose this loan for write-off. Requires Credit Committee approval.</div>
        <Field label="Reason / Justification"><Textarea value={writeOffReason} onChange={e=>setWriteOffReason(e.target.value)} rows={3} placeholder="e.g. Debtor absconded, no assets, recovery unviable..." /></Field>
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <Btn variant="danger" onClick={()=>{if(writeOffReason){proposeWriteOff(actionModal.loanId,writeOffReason);setActionModal(null);setWriteOffReason("")}}} disabled={!writeOffReason}>Submit Write-Off Proposal</Btn>
          <Btn variant="ghost" onClick={()=>setActionModal(null)}>Cancel</Btn>
        </div>
      </Modal>
    </div>);
  }

  function Provisioning() {
    const totalECL = provisions.reduce((s,p)=>s+p.ecl,0);
    const totalEAD = provisions.reduce((s,p)=>s+p.ead,0);
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>IFRS 9 Impairment & Provisioning</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Expected Credit Loss calculation, staging & forward-looking ECL models</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <KPI label="Total ECL Provision" value={fmt.cur(totalECL)} accent={C.purple} />
        <KPI label="Total EAD" value={fmt.cur(totalEAD)} accent={C.blue} />
        <KPI label="Coverage Ratio" value={fmt.pct(totalECL / totalEAD)} accent={C.amber} />
        <KPI label="Stage 2+3 Exposure" value={fmt.cur(provisions.filter(p=>p.stage>=2).reduce((s,p)=>s+p.ead,0))} accent={C.red} />
      </div>
      <SectionCard title="ECL by Loan">
        <Table columns={[
          { label:"Loan ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.loanId}</span> },
          { label:"Borrower", render:r=>cust(loans.find(l=>l.id===r.loanId)?.custId)?.name },
          { label:"Stage", render:r=><Badge color={r.stage===1?"green":r.stage===2?"amber":"red"}>Stage {r.stage}</Badge> },
          { label:"EAD", render:r=>fmt.cur(r.ead) },
          { label:"PD", render:r=>fmt.pct(r.pd) },
          { label:"LGD", render:r=>fmt.pct(r.lgd,0) },
          { label:"ECL", render:r=><span style={{ fontWeight:700, color:C.purple }}>{fmt.cur(r.ecl)}</span> },
          { label:"Method", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.method}</span> },
        ]} rows={provisions} />
        <div style={{ textAlign:"right", marginTop:14, fontSize:14, fontWeight:700, color:C.text }}>Total ECL: <span style={{ color:C.purple }}>{fmt.cur(totalECL)}</span></div>
      </SectionCard>
      <SectionCard title="IFRS 9 Stage Distribution">
        {[1,2,3].map(s => {
          const sp = provisions.filter(p=>p.stage===s);
          const ead = sp.reduce((sum,p)=>sum+p.ead,0);
          const ecl = sp.reduce((sum,p)=>sum+p.ecl,0);
          const colors = {1:C.green,2:C.amber,3:C.red};
          const labels = {1:"Performing (12-month ECL)",2:"Underperforming (Lifetime ECL)",3:"Credit-impaired (Lifetime ECL)"};
          return (<div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
            <div><Badge color={s===1?"green":s===2?"amber":"red"}>Stage {s}</Badge><span style={{ fontSize:12, color:C.textDim, marginLeft:10 }}>{labels[s]}</span></div>
            <div style={{ textAlign:"right" }}><div style={{ fontSize:14, fontWeight:700, color:C.text }}>EAD: {fmt.cur(ead)}</div><div style={{ fontSize:12, color:colors[s] }}>ECL: {fmt.cur(ecl)}</div></div>
          </div>);
        })}
      </SectionCard>
    </div>);
  }

  function Governance() {
    const [tab, setTab] = useState("audit");
    const categories = [...new Set(audit.map(a=>a.category).filter(Boolean))].sort();
    const users = [...new Set(audit.map(a=>a.user).filter(Boolean))].sort();
    let filteredAudit = [...audit].sort((a,b)=>b.ts-a.ts);
    if (auditFilter.category) filteredAudit = filteredAudit.filter(a=>a.category===auditFilter.category);
    if (auditFilter.user) filteredAudit = filteredAudit.filter(a=>a.user===auditFilter.user);
    if (auditFilter.entity) filteredAudit = filteredAudit.filter(a=>a.entity?.toLowerCase().includes(auditFilter.entity.toLowerCase()));

    const controlPoints = [
      { control:"FICA Verification", module:"Onboarding", status: customers.every(c=>c.ficaStatus==="Verified") ? "All Verified" : `${customers.filter(c=>c.ficaStatus!=="Verified").length} pending`, ok: customers.filter(c=>c.ficaStatus!=="Verified").length === 0 },
      { control:"Approval Authority Limits", module:"Underwriting", status:"Enforced in code", ok:true },
      { control:"Separation of Duties", module:"Underwriting", status:"Creator ≠ Approver enforced", ok:true },
      { control:"Dual Disbursement Auth", module:"Disbursement", status:"Booker ≠ Disburser enforced", ok:true },
      { control:"Sanctions Screening", module:"Origination", status: applications.some(a=>a.sanctionsFlag) ? "HITS DETECTED" : "All clear", ok: !applications.some(a=>a.sanctionsFlag) },
      { control:"BEE Certificate Monitoring", module:"Compliance", status: `${customers.filter(c=>c.beeExpiry&&c.beeExpiry<now+90*day).length} expiring within 90 days`, ok: customers.filter(c=>c.beeExpiry&&c.beeExpiry<now+90*day).length === 0 },
      { control:"RBAC Enforcement", module:"System-wide", status:`${Object.keys(PERMS).length} modules × ${Object.keys(ROLES).length} roles`, ok:true },
      { control:"Immutable Audit Trail", module:"System-wide", status:`${audit.length} entries recorded`, ok:true },
      { control:"NCR Statutory Reporting", module:"Compliance", status: `${(statutoryReports||[]).filter(r=>r.status!=="Submitted").length} pending`, ok: (statutoryReports||[]).filter(r=>r.status!=="Submitted"&&new Date(r.dueDate)<new Date()).length === 0 },
      { control:"IFRS 9 Provisioning", module:"Finance", status: `${provisions.length} loans provisioned. ECL: ${fmt.cur(provisions.reduce((s,p)=>s+p.ecl,0))}`, ok:true },
    ];

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>Governance, Risk & Compliance</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>Audit trail, control points, approval authorities, regulatory compliance & alerts</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Audit Entries" value={audit.length} />
        <KPI label="Controls Active" value={controlPoints.filter(c=>c.ok).length} sub={`of ${controlPoints.length}`} />
        <KPI label="Unread Alerts" value={alerts.filter(a=>!a.read).length} />
        <KPI label="Critical Alerts" value={alerts.filter(a=>a.severity==="critical"&&!a.read).length} />
      </div>
      <Tab tabs={[
        {key:"audit",label:"Audit Trail",count:audit.length},
        {key:"controls",label:"Control Points",count:controlPoints.length},
        {key:"authority",label:"Approval Matrix"},
        {key:"regulatory",label:"Regulatory Framework"},
        {key:"alerts",label:"All Alerts",count:alerts.length},
      ]} active={tab} onChange={setTab} />

      {tab==="audit" && <div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <select value={auditFilter.category} onChange={e=>setAuditFilter({...auditFilter,category:e.target.value})} style={{ padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit" }}>
            <option value="">All Categories</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={auditFilter.user} onChange={e=>setAuditFilter({...auditFilter,user:e.target.value})} style={{ padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit" }}>
            <option value="">All Users</option>
            {users.map(u=><option key={u} value={u}>{u}</option>)}
          </select>
          <input value={auditFilter.entity} onChange={e=>setAuditFilter({...auditFilter,entity:e.target.value})} placeholder="Filter by entity ID..." style={{ padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", width:160 }} />
          {(auditFilter.category||auditFilter.user||auditFilter.entity) && <Btn size="sm" variant="ghost" onClick={()=>setAuditFilter({category:"",user:"",entity:""})}>Clear</Btn>}
          <span style={{ fontSize:10, color:C.textMuted, alignSelf:"center" }}>{filteredAudit.length} of {audit.length} entries</span>
        </div>
        <Table columns={[
          { label:"Timestamp", render:r=>fmt.dateTime(r.ts) },
          { label:"Category", render:r=><Badge color={r.category==="Risk"||r.category==="Collections"?"red":r.category==="Compliance"?"amber":r.category==="Decision"?"purple":"cyan"}>{r.category}</Badge> },
          { label:"Action", render:r=><span style={{ fontWeight:600 }}>{r.action}</span> },
          { label:"Entity", render:r=><span style={{ fontFamily:"monospace", fontSize:11 }}>{r.entity}</span> },
          { label:"User", key:"user" },
          { label:"Detail", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.detail}</span> },
        ]} rows={filteredAudit.slice(0,50)} />
        {filteredAudit.length > 50 && <div style={{ fontSize:11, color:C.textMuted, marginTop:8 }}>Showing 50 of {filteredAudit.length} entries. Use filters to narrow.</div>}
      </div>}

      {tab==="controls" && <div>
        <Table columns={[
          { label:"Control", render:r=><span style={{ fontWeight:600 }}>{r.control}</span> },
          { label:"Module", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.module}</span> },
          { label:"Status", render:r=><span style={{ fontSize:12, color:r.ok?C.green:C.red, fontWeight:500 }}>{r.status}</span> },
          { label:"Health", render:r=>r.ok ? <Badge color="green">OK</Badge> : <Badge color="red">Attention</Badge> },
        ]} rows={controlPoints} />
      </div>}

      {tab==="authority" && <SectionCard title="Credit Approval Authority Matrix (Live)">
        <Table columns={[
          { label:"Role", render:r=><span style={{ fontWeight:500 }}>{ROLES[r.role]?.label}</span> },
          { label:"Approval Limit", render:r=>r.limit===Infinity ? "Unlimited" : r.limit > 0 ? fmt.cur(r.limit) : <span style={{ color:C.textMuted }}>No approval authority</span> },
          { label:"Current Users", render:r=>SYSTEM_USERS.filter(u=>u.role===r.role).map(u=>u.name).join(", ") || <span style={{ color:C.textMuted }}>—</span> },
          { label:"Tier", render:r=>ROLES[r.role]?.tier },
        ]} rows={Object.keys(ROLES).map(k=>({role:k,limit:APPROVAL_LIMITS[k]||0}))} />
      </SectionCard>}

      {tab==="regulatory" && <div>
        <SectionCard title="Regulatory Status">
          <InfoGrid items={[
            ["NCR Registration", settings?.ncrReg],
            ["NCR Expiry", settings?.ncrExpiry],
            ["FICA Compliance", customers.every(c=>c.ficaStatus==="Verified") ? "Fully Compliant" : `${customers.filter(c=>c.ficaStatus!=="Verified").length} customers pending`],
            ["POPIA Compliance", "Active"],
            ["NCA Registration", "Active – Section 40"],
            ["BEE Monitoring", `${customers.filter(c=>c.beeStatus==="Verified").length}/${customers.length} verified`],
            ["Last NCR Submission", (statutoryReports||[]).filter(r=>r.status==="Submitted").sort((a,b)=>new Date(b.submittedDate||0)-new Date(a.submittedDate||0))[0]?.name || "—"],
          ]} />
        </SectionCard>
        <SectionCard title="Regulatory Framework">
          {[
            ["National Credit Act (NCA) 34 of 2005","Governs credit agreements, affordability assessments, consumer protection. Enforced: affordability checks in underwriting, NCA demand letters in collections."],
            ["Financial Intelligence Centre Act (FICA) 38 of 2001","KYC/CDD, suspicious transaction reporting. Enforced: FICA status workflow on customers, sanctions screening on applications."],
            ["Protection of Personal Information Act (POPIA) 4 of 2013","Data privacy, consent. Enforced: data access via RBAC, audit trail on all data changes."],
            ["Companies Act 71 of 2008","Corporate governance, director responsibilities. Enforced: approval authority matrix, separation of duties."],
            ["BB-BEE Act 53 of 2003","Empowerment verification. Enforced: BEE verification workflow, eligibility checks in product selection."],
            ["Debt Collectors Act 114 of 1998","Collection conduct standards. Enforced: staged collections, NCA-compliant demand process."],
          ].map(([name, desc], i) => (
            <div key={i} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.accent }}>{name}</div>
              <div style={{ fontSize:12, color:C.textDim, marginTop:2 }}>{desc}</div>
            </div>
          ))}
        </SectionCard>
      </div>}

      {tab==="alerts" && <div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <span style={{ fontSize:11, color:C.textMuted }}>{alerts.filter(a=>!a.read).length} unread of {alerts.length} total</span>
          {canDo("governance","update") && alerts.some(a=>!a.read) && <Btn size="sm" variant="ghost" onClick={()=>save({...data,alerts:alerts.map(a=>({...a,read:true}))})}>Mark All Read</Btn>}
        </div>
        <Table columns={[
          { label:"Date", render:r=>fmt.dateTime(r.ts) },
          { label:"Severity", render:r=><Badge color={r.severity==="critical"?"red":r.severity==="warning"?"amber":"blue"}>{r.severity}</Badge> },
          { label:"Type", render:r=><Badge color="cyan">{r.type}</Badge> },
          { label:"Title", render:r=><span style={{ fontWeight:600 }}>{r.title}</span> },
          { label:"Message", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.msg}</span> },
          { label:"Status", render:r=>r.read?<Badge color="slate">Read</Badge>:<Badge color="amber">Unread</Badge> },
          { label:"", render:r=>!r.read && canDo("governance","update") ? <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();markRead(r.id)}}>Dismiss</Btn> : null },
        ]} rows={[...alerts].sort((a,b)=>b.ts-a.ts)} />
      </div>}
    </div>);
  }

  const updateStatutoryStatus = (reportId, newStatus) => {
    const updated = (statutoryReports||[]).map(r => r.id === reportId ? { ...r, status: newStatus, ...(newStatus === "Submitted" ? { submittedDate: new Date().toISOString().split("T")[0] } : {}) } : r);
    save({ ...data, statutoryReports: updated, audit: [...audit, addAudit("Statutory Report Updated", reportId, "Compliance Officer", `Status changed to "${newStatus}".`, "Compliance")] });
  };

  function StatutoryReporting() {
    const reports = statutoryReports || [];
    const [tab, setTab] = useState("upcoming");
    const today = new Date();
    const upcoming = reports.filter(r => r.status !== "Submitted").sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    const submitted = reports.filter(r => r.status === "Submitted");
    const daysUntil = d => { const diff = Math.ceil((new Date(d) - today) / 864e5); return diff; };

    const urgencyColor = days => days < 0 ? C.red : days <= 30 ? C.red : days <= 60 ? C.amber : C.textDim;
    const urgencyBadge = days => days < 0 ? <span style={{ fontSize:11, fontWeight:600, color:C.red }}>OVERDUE ({Math.abs(days)}d)</span> : days <= 14 ? <span style={{ fontSize:11, fontWeight:600, color:C.red }}>{days}d – Urgent</span> : days <= 30 ? <span style={{ fontSize:11, fontWeight:600, color:C.red }}>{days} days</span> : days <= 60 ? <span style={{ fontSize:11, fontWeight:500, color:C.amber }}>{days} days</span> : <span style={{ fontSize:11, color:C.textDim }}>{days} days</span>;

    const totalDisbursedAmt = loans.reduce((s,l)=>s+l.amount,0);
    const form39Frequency = totalDisbursedAmt > 15000000 ? "Quarterly" : "Annual";

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>NCR Statutory Reporting</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Regulatory reporting calendar, deadlines & submission tracking — NCRCP22396</p>

      {/* Critical deadline banner */}
      {upcoming.length > 0 && (() => {
        const next = upcoming[0];
        const days = daysUntil(next.dueDate);
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap:16 }}>
            <div style={{ flexShrink: 0 }}>{I.warning}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Next Deadline: {next.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Due: {fmt.date(new Date(next.dueDate))} · Period: {next.period} · Submit to: {next.submitTo}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: urgencyColor(days), lineHeight: 1 }}>{days < 0 ? "OVERDUE" : days}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{days < 0 ? `${Math.abs(days)} days overdue` : "days remaining"}</div>
            </div>
          </div>
        );
      })()}

      {/* KPI row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <KPI label="Pending Reports" value={upcoming.length} accent={C.amber} sub={`${upcoming.filter(r => daysUntil(r.dueDate) <= 60).length} due within 60 days`} />
        <KPI label="Submitted" value={submitted.length} accent={C.green} />
        <KPI label="Form 39 Frequency" value={form39Frequency} sub={`Disbursements: ${fmt.cur(totalDisbursedAmt)} ${totalDisbursedAmt > 15000000 ? "(> R15M)" : "(< R15M)"}`} accent={C.blue} />
        <KPI label="Year-End" value={settings?.yearEnd || "28 Feb 2026"} sub={`Annual reports due: ${settings?.annualDueDate || "31 Aug 2026"}`} accent={C.purple} />
      </div>

      <Tab tabs={[
        { key: "upcoming", label: "Upcoming Deadlines", count: upcoming.length },
        { key: "calendar", label: "Full Calendar" },
        { key: "submitted", label: "Submitted", count: submitted.length },
        { key: "guide", label: "Submission Guide" },
      ]} active={tab} onChange={setTab} />

      {tab === "upcoming" && (<div>
        {upcoming.map(r => {
          const days = daysUntil(r.dueDate);
          return (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom:12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.name}</span>
                    <Badge color={r.type === "Form 39" ? "blue" : "purple"}>{r.type}</Badge>
                    {statusBadge(r.status)}
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim }}>Period: {r.period} · Submit to: <span style={{ color: C.accent, fontWeight: 600 }}>{r.submitTo}</span></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {urgencyBadge(days)}
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Due: {fmt.date(new Date(r.dueDate))}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom:12, lineHeight: 1.5 }}>{r.notes}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {r.status === "Not Started" && canDo("statutory","update") && <Btn size="sm" variant="secondary" onClick={() => updateStatutoryStatus(r.id, "In Progress")}>Start Preparation</Btn>}
                {r.status === "In Progress" && canDo("statutory","update") && <Btn size="sm" variant="secondary" onClick={() => updateStatutoryStatus(r.id, "Under Review")}>Submit for Review</Btn>}
                {r.status === "Under Review" && canDo("statutory","update") && <Btn size="sm" onClick={() => updateStatutoryStatus(r.id, "Submitted")}>Mark as Submitted</Btn>}
                {!canDo("statutory","update") && <span style={{ fontSize:10, color:C.textMuted }}>View only</span>}
                {r.preparer && <span style={{ fontSize: 11, color: C.textMuted }}>Preparer: {r.preparer}</span>}
                {r.reviewer && <span style={{ fontSize: 11, color: C.textMuted }}>Reviewer: {r.reviewer}</span>}
              </div>
              {/* Countdown bar */}
              <div style={{ marginTop: 10 }}>
                <ProgressBar value={Math.max(0, 100 - Math.max(0, days) / 1.8)} color={urgencyColor(days)} height={4} />
              </div>
            </div>
          );
        })}
      </div>)}

      {tab === "calendar" && (<div>
        <SectionCard title="Annual Statutory Reports (Due within 6 months of year-end)">
          <div style={{ fontSize: 12, color: C.textDim, marginBottom:16, lineHeight: 1.6, padding: "10px 14px", background: C.surface2 }}>
            Credit providers registered under the NCA must submit the following reports to the NCR within <span style={{ fontWeight: 600, color: C.text }}>6 months</span> of their financial year-end. Year-end: <span style={{ fontWeight: 600, color: C.text }}>{settings?.yearEnd}</span> → Deadline: <span style={{ fontWeight: 600, color: C.red }}>{settings?.annualDueDate}</span>
          </div>
          <Table columns={[
            { label: "Report", render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
            { label: "Period", key: "period" },
            { label: "Due Date", render: r => <span style={{ fontWeight: 700, color: urgencyColor(daysUntil(r.dueDate)) }}>{fmt.date(new Date(r.dueDate))}</span> },
            { label: "Days Left", render: r => urgencyBadge(daysUntil(r.dueDate)) },
            { label: "Submit To", render: r => <span style={{ fontSize: 11, color: C.accent }}>{r.submitTo}</span> },
            { label: "Status", render: r => statusBadge(r.status) },
          ]} rows={reports.filter(r => r.type === "Annual" && r.status !== "Submitted")} />
        </SectionCard>

        <SectionCard title="Form 39 – Statistical Returns (Quarterly)">
          <div style={{ fontSize: 12, color: C.textDim, marginBottom:16, lineHeight: 1.6, padding: "10px 14px", background: C.surface2 }}>
            Annual disbursements: <span style={{ fontWeight: 700, color: C.text }}>{fmt.cur(totalDisbursedAmt)}</span> — {totalDisbursedAmt > 15000000
              ? <span style={{ color: C.red, fontWeight: 700 }}>Exceeds R15 million → Form 39 must be submitted QUARTERLY</span>
              : <span style={{ color: C.green, fontWeight: 700 }}>Below R15 million → Form 39 submitted annually (1 Jan – 31 Dec)</span>
            }
          </div>
          <Table columns={[
            { label: "Quarter", render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
            { label: "Period", key: "period" },
            { label: "Due Date", render: r => <span style={{ fontWeight: 700, color: urgencyColor(daysUntil(r.dueDate)) }}>{fmt.date(new Date(r.dueDate))}</span> },
            { label: "Days Left", render: r => urgencyBadge(daysUntil(r.dueDate)) },
            { label: "Status", render: r => statusBadge(r.status) },
          ]} rows={reports.filter(r => r.type === "Form 39")} />

          <div style={{ marginTop: 16, padding: "12px 14px", background: C.surface2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Form 39 Quarterly Schedule</div>
            <table style={{ width: "100%", fontSize: 12, color: C.textDim, borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Quarter</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Reporting Period</th>
                <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600, color: C.textMuted, fontSize: 10, textTransform: "uppercase" }}>Due Date</th>
              </tr></thead>
              <tbody>
                {[["Q1","1 January – 31 March","15 May"],["Q2","1 April – 30 June","15 August"],["Q3","1 July – 30 September","15 November"],["Q4","1 October – 31 December","15 February (following year)"]].map(([q,p,d],i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: C.accent }}>{q}</td>
                    <td style={{ padding: "8px 10px" }}>{p}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: C.amber }}>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>)}

      {tab === "submitted" && (
        <Table columns={[
          { label: "Report", render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
          { label: "Type", render: r => <Badge color={r.type === "Form 39" ? "blue" : "purple"}>{r.type}</Badge> },
          { label: "Period", key: "period" },
          { label: "Due Date", render: r => fmt.date(new Date(r.dueDate)) },
          { label: "Submitted", render: r => <span style={{ fontWeight: 600, color: C.green }}>{fmt.date(new Date(r.submittedDate))}</span> },
          { label: "Submit To", render: r => <span style={{ fontSize: 11, color: C.accent }}>{r.submitTo}</span> },
          { label: "Status", render: () => <Badge color="green">Submitted</Badge> },
        ]} rows={submitted} />
      )}

      {tab === "guide" && (<div>
        <SectionCard title="NCR Submission Requirements">
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.8 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom:8 }}>Annual Statutory Reports</div>
              <div>Registered credit providers must submit the following within <span style={{ fontWeight: 700, color: C.amber }}>6 months of their financial year-end</span>:</div>
              <div style={{ padding: "10px 0 10px 16px" }}>
                {["Annual Compliance Report", "Annual Financial Statements (must include auditor's report)", "Annual Financial & Operational Return", "Assurance Engagement Report"].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ color: C.accent }}>{I.check}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom:8 }}>Form 39 – Statistical Returns</div>
              <div style={{ padding: "8px 12px", background: C.surface2, border: `1px solid ${C.border}`, marginBottom:12 }}>
                <span style={{ fontWeight: 700 }}>Current annual disbursements: {fmt.cur(totalDisbursedAmt)}</span> — {totalDisbursedAmt > 15000000
                  ? <span style={{ color: C.red, fontWeight: 700 }}>Exceeds R15 million → Quarterly submission required</span>
                  : <span style={{ color: C.green, fontWeight: 700 }}>Below R15 million → Annual submission (1 Jan – 31 Dec)</span>
                }
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom:8 }}>Submission Channels</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap:12 }}>
                {[
                  ["Annual Statutory Reports", "submissions@ncr.org.za", C.purple],
                  ["Form 39 Statistical Returns", "returns@ncr.org.za", C.blue],
                  ["Hand Delivery", settings?.ncrAddress, C.amber],
                  ["Courier / Post", settings?.ncrPO, C.green],
                ].map(([label, value, color], i) => (
                  <div key={i} style={{ background: C.surface2, padding: "8px 12px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginTop: 3, wordBreak: "break-all" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom:8 }}>Company Details</div>
              <InfoGrid items={[
                ["Registered Name", settings?.companyName],
                ["NCR Registration", settings?.ncrReg],
                ["Registration Expiry", settings?.ncrExpiry],
                ["Branch", settings?.branch],
                ["Financial Year-End", settings?.yearEnd || "28 February"],
                ["Annual Reports Deadline", settings?.annualDueDate || "31 August"],
              ]} />
            </div>
          </div>
        </SectionCard>
      </div>)}
    </div>);
  }

  function Documents() {
    const docs = documents || [];
    const [tab, setTab] = useState("all");
    const [catFilter, setCatFilter] = useState("All");
    const categories = ["All", "KYC", "KYB", "Financial", "Legal", "Collateral", "Compliance", "Collections"];
    const filtered = docs
      .filter(d => tab === "all" ? true : tab === "pending" ? ["Pending","Received","Under Review"].includes(d.status) : tab === "expiring" ? (d.expiryDate && d.expiryDate < now + 90*day) : tab === "verified" ? d.status === "Verified" : true)
      .filter(d => catFilter === "All" || d.category === catFilter)
      .filter(d => !search || [d.name, d.custId, d.type, cust(d.custId)?.name].some(f => f?.toLowerCase().includes(search.toLowerCase())));
    const pending = docs.filter(d => ["Pending","Received","Under Review"].includes(d.status));
    const expiring = docs.filter(d => d.expiryDate && d.expiryDate < now + 90*day && d.status === "Verified");
    const verified = docs.filter(d => d.status === "Verified");

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>Document Management</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>Centralised document registry — KYC/KYB, financial, legal, collateral & compliance</p>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Total Documents" value={docs.length} />
        <KPI label="Verified" value={verified.length} sub={`${Math.round(verified.length/docs.length*100)}% complete`} />
        <KPI label="Pending Action" value={pending.length} sub={pending.length > 0 ? `${pending.filter(d=>d.status==="Pending").length} outstanding` : "All received"} />
        <KPI label="Expiring (90d)" value={expiring.length} sub={expiring.length > 0 ? `Earliest: ${Math.ceil((Math.min(...expiring.map(d=>d.expiryDate)) - now) / day)}d` : "None"} />
      </div>

      <Tab tabs={[
        { key:"all", label:"All Documents", count:docs.length },
        { key:"pending", label:"Pending Action", count:pending.length },
        { key:"expiring", label:"Expiring Soon", count:expiring.length },
        { key:"verified", label:"Verified", count:verified.length },
      ]} active={tab} onChange={setTab} />

      {/* Category filter */}
      <div style={{ display:"flex", gap:0, marginBottom:16, borderBottom:`1px solid ${C.border}` }}>
        {categories.map(c => (
          <button key={c} onClick={()=>setCatFilter(c)} style={{ padding:"4px 12px", border:"none", borderBottom: catFilter===c?`2px solid ${C.textDim}`:"2px solid transparent", background:"transparent", color:catFilter===c?C.text:C.textMuted, fontSize:11, fontWeight:catFilter===c?600:400, cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }}>{c}</button>
        ))}
      </div>

      <Table columns={[
        { label:"Doc ID", render:r=><span style={{ fontFamily:"monospace", fontSize:11 }}>{r.id}</span> },
        { label:"Document Name", render:r=><span style={{ fontWeight:500 }}>{r.name}</span> },
        { label:"Category", render:r=><span style={{ fontSize:11 }}>{r.category}</span> },
        { label:"Type", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.type}</span> },
        { label:"Customer", render:r=><span style={{ fontSize:12 }}>{cust(r.custId)?.name}</span> },
        { label:"Linked To", render:r=><span style={{ fontFamily:"monospace", fontSize:10, color:C.textDim }}>{[r.appId, r.loanId].filter(Boolean).join(" / ") || "—"}</span> },
        { label:"Status", render:r=>statusBadge(r.status) },
        { label:"Uploaded", render:r=>r.uploadedAt ? fmt.date(r.uploadedAt) : "—" },
        { label:"Verified By", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.verifiedBy || "—"}</span> },
        { label:"Expiry", render:r=>{
          if (!r.expiryDate) return <span style={{ color:C.textMuted, fontSize:11 }}>N/A</span>;
          const d = Math.ceil((r.expiryDate - now) / day);
          return <span style={{ fontSize:11, fontWeight:d<=30?600:400, color:d<=30?C.red:d<=90?C.amber:C.textDim }}>{fmt.date(r.expiryDate)} ({d}d)</span>;
        }},
        { label:"Req", render:r=>r.required ? <span style={{ fontSize:10, fontWeight:500 }}>Yes</span> : <span style={{ fontSize:10, color:C.textMuted }}>No</span> },
      ]} rows={filtered} />

      {/* Document checklist by customer */}
      {tab === "pending" && pending.length > 0 && (
        <div style={{ marginTop:20 }}>
          <SectionCard title="Outstanding Documents by Customer">
            {Object.entries(pending.reduce((acc, d) => { const n = cust(d.custId)?.name || d.custId; (acc[n] = acc[n] || []).push(d); return acc; }, {})).map(([name, docs], i) => (
              <div key={i} style={{ marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:8 }}>{name}</div>
                {docs.map((d, j) => (
                  <div key={j} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:C.textDim, width:60, fontSize:10 }}>{d.category}</span>
                      <span>{d.name}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {statusBadge(d.status)}
                      {d.notes && <span style={{ fontSize:10, color:C.textMuted, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"inline-block" }}>{d.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* Expiry schedule */}
      {tab === "expiring" && expiring.length > 0 && (
        <div style={{ marginTop:20 }}>
          <SectionCard title="Document Expiry Schedule">
            {expiring.sort((a,b)=>a.expiryDate-b.expiryDate).map((d, i) => {
              const daysLeft = Math.ceil((d.expiryDate - now) / day);
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:500, color:C.text }}>{d.name}</div>
                    <div style={{ fontSize:11, color:C.textMuted }}>{cust(d.custId)?.name} · {d.type}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12, fontWeight:600, color:daysLeft<=30?C.red:C.amber }}>{daysLeft} days</div>
                    <div style={{ fontSize:10, color:C.textMuted }}>Expires {fmt.date(d.expiryDate)}</div>
                  </div>
                </div>
              );
            })}
          </SectionCard>
        </div>
      )}
    </div>);
  }

  function Reports() {
    const activeLoans = loans.filter(l=>l.status==="Active");
    const totalBook = activeLoans.reduce((s,l)=>s+l.balance,0);
    const totalECL = provisions.reduce((s,p)=>s+p.ecl,0);
    const allPmts = loans.flatMap(l=>l.payments.map(p=>({...p,loanId:l.id})));
    const delinquent = activeLoans.filter(l=>l.dpd>0);

    const exportCSV = (title, headers, rows) => {
      const csv = [headers.join(","), ...rows.map(r=>r.map(c=>`"${String(c||"").replace(/"/g,'""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], {type:"text/csv"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href=url; a.download=`${title.replace(/\s+/g,"_")}_${new Date().toISOString().split("T")[0]}.csv`; a.click();
      URL.revokeObjectURL(url);
    };

    return (<div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
        <div><h2 style={{ margin:0, fontSize:24, fontWeight:700, color:C.text }}>Reports & Analytics</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>Portfolio performance, risk analysis, collections, servicing & impact reporting</p></div>
        {canDo("reports","export") && <div style={{ display:"flex", gap:8 }}>
          <Btn size="sm" variant="secondary" onClick={()=>exportCSV("Portfolio_Report",["Loan ID","Borrower","Amount","Balance","Rate","DPD","Stage","Status"],loans.map(l=>[l.id,cust(l.custId)?.name,l.amount,l.balance,l.rate,l.dpd,l.stage,l.status]))}>Export Portfolio</Btn>
          <Btn size="sm" variant="secondary" onClick={()=>exportCSV("Audit_Trail",["Timestamp","Category","Action","Entity","User","Detail"],audit.map(a=>[fmt.dateTime(a.ts),a.category,a.action,a.entity,a.user,a.detail]))}>Export Audit</Btn>
        </div>}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <SectionCard title="Portfolio Summary">
          {[["Total Loan Book",fmt.cur(totalBook)],["Active Loans",activeLoans.length],["Booked (Awaiting Disbursement)",loans.filter(l=>l.status==="Booked").length],["Settled",loans.filter(l=>l.status==="Settled").length],["Written Off",loans.filter(l=>l.status==="Written Off").length],["Total Disbursed",fmt.cur(loans.reduce((s,l)=>s+l.amount,0))],["Weighted Avg Rate",`${activeLoans.length?(activeLoans.reduce((s,l)=>s+l.rate,0)/activeLoans.length).toFixed(1):0}%`],["Total ECL",fmt.cur(totalECL)],["ECL Coverage",totalBook>0?fmt.pct(totalECL/totalBook):"0%"]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:13, fontWeight:700, color:C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Concentration by Industry">
          {Object.entries(activeLoans.reduce((acc, l) => { const ind = cust(l.custId)?.industry || "Unknown"; acc[ind] = (acc[ind]||0) + l.balance; return acc; }, {})).sort((a,b)=>b[1]-a[1]).map(([ind, bal], i) => (
            <div key={i} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.textDim, marginBottom:3 }}><span>{ind}</span><span>{fmt.cur(bal)} ({totalBook>0?fmt.pct(bal/totalBook,0):"0%"})</span></div>
              <ProgressBar value={bal} max={totalBook||1} color={C.accent} />
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Collections Summary">
          {[["Delinquent Accounts",delinquent.length],["Total Arrears",fmt.cur(delinquent.reduce((s,l)=>s+l.balance,0))],["Early (1-30 DPD)",delinquent.filter(l=>l.dpd<=30).length],["Mid (31-90 DPD)",delinquent.filter(l=>l.dpd>30&&l.dpd<=90).length],["Late (91+ DPD)",delinquent.filter(l=>l.dpd>90).length],["Collection Actions (Total)",collections.length],["Active PTPs",collections.filter(c=>c.ptpDate&&c.ptpDate>Date.now()).length],["Write-Off Proposals",collections.filter(c=>c.writeOff).length]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:13, fontWeight:700, color:typeof v==="number"&&v>0?C.red:C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Servicing Summary">
          {[["Payments Processed",allPmts.length],["Total Collected",fmt.cur(allPmts.reduce((s,p)=>s+p.amount,0))],["Interest Collected",fmt.cur(allPmts.reduce((s,p)=>s+(p.interest||0),0))],["Principal Collected",fmt.cur(allPmts.reduce((s,p)=>s+(p.principal||0),0))],["Monthly Receivable",fmt.cur(activeLoans.reduce((s,l)=>s+l.monthlyPmt,0))],["Overdue Accounts",delinquent.length]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:13, fontWeight:700, color:C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Application Outcomes">
          {["Approved","Declined","Submitted","Underwriting","Booked","Withdrawn"].map(s => {
            const count = applications.filter(a => a.status === s).length;
            if (count === 0) return null;
            return (<div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              {statusBadge(s)}<div><span style={{ fontSize:16, fontWeight:700, color:C.text }}>{count}</span><span style={{ fontSize:11, color:C.textMuted, marginLeft:8 }}>({applications.length>0?fmt.pct(count/applications.length,0):"0%"})</span></div>
            </div>);
          })}
        </SectionCard>
        <SectionCard title="Development Impact">
          {[["Total Jobs Supported",fmt.num(customers.reduce((s,c)=>s+c.employees,0))],["BEE Level 1 Clients",customers.filter(c=>c.beeLevel===1).length],["BEE Level 1-2 Exposure",fmt.cur(activeLoans.filter(l=>cust(l.custId)?.beeLevel<=2).reduce((s,l)=>s+l.balance,0))],["Women-Owned (>50%)",customers.filter(c=>(c.womenOwned||0)>50).length],["Youth-Owned (>50%)",customers.filter(c=>(c.youthOwned||0)>50).length],["Disability-Owned (>50%)",customers.filter(c=>(c.disabilityOwned||0)>50).length],["Avg Social Impact Score",applications.filter(a=>a.socialScore).length>0?Math.round(applications.filter(a=>a.socialScore).reduce((s,a)=>s+a.socialScore,0)/applications.filter(a=>a.socialScore).length):"—"],["Provinces Covered",new Set(customers.map(c=>c.province)).size],["Industries Covered",new Set(customers.map(c=>c.industry)).size]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:13, fontWeight:700, color:C.accent }}>{v}</span>
            </div>
          ))}
        </SectionCard>
      </div>
    </div>);
  }

  function Comms() {
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>Communication Center</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Omnichannel communication log — Phone, Email, SMS, Letters, Meetings</p>
      <Table columns={[
        { label:"Date", render:r=>fmt.dateTime(r.ts) },
        { label:"Customer", render:r=>cust(r.custId)?.name },
        { label:"Channel", render:r=><Badge color={r.channel==="Phone"?"blue":r.channel==="Email"?"cyan":r.channel==="Letter"?"amber":r.channel==="In-Person"?"green":"slate"}>{r.channel||"—"}</Badge> },
        { label:"Direction", render:r=><Badge color={r.direction==="Inbound"?"purple":"slate"}>{r.direction}</Badge> },
        { label:"Subject", render:r=><span style={{ fontWeight:600 }}>{r.subject}</span> },
        { label:"From/By", key:"from" },
        { label:"Summary", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:250, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.body}</span> },
      ]} rows={[...comms].sort((a,b)=>b.ts-a.ts)} />
    </div>);
  }

  function renderDetail() {
    const goBack = () => setDetail(null);
    const BackBtn = () => <button onClick={goBack} style={{ background:"none", border:"none", color:C.accent, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:16, display:"flex", alignItems:"center", gap:4, fontFamily:"inherit" }}>{I.back} Back</button>;

    if (detail.type === "customer") {
      const c = customers.find(x=>x.id===detail.id); if (!c) return <div>Not found</div>;
      const ca = applications.filter(a=>a.custId===c.id);
      const cl = loans.filter(l=>l.custId===c.id);
      const custDocs = (documents||[]).filter(d=>d.custId===c.id);

      const ficaActions = {
        "Pending": [{ label:"Start KYC Review", target:"Under Review" }],
        "Under Review": [{ label:"Verify (FICA Pass)", target:"Verified" }, { label:"Fail", target:"Failed" }],
        "Failed": [{ label:"Re-submit for Review", target:"Under Review" }],
        "Verified": [{ label:"Mark Expired", target:"Expired" }],
        "Expired": [{ label:"Re-submit for Review", target:"Under Review" }],
      };

      return (<div><BackBtn />
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
          <div style={{ width:40, height:40, borderRadius:2, background:C.surface2, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.textDim, fontSize:16, fontWeight:600 }}>{c.name.charAt(0)}</div>
          <div><h2 style={{ margin:0, fontSize:24, fontWeight:700, color:C.text }}>{c.name}</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.textMuted }}>{c.id} · {c.industry} · {c.province}</p></div>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>{statusBadge(c.ficaStatus)}<Badge color="purple">BEE Level {c.beeLevel}</Badge><Badge color={c.riskCategory==="Low"?"green":c.riskCategory==="Medium"?"amber":"red"}>{c.riskCategory} Risk</Badge></div>
        </div>

        {/* Profile — read or edit */}
        <SectionCard title="Customer Profile" actions={canDo("customers","update") && !detailEditing ? <Btn size="sm" variant="ghost" onClick={()=>{setDetailForm({...c});setDetailEditing(true)}}>Edit</Btn> : null}>
          {!detailEditing ? (
            <InfoGrid items={[["Contact",c.contact],["Email",c.email],["Phone",c.phone],["ID Number",c.idNum],["Reg Number",c.regNum],["Address",c.address],["Annual Revenue",fmt.cur(c.revenue)],["Employees",c.employees],["Years in Business",c.years],["Sector",c.sector],["BEE Expiry",fmt.date(c.beeExpiry)],["Women Ownership",(c.womenOwned||0)+"%"],["Youth Ownership",(c.youthOwned||0)+"%"],["Disability Ownership",(c.disabilityOwned||0)+"%"],["FICA Date",fmt.date(c.ficaDate)],["Created",fmt.date(c.created)]]} />
          ) : (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Business Name"><Input value={detailForm.name} onChange={e=>setDetailForm({...detailForm,name:e.target.value})} /></Field>
                <Field label="Contact"><Input value={detailForm.contact} onChange={e=>setDetailForm({...detailForm,contact:e.target.value})} /></Field>
                <Field label="Email"><Input value={detailForm.email} onChange={e=>setDetailForm({...detailForm,email:e.target.value})} /></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Phone"><Input value={detailForm.phone} onChange={e=>setDetailForm({...detailForm,phone:e.target.value})} /></Field>
                <Field label="Industry"><Select value={detailForm.industry} onChange={e=>setDetailForm({...detailForm,industry:e.target.value})} options={["Retail","Agriculture","Technology","Construction","Food Processing","Transport","Manufacturing","Professional Services","Other"].map(v=>({value:v,label:v}))} /></Field>
                <Field label="Revenue"><Input type="number" value={detailForm.revenue} onChange={e=>setDetailForm({...detailForm,revenue:+e.target.value})} /></Field>
                <Field label="Employees"><Input type="number" value={detailForm.employees} onChange={e=>setDetailForm({...detailForm,employees:+e.target.value})} /></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Address"><Input value={detailForm.address} onChange={e=>setDetailForm({...detailForm,address:e.target.value})} /></Field>
                <Field label="Province"><Select value={detailForm.province} onChange={e=>setDetailForm({...detailForm,province:e.target.value})} options={["Eastern Cape","Western Cape","Gauteng","KwaZulu-Natal","Free State","North West","Limpopo","Mpumalanga","Northern Cape"].map(v=>({value:v,label:v}))} /></Field>
                <Field label="Risk Category"><Select value={detailForm.riskCategory} onChange={e=>setDetailForm({...detailForm,riskCategory:e.target.value})} options={["Low","Medium","High"].map(v=>({value:v,label:v}))} /></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Women Ownership %"><Input type="number" min="0" max="100" value={detailForm.womenOwned||0} onChange={e=>setDetailForm({...detailForm,womenOwned:+e.target.value})} /></Field>
                <Field label="Youth Ownership %"><Input type="number" min="0" max="100" value={detailForm.youthOwned||0} onChange={e=>setDetailForm({...detailForm,youthOwned:+e.target.value})} /></Field>
                <Field label="Disability Ownership %"><Input type="number" min="0" max="100" value={detailForm.disabilityOwned||0} onChange={e=>setDetailForm({...detailForm,disabilityOwned:+e.target.value})} /></Field>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={()=>{updateCustomer(c.id,detailForm);setDetailEditing(false)}}>Save Changes</Btn>
                <Btn variant="ghost" onClick={()=>setDetailEditing(false)}>Cancel</Btn>
              </div>
            </div>
          )}
        </SectionCard>

        {/* FICA / KYC Status & Workflow */}
        <SectionCard title="FICA / KYC Verification">
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:C.text }}>Status: {c.ficaStatus}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{c.ficaDate ? `Verified: ${fmt.date(c.ficaDate)}` : "Not yet verified"}</div>
            </div>
            <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
              {canDoAny("customers",["update"]) && (ficaActions[c.ficaStatus]||[]).map((a,i) => (
                <Btn key={i} size="sm" variant={a.target==="Verified"?"default":a.target==="Failed"?"danger":"secondary"} onClick={()=>updateFicaStatus(c.id, a.target)}>{a.label}</Btn>
              ))}
            </div>
          </div>
          <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.6 }}>
            FICA verification flow: Pending → Under Review → Verified / Failed. Verified status can expire. Failed can be re-submitted. All transitions are audited.
          </div>
        </SectionCard>

        {/* BEE Verification */}
        <SectionCard title="BEE Verification">
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:C.text }}>BEE Level {c.beeLevel} — {c.beeStatus}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{c.beeExpiry ? `Expires: ${fmt.date(c.beeExpiry)}${c.beeExpiry < now + 90*day ? " ⚠ Expiring soon" : ""}` : "No expiry date"}</div>
            </div>
            {canDoAny("customers",["update"]) && <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
              {c.beeStatus !== "Verified" && <Btn size="sm" onClick={()=>updateBeeStatus(c.id,"Verified",detailBeeForm.level,detailBeeForm.expiry)}>Verify BEE</Btn>}
              {c.beeStatus === "Verified" && <Btn size="sm" variant="secondary" onClick={()=>updateBeeStatus(c.id,"Expired",null,null)}>Mark Expired</Btn>}
              <Btn size="sm" variant="ghost" onClick={()=>updateBeeStatus(c.id,"Pending Review",null,null)}>Reset</Btn>
            </div>}
          </div>
          {canDoAny("customers",["update"]) && (
            <div style={{ display:"flex", gap:12, alignItems:"flex-end" }}>
              <Field label="BEE Level"><Select value={detailBeeForm.level} onChange={e=>setDetailBeeForm({...detailBeeForm,level:e.target.value})} options={[1,2,3,4,5,6,7,8].map(v=>({value:v,label:`Level ${v}`}))} /></Field>
              <Field label="Certificate Expiry"><Input type="date" value={detailBeeForm.expiry} onChange={e=>setDetailBeeForm({...detailBeeForm,expiry:e.target.value})} /></Field>
            </div>
          )}
        </SectionCard>

        {/* Documents */}
        <SectionCard title={`Documents (${custDocs.length})`} actions={<Btn size="sm" variant="ghost" onClick={()=>{setDetail(null);setPage("documents")}}>View All</Btn>}>
          <Table columns={[
            {label:"ID", render:r=><span style={{fontFamily:"monospace",fontSize:10}}>{r.id}</span>},
            {label:"Document", render:r=><span style={{fontWeight:500}}>{r.name}</span>},
            {label:"Category", render:r=><span style={{fontSize:11,color:C.textDim}}>{r.category}</span>},
            {label:"Status", render:r=>statusBadge(r.status)},
            {label:"Expiry", render:r=>{
              if(!r.expiryDate) return <span style={{fontSize:10,color:C.textMuted}}>—</span>;
              const d=Math.ceil((r.expiryDate-now)/day);
              return <span style={{fontSize:11,fontWeight:d<=30?600:400,color:d<=30?C.red:d<=90?C.amber:C.textDim}}>{fmt.date(r.expiryDate)}</span>;
            }},
            {label:"Actions", render:r=><div style={{ display:"flex", gap:4 }}>
              {canDo("documents","approve") && r.status!=="Verified" && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();approveDocument(r.id)}}>Approve</Btn>}
              {canDo("documents","update") && r.status!=="Rejected" && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();rejectDocument(r.id,"Re-submission required.")}}>Reject</Btn>}
            </div>},
          ]} rows={custDocs} />
        </SectionCard>

        {/* Applications */}
        {ca.length>0 && <SectionCard title={`Applications (${ca.length})`}>
          <Table columns={[{label:"ID",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.id}</span>},{label:"Product",render:r=>prod(r.product)?.name},{label:"Amount",render:r=>fmt.cur(r.amount)},{label:"Status",render:r=>statusBadge(r.status)}]} rows={ca} onRowClick={r=>setDetail({type:"application",id:r.id})} />
        </SectionCard>}

        {/* Loans */}
        {cl.length>0 && <SectionCard title={`Active Loans (${cl.length})`}>
          <Table columns={[{label:"ID",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.id}</span>},{label:"Balance",render:r=>fmt.cur(r.balance)},{label:"DPD",render:r=>r.dpd},{label:"Stage",render:r=><Badge color={r.stage===1?"green":r.stage===2?"amber":"red"}>Stage {r.stage}</Badge>}]} rows={cl} onRowClick={r=>setDetail({type:"loan",id:r.id})} />
        </SectionCard>}
      </div>);
    }

    if (detail.type === "application") {
      const a = applications.find(x=>x.id===detail.id); if (!a) return <div>Not found</div>;
      const c = cust(a.custId); const p = prod(a.product);
      const w = a.workflow || {};
      const isUW = a.status === "Underwriting";
      const isSub = a.status === "Submitted";
      const isDecided = ["Approved","Declined"].includes(a.status);
      const appDocs = (documents||[]).filter(d => d.custId === a.custId && (d.appId === a.id || !d.appId));
      const allDDComplete = w.kycComplete && w.docsComplete && w.siteVisitComplete && w.financialAnalysisComplete && w.collateralAssessed && w.socialVerified;

      const steps = [
        { key:"submitted", label:"1. Application Received & QA", done:!!a.qaSignedOff, hasData:true, detail: a.qaSignedOff ? `QA passed ${fmt.date(a.qaDate)} by ${a.qaOfficer}` : a.qaFindings?.result === "Failed" ? "QA failed — resolve issues" : "Awaiting QA sign-off" },
        { key:"kyc", label:"2. KYC/FICA & Sanctions", done:w.kycComplete, hasData:!!w.kycDate, canRun:isUW, gateOk:!!a.qaSignedOff, gateMsg:"Complete Step 1 (QA sign-off) first", runLabel:w.kycDate?"Re-run Checks":"Run Automated Checks" },
        { key:"docs", label:"3. Document Completeness Review", done:w.docsComplete, hasData:!!w.docsDate, canRun:isUW, gateOk:w.kycComplete, gateMsg:"Complete Step 2 (KYC/FICA) first", runLabel:w.docsDate?"Re-check":"Run Document Check" },
        { key:"sitevisit", label:"4. Site Visit & Management Interview", done:w.siteVisitComplete, hasData:!!w.siteVisitDate, canRun:isUW, gateOk:w.docsComplete, gateMsg:"Complete Step 3 (Document Review) first", runLabel:w.siteVisitDate?"Re-generate":"Generate Findings" },
        { key:"credit", label:"5. Credit Bureau & Financial Analysis", done:w.financialAnalysisComplete, hasData:!!w.creditDate, canRun:isUW, gateOk:w.kycComplete&&w.docsComplete&&w.siteVisitComplete, gateMsg:"Complete Steps 2–4 first", runLabel:w.creditPulled?"Re-analyse":"Pull Credit & Analyse" },
        { key:"collateral", label:"6. Collateral & Security Assessment", done:w.collateralAssessed, hasData:!!w.collateralDate, canRun:isUW, gateOk:w.siteVisitComplete, gateMsg:"Complete Step 4 (Site Visit) first", runLabel:w.collateralDate?"Re-assess":"Run Assessment" },
        { key:"social", label:"7. Social Impact & BEE Verification", done:w.socialVerified, hasData:!!w.socialDate, canRun:isUW, gateOk:w.kycComplete, gateMsg:"Complete Step 2 (KYC/FICA) first", runLabel:w.socialDate?"Re-verify":"Run Verification" },
        { key:"decision", label:"8. Credit Decision", done:isDecided, hasData:isDecided },
      ];
      const doneCount = steps.filter(s=>s.done).length - 1;

      const renderChecklist = (findings, stepKey) => {
        if (!findings || !Array.isArray(findings)) return null;
        const isActionable = isUW && (stepKey==="kyc"||stepKey==="docs");
        const reqItems = findings.filter(f => {
          if (f.inherited) return false; // KYC docs inherited from step 2 — skip
          if (stepKey==="docs" && f.required===false) return false;
          return true;
        });
        const allActioned = isActionable && reqItems.every(f => f.officerAction);
        return (<div>
          <div style={{ border:`1px solid ${C.border}` }}>
            {findings.map((f,i) => {
              const doc = f.docId ? (documents||[]).find(d=>d.id===f.docId) : null;
              const isExpanded = viewingDoc === `${stepKey}-${i}`;
              const isInherited = f.inherited;
              return (
              <div key={i} style={{ borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none", opacity:isInherited?0.6:1 }}>
                <div style={{ display:"flex", gap:8, padding:"4px 8px", fontSize:11, alignItems:"center" }}>
                  <span style={{ width:40, flexShrink:0, fontWeight:500, color: f.status==="Pass"||f.status==="Verified"||f.status==="Confirmed (Override)"?C.green : f.status==="Flagged"?C.amber : f.status==="Rejected"||f.status==="Fail"||f.status==="Missing"?C.red : f.status==="Pending KYC"?C.amber : C.textMuted }}>{f.officerAction?f.status:(f.systemResult||f.status)}</span>
                  <span style={{ width:130, flexShrink:0, fontWeight:500, color:isInherited?C.textDim:C.text, fontSize:11 }}>{f.item}</span>
                  <span style={{ flex:1, color:C.textDim, fontSize:11 }}>{f.detail}{f.source?` (${f.source})`:""}{f.purpose&&!isInherited?<span style={{ color:C.textMuted, fontSize:10 }}> — {f.purpose}</span>:""}</span>
                  {/* View Document button */}
                  {doc && !isInherited && <button onClick={()=>setViewingDoc(isExpanded?null:`${stepKey}-${i}`)} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:isExpanded?C.surface2:"transparent", color:C.accent, cursor:"pointer", fontFamily:"inherit", fontWeight:isExpanded?600:400 }}>{isExpanded?"Close":"View"}</button>}
                  {/* Request button — shown for Missing non-inherited docs */}
                  {!doc && !isInherited && f.systemResult==="Missing" && isUW && (() => {
                    const reqs = (w.docRequests||[]).filter(r=>r.docType===f.item);
                    const lastReq = reqs[reqs.length-1];
                    return lastReq
                      ? <span style={{ fontSize:10, color:C.textMuted, flexShrink:0 }}>Requested {fmt.date(lastReq.requestedAt)} by {lastReq.requestedBy}</span>
                      : <button onClick={()=>requestDocFromApplicant(a.id,f.item,"")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Request</button>;
                  })()}
                  {/* Inherited indicator */}
                  {isInherited && <span style={{ fontSize:10, color:C.textMuted, flexShrink:0, fontStyle:"italic" }}>from Step 2</span>}
                  {/* Confirm / Flag / Reject — only for non-inherited items */}
                  {isActionable && !isInherited && !f.officerAction && (
                    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Confirmed","")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Confirm</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Flagged","")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.amber, cursor:"pointer", fontFamily:"inherit" }}>Flag</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Rejected","")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject</button>
                    </div>
                  )}
                  {isActionable && !isInherited && f.officerAction && <span style={{ fontSize:10, color:C.textMuted, flexShrink:0 }}>{f.officerAction}</span>}
                  {/* Doc-level approve/reject — only for non-inherited items */}
                  {doc && !isInherited && isUW && doc.status!=="Verified" && canDo("documents","approve") && <button onClick={()=>approveDocument(doc.id,a.id)} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Approve Doc</button>}
                  {doc && !isInherited && isUW && doc.status!=="Rejected" && canDo("documents","update") && <button onClick={()=>rejectDocument(doc.id,"Re-submission required.")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject Doc</button>}
                </div>
                {/* Expanded document detail panel */}
                {isExpanded && doc && (
                  <div style={{ padding:"8px 8px 8px 46px", background:C.surface2, borderTop:`1px solid ${C.border}` }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, fontSize:10 }}>
                      <div><span style={{ color:C.textMuted }}>Document ID:</span> <span style={{ fontFamily:"monospace", fontWeight:500 }}>{doc.id}</span></div>
                      <div><span style={{ color:C.textMuted }}>Name:</span> <span style={{ fontWeight:500 }}>{doc.name}</span></div>
                      <div><span style={{ color:C.textMuted }}>Category:</span> {doc.category}</div>
                      <div><span style={{ color:C.textMuted }}>Status:</span> <span style={{ fontWeight:600, color:doc.status==="Verified"?C.green:doc.status==="Rejected"?C.red:C.amber }}>{doc.status}</span></div>
                      <div><span style={{ color:C.textMuted }}>Uploaded By:</span> {doc.uploadedBy||"—"}</div>
                      <div><span style={{ color:C.textMuted }}>Uploaded:</span> {fmt.date(doc.uploadedAt)}</div>
                      <div><span style={{ color:C.textMuted }}>Verified By:</span> {doc.verifiedBy||"—"}</div>
                      <div><span style={{ color:C.textMuted }}>Verified:</span> {fmt.date(doc.verifiedAt)}</div>
                      <div><span style={{ color:C.textMuted }}>Expiry:</span> {doc.expiryDate ? <span style={{ color: doc.expiryDate < now + 90*day ? C.red : C.textDim }}>{fmt.date(doc.expiryDate)}</span> : "None"}</div>
                      <div style={{ gridColumn:"1/4" }}><span style={{ color:C.textMuted }}>File:</span> <span style={{ fontFamily:"monospace", fontSize:10 }}>{doc.fileRef||"—"}</span></div>
                      {doc.notes && <div style={{ gridColumn:"1/4" }}><span style={{ color:C.textMuted }}>Notes:</span> {doc.notes}</div>}
                    </div>
                  </div>
                )}
                {/* Officer note input */}
                {isActionable && f.officerAction && (
                  <div style={{ padding:"0 8px 4px 46px" }}>
                    <input value={f.officerNote||""} onChange={e=>updateFindingNote(a.id,stepKey,i,e.target.value)} placeholder="Note..." style={{ width:"100%", padding:"2px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                )}
              </div>
              );
            })}
          </div>
          {isActionable && <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:10, color:C.textMuted }}>{allActioned?"Ready for sign-off.":`${reqItems.filter(f=>f.officerAction).length}/${reqItems.length} reviewed.`}</span>
            <Btn size="sm" onClick={()=>signOffStep(a.id,stepKey)} disabled={!allActioned}>Sign Off</Btn>
          </div>}
        </div>);
      };

      const renderReadOnly = (findings) => {
        if (!findings || !Array.isArray(findings)) return null;
        return (<div style={{ border:`1px solid ${C.border}` }}>
          {findings.map((f,i) => (
            <div key={i} style={{ display:"flex", gap:8, padding:"4px 8px", fontSize:11, borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
              <span style={{ width:140, flexShrink:0, fontWeight:500, color:C.text }}>{f.item}</span>
              <span style={{ flex:1, color:C.textDim, lineHeight:1.5 }}>{f.detail}</span>
            </div>
          ))}
        </div>);
      };

      const renderStepBody = (s) => {
        if (s.key==="submitted") return (<div>
          <InfoGrid items={[["Applicant",c?.name],["Product",p?.name],["Amount",fmt.cur(a.amount)],["Term",`${a.term}m`],["Created",fmt.date(a.createdAt||a.submitted)],["Purpose",a.purpose]]} />
          {a.qaFindings && <div style={{ marginTop:8 }}>
            <div style={{ fontSize:11, fontWeight:600, color:C.text, marginBottom:4 }}>QA Document Check</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {(a.qaFindings.mandatoryDocs||[]).map((d,i) => (
                <div key={i} style={{ display:"flex", gap:8, padding:"4px 8px", fontSize:11, borderBottom:i<(a.qaFindings.mandatoryDocs.length-1)?`1px solid ${C.border}`:"none" }}>
                  <span style={{ width:40, fontWeight:500, color:d.onFile && d.status!=="Pending" && d.status!=="Rejected" ? C.green : C.red }}>{d.onFile && d.status!=="Pending" && d.status!=="Rejected" ? "OK" : d.status}</span>
                  <span style={{ width:140, fontWeight:500 }}>{d.type}</span>
                  <span style={{ color:C.textDim }}>{d.docId || "Not on file"}{d.status ? ` — ${d.status}` : ""}</span>
                </div>
              ))}
            </div>
            {a.qaFindings.missingDocs?.length > 0 && <div style={{ fontSize:11, color:C.red, marginTop:4 }}>Missing: {a.qaFindings.missingDocs.join(", ")}</div>}
            {a.qaFindings.incompleteDocs?.length > 0 && <div style={{ fontSize:11, color:C.amber, marginTop:2 }}>Incomplete: {a.qaFindings.incompleteDocs.join(", ")}</div>}
            <div style={{ fontSize:10, color:a.qaFindings.result==="Passed"?C.green:C.red, marginTop:4, fontWeight:600 }}>
              QA Result: {a.qaFindings.result}{a.qaFindings.officer ? ` — ${a.qaFindings.officer} on ${fmt.date(a.qaFindings.passedAt)}` : ""}
            </div>
          </div>}
          {a.expiresAt && a.status === "Draft" && <div style={{ fontSize:10, color: a.expiresAt < Date.now() ? C.red : C.amber, marginTop:8 }}>
            {a.expiresAt < Date.now() ? `EXPIRED on ${fmt.date(a.expiresAt)}` : `Expires: ${fmt.date(a.expiresAt)} (${Math.ceil((a.expiresAt - Date.now())/day)} days remaining)`}
          </div>}
        </div>);
        if (s.key==="kyc") return (<div>
          {!w.kycDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Verify applicant identity and regulatory compliance: ID against Home Affairs, company registration against CIPC, bank account confirmation, address verification, sanctions screening (OFAC/UN/SA), and PEP check. Each item requires your review and sign-off.</div>}
          {w.kycFindings && renderChecklist(w.kycFindings, "kyc")}
          {w.kycComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.kycOfficer}</div>}
        </div>);
        if (s.key==="docs") return (<div>
          {!w.docsDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Check application document completeness. KYC documents (ID, PoA, Bank, Registration) carry forward from Step 2. This step verifies financial statements, business plan, and any industry-specific documents are on file and adequate for underwriting.</div>}
          {w.docsFindings && renderChecklist(w.docsFindings, "docs")}
          {isUW && <div style={{ marginTop:8, padding:"8px 8px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Request Document from Applicant</div>
            <div style={{ display:"flex", gap:4 }}>
              <input value={reqDocType} onChange={e=>setReqDocType(e.target.value)} placeholder="Document type..." style={{ flex:1, padding:"4px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              <Btn size="sm" variant="secondary" onClick={()=>{if(reqDocType){requestDocFromApplicant(a.id,reqDocType,"");setReqDocType("")}}}>Send</Btn>
            </div>
          </div>}
          {w.docsComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.docsOfficer}</div>}
        </div>);
        if (s.key==="sitevisit") {
          const findings = w.siteVisitFindings || [];
          const isOldFormat = findings.length > 0 && findings[0].field === undefined;
          const filledCount = findings.filter(f => f.value && f.value.trim().length > 10).length;
          const allFilled = findings.length > 0 && !isOldFormat && findings.every(f => f.value && f.value.trim().length > 5);
          return (<div>
          {!w.siteVisitDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Click "Generate Findings" to create the site visit assessment form. Complete each field after the physical visit, then sign off.</div>}
          {isOldFormat && <div style={{ padding:12, background:"#fff8e1", border:`1px solid ${C.amber}`, marginBottom:8, fontSize:11 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Site visit data is in a legacy format (static/read-only).</div>
            <div style={{ color:C.textDim }}>Click "Re-generate" above to create the interactive assessment form. You will need to re-enter your observations.</div>
          </div>}
          {findings.length > 0 && !isOldFormat && <div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:8 }}>{filledCount}/{findings.length} sections completed{allFilled ? " — ready for sign-off" : ""}</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {findings.map((f, i) => (
                <div key={i} style={{ padding:"8px 12px", borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:C.text }}>{f.item}</span>
                    {f.value && f.value.trim().length > 5 ? <span style={{ fontSize:10, color:C.green }}>Completed</span> : <span style={{ fontSize:10, color:C.amber }}>Required</span>}
                  </div>
                  {isUW && !w.siteVisitComplete ? (
                    <textarea value={f.value||""} onChange={e=>saveSiteVisitField(a.id,i,e.target.value)} placeholder={f.placeholder||""} rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
                  ) : (
                    <div style={{ fontSize:11, color:f.value ? C.textDim : C.textMuted, lineHeight:1.5, fontStyle:f.value?"normal":"italic" }}>{f.value || "Not completed"}</div>
                  )}
                  {f.item === "Overall Assessment" && isUW && !w.siteVisitComplete && (
                    <div style={{ display:"flex", gap:8, marginTop:4 }}>
                      {["Satisfactory","Concerns Noted","Unsatisfactory"].map(r => (
                        <button key={r} onClick={()=>saveSiteVisitRating(a.id,i,r)} style={{ padding:"2px 8px", fontSize:10, border:`1px solid ${f.rating===r?C.accent:C.border}`, background:f.rating===r?C.accent:"transparent", color:f.rating===r?"#fff":C.textDim, cursor:"pointer", fontFamily:"inherit" }}>{r}</button>
                      ))}
                    </div>
                  )}
                  {f.item === "Overall Assessment" && f.rating && (
                    <div style={{ fontSize:10, marginTop:3, fontWeight:500, color:f.rating==="Satisfactory"?C.green:f.rating==="Unsatisfactory"?C.red:C.amber }}>Rating: {f.rating}</div>
                  )}
                </div>
              ))}
            </div>
          </div>}
          {isUW && <div style={{ marginTop:8 }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Additional Notes</div>
            <textarea value={w.siteVisitNotes||""} onChange={e=>saveSiteVisitNotes(a.id,e.target.value)} placeholder="Any additional observations not covered above..." rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
          </div>}
          {isUW && w.siteVisitDate && !w.siteVisitComplete && !isOldFormat && (
            <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:10, color:allFilled?C.green:C.amber }}>{allFilled ? "All sections completed. Ready for sign-off." : `${filledCount}/${findings.length} completed. Complete all sections to sign off.`}</span>
              <Btn size="sm" onClick={()=>signOffStep(a.id,"sitevisit")} disabled={!allFilled}>Sign Off</Btn>
            </div>
          )}
          {/* Old format fallback — show read-only for reference */}
          {isOldFormat && findings.length > 0 && renderReadOnly(findings)}
          {w.siteVisitComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.siteVisitOfficer}</div>}
        </div>);
        }
        if (s.key==="credit") {
          const findings = w.creditFindings || [];
          const hasNewFormat = findings.length > 0 && findings[0].analystNote !== undefined;
          const isOldCreditFormat = findings.length > 0 && !hasNewFormat;
          const notedCount = findings.filter(f => f.analystNote && f.analystNote.trim().length > 3).length;
          const riskFinding = findings.find(f => f.item === "Risk Score & Recommendation");
          const canSignOff = hasNewFormat && riskFinding?.analystNote && riskFinding.analystNote.trim().length > 10;
          return (<div>
          {!w.creditDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Pull credit bureau report and run automated financial analysis. System computes key ratios from submitted financials. Review each finding, add your professional assessment, flag concerns, then confirm.</div>}
          {isOldCreditFormat && <div style={{ padding:12, background:"#fff8e1", border:`1px solid ${C.amber}`, marginBottom:8, fontSize:11 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Credit analysis data is in a legacy format (static/read-only).</div>
            <div style={{ color:C.textDim }}>Click "Re-analyse" above to generate the interactive analyst review form.</div>
          </div>}
          {isOldCreditFormat && renderReadOnly(findings)}
          {hasNewFormat && findings.length > 0 && <div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:8 }}>{notedCount}/{findings.length} findings reviewed by analyst{canSignOff ? " — ready for confirmation" : ""}</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {findings.map((f, i) => (
                <div key={i} style={{ padding:"8px 12px", borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:C.text }}>{f.item}</span>
                    {f.flag && <span style={{ fontSize:10, padding:"1px 6px", background:f.flag==="Accept"?C.green:f.flag==="Override"?C.purple:C.red, color:"#fff" }}>{f.flag}</span>}
                  </div>
                  {/* System-computed value — always visible as reference */}
                  <div style={{ fontSize:11, color:C.accent, fontWeight:500, marginBottom:2 }}>{f.systemValue}</div>
                  {f.systemDetail && <div style={{ fontSize:10, color:C.textDim, marginBottom:4, lineHeight:1.5 }}>{f.systemDetail}</div>}
                  {/* Analyst commentary */}
                  {isUW && !w.financialAnalysisComplete ? (
                    <div>
                      <textarea value={f.analystNote||""} onChange={e=>saveCreditFinding(a.id,i,"analystNote",e.target.value)} placeholder={f.placeholder || "Analyst assessment — confirm, qualify, or override the system finding..."} rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5, marginBottom:4 }} />
                      <div style={{ display:"flex", gap:4 }}>
                        {["Accept","Override","Concern"].map(fl => (
                          <button key={fl} onClick={()=>saveCreditFinding(a.id,i,"flag",f.flag===fl?"":fl)} style={{ padding:"1px 7px", fontSize:10, border:`1px solid ${f.flag===fl?(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red):C.border}`, background:f.flag===fl?(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red):"transparent", color:f.flag===fl?"#fff":(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red), cursor:"pointer", fontFamily:"inherit" }}>{fl}</button>
                        ))}
                      </div>
                    </div>
                  ) : f.analystNote ? (
                    <div style={{ fontSize:11, color:C.textDim, lineHeight:1.5, marginTop:2, paddingLeft:8, borderLeft:`2px solid ${C.border}` }}>{f.analystNote}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>}
          {isUW && w.creditDate && !w.financialAnalysisComplete && (
            <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:10, color:canSignOff?C.green:C.amber }}>{canSignOff ? "Risk assessment complete. Ready for confirmation." : "Provide analyst assessment on 'Risk Score & Recommendation' to confirm."}</span>
              <Btn size="sm" onClick={()=>signOffStep(a.id,"credit")} disabled={!canSignOff}>Confirm Analysis</Btn>
            </div>
          )}
          {w.financialAnalysisComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Confirmed by Credit Analyst</div>}
        </div>);
        }
        if (s.key==="collateral") return (<div>
          {!w.collateralDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Assess collateral and security linked to the customer. Computes LTV.</div>}
          {w.collateralFindings && renderReadOnly(w.collateralFindings)}
          {isUW && w.collateralDate && !w.collateralAssessed && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"collateral")}>Confirm</Btn></div>}
          {w.collateralAssessed && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Assessment confirmed</div>}
        </div>);
        if (s.key==="social") return (<div>
          {!w.socialDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Verify BEE status, employment impact, and development alignment.</div>}
          {w.socialFindings && renderReadOnly(w.socialFindings)}
          {isUW && w.socialDate && !w.socialVerified && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"social")}>Confirm</Btn></div>}
          {w.socialVerified && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Verified by {w.socialOfficer}</div>}
        </div>);
        if (s.key==="decision" && isDecided) return <InfoGrid items={[["Decision",a.status],["Date",fmt.date(a.decided)],["Approver",a.approver],["Risk",a.riskScore],["DSCR",`${a.dscr}x`],["Social",a.socialScore]]} />;
        return null;
      };

      return (<div><BackBtn />
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:700, color:C.text }}>{a.id}</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.textMuted }}>{c?.name} \u00b7 {p?.name} \u00b7 {fmt.cur(a.amount)} over {a.term}m</p></div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>{statusBadge(a.status)}<span style={{ fontSize:11, color:C.textMuted }}>{doneCount}/7</span></div>
        </div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:12 }}>
          <KPI label="Amount" value={fmt.cur(a.amount)} /><KPI label="Term" value={`${a.term}m`} /><KPI label="Bureau" value={w.creditBureauScore??"-"} /><KPI label="Risk" value={a.riskScore??"-"} /><KPI label="DSCR" value={a.dscr?`${a.dscr}x`:"-"} /><KPI label="Social" value={a.socialScore??"-"} /><KPI label="LTV" value={w.collateralTotal?`${(a.amount/w.collateralTotal*100).toFixed(0)}%`:"-"} />
        </div>
        {isSub && <div style={{ border:`1px solid ${C.border}`, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:12, fontWeight:600, color:C.text }}>Application awaiting due diligence</div><div style={{ fontSize:11, color:C.textMuted }}>Initiate underwriting to begin step-by-step verification.</div></div>
          <Btn onClick={()=>moveToUnderwriting(a.id)}>Start Due Diligence</Btn>
        </div>}

        {/* Decision summary for Approved/Declined/Booked — no workflow accordion */}
        {isDecided && !isUW && <div>
          <SectionCard title="Decision Summary">
            <InfoGrid items={[
              ["Decision", a.status],
              ["Decided By", a.approver || "—"],
              ["Decision Date", a.decided ? fmt.date(a.decided) : "—"],
              ["Risk Score", a.riskScore || "—"],
              ["DSCR", a.dscr ? `${a.dscr}x` : "—"],
              ["Rate", a.rate ? `${a.rate}%` : "—"],
            ]} />
          </SectionCard>
          {a.creditMemo && <SectionCard title="Credit Memorandum"><div style={{ fontSize:12, color:C.textDim, lineHeight:1.5, whiteSpace:"pre-line" }}>{a.creditMemo}</div></SectionCard>}
          {a.conditions?.length>0 && <SectionCard title={`Conditions (${a.conditions.length})`}>{a.conditions.map((cond,i)=><div key={i} style={{ display:"flex", alignItems:"flex-start", gap:4, padding:"4px 0", fontSize:12 }}><span style={{ color:C.green, flexShrink:0, marginTop:1 }}>{I.check}</span><span>{cond}</span></div>)}</SectionCard>}
          {a.status === "Approved" && canDo("loans","update") && !loanForApp(a.id) && (
            <div style={{ border:`1px solid ${C.border}`, padding:"12px 16px", marginTop:4 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text }}>Loan Booking</div>

              {/* ═══ Security Instruments ═══ */}
              {(() => {
                const prodSec = PRODUCT_SECURITY[a.product];
                if (!prodSec) return null;
                const allInstruments = [...(prodSec.required||[]), ...(prodSec.optional||[])];
                const sels = securitySelections[a.id] || {};
                return (
                  <SectionCard title="Security Instruments">
                    <div style={{ fontSize:11, color:C.textMuted, marginBottom:12 }}>{prodSec.desc}</div>
                    {allInstruments.map(instId => {
                      const inst = SECURITY_INSTRUMENTS[instId];
                      if (!inst) return null;
                      const isRequired = (prodSec.required||[]).includes(instId);
                      const isSelected = isRequired || sels[instId];
                      return (
                        <div key={instId} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"8px 0", borderBottom:`1px solid ${C.surface3}` }}>
                          <input type="checkbox" checked={isSelected} disabled={isRequired} onChange={() => { const next = {...sels, [instId]:!sels[instId]}; setSecuritySelections({...securitySelections, [a.id]:next}); }} style={{ marginTop:2, accentColor:C.accent }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{inst.name} {isRequired && <span style={{ fontSize:10, color:C.red, fontWeight:500 }}>(Required)</span>}</div>
                            <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{inst.desc}</div>
                          </div>
                          {isSelected && inst.template && <button className="kb-cta-outline" onClick={() => { const c2 = customers.find(x=>x.id===a.custId); const p2 = products.find(x=>x.id===a.product); showToast(`Generating ${inst.name} template...`); generateSecurityDoc(inst.template, a, c2, p2); }} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 12px", fontSize:10, fontWeight:500, color:C.accent, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>Generate</button>}
                        </div>
                      );
                    })}
                    <div style={{ marginTop:8, fontSize:10, color:C.textMuted }}>Required instruments must be signed before disbursement. Optional instruments reduce risk exposure and may improve pricing.</div>
                  </SectionCard>
                );
              })()}
                  <div style={{ fontSize:11, color:C.textMuted }}>Verify conditions precedent and create loan record.</div>
                </div>
              <Btn variant="secondary" onClick={() => { const c3 = customers.find(x=>x.id===a.custId); const p3 = products.find(x=>x.id===a.product); generateLoanAgreement(null, a, c3, p3); }}>Generate Agreement</Btn>
                <Btn onClick={()=>bookLoan(a.id)}>Book Loan</Btn>
              </div>
            </div>
          )}
          {/* Underwriting Record — read-only expandable for audit/review */}
          {Object.keys(w).length > 0 && <div style={{ marginTop:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:`1px solid ${C.border}`, cursor:"pointer", background:C.surface2 }} onClick={()=>setExpandedStep(expandedStep==="uwRecord"?null:"uwRecord")}>
              <span style={{ fontSize:12, fontWeight:600, color:C.textDim }}>Underwriting Record</span>
              <span style={{ fontSize:10, color:C.textMuted }}>(click to {expandedStep==="uwRecord"?"collapse":"expand"})</span>
              <span style={{ marginLeft:"auto", color:C.textMuted, transform:expandedStep==="uwRecord"?"rotate(90deg)":"none", transition:"transform .15s" }}>{I.chev}</span>
            </div>
            {expandedStep==="uwRecord" && <div style={{ border:`1px solid ${C.border}`, borderTop:"none" }}>
              {steps.filter(s=>s.key!=="decision").map((s,i) => (
                <div key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px" }}>
                    <div style={{ width:14, height:14, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:s.done?C.green:"transparent", color:s.done?"#fff":C.textMuted, fontSize:10, fontWeight:600, border:`1px solid ${s.done?C.green:C.border}` }}>{s.done?I.check:""}</div>
                    <span style={{ fontSize:11, fontWeight:s.done?500:400, color:s.done?C.text:C.textMuted }}>{s.label}</span>
                    {s.done && <span style={{ fontSize:10, color:C.green, marginLeft:4 }}>Complete</span>}
                    {!s.done && s.hasData && <span style={{ fontSize:10, color:C.amber, marginLeft:4 }}>Incomplete</span>}
                    {!s.done && !s.hasData && <span style={{ fontSize:10, color:C.textMuted, marginLeft:4 }}>Not performed</span>}
                  </div>
                  {s.hasData && <div style={{ padding:"4px 10px 8px 32px", fontSize:11, color:C.textDim }}>
                    {s.key==="submitted" && s.detail && <div>{s.detail}</div>}
                    {s.key==="kyc" && w.kycFindings && <div>{w.kycFindings.filter(f=>f.officerAction).map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ color:f.status==="Pass"?C.green:C.amber, fontWeight:500 }}>{f.status}</span> {f.item}{f.officerNote?` — ${f.officerNote}`:""}</div>)}{w.kycOfficer && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Signed off by {w.kycOfficer}</div>}</div>}
                    {s.key==="docs" && w.docsFindings && <div>{w.docsFindings.filter(f=>!f.inherited&&f.officerAction).map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ color:C.green, fontWeight:500 }}>{f.status}</span> {f.item}{f.officerNote?` — ${f.officerNote}`:""}</div>)}{w.docsOfficer && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Signed off by {w.docsOfficer}</div>}</div>}
                    {s.key==="sitevisit" && w.siteVisitFindings && <div>{w.siteVisitFindings.filter(f=>f.value).map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ fontWeight:500 }}>{f.item}:</span> {f.value?.substring(0,120)}{f.value?.length>120?"...":""}{f.rating?` [${f.rating}]`:""}</div>)}{w.siteVisitOfficer && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Signed off by {w.siteVisitOfficer}</div>}</div>}
                    {s.key==="credit" && w.creditFindings && <div>{w.creditFindings.map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ fontWeight:500 }}>{f.item}:</span> {f.systemValue||""}{f.flag?<span style={{ fontSize:10, marginLeft:4, padding:"0 4px", background:f.flag==="Accept"?C.green:f.flag==="Concern"?C.red:C.purple, color:"#fff" }}>{f.flag}</span>:""}{f.analystNote?<div style={{ paddingLeft:8, color:C.textDim, fontSize:10, marginTop:1 }}>{f.analystNote.substring(0,150)}{f.analystNote.length>150?"...":""}</div>:""}</div>)}</div>}
                    {s.key==="collateral" && w.collateralFindings && <div>{w.collateralFindings.map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ fontWeight:500 }}>{f.item}:</span> {fmt.cur(f.value)} — {f.detail?.substring(0,100)}</div>)}<div style={{ fontWeight:500, marginTop:2 }}>Total: {fmt.cur(w.collateralTotal)}</div></div>}
                    {s.key==="social" && w.socialFindings && renderReadOnly(w.socialFindings)}
                  </div>}
                </div>
              ))}
              {w.analystNotes && <div style={{ padding:"8px 12px", borderTop:`1px solid ${C.border}` }}><span style={{ fontSize:10, fontWeight:600, color:C.textDim }}>Analyst Notes:</span><div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{w.analystNotes}</div></div>}
            </div>}
          </div>}
        </div>}

        {/* Interactive workflow steps — only for Draft/Submitted/Underwriting */}
        {(isUW || a.status === "Draft") && steps.map((s,i) => {
          const isOpen = expandedStep===s.key;
          return (<div key={i} style={{ border:`1px solid ${C.border}`, marginBottom:1, background:C.surface }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", cursor:"pointer", background:isOpen?C.surface2:"transparent" }} onClick={()=>setExpandedStep(isOpen?null:s.key)}>
              <div style={{ width:16, height:16, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:s.done?C.accent:"transparent", color:s.done?"#fff":C.textMuted, fontSize:10, fontWeight:600, border:`1px solid ${s.done?C.text:s.hasData&&!s.done?C.amber:C.border}` }}>{s.done?I.check:i}</div>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:12, fontWeight:s.done?600:400, color:s.done?C.text:C.textDim }}>{s.label}</span>
                {s.done && <span style={{ fontSize:10, color:C.textMuted, marginLeft:6 }}>Complete</span>}
                {s.hasData && !s.done && <span style={{ fontSize:10, color:C.amber, marginLeft:6 }}>Awaiting sign-off</span>}
              </div>
              {s.canRun && isOpen && (s.gateOk ? <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();runDDStep(a.id,s.key)}}>{s.runLabel}</Btn> : <span style={{ fontSize:10, color:C.textMuted }}>{s.gateMsg}</span>)}
              <span style={{ color:C.textMuted, transform:isOpen?"rotate(90deg)":"none", transition:"transform .15s" }}>{I.chev}</span>
            </div>
            {isOpen && <div style={{ padding:"8px 10px 10px 34px", borderTop:`1px solid ${C.border}` }}>{renderStepBody(s)}</div>}
          </div>);
        })}
        {/* Analyst Notes */}
        {isUW && <div style={{ border:`1px solid ${C.border}`, marginTop:8, padding:"8px 12px" }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Analyst Notes</div>
          <textarea value={w.analystNotes||""} onChange={e=>saveAnalystNotes(a.id,e.target.value)} placeholder="Observations, concerns, conditions to propose..." rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
        </div>}
        {/* Notify applicant */}
        {isUW && <div style={{ border:`1px solid ${C.border}`, marginTop:1, padding:"8px 12px" }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Notify Applicant</div>
          <input value={notifForm.subject} onChange={e=>setNotifForm({...notifForm,subject:e.target.value})} placeholder="Subject" style={{ width:"100%", padding:"4px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:3 }} />
          <textarea value={notifForm.body} onChange={e=>setNotifForm({...notifForm,body:e.target.value})} placeholder="Message..." rows={2} style={{ width:"100%", padding:"4px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.4 }} />
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:3 }}>
            <Btn size="sm" variant="secondary" onClick={()=>{if(notifForm.subject&&notifForm.body){sendNotification(a.id,notifForm.subject,notifForm.body);setNotifForm({subject:"",body:""})}}}>Send</Btn>
          </div>
        </div>}
        {a.creditMemo && isUW && <SectionCard title="Credit Memorandum"><div style={{ fontSize:12, color:C.textDim, lineHeight:1.5, whiteSpace:"pre-line" }}>{a.creditMemo}</div></SectionCard>}
        {isUW && <div style={{ border:`1px solid ${C.border}`, padding:"12px 16px", marginTop:4 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><div style={{ fontSize:12, fontWeight:600, color:C.text }}>Credit Decision</div><div style={{ fontSize:11, color:C.textMuted }}>{allDDComplete?"All steps signed off. Ready for decision.":`${doneCount}/7 steps completed.`}</div></div>
            <div style={{ display:"flex", gap:8 }}><Btn onClick={()=>decideLoan(a.id,"Approved")} disabled={!allDDComplete}>Approve</Btn><Btn variant="danger" onClick={()=>decideLoan(a.id,"Declined")} disabled={!allDDComplete}>Decline</Btn></div>
          </div>
        </div>}
        {a.status === "Booked" && (
          <div style={{ border:`1px solid ${C.border}`, padding:"12px 16px", marginTop:4, background:C.surface2 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:C.text }}>Loan Booked — Awaiting Disbursement</div>
                <div style={{ fontSize:11, color:C.textMuted }}>Loan {loanForApp(a.id)?.id} created. Finance to initiate disbursement (requires dual authorization).</div>
              </div>
              <Btn size="sm" variant="ghost" onClick={()=>{const l=loanForApp(a.id); if(l) setDetail({type:"loan",id:l.id})}}>View Loan</Btn>
            </div>
          </div>
        )}
      </div>);
    }

    if (detail.type === "loan") {
      const l = loans.find(x=>x.id===detail.id); if (!l) return <div>Not found</div>;
      const c = cust(l.custId); const prov = provisions.find(p=>p.loanId===l.id);
      const lc = collections.filter(x=>x.loanId===l.id);
      const repaidPct = l.status === "Active" ? Math.round((1-l.balance/l.amount)*100) : 0;
      const isBooked = l.status === "Booked";
      return (<div><BackBtn />
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:24 }}>
          <div><h2 style={{ margin:0, fontSize:24, fontWeight:700, color:C.text }}>{l.id}</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>{c?.name}</p></div>
          <div style={{ display:"flex", gap:8 }}>
            {statusBadge(l.status)}
            {l.status==="Active"&&<Badge color={l.dpd===0?"green":l.dpd<=30?"amber":"red"}>{l.dpd} DPD</Badge>}
            {l.status==="Active"&&<Badge color={l.stage===1?"green":l.stage===2?"amber":"red"}>Stage {l.stage}</Badge>}
          </div>
        </div>

        {/* Disbursement panel for Booked loans */}
        {isBooked && (
          <div style={{ border:`1px solid ${C.border}`, padding:"12px 16px", marginBottom:20, background:C.surface2 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:C.text }}>Loan Booked — Awaiting Disbursement</div>
                <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>
                  Booked by: {SYSTEM_USERS.find(u=>u.id===l.bookedBy)?.name || "—"} on {fmt.date(l.bookedAt)}<br/>
                  Pre-disbursement AML check will run automatically. Dual authorization required (disbursing officer must differ from booking officer).
                  {l.arrangementFee > 0 && <span> · Arrangement fee: {fmt.cur(l.arrangementFee)}</span>}
                </div>
              </div>
              {canDoAny("servicing",["create"]) && canDoAny("loans",["update"]) && (
                <Btn onClick={()=>disburseLoan(l.id)}>Disburse Funds</Btn>
              )}
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
          <KPI label={isBooked?"Amount":"Disbursed"} value={fmt.cur(l.amount)} accent={C.blue} />
          <KPI label="Balance" value={fmt.cur(l.balance)} accent={C.red} />
          <KPI label="Rate" value={`${l.rate}%`} accent={C.amber} />
          <KPI label="Monthly PMT" value={fmt.cur(l.monthlyPmt)} />
          <KPI label="Term" value={`${l.term}m`} />
          <KPI label="Total Paid" value={fmt.cur(l.totalPaid)} accent={C.green} />
        </div>
        <SectionCard title={`Repayment Progress — ${repaidPct}%`}>
          <ProgressBar value={repaidPct} color={C.accent} height={10} />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11, color:C.textMuted }}>
            <span>Disbursed: {fmt.date(l.disbursed)}</span><span>Next Due: {fmt.date(l.nextDue)}</span><span>Last Payment: {l.lastPmt ? `${fmt.cur(l.lastPmtAmt)} on ${fmt.date(l.lastPmt)}` : "—"}</span>
          </div>
        </SectionCard>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <SectionCard title="Covenant Monitoring">
            {l.covenants.map((cov,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div><div style={{ fontSize:13, color:C.text }}>{cov.name}</div><div style={{ fontSize:10, color:C.textMuted }}>Checked: {fmt.date(cov.checked)} · Value: {cov.value}</div></div>
                {statusBadge(cov.status)}
              </div>
            ))}
          </SectionCard>
          <SectionCard title="Collateral & Security">
            {l.collateral.length>0 ? l.collateral.map((col,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div><div style={{ fontSize:13, fontWeight:600, color:C.text }}>{col.type}</div><div style={{ fontSize:11, color:C.textMuted }}>{col.description}</div></div>
                <span style={{ fontSize:13, fontWeight:700, color:C.accent }}>{fmt.cur(col.value)}</span>
              </div>
            )) : <div style={{ color:C.textMuted, fontSize:13 }}>No collateral recorded</div>}
            {l.collateral.length>0 && <div style={{ textAlign:"right", marginTop:10, fontSize:13, fontWeight:700, color:C.text }}>Total Security: {fmt.cur(l.collateral.reduce((s,c)=>s+c.value,0))}</div>}
          </SectionCard>
        </div>
        {prov && <SectionCard title="IFRS 9 Provisioning">
          <div style={{ display:"flex", gap:24 }}>
            {[["Stage",`Stage ${prov.stage}`],["PD",fmt.pct(prov.pd)],["LGD",fmt.pct(prov.lgd,0)],["EAD",fmt.cur(prov.ead)],["ECL",fmt.cur(prov.ecl)],["Method",prov.method]].map(([l,v],i)=>(
              <div key={i}><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>{l}</div><div style={{ fontSize:14, fontWeight:700, color:l==="ECL"?C.purple:C.text }}>{v}</div></div>
            ))}
          </div>
        </SectionCard>}
        <SectionCard title={`Payment History (${l.payments.length})`}>
          <Table columns={[
            { label:"Date", render:r=>fmt.date(r.date) },
            { label:"Total", render:r=><span style={{ fontWeight:700 }}>{fmt.cur(r.amount)}</span> },
            { label:"Interest", render:r=><span style={{ color:C.amber }}>{fmt.cur(r.interest||0)}</span> },
            { label:"Principal", render:r=><span style={{ color:C.green }}>{fmt.cur(r.principal||0)}</span> },
            { label:"Type", key:"type" },
            { label:"Status", render:r=>statusBadge(r.status) },
          ]} rows={[...l.payments].sort((a,b)=>b.date-a.date)} />
          {canDo("servicing","create") && <div style={{ marginTop:12 }}><Btn size="sm" variant="secondary" onClick={()=>recordPayment(l.id, l.monthlyPmt)} icon={I.plus}>Record Payment</Btn></div>}
        </SectionCard>
        {lc.length>0 && <SectionCard title="Collection Activity">
          {lc.sort((a,b)=>b.created-a.created).map((col,i) => (
            <div key={i} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontWeight:700, color:C.text, fontSize:13 }}>{col.action}</span><Badge color="slate">{col.channel}</Badge></div>
                <span style={{ fontSize:10, color:C.textMuted }}>{fmt.date(col.created)}</span>
              </div>
              <div style={{ fontSize:12, color:C.textDim }}>{col.notes}</div>
              {col.ptpDate && <div style={{ fontSize:11, color:C.accent, marginTop:3 }}>PTP: {fmt.cur(col.ptpAmount)} by {fmt.date(col.ptpDate)}</div>}
            </div>
          ))}
        </SectionCard>}
      </div>);
    }
    return null;
  }

  const saveProduct = (prod) => {
    if (!canDo("products","create") && !canDo("products","update")) { alert("Permission denied."); return; }
    const isNew = !products.find(p => p.id === prod.id);
    if (isNew) {
      save({ ...data, products: [...products, { ...prod, id:`P${String(products.length+1).padStart(3,"0")}`, createdBy:currentUser.id, createdAt:Date.now() }], audit:[...audit, addAudit("Product Created", prod.name, currentUser.name, `New product: ${prod.name}. Rate: ${prod.baseRate}%. Range: ${fmt.cur(prod.minAmount)}-${fmt.cur(prod.maxAmount)}.`, "Configuration")] });
    } else {
      save({ ...data, products: products.map(p => p.id === prod.id ? { ...p, ...prod } : p), audit:[...audit, addAudit("Product Updated", prod.id, currentUser.name, `Product ${prod.name} updated.`, "Configuration")] });
    }
  };
  const toggleProductStatus = (prodId) => {
    if (!canDo("products","update")) { alert("Permission denied."); return; }
    const p = products.find(x => x.id === prodId);
    if (!p) return;
    const newStatus = p.status === "Active" ? "Suspended" : "Active";
    save({ ...data, products: products.map(x => x.id === prodId ? { ...x, status: newStatus } : x), audit:[...audit, addAudit(`Product ${newStatus}`, prodId, currentUser.name, `${p.name} status changed to ${newStatus}.`, "Configuration")] });
  };

  function Administration() {
    const [adminTab, setAdminTab] = useState("products");
    // Product management
    const blank = { name:"", description:"", idealFor:"", minAmount:100000, maxAmount:5000000, minTerm:3, maxTerm:12, baseRate:42.0, monthlyRate:3.5, repaymentType:"Bullet", arrangementFee:2.0, commitmentFee:0.5, gracePeriod:0, maxLTV:80, minDSCR:1.15, riskClass:"A", ecl:0.70, s1PD:0.006, lgd:0.22, eligibleBEE:[1,2,3,4], eligibleIndustries:["All"], requiredSecurity:[], optionalSecurity:[], status:"Active" };
    const startEdit = (p) => { setProdForm({...p}); setProdEditing(p.id); };
    const startNew = () => { setProdForm({...blank}); setProdEditing("new"); };
    const cancelEdit = () => { setProdForm(null); setProdEditing(null); };
    const handleSaveProd = () => { if (!prodForm.name) return; if (prodEditing === "new") saveProduct(prodForm); else saveProduct({ ...prodForm, id: prodEditing }); cancelEdit(); };
    // User management
    const blankUser = {name:"",email:"",role:"LOAN_OFFICER",initials:"",password:"",status:"Active"};
    const startEditUser = u => { setUserForm({...u,password:""}); setUserEditing(u.id); };
    const startNewUser = () => { setUserForm({...blankUser}); setUserEditing("new"); };
    const cancelUserEdit = () => { setUserForm(null); setUserEditing(null); };
    const handleSaveUser = () => {
      if (!userForm.name||!userForm.email) return;
      const initials = userForm.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
      if (userEditing === "new") {
        const u = { ...userForm, id:`U${String(sysUsers.length+1).padStart(3,"0")}`, initials, createdAt:Date.now() };
        setSysUsers([...sysUsers, u]);
        save({...data, audit:[...audit, addAudit("User Created",u.id,currentUser.name,`${u.name} (${ROLES[u.role]?.label}) created.`,"Configuration")]});
      } else {
        setSysUsers(sysUsers.map(u => u.id===userEditing ? {...u,...userForm,initials} : u));
        save({...data, audit:[...audit, addAudit("User Updated",userEditing,currentUser.name,`${userForm.name} profile updated.`,"Configuration")]});
      }
      cancelUserEdit();
    };
    const toggleUserStatus = id => {
      setSysUsers(sysUsers.map(u => u.id===id ? {...u,status:u.status==="Active"?"Suspended":"Active"} : u));
      const u = sysUsers.find(x=>x.id===id);
      save({...data, audit:[...audit, addAudit(u?.status==="Active"?"User Suspended":"User Reactivated",id,currentUser.name,`${u?.name} status changed.`,"Configuration")]});
    };
    const resetPassword = id => {
      const u = sysUsers.find(x=>x.id===id);
      save({...data, audit:[...audit, addAudit("Password Reset",id,currentUser.name,`Password reset initiated for ${u?.name}.`,"Configuration")]});
      alert(`Password reset link sent to ${u?.email}`);
    };
    const revokeAccess = id => {
      setSysUsers(sysUsers.map(u => u.id===id ? {...u,status:"Revoked",role:"VIEWER"} : u));
      const u = sysUsers.find(x=>x.id===id);
      save({...data, audit:[...audit, addAudit("Access Revoked",id,currentUser.name,`All privileges revoked for ${u?.name}. Role set to Viewer.`,"Configuration")]});
    };
    // Settings
    const handleSaveSettings = () => {
      if (!canDo("settings","update")) { alert("Permission denied."); return; }
      save({ ...data, settings: settingsForm, audit:[...audit, addAudit("Settings Updated", "System", currentUser.name, "Company settings modified.", "Configuration")] });
      setSettingsEditing(false);
    };
    // Business rules
    const startEditRule = r => { setPolicyForm({...r}); setPolicyEditing(r.id); };
    const startNewRule = () => { setPolicyForm({id:"",name:"",category:"Credit",value:"",description:"",status:"Active"}); setPolicyEditing("new"); };
    const handleSaveRule = () => {
      if (!policyForm.name||!policyForm.value) return;
      if (policyEditing==="new") {
        setBusinessRules([...businessRules, {...policyForm, id:`BR-${String(businessRules.length+1).padStart(3,"0")}`, lastUpdated:Date.now(), updatedBy:currentUser.name}]);
        save({...data, audit:[...audit, addAudit("Business Rule Created",policyForm.name,currentUser.name,`New rule: ${policyForm.name} = ${policyForm.value}`,"Configuration")]});
      } else {
        setBusinessRules(businessRules.map(r => r.id===policyEditing ? {...r,...policyForm, lastUpdated:Date.now(), updatedBy:currentUser.name} : r));
        save({...data, audit:[...audit, addAudit("Business Rule Updated",policyEditing,currentUser.name,`${policyForm.name} updated to ${policyForm.value}`,"Configuration")]});
      }
      setPolicyForm(null); setPolicyEditing(null);
    };
    const toggleRule = id => {
      setBusinessRules(businessRules.map(r => r.id===id ? {...r, status:r.status==="Active"?"Suspended":"Active", lastUpdated:Date.now(), updatedBy:currentUser.name} : r));
    };
    // Backup
    const runBackup = () => { setBackupSchedule({...backupSchedule, lastBackup:Date.now()}); save({...data, audit:[...audit, addAudit("Manual Backup","System",currentUser.name,"Manual database backup initiated.","Configuration")]}); };
    const addApiKey = () => { const k = {id:`ak${apiKeys.length+1}`,name:"New API Key",key:`key_${uid()}`,status:"Active",created:Date.now(),lastUsed:null}; setApiKeys([...apiKeys,k]); };
    const revokeApiKey = id => { setApiKeys(apiKeys.map(k=>k.id===id?{...k,status:"Revoked"}:k)); };
    // System health
    const uptime = Math.floor((Date.now() - (now - 30*day)) / 3600000);
    const dbSize = (customers.length*2 + applications.length*5 + loans.length*3 + documents.length + audit.length*0.5).toFixed(1);

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>Administration</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>Product catalog, user management, system configuration & business rules</p>
      <Tab tabs={[
        { key:"products", label:"Product Management", count:products.length },
        { key:"users", label:"User Management", count:sysUsers.length },
        { key:"system", label:"System Admin & Support" },
        { key:"rules", label:"Business Rules & Policies", count:businessRules.length },
      ]} active={adminTab} onChange={setAdminTab} />

      {/* ── Product Management ── */}
      {adminTab === "products" && <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          {canDo("products","create") && <Btn onClick={startNew} icon={I.plus}>New Product</Btn>}
        </div>
        {prodForm && (
          <SectionCard title={prodEditing === "new" ? "Create New Product" : `Edit: ${prodForm.name}`}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Product Name"><Input value={prodForm.name} onChange={e=>setProdForm({...prodForm,name:e.target.value})} /></Field>
              <Field label="Repayment Type"><Select value={prodForm.repaymentType} onChange={e=>setProdForm({...prodForm,repaymentType:e.target.value})} options={["Amortising","Bullet","Balloon","Seasonal"].map(v=>({value:v,label:v}))} /></Field>
              <Field label="Status"><Select value={prodForm.status} onChange={e=>setProdForm({...prodForm,status:e.target.value})} options={["Active","Suspended","Retired"].map(v=>({value:v,label:v}))} /></Field>
            </div>
            <Field label="Description"><Textarea value={prodForm.description} onChange={e=>setProdForm({...prodForm,description:e.target.value})} rows={2} /></Field>
            <Field label="Ideal For"><Input value={prodForm.idealFor||""} onChange={e=>setProdForm({...prodForm,idealFor:e.target.value})} placeholder="Target market description" /></Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Min Amount (R)"><Input type="number" value={prodForm.minAmount} onChange={e=>setProdForm({...prodForm,minAmount:+e.target.value})} /></Field>
              <Field label="Max Amount (R)"><Input type="number" value={prodForm.maxAmount} onChange={e=>setProdForm({...prodForm,maxAmount:+e.target.value})} /></Field>
              <Field label="Min Term (m)"><Input type="number" value={prodForm.minTerm} onChange={e=>setProdForm({...prodForm,minTerm:+e.target.value})} /></Field>
              <Field label="Max Term (m)"><Input type="number" value={prodForm.maxTerm} onChange={e=>setProdForm({...prodForm,maxTerm:+e.target.value})} /></Field>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Base Rate % (ann.)"><Input type="number" value={prodForm.baseRate} onChange={e=>setProdForm({...prodForm,baseRate:+e.target.value})} /></Field>
              <Field label="Monthly Rate %"><Input type="number" value={prodForm.monthlyRate||""} onChange={e=>setProdForm({...prodForm,monthlyRate:+e.target.value})} /></Field>
              <Field label="Arrangement Fee %"><Input type="number" value={prodForm.arrangementFee} onChange={e=>setProdForm({...prodForm,arrangementFee:+e.target.value})} /></Field>
              <Field label="Commitment Fee %"><Input type="number" value={prodForm.commitmentFee} onChange={e=>setProdForm({...prodForm,commitmentFee:+e.target.value})} /></Field>
              <Field label="Grace Period (m)"><Input type="number" value={prodForm.gracePeriod} onChange={e=>setProdForm({...prodForm,gracePeriod:+e.target.value})} /></Field>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Max LTV %"><Input type="number" value={prodForm.maxLTV} onChange={e=>setProdForm({...prodForm,maxLTV:+e.target.value})} /></Field>
              <Field label="Min DSCR"><Input type="number" value={prodForm.minDSCR} onChange={e=>setProdForm({...prodForm,minDSCR:+e.target.value})} step="0.05" /></Field>
              <Field label="Risk Class"><Select value={prodForm.riskClass||"A"} onChange={e=>setProdForm({...prodForm,riskClass:e.target.value})} options={["A","B","C","D"].map(v=>({value:v,label:`Class ${v}`}))} /></Field>
              <Field label="ECL Rate %"><Input type="number" value={prodForm.ecl||""} onChange={e=>setProdForm({...prodForm,ecl:+e.target.value})} step="0.01" /></Field>
              <Field label="S1 PD"><Input type="number" value={prodForm.s1PD||""} onChange={e=>setProdForm({...prodForm,s1PD:+e.target.value})} step="0.001" /></Field>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="LGD"><Input type="number" value={prodForm.lgd||""} onChange={e=>setProdForm({...prodForm,lgd:+e.target.value})} step="0.01" /></Field>
              <Field label="Eligible BEE Levels (comma-sep)"><Input value={(prodForm.eligibleBEE||[]).join(",")} onChange={e=>setProdForm({...prodForm,eligibleBEE:e.target.value.split(",").map(Number).filter(Boolean)})} /></Field>
            </div>

            {/* Security Instruments */}
            <div style={{ marginTop:12, marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.textDim, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Security Instruments</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:C.text, marginBottom:8 }}>Required (mandatory for this product)</div>
                  {Object.values(SECURITY_INSTRUMENTS).map(inst => {
                    const isChecked = (prodForm.requiredSecurity||[]).includes(inst.id);
                    return (
                      <label key={inst.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"4px 0", cursor:"pointer", fontSize:12 }}>
                        <input type="checkbox" checked={isChecked} onChange={() => {
                          const current = prodForm.requiredSecurity || [];
                          const next = isChecked ? current.filter(x=>x!==inst.id) : [...current, inst.id];
                          const optNext = (prodForm.optionalSecurity||[]).filter(x=>x!==inst.id);
                          setProdForm({...prodForm, requiredSecurity:next, optionalSecurity:optNext});
                        }} style={{ marginTop:2, accentColor:C.accent }} />
                        <div>
                          <div style={{ fontWeight:500, color:C.text }}>{inst.name}</div>
                          <div style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{inst.desc.split(".")[0]}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:C.text, marginBottom:8 }}>Optional (recommended, reduces risk)</div>
                  {Object.values(SECURITY_INSTRUMENTS).filter(inst => !(prodForm.requiredSecurity||[]).includes(inst.id)).map(inst => {
                    const isChecked = (prodForm.optionalSecurity||[]).includes(inst.id);
                    return (
                      <label key={inst.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"4px 0", cursor:"pointer", fontSize:12 }}>
                        <input type="checkbox" checked={isChecked} onChange={() => {
                          const current = prodForm.optionalSecurity || [];
                          const next = isChecked ? current.filter(x=>x!==inst.id) : [...current, inst.id];
                          setProdForm({...prodForm, optionalSecurity:next});
                        }} style={{ marginTop:2, accentColor:C.accent }} />
                        <div>
                          <div style={{ fontWeight:500, color:C.textDim }}>{inst.name}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display:"flex", gap:8, marginTop:12 }}><Btn onClick={handleSaveProd}>Save Product</Btn><Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn></div>
          </SectionCard>
        )}
        <Table columns={[
          { label:"Product", render:r=><div><div style={{ fontWeight:600, fontSize:12 }}>{r.name}</div><div style={{ fontSize:10, color:C.textMuted }}>{r.idealFor||r.description?.substring(0,60)}</div></div> },
          { label:"Type", render:r=><span style={{ fontSize:11 }}>{r.repaymentType||"Amortising"}</span> },
          { label:"Rate", render:r=><span style={{ fontSize:12, fontWeight:600 }}>{r.monthlyRate||r.baseRate}%{r.monthlyRate?"/mo":""}</span> },
          { label:"Amount Range", render:r=><span style={{ fontSize:11 }}>{fmt.cur(r.minAmount)} – {fmt.cur(r.maxAmount)}</span> },
          { label:"Term", render:r=><span style={{ fontSize:11 }}>{r.minTerm<1?Math.round(r.minTerm*30)+"d":r.minTerm+"m"}–{r.maxTerm}m</span> },
          { label:"Class", render:r=><Badge color={r.riskClass==="A"?"green":r.riskClass==="B"?"amber":r.riskClass==="C"?"red":"gray"}>{r.riskClass||"—"}</Badge> },
          { label:"ECL", render:r=><span style={{ fontSize:11, fontFamily:"monospace" }}>{r.ecl!=null?`${r.ecl}%`:"—"}</span> },
          { label:"Security", render:r => {
            const sec = getProductSecurity(r.id);
            const reqNames = (sec.required||[]).map(id => SECURITY_INSTRUMENTS[id]?.name?.split(" ")[0]).filter(Boolean);
            const optCount = (sec.optional||[]).length;
            return <div style={{ fontSize:10 }}>
              {reqNames.length > 0 && <div style={{ color:C.text, fontWeight:500 }}>{reqNames.join(", ")}</div>}
              {optCount > 0 && <div style={{ color:C.textMuted }}>+{optCount} optional</div>}
              {reqNames.length === 0 && optCount === 0 && <span style={{ color:C.textMuted }}>None set</span>}
            </div>;
          }},
          { label:"Status", render:r=>statusBadge(r.status||"Active") },
          { label:"Actions", render:r=><div style={{ display:"flex", gap:4 }}>
            {canDo("products","update") && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();startEdit(r)}}>Edit</Btn>}
            {canDo("products","update") && <Btn size="sm" variant={r.status==="Active"?"ghost":"secondary"} onClick={e=>{e.stopPropagation();toggleProductStatus(r.id)}}>{r.status==="Active"?"Suspend":"Activate"}</Btn>}
          </div> },
        ]} rows={products} />
      </div>}

      {/* ── User Management ── */}
      {adminTab === "users" && <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          {canDo("settings","create") && <Btn onClick={startNewUser} icon={I.plus}>Add User</Btn>}
        </div>
        {userForm && (
          <SectionCard title={userEditing==="new"?"Create New User":`Edit: ${userForm.name}`}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Full Name *"><Input value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})} placeholder="e.g. Jane Doe" /></Field>
              <Field label="Email *"><Input value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} placeholder="jane@tqacapital.co.za" /></Field>
              <Field label="Role"><Select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})} options={Object.entries(ROLES).map(([k,v])=>({value:k,label:v.label}))} /></Field>
            </div>
            {userEditing==="new" && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Temporary Password"><Input type="password" value={userForm.password||""} onChange={e=>setUserForm({...userForm,password:e.target.value})} placeholder="Min 8 characters" /></Field>
              <Field label="Status"><Select value={userForm.status||"Active"} onChange={e=>setUserForm({...userForm,status:e.target.value})} options={["Active","Suspended"].map(v=>({value:v,label:v}))} /></Field>
            </div>}
            <div style={{ display:"flex", gap:8 }}><Btn onClick={handleSaveUser}>Save User</Btn><Btn variant="ghost" onClick={cancelUserEdit}>Cancel</Btn></div>
          </SectionCard>
        )}
        <Table columns={[
          { label:"User", render:r=><div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ width:24, height:24, borderRadius:10, background:r.status==="Active"?C.surface2:C.red+"20", border:`1px solid ${r.status==="Active"?C.border:C.red}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, color:r.status==="Active"?C.textDim:C.red }}>{r.initials}</div><div><div style={{ fontWeight:500, fontSize:12 }}>{r.name}</div><div style={{ fontSize:10, color:C.textMuted }}>{r.email}</div></div></div> },
          { label:"Role", render:r=><Badge color={r.role==="ADMIN"?"purple":r.role==="EXEC"?"blue":"gray"}>{ROLES[r.role]?.label||r.role}</Badge> },
          { label:"Tier", render:r=><span style={{ fontSize:11 }}>{ROLES[r.role]?.tier}</span> },
          { label:"Approval Limit", render:r=>APPROVAL_LIMITS[r.role]?(APPROVAL_LIMITS[r.role]===Infinity?"Unlimited":fmt.cur(APPROVAL_LIMITS[r.role])):<span style={{ color:C.textMuted }}>—</span> },
          { label:"Status", render:r=><Badge color={r.status==="Active"?"green":r.status==="Suspended"?"amber":"red"}>{r.status||"Active"}</Badge> },
          { label:"Actions", render:r=>canDo("settings","update") && r.id!==currentUser.id ? <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            <Btn size="sm" variant="ghost" onClick={()=>startEditUser(r)}>Edit</Btn>
            <Btn size="sm" variant="ghost" onClick={()=>resetPassword(r.id)}>Reset Pwd</Btn>
            <Btn size="sm" variant={r.status==="Active"?"ghost":"secondary"} onClick={()=>toggleUserStatus(r.id)}>{r.status==="Active"?"Suspend":"Activate"}</Btn>
            {r.status!=="Revoked" && <Btn size="sm" variant="danger" onClick={()=>{if(confirm(`Revoke all access for ${r.name}?`))revokeAccess(r.id)}}>Revoke</Btn>}
          </div> : <span style={{ fontSize:10, color:C.textMuted }}>{r.id===currentUser.id?"(You)":"View only"}</span> },
        ]} rows={sysUsers} />
        <SectionCard title="Approval Authority Matrix">
          <Table columns={[
            { label:"Role", render:r=><span style={{ fontWeight:500 }}>{ROLES[r.role]?.label}</span> },
            { label:"Max Amount", render:r=>r.limit === Infinity ? "Unlimited" : r.limit > 0 ? fmt.cur(r.limit) : <span style={{ color:C.textMuted }}>No approval authority</span> },
            { label:"Tier", render:r=>String(ROLES[r.role]?.tier) },
            { label:"Active Users", render:r=>sysUsers.filter(u=>u.role===r.role&&(u.status||"Active")==="Active").length },
          ]} rows={Object.keys(ROLES).map(k => ({ role:k, limit: APPROVAL_LIMITS[k] || 0 }))} />
        </SectionCard>
      </div>}

      {/* ── System Admin & Support ── */}
      {adminTab === "system" && <div>
        <SectionCard title="Company Details" actions={canDo("settings","update") && !settingsEditing ? <Btn size="sm" variant="ghost" onClick={()=>{setSettingsForm({...(settings||{})});setSettingsEditing(true)}}>Edit</Btn> : null}>
          {!settingsEditing ? (
            <InfoGrid items={[["Company Name", settings?.companyName],["NCR Registration", settings?.ncrReg],["NCR Expiry", settings?.ncrExpiry],["Branch", settings?.branch],["Financial Year-End", settings?.yearEnd],["Address", settings?.address || "East London, Nahoon Valley"]]} />
          ) : (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Company Name"><Input value={settingsForm.companyName||""} onChange={e=>setSettingsForm({...settingsForm,companyName:e.target.value})} /></Field>
                <Field label="NCR Registration"><Input value={settingsForm.ncrReg||""} onChange={e=>setSettingsForm({...settingsForm,ncrReg:e.target.value})} /></Field>
                <Field label="NCR Expiry"><Input value={settingsForm.ncrExpiry||""} onChange={e=>setSettingsForm({...settingsForm,ncrExpiry:e.target.value})} /></Field>
                <Field label="Branch"><Input value={settingsForm.branch||""} onChange={e=>setSettingsForm({...settingsForm,branch:e.target.value})} /></Field>
                <Field label="Year-End"><Input value={settingsForm.yearEnd||""} onChange={e=>setSettingsForm({...settingsForm,yearEnd:e.target.value})} /></Field>
                <Field label="Address"><Input value={settingsForm.address||""} onChange={e=>setSettingsForm({...settingsForm,address:e.target.value})} /></Field>
              </div>
              <div style={{ display:"flex", gap:8 }}><Btn onClick={handleSaveSettings}>Save</Btn><Btn variant="ghost" onClick={()=>setSettingsEditing(false)}>Cancel</Btn></div>
            </div>
          )}
        </SectionCard>
        <SectionCard title="System Health">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            {[["Status","Operational",C.green],["Uptime",`${uptime}h`,C.accent],["DB Size",`~${dbSize} KB`,C.blue],["Active Sessions",sysUsers.filter(u=>(u.status||"Active")==="Active").length,C.purple]].map(([l,v,c],i)=>(
              <div key={i} style={{ background:C.surface2, padding:"12px 12px", border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                <div style={{ fontSize:18, fontWeight:700, color:c, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Backup & Recovery" actions={canDo("settings","update") && <Btn size="sm" variant="secondary" onClick={runBackup}>Run Backup Now</Btn>}>
          <InfoGrid items={[
            ["Schedule", `${backupSchedule.frequency} at ${backupSchedule.time}`],
            ["Retention", `${backupSchedule.retention} days`],
            ["Last Backup", backupSchedule.lastBackup ? fmt.date(backupSchedule.lastBackup) + " " + new Date(backupSchedule.lastBackup).toLocaleTimeString() : "No backups yet"],
            ["Auto-Backup", backupSchedule.autoEnabled ? "Enabled" : "Disabled"],
            ["Storage", "Supabase PostgreSQL + localStorage fallback"],
          ]} />
          {canDo("settings","update") && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop:10 }}>
            <Field label="Frequency"><Select value={backupSchedule.frequency} onChange={e=>setBackupSchedule({...backupSchedule,frequency:e.target.value})} options={["Hourly","Daily","Weekly"].map(v=>({value:v,label:v}))} /></Field>
            <Field label="Time"><Input type="time" value={backupSchedule.time} onChange={e=>setBackupSchedule({...backupSchedule,time:e.target.value})} /></Field>
            <Field label="Retention (days)"><Input type="number" value={backupSchedule.retention} onChange={e=>setBackupSchedule({...backupSchedule,retention:+e.target.value})} /></Field>
          </div>}
        </SectionCard>
        <SectionCard title="API Key Management" actions={canDo("settings","create") && <Btn size="sm" variant="secondary" onClick={addApiKey} icon={I.plus}>Generate Key</Btn>}>
          <Table columns={[
            { label:"Name", render:r=><span style={{ fontWeight:500 }}>{r.name}</span> },
            { label:"Key", render:r=><span style={{ fontFamily:"monospace", fontSize:10, color:C.textDim }}>{r.key}</span> },
            { label:"Status", render:r=><Badge color={r.status==="Active"?"green":"red"}>{r.status}</Badge> },
            { label:"Created", render:r=>fmt.date(r.created) },
            { label:"Last Used", render:r=>r.lastUsed?fmt.date(r.lastUsed):"Never" },
            { label:"Actions", render:r=>r.status==="Active" && canDo("settings","update") ? <Btn size="sm" variant="danger" onClick={()=>revokeApiKey(r.id)}>Revoke</Btn> : null },
          ]} rows={apiKeys} />
        </SectionCard>
        <SectionCard title="Data Management">
          <InfoGrid items={[["Customers",customers.length],["Applications",applications.length],["Active Loans",loans.length],["Documents",documents.length],["Audit Entries",audit.length],["Collections Records",collections.length],["Communications",comms.length],["Database","Supabase (yioqaluxgqxsifclydmd)"]]} />
        </SectionCard>
      </div>}

      {/* ── Business Rules & Policies ── */}
      {adminTab === "rules" && <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          {canDo("settings","create") && <Btn onClick={startNewRule} icon={I.plus}>New Rule</Btn>}
        </div>
        {policyForm && (
          <SectionCard title={policyEditing==="new"?"Create Business Rule":`Edit: ${policyForm.name}`}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Rule Name *"><Input value={policyForm.name} onChange={e=>setPolicyForm({...policyForm,name:e.target.value})} /></Field>
              <Field label="Category"><Select value={policyForm.category} onChange={e=>setPolicyForm({...policyForm,category:e.target.value})} options={["Credit","Collections","Finance","Compliance","Operations","Governance"].map(v=>({value:v,label:v}))} /></Field>
              <Field label="Value *"><Input value={policyForm.value} onChange={e=>setPolicyForm({...policyForm,value:e.target.value})} placeholder="e.g. 1.25x, 30 days, R500,000" /></Field>
            </div>
            <Field label="Description"><Textarea value={policyForm.description||""} onChange={e=>setPolicyForm({...policyForm,description:e.target.value})} rows={2} /></Field>
            <div style={{ display:"flex", gap:8, marginTop:10 }}><Btn onClick={handleSaveRule}>Save Rule</Btn><Btn variant="ghost" onClick={()=>{setPolicyForm(null);setPolicyEditing(null)}}>Cancel</Btn></div>
          </SectionCard>
        )}
        <Table columns={[
          { label:"Rule", render:r=><div><div style={{ fontWeight:600, fontSize:12 }}>{r.name}</div><div style={{ fontSize:10, color:C.textMuted }}>{r.description}</div></div> },
          { label:"Category", render:r=><Badge color={r.category==="Credit"?"blue":r.category==="Collections"?"amber":r.category==="Compliance"?"purple":"gray"}>{r.category}</Badge> },
          { label:"Value", render:r=><span style={{ fontSize:13, fontWeight:700, color:C.accent }}>{r.value}</span> },
          { label:"Status", render:r=><Badge color={r.status==="Active"?"green":"red"}>{r.status}</Badge> },
          { label:"Updated", render:r=><div><div style={{ fontSize:10 }}>{fmt.date(r.lastUpdated)}</div><div style={{ fontSize:10, color:C.textMuted }}>{r.updatedBy}</div></div> },
          { label:"Actions", render:r=>canDo("settings","update") ? <div style={{ display:"flex", gap:4 }}>
            <Btn size="sm" variant="ghost" onClick={()=>startEditRule(r)}>Edit</Btn>
            <Btn size="sm" variant={r.status==="Active"?"ghost":"secondary"} onClick={()=>toggleRule(r.id)}>{r.status==="Active"?"Suspend":"Activate"}</Btn>
          </div> : null },
        ]} rows={businessRules} />
        <SectionCard title="RBAC Permission Matrix">
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead><tr style={{ borderBottom:`2px solid ${C.border}` }}>
                <th style={{ textAlign:"left", padding:"4px 6px", fontWeight:600, color:C.text }}>Module</th>
                {Object.keys(ROLES).map(r=><th key={r} style={{ textAlign:"center", padding:"4px 3px", fontWeight:500, color:C.textDim, fontSize:10 }}>{r.replace("_"," ")}</th>)}
              </tr></thead>
              <tbody>{Object.keys(PERMS).map(mod=>(
                <tr key={mod} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"4px 6px", fontWeight:500, color:C.text }}>{mod}</td>
                  {Object.keys(ROLES).map(r=><td key={r} style={{ textAlign:"center", padding:"4px 2px", color:PERMS[mod]?.[r]?C.textDim:C.border, fontSize:10 }}>{PERMS[mod]?.[r]||"—"}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard title="Regulatory Framework">
          <div style={{ fontSize:12, color:C.textDim, lineHeight:1.5 }}>
            {[["National Credit Act (NCA)","Affordability assessments, pre-agreement disclosure, debt collection standards"],
              ["FICA / AML","KYC verification, sanctions screening, suspicious transaction reporting to FIC"],
              ["POPIA","Data minimisation, privacy notices, customer rights, secure processing"],
              ["BB-BEE Act","Empowerment verification, ownership tracking, development impact reporting"],
              ["IFRS 9","Expected credit loss provisioning, 3-stage impairment model"]
            ].map(([title,desc],i)=><div key={i} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}` }}><span style={{ fontWeight:600, color:C.text }}>{title}:</span> {desc}</div>)}
          </div>
        </SectionCard>
      </div>}
    </div>);
  }

  function NewAppModal() {
    const [form, setForm] = useState({ custId: customers[0]?.id, product: products.find(p=>p.status==="Active")?.id || products[0]?.id, amount: "", term: "36", purpose: "" });
    const p = prod(form.product);
    const c = cust(form.custId);
    const activeProducts = products.filter(pr => pr.status === "Active");
    const amt = +form.amount;
    const trm = +form.term;
    const errors = [];
    if (p && amt) {
      if (amt < p.minAmount) errors.push(`Below minimum (${fmt.cur(p.minAmount)})`);
      if (amt > p.maxAmount) errors.push(`Exceeds maximum (${fmt.cur(p.maxAmount)})`);
    }
    if (p && trm) {
      if (trm < p.minTerm) errors.push(`Term below minimum (${p.minTerm}m)`);
      if (trm > p.maxTerm) errors.push(`Term exceeds maximum (${p.maxTerm}m)`);
    }
    if (p && c && p.eligibleBEE && !p.eligibleBEE.includes(0) && !(p.eligibleIndustries||[]).includes("All")) {
      if (c.beeLevel && !p.eligibleBEE.includes(c.beeLevel)) errors.push(`Customer BEE Level ${c.beeLevel} not eligible (requires ${p.eligibleBEE.join(",")})`);
    }
    if (p && p.eligibleBEE && !(p.eligibleBEE.length===4) && c?.beeLevel && !p.eligibleBEE.includes(c.beeLevel)) {
      errors.push(`BEE Level ${c.beeLevel} not eligible for ${p.name} (requires Level ${p.eligibleBEE.join(",")})`);
    }
    const canSubmit = form.amount && form.purpose && errors.length === 0;

    return (
      <Modal open={modal === "newApp"} onClose={() => setModal(null)} title="New Loan Application" width={560}>
        <Field label="Customer"><Select value={form.custId} onChange={e=>setForm({...form,custId:e.target.value})} options={customers.map(c=>({value:c.id,label:`${c.name} (BEE ${c.beeLevel})`}))} /></Field>
        <Field label="Loan Product"><Select value={form.product} onChange={e=>setForm({...form,product:e.target.value})} options={activeProducts.map(p=>({value:p.id,label:`${p.name} (${p.baseRate}%, ${p.repaymentType||"Amortising"})`}))} /></Field>
        {p && <div style={{ background:C.surface2, padding:12, marginBottom:12, fontSize:11, color:C.textDim, border:`1px solid ${C.border}`, lineHeight:1.6 }}>
          {p.description}<br/>
          Range: {fmt.cur(p.minAmount)} – {fmt.cur(p.maxAmount)} · Term: {p.minTerm}–{p.maxTerm}m · Grace: {p.gracePeriod||0}m<br/>
          Fees: Arrangement {p.arrangementFee||0}% · Commitment {p.commitmentFee||0}% · Max LTV: {p.maxLTV||80}% · Min DSCR: {p.minDSCR||1.2}x<br/>
          BEE Eligibility: Level {(p.eligibleBEE||[]).join(", ")}
        </div>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Amount (R)"><Input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder={p?`${fmt.cur(p.minAmount)} – ${fmt.cur(p.maxAmount)}`:"e.g. 500000"} /></Field>
          <Field label="Term (months)"><Input type="number" value={form.term} onChange={e=>setForm({...form,term:e.target.value})} placeholder={p?`${p.minTerm} – ${p.maxTerm}`:"e.g. 36"} /></Field>
        </div>
        {errors.length > 0 && <div style={{ background:"#fff5f5", border:`1px solid ${C.red}`, padding:"8px 12px", marginBottom:12, fontSize:11, color:C.red }}>{errors.map((e,i)=><div key={i}>{e}</div>)}</div>}
        <Field label="Purpose of Loan"><Textarea value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})} placeholder="Describe the purpose..." rows={3} /></Field>
        <div style={{ display:"flex", gap:12, marginTop:16 }}>
          <Btn variant="ghost" onClick={()=>setModal(null)} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={()=>{if(canSubmit){submitApp(form);setModal(null)}}} disabled={!canSubmit}>Submit Application</Btn>
        </div>
      </Modal>
    );
  }

  return (
    <div style={{ fontFamily:"'Outfit','Segoe UI',system-ui,sans-serif", background:C.bg, minHeight:"100vh", display:"flex", color:C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>

      
      {/* Mobile Bottom Action Bar */}
      <div className="kb-mobile-fab" style={{ display:"none", position:"fixed", bottom:0, left:0, right:0, background:C.surface, borderTop:`1px solid ${C.border}`, padding:"8px 12px", zIndex:50, boxShadow:"0 -2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex", justifyContent:"space-around", alignItems:"center" }}>
          {[["dashboard","Dashboard",I.grid],["customers","Customers",I.users],["origination","Apps",I.file],["loanbook","Loans",I.book],["collections","Collect",I.alert]].map(([key,label,icon])=>(
            <button key={key} onClick={()=>navTo(key)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, background:"none", border:"none", cursor:"pointer", color:page===key?C.accent:C.textDim, padding:"4px 8px", fontFamily:"inherit", fontSize:10, fontWeight:page===key?600:400 }}>
              <span style={{ fontSize:16 }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Toast Notification */}
      {toast && <div className="kb-toast" style={{ background: toast.type === "error" ? C.red : toast.type === "warning" ? C.amber : C.green, color:"#fff", padding:"10px 20px", borderRadius:6, fontSize:12, fontWeight:500, boxShadow:"0 4px 16px rgba(0,0,0,0.15)", display:"flex", alignItems:"center", gap:8, maxWidth:400 }}>
        <span>{toast.type === "error" ? "✕" : toast.type === "warning" ? "⚠" : "✓"}</span>
        <span>{toast.msg}</span>
      </div>}
{/* Sidebar */}
      <div className="kb-mobile-overlay" onClick={()=>setMobileMenuOpen(false)} style={{ display:mobileMenuOpen?"block":"none", position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:998, backdropFilter:"blur(2px)" }} />
      <aside className="kb-mobile-sidebar" style={{ display:mobileMenuOpen?"flex":"none", position:"fixed", top:0, left:0, bottom:0, width:260, background:C.surface, zIndex:999, flexDirection:"column", boxShadow:"4px 0 16px rgba(0,0,0,0.1)", overflow:"hidden" }}>
        <div style={{ padding:"16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div><div style={{ fontSize:14, fontWeight:600, color:C.text }}>KwikBridge</div><div style={{ fontSize:10, color:C.textMuted, letterSpacing:0.5 }}>LOAN MANAGEMENT</div></div>
          <button onClick={()=>setMobileMenuOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, padding:4 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <nav style={{ flex:1, padding:"8px", overflowY:"auto" }}>
          {staffNavItems.map(n => {
            const active = page === n.key && !detail;
            return (<button key={n.key} onClick={()=>{navTo(n.key);setMobileMenuOpen(false)}} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"10px 12px", border:"none", background:active?C.accent+"11":"transparent", color:active?C.accent:C.textDim, fontSize:13, fontWeight:active?600:400, cursor:"pointer", textAlign:"left", fontFamily:"inherit", borderRadius:4, marginBottom:2 }}>{n.icon}<span>{n.label}</span>{n.badge > 0 && <span style={{ marginLeft:"auto", fontSize:10, background:C.red, color:"#fff", padding:"1px 6px", borderRadius:8 }}>{n.badge}</span>}</button>);
          })}
        </nav>
      </aside>
      <aside className="kb-sidebar" style={{ width:sideCollapsed?56:220, background:`linear-gradient(180deg, ${C.surface} 0%, ${C.surface2} 100%)`, borderRight:`1px solid ${C.border}`, transition:"width .2s ease", flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:sideCollapsed?"12px 8px":"14px 14px 10px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={()=>setSideCollapsed(!sideCollapsed)}>
          {!sideCollapsed && <div><div style={{ fontSize:14, fontWeight:700, color:C.accent, letterSpacing:-0.3 }}>KwikBridge</div><div style={{ fontSize:10, color:C.textMuted, letterSpacing:0.5 }}>LOAN MANAGEMENT</div></div>}
        </div>
        <nav style={{ flex:1, padding:"8px 4px", overflowY:"auto" }}>
          {staffNavItems.map(n => {
            const active = page === n.key && !detail;
            return (<button key={n.key} onClick={()=>{navTo(n.key)}} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:sideCollapsed?"7px 0":"6px 10px", justifyContent:sideCollapsed?"center":"flex-start", background:active?C.accent+"0d":"transparent", color:active?C.accent:C.textDim, border:"none", borderLeft:active?`3px solid ${C.accent}`:"3px solid transparent", fontSize:12, fontWeight:active?600:400, cursor:"pointer", marginBottom:1, fontFamily:"inherit", borderRadius:"0 6px 6px 0", transition:"all .15s ease" }}>
              {n.icon}
              {!sideCollapsed && <span style={{ flex:1, textAlign:"left" }}>{n.label}</span>}
              {!sideCollapsed && n.count != null && n.count > 0 && <span style={{ fontSize:10, color:C.textMuted }}>{n.count}</span>}
            </button>);
          })}
        </nav>
        {!sideCollapsed && <div style={{ padding:"8px 12px 12px", borderTop:`1px solid ${C.border}` }}>
          <div style={{ fontSize:10, fontWeight:500, color:C.text, marginBottom:2 }}>{currentUser.name}</div>
          <div style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>{ROLES[role]?.label}</div>
          <div style={{ fontSize:10, color:C.textMuted, lineHeight:1.5, letterSpacing:0.2 }}>TQA Capital<br/>NCR: {settings?.ncrReg||"—"}<br/>Valid: {settings?.ncrExpiry||"—"}</div>
          <div style={{ display:"flex", gap:4, marginTop:8 }}>
            <button onClick={reset} style={{ background:"none", border:`1px solid ${C.border}`, color:C.textMuted, borderRadius:10, padding:"2px 8px", fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>Reset Demo</button>
            <button onClick={handleSignOut} style={{ background:"none", border:`1px solid ${C.border}`, color:C.red, borderRadius:10, padding:"2px 8px", fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>Sign Out</button>
          </div>
        </div>}
      </aside>

      {/* Main */}
      <div className="kb-main" style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, position:"sticky", top:0, zIndex:10, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button className="kb-hamburger" onClick={()=>setMobileMenuOpen(!mobileMenuOpen)} style={{ background:"none", border:"none", cursor:"pointer", color:C.text, padding:"4px", display:"none", alignItems:"center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg></button>
            {(pageHistory.length > 0 || detail) && <button onClick={()=>{if(detail){setDetail(null)}else{goBack()}}} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, padding:"4px 2px", display:"flex", alignItems:"center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>}
            <div className="kb-header-search" style={{ display:"flex", alignItems:"center", gap:8, background:C.surface2, padding:"4px 10px", width:250, border:`1px solid ${C.border}` }}>
              {I.search}
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ border:"none", background:"transparent", outline:"none", fontSize:12, color:C.text, width:"100%", fontFamily:"inherit" }} />
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ position:"relative" }}>
              <button onClick={()=>setNotifOpen(!notifOpen)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, position:"relative", padding:4 }}>
                {I.bell}
                {unread>0 && <span style={{ position:"absolute", top:-2, right:-2, width:14, height:14, borderRadius:7, background:C.red, color:C.white, fontSize:10, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center" }}>{unread}</span>}
              </button>
              {notifOpen && <div style={{ position:"absolute", right:0, top:34, width:340, background:C.surface, border:`1px solid ${C.border}`, boxShadow:"0 4px 16px rgba(0,0,0,0.06)", zIndex:100, maxHeight:380, overflow:"auto" }}>
                <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, fontSize:12, fontWeight:600, color:C.text }}>Notifications ({unread})</div>
                {alerts.slice(0,8).map(a => (
                  <div key={a.id} style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}`, opacity:a.read?0.35:1, cursor:"pointer" }} onClick={()=>{markRead(a.id)}}>
                    <div style={{ fontSize:11, fontWeight:500, color:C.text }}>{a.title}</div>
                    <div style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{a.msg}</div>
                  </div>
                ))}
              </div>}
            </div>
            <div style={{ width:1, height:20, background:C.border }} />
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:2, background:C.surface2, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, color:C.textDim }}>{currentUser.initials}</div>
              <div>
                <select value={currentUser.id} onChange={e=>{const u=sysUsers.find(u=>u.id===e.target.value);if(u){setCurrentUser(u);setDetail(null)}}} style={{ border:"none", background:"transparent", fontSize:11, fontWeight:500, color:C.text, fontFamily:"inherit", outline:"none", cursor:"pointer", maxWidth:160 }}>
                  {sysUsers.filter(u=>(u.status||"Active")==="Active").map(u=><option key={u.id} value={u.id}>{u.name} ({ROLES[u.role]?.label})</option>)}
                </select>
                {authSession?.user?.email && <div style={{ fontSize:10, color:C.textMuted }}>{authSession.user.email}</div>}
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex:1, overflow:"auto", padding:16 }} onClick={()=>notifOpen&&setNotifOpen(false)}>
          {renderPage()}
        </main>
      </div>

      <NewAppModal />
    </div>
  );
}
