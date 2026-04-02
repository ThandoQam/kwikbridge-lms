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
const SUPABASE_KEY = "sb_publishable_5-mJwKTUJKxdZSTXZMJd-A_89ZkNWrM";
const sb = (table) => `${SUPABASE_URL}/rest/v1/${table}`;
const sbHeaders = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" };
const sbGet = async (table) => { const r = await fetch(sb(table) + "?order=id", { headers: sbHeaders }); return r.ok ? r.json() : []; };
const sbUpsert = async (table, rows) => { if (!rows?.length) return; await fetch(sb(table), { method: "POST", headers: { ...sbHeaders, "Prefer": "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) }); };
const sbDelete = async (table, id) => { await fetch(sb(table) + `?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: sbHeaders }); };

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
  bg: "#f5f5f7", surface: "#ffffff", surface2: "#fafafa", surface3: "#f5f5f7",
  border: "#e5e5e5", borderLight: "#d4d4d4",
  text: "#1a1a2e", textDim: "#52525b", textMuted: "#a1a1aa",
  accent: "#1a1a2e", accentDim: "#3f3f46", accentGlow: "#f5f5f7",
  green: "#15803d", greenDim: "#166534", greenBg: "#f0fdf4",
  amber: "#a16207", amberDim: "#854d0e", amberBg: "#fefce8",
  red: "#b91c1c", redDim: "#991b1b", redBg: "#fef2f2",
  purple: "#6d28d9", purpleBg: "#faf5ff",
  blue: "#1d4ed8", blueBg: "#eff6ff",
  white: "#ffffff",
};

const ROLES = {
  ADMIN:       { id:"ADMIN",       label:"System Admin",       tier:0 },
  EXEC:        { id:"EXEC",        label:"Executive",          tier:1 },
  CREDIT_HEAD: { id:"CREDIT_HEAD", label:"Head of Credit",     tier:2 },
  COMPLIANCE:  { id:"COMPLIANCE",  label:"Compliance Officer",  tier:2 },
  CREDIT_SNR:  { id:"CREDIT_SNR",  label:"Senior Credit Analyst", tier:3 },
  CREDIT:      { id:"CREDIT",      label:"Credit Analyst",     tier:3 },
  LOAN_OFFICER:{ id:"LOAN_OFFICER",label:"Loan Officer",       tier:4 },
  COLLECTIONS: { id:"COLLECTIONS", label:"Collections Specialist", tier:4 },
  FINANCE:     { id:"FINANCE",     label:"Finance Officer",    tier:3 },
  AUDITOR:     { id:"AUDITOR",     label:"Internal Auditor",   tier:3 },
  VIEWER:      { id:"VIEWER",      label:"Report Viewer",      tier:5 },
};

const PERMS = {
  dashboard:     { ADMIN:"view,export", EXEC:"view,export", CREDIT_HEAD:"view,export", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view", COLLECTIONS:"view", FINANCE:"view", AUDITOR:"view", VIEWER:"view" },
  customers:     { ADMIN:"view,create,update,delete", EXEC:"view", CREDIT_HEAD:"view,update", COMPLIANCE:"view,update", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view,create,update", COLLECTIONS:"view", FINANCE:"view", AUDITOR:"view", VIEWER:"" },
  origination:   { ADMIN:"view,create,update,delete,assign", EXEC:"view", CREDIT_HEAD:"view,assign", COMPLIANCE:"view", CREDIT_SNR:"view,create,update", CREDIT:"view,create,update", LOAN_OFFICER:"view,create,update,assign", COLLECTIONS:"", FINANCE:"", AUDITOR:"view", VIEWER:"" },
  underwriting:  { ADMIN:"view,update,approve,signoff", EXEC:"view,approve", CREDIT_HEAD:"view,update,approve,signoff,assign", COMPLIANCE:"view,signoff", CREDIT_SNR:"view,update,approve,signoff", CREDIT:"view,update,signoff", LOAN_OFFICER:"view,update,signoff", COLLECTIONS:"", FINANCE:"", AUDITOR:"view", VIEWER:"" },
  loans:         { ADMIN:"view,update", EXEC:"view", CREDIT_HEAD:"view,update", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view,update", COLLECTIONS:"view", FINANCE:"view,update", AUDITOR:"view", VIEWER:"view" },
  servicing:     { ADMIN:"view,create,update", EXEC:"view", CREDIT_HEAD:"view", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view,update", COLLECTIONS:"view", FINANCE:"view,create,update", AUDITOR:"view", VIEWER:"" },
  collections:   { ADMIN:"view,create,update,assign,approve", EXEC:"view,approve", CREDIT_HEAD:"view,approve", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view,create,update", COLLECTIONS:"view,create,update,assign", FINANCE:"view", AUDITOR:"view", VIEWER:"" },
  provisioning:  { ADMIN:"view,update,approve", EXEC:"view,approve", CREDIT_HEAD:"view,approve", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"", COLLECTIONS:"", FINANCE:"view,update,approve", AUDITOR:"view", VIEWER:"" },
  governance:    { ADMIN:"view,update", EXEC:"view", CREDIT_HEAD:"view", COMPLIANCE:"view,update", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view", COLLECTIONS:"view", FINANCE:"view", AUDITOR:"view,export", VIEWER:"" },
  statutory:     { ADMIN:"view,update", EXEC:"view", CREDIT_HEAD:"view", COMPLIANCE:"view,create,update", CREDIT_SNR:"", CREDIT:"", LOAN_OFFICER:"", COLLECTIONS:"", FINANCE:"view,update", AUDITOR:"view", VIEWER:"" },
  documents:     { ADMIN:"view,create,update,delete,approve", EXEC:"view", CREDIT_HEAD:"view,approve", COMPLIANCE:"view,update,approve", CREDIT_SNR:"view,update", CREDIT:"view,update", LOAN_OFFICER:"view,create,update,approve", COLLECTIONS:"view", FINANCE:"view", AUDITOR:"view", VIEWER:"" },
  reports:       { ADMIN:"view,export", EXEC:"view,export", CREDIT_HEAD:"view,export", COMPLIANCE:"view,export", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view", COLLECTIONS:"view", FINANCE:"view,export", AUDITOR:"view,export", VIEWER:"view,export" },
  comms:         { ADMIN:"view,create", EXEC:"view", CREDIT_HEAD:"view,create", COMPLIANCE:"view", CREDIT_SNR:"view,create", CREDIT:"view,create", LOAN_OFFICER:"view,create", COLLECTIONS:"view,create", FINANCE:"view", AUDITOR:"view", VIEWER:"" },
  products:      { ADMIN:"view,create,update,delete", EXEC:"view", CREDIT_HEAD:"view,create,update", COMPLIANCE:"view", CREDIT_SNR:"view", CREDIT:"view", LOAN_OFFICER:"view", COLLECTIONS:"", FINANCE:"view", AUDITOR:"view", VIEWER:"" },
  settings:      { ADMIN:"view,create,update,delete", EXEC:"view", CREDIT_HEAD:"", COMPLIANCE:"view", CREDIT_SNR:"", CREDIT:"", LOAN_OFFICER:"", COLLECTIONS:"", FINANCE:"view", AUDITOR:"view", VIEWER:"" },
};

const APPROVAL_LIMITS = {
  CREDIT: 250000, CREDIT_SNR: 500000, CREDIT_HEAD: 1000000, EXEC: 5000000, ADMIN: Infinity,
};

const SYSTEM_USERS = [
  { id:"U001", name:"Thando Qamarana", initials:"TQ", email:"thando@thandoq.co.za", role:"ADMIN" },
  { id:"U002", name:"J. Ndaba", initials:"JN", email:"j.ndaba@thandoq.co.za", role:"LOAN_OFFICER" },
  { id:"U003", name:"P. Sithole", initials:"PS", email:"p.sithole@thandoq.co.za", role:"CREDIT" },
  { id:"U004", name:"M. Zulu", initials:"MZ", email:"m.zulu@thandoq.co.za", role:"CREDIT_HEAD" },
  { id:"U005", name:"N. Xaba", initials:"NX", email:"n.xaba@thandoq.co.za", role:"COLLECTIONS" },
  { id:"U006", name:"S. Pillay", initials:"SP", email:"s.pillay@thandoq.co.za", role:"FINANCE" },
  { id:"U007", name:"Compliance Officer", initials:"CO", email:"compliance@thandoq.co.za", role:"COMPLIANCE" },
  { id:"U008", name:"Internal Auditor", initials:"IA", email:"audit@thandoq.co.za", role:"AUDITOR" },
  { id:"U009", name:"Executive Viewer", initials:"EV", email:"exec@thandoq.co.za", role:"EXEC" },
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
  const customers = [
    { id:"C001", name:"Nomsa Trading (Pty) Ltd", contact:"Nomsa Dlamini", email:"nomsa@trading.co.za", phone:"083 456 7890", idNum:"8501015009088", regNum:"2019/123456/07", industry:"Retail", sector:"Consumer Goods", revenue:4200000, employees:12, years:6, beeLevel:2, beeStatus:"Verified", beeExpiry:now+180*day, address:"45 Oxford St, East London", province:"Eastern Cape", ficaStatus:"Verified", ficaDate:now-170*day, riskCategory:"Medium", created:now-180*day },
    { id:"C002", name:"Sipho Agri Cooperative", contact:"Sipho Mabaso", email:"sipho@agri.co.za", phone:"072 321 6543", idNum:"7803025012083", regNum:"2020/654321/07", industry:"Agriculture", sector:"Agro-processing", revenue:2800000, employees:25, years:4, beeLevel:1, beeStatus:"Verified", beeExpiry:now+90*day, address:"Farm 12, Komani", province:"Eastern Cape", ficaStatus:"Verified", ficaDate:now-110*day, riskCategory:"Medium", created:now-120*day },
    { id:"C003", name:"Zenith Tech Solutions", contact:"Ayanda Nkosi", email:"ayanda@zenith.co.za", phone:"061 987 1234", idNum:"9005135048081", regNum:"2021/789012/07", industry:"Technology", sector:"Software & IT", revenue:8500000, employees:18, years:3, beeLevel:3, beeStatus:"Pending Review", beeExpiry:null, address:"10 Settlers Way, Gqeberha", province:"Eastern Cape", ficaStatus:"Verified", ficaDate:now-55*day, riskCategory:"Low", created:now-60*day },
    { id:"C004", name:"Khanyisa Construction", contact:"Thabo Mokoena", email:"thabo@khanyisa.co.za", phone:"079 555 4321", idNum:"8207185036080", regNum:"2018/345678/07", industry:"Construction", sector:"Infrastructure", revenue:12000000, employees:45, years:7, beeLevel:1, beeStatus:"Verified", beeExpiry:now+240*day, address:"88 Fleet St, East London", province:"Eastern Cape", ficaStatus:"Verified", ficaDate:now-290*day, riskCategory:"High", created:now-300*day },
    { id:"C005", name:"Ubuntu Foods (Pty) Ltd", contact:"Lindiwe Khumalo", email:"lindiwe@ubuntufoods.co.za", phone:"084 222 8765", idNum:"8812015074083", regNum:"2022/901234/07", industry:"Food Processing", sector:"FMCG", revenue:3100000, employees:8, years:2, beeLevel:2, beeStatus:"Verified", beeExpiry:now+150*day, address:"Unit 5, Industrial Park, Mthatha", province:"Eastern Cape", ficaStatus:"Pending", ficaDate:null, riskCategory:"Medium", created:now-30*day },
    { id:"C006", name:"Msenge Logistics (Pty) Ltd", contact:"Mandla Gcwabe", email:"mandla@msenge.co.za", phone:"073 888 2211", idNum:"8509105077082", regNum:"2017/567890/07", industry:"Transport", sector:"Logistics", revenue:6700000, employees:32, years:8, beeLevel:1, beeStatus:"Verified", beeExpiry:now+200*day, address:"22 Industrial Rd, East London", province:"Eastern Cape", ficaStatus:"Verified", ficaDate:now-250*day, riskCategory:"Low", created:now-350*day },
  ];

  const products = [
    { id:"P001", name:"SME Term Loan", minAmount:100000, maxAmount:5000000, minTerm:12, maxTerm:60, baseRate:14.5, description:"General purpose business finance for SMEs", repaymentType:"Amortising", arrangementFee:1.5, commitmentFee:0.5, gracePeriod:0, maxLTV:80, minDSCR:1.25, eligibleBEE:[1,2,3,4], eligibleIndustries:["All"], status:"Active", createdBy:"U001", createdAt:now-365*day },
    { id:"P002", name:"Agri Finance", minAmount:200000, maxAmount:10000000, minTerm:12, maxTerm:84, baseRate:13.0, description:"Agricultural and agro-processing finance", repaymentType:"Seasonal", arrangementFee:1.0, commitmentFee:0.5, gracePeriod:3, maxLTV:70, minDSCR:1.2, eligibleBEE:[1,2,3,4], eligibleIndustries:["Agriculture","Food Processing"], status:"Active", createdBy:"U001", createdAt:now-365*day },
    { id:"P003", name:"Innovation Loan", minAmount:250000, maxAmount:3000000, minTerm:24, maxTerm:60, baseRate:15.0, description:"Technology and innovation business finance", repaymentType:"Amortising", arrangementFee:2.0, commitmentFee:0.5, gracePeriod:6, maxLTV:60, minDSCR:1.3, eligibleBEE:[1,2,3], eligibleIndustries:["Technology","Professional Services"], status:"Active", createdBy:"U001", createdAt:now-365*day },
    { id:"P004", name:"Trade Finance", minAmount:100000, maxAmount:8000000, minTerm:3, maxTerm:12, baseRate:12.5, description:"Short-term trade and import/export finance", repaymentType:"Bullet", arrangementFee:1.5, commitmentFee:1.0, gracePeriod:0, maxLTV:90, minDSCR:1.15, eligibleBEE:[1,2,3,4], eligibleIndustries:["All"], status:"Active", createdBy:"U001", createdAt:now-365*day },
    { id:"P005", name:"Asset Finance", minAmount:50000, maxAmount:5000000, minTerm:12, maxTerm:60, baseRate:13.5, description:"Equipment and asset acquisition finance", repaymentType:"Amortising", arrangementFee:1.0, commitmentFee:0, gracePeriod:0, maxLTV:80, minDSCR:1.2, eligibleBEE:[1,2,3,4], eligibleIndustries:["All"], status:"Active", createdBy:"U001", createdAt:now-365*day },
    { id:"P006", name:"Empowerment Finance", minAmount:100000, maxAmount:3000000, minTerm:12, maxTerm:72, baseRate:12.0, description:"Preferential rates for qualifying BEE enterprises", repaymentType:"Amortising", arrangementFee:0.5, commitmentFee:0, gracePeriod:3, maxLTV:85, minDSCR:1.15, eligibleBEE:[1,2], eligibleIndustries:["All"], status:"Active", createdBy:"U001", createdAt:now-365*day },
  ];

  const emptyWF = { kycComplete:false, kycFindings:null, kycDate:null, kycOfficer:null, docsComplete:false, docsFindings:null, docsDate:null, docsOfficer:null, siteVisitComplete:false, siteVisitFindings:null, siteVisitDate:null, siteVisitOfficer:null, siteVisitNotes:"", creditPulled:false, creditBureauScore:null, creditDate:null, creditFindings:null, financialAnalysisComplete:false, financialDate:null, collateralAssessed:false, collateralFindings:null, collateralDate:null, collateralTotal:0, socialVerified:false, socialFindings:null, socialDate:null, socialOfficer:null, sanctionsCleared:false, sanctionsDate:null, analystNotes:"", creditMemoSections:[], docRequests:[] };
  const applications = [
    { id:"APP-001", custId:"C001", status:"Approved", product:"P001", amount:750000, term:36, purpose:"Working capital & inventory expansion for new retail outlet", rate:14.5, riskScore:72, dscr:1.85, currentRatio:1.92, debtEquity:0.65, socialScore:78, recommendation:"Approve", approver:"Head of Credit", creditMemo:"Strong trading history, solid cash flows, well-secured.", submitted:now-90*day, decided:now-80*day, conditions:["Maintain DSCR > 1.3","Submit quarterly financials","Insurance on stock"] },
    { id:"APP-002", custId:"C002", status:"Approved", product:"P002", amount:1200000, term:48, purpose:"Equipment purchase & irrigation system for expanded farming operations", rate:13.0, riskScore:68, dscr:1.62, currentRatio:1.45, debtEquity:0.78, socialScore:92, recommendation:"Approve", approver:"Credit Committee", creditMemo:"Strong social impact. Seasonal cash flow mitigated by crop insurance.", submitted:now-70*day, decided:now-55*day, conditions:["Crop insurance required","Annual audit","DSCR > 1.2"] },
    { id:"APP-003", custId:"C003", status:"Underwriting", product:"P003", amount:2000000, term:60, purpose:"Software platform development and market expansion", rate:null, riskScore:null, dscr:null, currentRatio:null, debtEquity:null, socialScore:null, recommendation:null, approver:null, creditMemo:null, submitted:now-10*day, decided:null, conditions:[], createdBy:"U001", createdAt:now-12*day, expiresAt:now+18*day, qaSignedOff:true, qaOfficer:"Loan Officer – J. Ndaba", qaDate:now-10*day, qaFindings:{result:"Passed",passedAt:now-10*day,officer:"Loan Officer – J. Ndaba",mandatoryDocs:[{type:"ID Document",docId:"DOC-019",status:"Verified",onFile:true},{type:"Proof of Address",docId:"DOC-021",status:"Verified",onFile:true},{type:"Bank Confirmation",docId:"DOC-022",status:"Verified",onFile:true},{type:"Company Registration",docId:"DOC-020",status:"Verified",onFile:true}],missingDocs:[],incompleteDocs:[],fieldErrors:[]}, sanctionsFlag:false, sanctionsDate:now-10*day, assignedTo:"U003", workflow:{...emptyWF} },
    { id:"APP-004", custId:"C004", status:"Approved", product:"P001", amount:3500000, term:60, purpose:"Construction equipment fleet renewal and working capital", rate:15.0, riskScore:81, dscr:2.1, currentRatio:2.35, debtEquity:0.42, socialScore:85, recommendation:"Approve", approver:"Credit Committee", creditMemo:"Strong balance sheet. Key government contracts provide revenue visibility.", submitted:now-200*day, decided:now-185*day, conditions:["DSCR > 1.5","Insurance on all equipment","Submit quarterly financials","Maintain BEE Level 1"] },
    { id:"APP-005", custId:"C005", status:"Underwriting", product:"P001", amount:500000, term:24, purpose:"Cold storage facility for food processing expansion", rate:null, riskScore:null, dscr:null, currentRatio:null, debtEquity:null, socialScore:null, recommendation:null, approver:null, creditMemo:null, submitted:now-8*day, decided:null, conditions:[], createdBy:"U001", createdAt:now-10*day, expiresAt:now+20*day, qaSignedOff:true, qaOfficer:"Loan Officer – J. Ndaba", qaDate:now-8*day, qaFindings:{result:"Passed",passedAt:now-8*day,officer:"Loan Officer – J. Ndaba",mandatoryDocs:[{type:"ID Document",docId:"DOC-032",status:"Verified",onFile:true},{type:"Proof of Address",docId:"DOC-034",status:"Verified",onFile:true},{type:"Bank Confirmation",docId:"DOC-035",status:"Verified",onFile:true},{type:"Company Registration",docId:"DOC-033",status:"Verified",onFile:true}],missingDocs:[],incompleteDocs:[],fieldErrors:[]}, sanctionsFlag:false, sanctionsDate:now-8*day, assignedTo:"U004", workflow:{...emptyWF} },
    { id:"APP-006", custId:"C003", status:"Declined", product:"P004", amount:5000000, term:12, purpose:"Import of hardware components for resale", rate:null, riskScore:42, dscr:0.9, currentRatio:0.87, debtEquity:1.85, socialScore:55, recommendation:"Decline", approver:"Head of Credit", creditMemo:"Insufficient cash flow coverage. High leverage. Affordability test failed.", submitted:now-45*day, decided:now-35*day, conditions:[] },
    { id:"APP-007", custId:"C006", status:"Approved", product:"P005", amount:1800000, term:48, purpose:"Purchase of 3 additional delivery trucks", rate:13.5, riskScore:79, dscr:2.35, currentRatio:2.1, debtEquity:0.38, socialScore:80, recommendation:"Approve", approver:"Head of Credit", creditMemo:"Excellent payment history. Strong contract pipeline. Well-managed fleet.", submitted:now-250*day, decided:now-240*day, conditions:["Insurance on all vehicles","GPS tracking required","Quarterly financials"] },
    { id:"APP-008", custId:"C001", status:"Underwriting", product:"P006", amount:900000, term:48, purpose:"Retail expansion — second branch and inventory build-up", rate:null, riskScore:null, dscr:null, currentRatio:null, debtEquity:null, socialScore:null, recommendation:null, approver:null, creditMemo:null, submitted:now-6*day, decided:null, conditions:[], createdBy:"U001", createdAt:now-8*day, expiresAt:now+22*day, qaSignedOff:true, qaOfficer:"Loan Officer – J. Ndaba", qaDate:now-6*day, qaFindings:{result:"Passed",passedAt:now-6*day,officer:"Loan Officer – J. Ndaba",mandatoryDocs:[{type:"ID Document",docId:"DOC-001",status:"Verified",onFile:true},{type:"Proof of Address",docId:"DOC-003",status:"Verified",onFile:true},{type:"Bank Confirmation",docId:"DOC-004",status:"Verified",onFile:true},{type:"Company Registration",docId:"DOC-002",status:"Verified",onFile:true}],missingDocs:[],incompleteDocs:[],fieldErrors:[]}, sanctionsFlag:false, sanctionsDate:now-6*day, assignedTo:"U003", workflow:{...emptyWF} },
  ];

  const loans = [
    { id:"LN-001", appId:"APP-001", custId:"C001", status:"Active", amount:750000, balance:625000, rate:14.5, term:36, monthlyPmt:25800, disbursed:now-75*day, nextDue:now+5*day, lastPmt:now-25*day, lastPmtAmt:25800, totalPaid:125000, dpd:0, stage:1, payments:[
      {date:now-55*day,amount:25800,type:"Instalment",status:"Cleared"},{date:now-25*day,amount:25800,type:"Instalment",status:"Cleared"}
    ], covenants:[{name:"DSCR > 1.3",status:"Compliant",value:"1.85",checked:now-15*day},{name:"Quarterly Financials",status:"Compliant",value:"Received",checked:now-10*day},{name:"Stock Insurance",status:"Compliant",value:"R1.2M cover",checked:now-20*day}], collateral:[{type:"Inventory",value:450000,description:"Retail stock"},{type:"Personal Guarantee",value:750000,description:"Director surety"}] },
    { id:"LN-002", appId:"APP-002", custId:"C002", status:"Active", amount:1200000, balance:1080000, rate:13.0, term:48, monthlyPmt:32400, disbursed:now-50*day, nextDue:now-15*day, lastPmt:now-45*day, lastPmtAmt:32400, totalPaid:120000, dpd:15, stage:1, payments:[
      {date:now-45*day,amount:32400,type:"Instalment",status:"Cleared"}
    ], covenants:[{name:"DSCR > 1.2",status:"Compliant",value:"1.62",checked:now-20*day},{name:"Annual Audit",status:"Due",value:"Due 30 Apr",checked:now-5*day},{name:"Crop Insurance",status:"Compliant",value:"R2M cover",checked:now-25*day}], collateral:[{type:"Equipment",value:800000,description:"Irrigation system"},{type:"Land",value:1500000,description:"Farm property"},{type:"Crop Insurance",value:600000,description:"Annual crop cover"}] },
    { id:"LN-003", appId:"APP-004", custId:"C004", status:"Active", amount:3500000, balance:2450000, rate:15.0, term:60, monthlyPmt:83200, disbursed:now-180*day, nextDue:now-45*day, lastPmt:now-75*day, lastPmtAmt:83200, totalPaid:1050000, dpd:45, stage:2, payments:[
      {date:now-165*day,amount:83200,type:"Instalment",status:"Cleared"},{date:now-135*day,amount:83200,type:"Instalment",status:"Cleared"},{date:now-105*day,amount:83200,type:"Instalment",status:"Cleared"},{date:now-75*day,amount:83200,type:"Instalment",status:"Cleared"}
    ], covenants:[{name:"DSCR > 1.5",status:"Breach",value:"1.18",checked:now-10*day},{name:"Equipment Insurance",status:"Compliant",value:"R4M cover",checked:now-15*day},{name:"Quarterly Financials",status:"Overdue",value:"Q4 2025 outstanding",checked:now-5*day},{name:"BEE Level 1",status:"Compliant",value:"Level 1 verified",checked:now-30*day}], collateral:[{type:"Equipment",value:2800000,description:"Construction fleet"},{type:"Property",value:1200000,description:"Yard and offices"},{type:"Cession",value:3500000,description:"Contract receivables"}] },
    { id:"LN-004", appId:"APP-007", custId:"C006", status:"Active", amount:1800000, balance:1350000, rate:13.5, term:48, monthlyPmt:48600, disbursed:now-235*day, nextDue:now+10*day, lastPmt:now-20*day, lastPmtAmt:48600, totalPaid:450000, dpd:0, stage:1, payments:[
      {date:now-200*day,amount:48600,type:"Instalment",status:"Cleared"},{date:now-170*day,amount:48600,type:"Instalment",status:"Cleared"},{date:now-140*day,amount:48600,type:"Instalment",status:"Cleared"},{date:now-110*day,amount:48600,type:"Instalment",status:"Cleared"},{date:now-80*day,amount:48600,type:"Instalment",status:"Cleared"},{date:now-50*day,amount:48600,type:"Instalment",status:"Cleared"},{date:now-20*day,amount:48600,type:"Instalment",status:"Cleared"}
    ], covenants:[{name:"Vehicle Insurance",status:"Compliant",value:"Full cover",checked:now-10*day},{name:"GPS Tracking",status:"Compliant",value:"Active",checked:now-5*day},{name:"Quarterly Financials",status:"Compliant",value:"Received",checked:now-15*day}], collateral:[{type:"Vehicles",value:1600000,description:"3x delivery trucks"},{type:"Personal Guarantee",value:1800000,description:"Director surety"}] },
  ];

  const collections = [
    { id:uid(), loanId:"LN-002", custId:"C002", stage:"Early", dpd:15, action:"SMS Reminder", channel:"SMS", officer:"System", notes:"Automated reminder sent Day 1 of arrears.", created:now-15*day },
    { id:uid(), loanId:"LN-002", custId:"C002", stage:"Early", dpd:15, action:"Email Reminder", channel:"Email", officer:"System", notes:"Automated email reminder sent Day 7.", created:now-8*day },
    { id:uid(), loanId:"LN-002", custId:"C002", stage:"Early", dpd:15, action:"Phone Call", channel:"Phone", officer:"Loan Officer", notes:"Spoke with Sipho. Delayed harvest proceeds. PTP secured for next week.", created:now-3*day, ptpDate:now+4*day, ptpAmount:32400 },
    { id:uid(), loanId:"LN-003", custId:"C004", stage:"Mid", dpd:45, action:"SMS Reminder", channel:"SMS", officer:"System", notes:"Automated reminder sent Day 1.", created:now-45*day },
    { id:uid(), loanId:"LN-003", custId:"C004", stage:"Mid", dpd:45, action:"Phone Call", channel:"Phone", officer:"Loan Officer", notes:"Multiple attempts. Customer difficult to reach.", created:now-35*day },
    { id:uid(), loanId:"LN-003", custId:"C004", stage:"Mid", dpd:45, action:"Account Handover", channel:"System", officer:"System", notes:"Account automatically transferred to Collections Specialist at 31 DPD.", created:now-14*day },
    { id:uid(), loanId:"LN-003", custId:"C004", stage:"Mid", dpd:45, action:"Letter of Demand", channel:"Letter", officer:"Collections Specialist", notes:"Formal NCA-compliant Letter of Demand issued.", created:now-10*day },
    { id:uid(), loanId:"LN-003", custId:"C004", stage:"Mid", dpd:45, action:"Site Visit", channel:"In-Person", officer:"Collections Specialist", notes:"Visited premises. Operations ongoing but cash flow constrained by delayed government payment.", created:now-7*day },
    { id:uid(), loanId:"LN-003", custId:"C004", stage:"Mid", dpd:45, action:"Restructuring Proposed", channel:"Meeting", officer:"Collections Manager", notes:"6-month term extension proposed with 3-month reduced payment plan. Pending Credit Committee approval.", created:now-3*day },
  ];

  const alerts = [
    { id:uid(), type:"EWS", severity:"critical", title:"Covenant Breach – Khanyisa Construction", msg:"DSCR fell below 1.5 threshold (current: 1.18). Enhanced monitoring activated.", loanId:"LN-003", read:false, ts:now-3*day },
    { id:uid(), type:"EWS", severity:"warning", title:"Payment Overdue 15 Days – Sipho Agri", msg:"LN-002 instalment 15 days past due. PTP secured for next week.", loanId:"LN-002", read:false, ts:now-1*day },
    { id:uid(), type:"Compliance", severity:"warning", title:"FICA Verification Pending – Ubuntu Foods", msg:"Customer C005 FICA status remains Pending after 30 days. Escalation required.", custId:"C005", read:false, ts:now-1*day },
    { id:uid(), type:"Collections", severity:"critical", title:"Account Escalated to Mid-Stage – Khanyisa", msg:"LN-003 reached 45 DPD. Transferred to Collections Specialist. Restructuring proposed.", loanId:"LN-003", read:true, ts:now-14*day },
    { id:uid(), type:"Portfolio", severity:"info", title:"Quarterly Stress Test Due", msg:"Q1 2026 portfolio stress testing scheduled for completion by 30 April.", read:false, ts:now },
    { id:uid(), type:"Regulatory", severity:"info", title:"NCR Registration Renewal", msg:"NCRCP22396 valid until 31 July 2026. Renewal process to commence May 2026.", read:false, ts:now-2*day },
    { id:uid(), type:"Application", severity:"info", title:"New Application – Ubuntu Foods", msg:"APP-005 submitted for R500,000 SME Term Loan. Awaiting initial due diligence.", read:true, ts:now-5*day },
    { id:uid(), type:"EWS", severity:"warning", title:"BEE Certificate Expiring – Sipho Agri", msg:"BEE Level 1 certificate for C002 expires in 90 days. Renewal reminder sent.", custId:"C002", read:false, ts:now-1*day },
  ];

  const audit = [
    { id:uid(), action:"Application Submitted", entity:"APP-005", user:"Lindiwe Khumalo (Customer)", detail:"New application R500,000 SME Term Loan submitted via portal.", ts:now-5*day, category:"Origination" },
    { id:uid(), action:"KYC/FICA Verified", entity:"C003", user:"Loan Officer – J. Ndaba", detail:"FICA verification completed. ID validated against Home Affairs. Address verified.", ts:now-55*day, category:"Compliance" },
    { id:uid(), action:"Site Visit Completed", entity:"APP-003", user:"Loan Officer – J. Ndaba", detail:"Site visit to Zenith Tech premises. Management interview conducted. Findings uploaded.", ts:now-8*day, category:"Underwriting" },
    { id:uid(), action:"Credit Report Pulled", entity:"APP-003", user:"System (TransUnion API)", detail:"Business credit report retrieved. Score: 645. No adverse information.", ts:now-9*day, category:"Underwriting" },
    { id:uid(), action:"Credit Decision – Decline", entity:"APP-006", user:"Head of Credit – M. Zulu", detail:"Application declined. DSCR 0.9 below minimum 1.2. Affordability test failed.", ts:now-35*day, category:"Decision" },
    { id:uid(), action:"Loan Disbursed", entity:"LN-002", user:"Finance Dept – S. Pillay", detail:"R1,200,000 disbursed to Sipho Agri Co-op. Dual authorization confirmed.", ts:now-50*day, category:"Disbursement" },
    { id:uid(), action:"Loan Agreement Signed", entity:"LN-002", user:"Sipho Mabaso (Customer)", detail:"Electronic signature received and stored. Agreement ID: AGR-2026-002.", ts:now-51*day, category:"Documentation" },
    { id:uid(), action:"Final AML Check", entity:"LN-002", user:"System (Sanctions API)", detail:"Pre-disbursement AML check cleared. No sanctions matches.", ts:now-50*day, category:"Compliance" },
    { id:uid(), action:"Letter of Demand Issued", entity:"LN-003", user:"Collections Specialist – T. Mthembu", detail:"Formal NCA-compliant demand issued to Khanyisa Construction.", ts:now-10*day, category:"Collections" },
    { id:uid(), action:"Covenant Breach Flagged", entity:"LN-003", user:"System (EWS)", detail:"DSCR covenant breach detected. Current: 1.18, Required: 1.5. Alert generated.", ts:now-3*day, category:"Risk" },
    { id:uid(), action:"Payment Received", entity:"LN-004", user:"System (Debit Order)", detail:"Monthly instalment R48,600 received from Msenge Logistics. Auto-allocated.", ts:now-20*day, category:"Servicing" },
    { id:uid(), action:"Restructuring Proposal", entity:"LN-003", user:"Collections Manager – N. Xaba", detail:"6-month term extension with reduced payments proposed. Submitted for Credit Committee.", ts:now-3*day, category:"Collections" },
  ];

  const provisions = [
    { loanId:"LN-001", stage:1, pd:0.02, lgd:0.25, ead:625000, ecl:3125, method:"12-month ECL" },
    { loanId:"LN-002", stage:1, pd:0.04, lgd:0.25, ead:1080000, ecl:10800, method:"12-month ECL" },
    { loanId:"LN-003", stage:2, pd:0.18, lgd:0.50, ead:2450000, ecl:220500, method:"Lifetime ECL" },
    { loanId:"LN-004", stage:1, pd:0.015, lgd:0.20, ead:1350000, ecl:4050, method:"12-month ECL" },
  ];

  const comms = [
    { id:uid(), custId:"C002", loanId:"LN-002", channel:"Phone", direction:"Outbound", from:"Loan Officer", subject:"Payment Follow-up", body:"Discussed delayed payment. Customer confirmed harvest proceeds expected within 7 days. PTP secured.", ts:now-3*day },
    { id:uid(), custId:"C004", loanId:"LN-003", channel:"Letter", direction:"Outbound", from:"Collections", subject:"Letter of Demand – LN-003", body:"Formal NCA-compliant demand letter issued. 20 business day cure period.", ts:now-10*day },
    { id:uid(), custId:"C004", loanId:"LN-003", channel:"In-Person", direction:"Outbound", from:"Collections Specialist", subject:"Site Visit – Business Assessment", body:"Visited premises. Operations ongoing. Cash flow constrained by delayed govt payment on R2.1M contract.", ts:now-7*day },
    { id:uid(), custId:"C005", channel:null, loanId:null, direction:"Inbound", from:"Lindiwe Khumalo", subject:"Application Status Inquiry", body:"Customer called to check on application APP-005 status. Advised initial review in progress.", ts:now-2*day },
    { id:uid(), custId:"C001", loanId:"LN-001", channel:"Email", direction:"Outbound", from:"System", subject:"Monthly Statement – March 2026", body:"Automated monthly statement generated and sent to customer.", ts:now-5*day },
    { id:uid(), custId:"C006", loanId:"LN-004", channel:"Email", direction:"Outbound", from:"Relationship Manager", subject:"Quarterly Review Meeting", body:"Scheduled quarterly business review for 15 April 2026 at customer premises.", ts:now-1*day },
  ];

  const documents = [
    { id:"DOC-001", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"SA ID Document – Nomsa Dlamini", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-178*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-175*day, expiryDate:null, fileRef:"C001/KYC/id_document.pdf", notes:"Verified against Home Affairs database." },
    { id:"DOC-002", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-178*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-175*day, expiryDate:null, fileRef:"C001/KYB/cipc_cert.pdf", notes:"Reg 2019/123456/07 confirmed active on CIPC portal." },
    { id:"DOC-003", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"Proof of Business Address", category:"KYC", type:"Proof of Address", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-178*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-174*day, expiryDate:null, fileRef:"C001/KYC/proof_address.pdf", notes:"Municipal account dated within 3 months." },
    { id:"DOC-004", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"Bank Confirmation Letter – FNB", category:"KYC", type:"Bank Confirmation", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-176*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-174*day, expiryDate:null, fileRef:"C001/KYC/bank_confirmation.pdf", notes:"Account confirmed active. Bank stamp verified." },
    { id:"DOC-005", custId:"C001", appId:"APP-001", loanId:null, name:"Financial Statements FY2024", category:"Financial", type:"Annual Financials", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-170*day, verifiedBy:"Credit Analyst – P. Sithole", verifiedAt:now-165*day, expiryDate:null, fileRef:"C001/Financial/AFS_2024.pdf", notes:"Audited by BDO. Clean audit opinion." },
    { id:"DOC-006", custId:"C001", appId:"APP-001", loanId:null, name:"Business Plan 2025-2027", category:"Financial", type:"Business Plan", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-170*day, verifiedBy:"Credit Analyst – P. Sithole", verifiedAt:now-160*day, expiryDate:null, fileRef:"C001/Financial/business_plan.pdf", notes:"3-year plan. Revenue projections assessed as reasonable." },
    { id:"DOC-007", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"Loan Agreement – LN-001", category:"Legal", type:"Loan Agreement", required:true, status:"Verified", uploadedBy:"System", uploadedAt:now-75*day, verifiedBy:"Legal – M. Zulu", verifiedAt:now-75*day, expiryDate:null, fileRef:"C001/Legal/loan_agreement_LN001.pdf", notes:"Electronically signed. Stored in secure repository." },
    { id:"DOC-008", custId:"C001", appId:null, loanId:"LN-001", name:"Stock Insurance Certificate", category:"Collateral", type:"Insurance", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-70*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-68*day, expiryDate:now+295*day, fileRef:"C001/Collateral/stock_insurance.pdf", notes:"R1.2M cover. Hollard policy. Renewal due in 10 months." },
    { id:"DOC-009", custId:"C001", appId:null, loanId:"LN-001", name:"Personal Guarantee – Director", category:"Legal", type:"Guarantee", required:true, status:"Verified", uploadedBy:"System", uploadedAt:now-75*day, verifiedBy:"Legal – M. Zulu", verifiedAt:now-74*day, expiryDate:null, fileRef:"C001/Legal/personal_guarantee.pdf", notes:"Unlimited surety signed by Nomsa Dlamini." },
    { id:"DOC-010", custId:"C002", appId:"APP-002", loanId:"LN-002", name:"SA ID Document – Sipho Mabaso", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-118*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-115*day, expiryDate:null, fileRef:"C002/KYC/id_document.pdf", notes:"Verified against Home Affairs." },
    { id:"DOC-011", custId:"C002", appId:"APP-002", loanId:"LN-002", name:"Co-operative Registration", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-118*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-115*day, expiryDate:null, fileRef:"C002/KYB/coop_registration.pdf", notes:"Reg 2020/654321/07 active." },
    { id:"DOC-012", custId:"C002", appId:"APP-002", loanId:null, name:"Proof of Address – Farm 12", category:"KYC", type:"Proof of Address", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-118*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-114*day, expiryDate:null, fileRef:"C002/KYC/proof_address.pdf", notes:"Title deed used as proof. Farm address confirmed." },
    { id:"DOC-013", custId:"C002", appId:"APP-002", loanId:null, name:"Bank Confirmation Letter – Standard Bank", category:"KYC", type:"Bank Confirmation", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-116*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-114*day, expiryDate:null, fileRef:"C002/KYC/bank_confirmation.pdf", notes:"Account confirmed active." },
    { id:"DOC-018", custId:"C002", appId:null, loanId:"LN-002", name:"BEE Level 1 Certificate", category:"Compliance", type:"BEE Certificate", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-110*day, verifiedBy:"Compliance Officer", verifiedAt:now-108*day, expiryDate:now+90*day, fileRef:"C002/Compliance/bee_cert.pdf", notes:"Level 1. Expires in 90 days — renewal required." },
    { id:"DOC-019", custId:"C003", appId:"APP-003", loanId:null, name:"SA ID Document – Ayanda Nkosi", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Ayanda Nkosi", uploadedAt:now-58*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-55*day, expiryDate:null, fileRef:"C003/KYC/id_document.pdf", notes:"Verified against Home Affairs." },
    { id:"DOC-020", custId:"C003", appId:"APP-003", loanId:null, name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Ayanda Nkosi", uploadedAt:now-58*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-55*day, expiryDate:null, fileRef:"C003/KYB/cipc_cert.pdf", notes:"Active on CIPC." },
    { id:"DOC-021", custId:"C003", appId:"APP-003", loanId:null, name:"Proof of Address", category:"KYC", type:"Proof of Address", required:true, status:"Verified", uploadedBy:"Ayanda Nkosi", uploadedAt:now-58*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-55*day, expiryDate:null, fileRef:"C003/KYC/proof_address.pdf", notes:"Lease agreement for office premises." },
    { id:"DOC-022", custId:"C003", appId:"APP-003", loanId:null, name:"Bank Confirmation Letter – Nedbank", category:"KYC", type:"Bank Confirmation", required:true, status:"Verified", uploadedBy:"Ayanda Nkosi", uploadedAt:now-57*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-55*day, expiryDate:null, fileRef:"C003/KYC/bank_confirmation.pdf", notes:"Confirmed active." },
    { id:"DOC-023", custId:"C003", appId:"APP-003", loanId:null, name:"Financial Statements FY2024", category:"Financial", type:"Annual Financials", required:true, status:"Received", uploadedBy:"Ayanda Nkosi", uploadedAt:now-12*day, verifiedBy:null, verifiedAt:null, expiryDate:null, fileRef:"C003/Financial/AFS_2024.pdf", notes:"Received. Awaiting credit analyst review." },
    { id:"DOC-024", custId:"C003", appId:"APP-003", loanId:null, name:"Business Plan – Platform Development", category:"Financial", type:"Business Plan", required:true, status:"Under Review", uploadedBy:"Ayanda Nkosi", uploadedAt:now-12*day, verifiedBy:null, verifiedAt:null, expiryDate:null, fileRef:"C003/Financial/business_plan.pdf", notes:"Under review by credit analyst." },
    { id:"DOC-025", custId:"C004", appId:"APP-004", loanId:"LN-003", name:"SA ID Document – Thabo Mokoena", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Thabo Mokoena", uploadedAt:now-298*day, verifiedBy:"Loan Officer", verifiedAt:now-295*day, expiryDate:null, fileRef:"C004/KYC/id_document.pdf", notes:"Verified." },
    { id:"DOC-026", custId:"C004", appId:"APP-004", loanId:"LN-003", name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Thabo Mokoena", uploadedAt:now-298*day, verifiedBy:"Loan Officer", verifiedAt:now-295*day, expiryDate:null, fileRef:"C004/KYB/cipc_cert.pdf", notes:"Active." },
    { id:"DOC-032", custId:"C005", appId:"APP-005", loanId:null, name:"SA ID Document – Lindiwe Khumalo", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-28*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-7*day, expiryDate:null, fileRef:"C005/KYC/id_document.pdf", notes:"Verified against Home Affairs." },
    { id:"DOC-033", custId:"C005", appId:"APP-005", loanId:null, name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-28*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-7*day, expiryDate:null, fileRef:"C005/KYB/cipc_cert.pdf", notes:"Confirmed active." },
    { id:"DOC-034", custId:"C005", appId:"APP-005", loanId:null, name:"Proof of Address – Municipal Account", category:"KYC", type:"Proof of Address", required:true, status:"Verified", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-26*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-7*day, expiryDate:null, fileRef:"C005/KYC/proof_address.pdf", notes:"Municipal account within 3 months." },
    { id:"DOC-035", custId:"C005", appId:"APP-005", loanId:null, name:"Bank Confirmation Letter – Capitec", category:"KYC", type:"Bank Confirmation", required:true, status:"Verified", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-26*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-7*day, expiryDate:null, fileRef:"C005/KYC/bank_confirmation.pdf", notes:"Account confirmed active." },
    { id:"DOC-036", custId:"C005", appId:"APP-005", loanId:null, name:"Financial Statements FY2024", category:"Financial", type:"Annual Financials", required:true, status:"Verified", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-20*day, verifiedBy:"Credit Analyst – P. Sithole", verifiedAt:now-6*day, expiryDate:null, fileRef:"C005/Financial/AFS_2024.pdf", notes:"Audited. Revenue R3.1M confirmed." },
    { id:"DOC-037", custId:"C005", appId:"APP-005", loanId:null, name:"Business Plan – Cold Storage Expansion", category:"Financial", type:"Business Plan", required:true, status:"Verified", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-20*day, verifiedBy:"Credit Analyst – P. Sithole", verifiedAt:now-6*day, expiryDate:null, fileRef:"C005/Financial/business_plan.pdf", notes:"Cold storage expansion reviewed." },
    { id:"DOC-038", custId:"C006", appId:"APP-007", loanId:"LN-004", name:"SA ID Document – Mandla Gcwabe", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Mandla Gcwabe", uploadedAt:now-348*day, verifiedBy:"Loan Officer", verifiedAt:now-345*day, expiryDate:null, fileRef:"C006/KYC/id_document.pdf", notes:"Verified." },
    { id:"DOC-039", custId:"C006", appId:"APP-007", loanId:"LN-004", name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Mandla Gcwabe", uploadedAt:now-348*day, verifiedBy:"Loan Officer", verifiedAt:now-345*day, expiryDate:null, fileRef:"C006/KYB/cipc_cert.pdf", notes:"Active." },
  ];

  const yearEnd = "28 February 2026";
  const annualDueDate = "31 August 2026";
  const totalDisbursed = loans.reduce((s,l) => s + l.amount, 0);
  const form39Required = totalDisbursed > 15000000 ? "Quarterly" : "Annual";

  const statutoryReports = [
    { id:"SR-001", name:"Annual Compliance Report", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Comprehensive compliance report covering all NCA obligations for the financial year." },
    { id:"SR-002", name:"Annual Financial Statements", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Must include the auditor's report. Audited financial statements for the full financial year." },
    { id:"SR-003", name:"Annual Financial & Operational Return", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Detailed financial and operational data return as prescribed by the NCR." },
    { id:"SR-004", name:"Assurance Engagement Report", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Independent assurance engagement on compliance with NCA requirements." },
    { id:"SR-005", name:"Form 39 – Q1 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Jan – 31 Mar 2026", dueDate:"2026-05-15", submitTo:"returns@ncr.org.za", status:"In Progress", preparer:"Finance Department", reviewer:"Chief Risk Officer", notes:"Quarterly statistical return. Reporting period: 1 January – 31 March 2026." },
    { id:"SR-006", name:"Form 39 – Q2 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Apr – 30 Jun 2026", dueDate:"2026-08-15", submitTo:"returns@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Quarterly statistical return. Reporting period: 1 April – 30 June 2026." },
    { id:"SR-007", name:"Form 39 – Q3 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Jul – 30 Sep 2026", dueDate:"2026-11-15", submitTo:"returns@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Quarterly statistical return. Reporting period: 1 July – 30 September 2026." },
    { id:"SR-008", name:"Form 39 – Q4 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Oct – 31 Dec 2026", dueDate:"2027-02-15", submitTo:"returns@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Quarterly statistical return. Reporting period: 1 October – 31 December 2026." },
    { id:"SR-009", name:"Form 39 – Q4 2025 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Oct – 31 Dec 2025", dueDate:"2026-02-15", submitTo:"returns@ncr.org.za", status:"Submitted", preparer:"Finance Department", reviewer:"Chief Risk Officer", submittedDate:"2026-02-12", notes:"Submitted on time via email to returns@ncr.org.za." },
    { id:"SR-010", name:"Annual Compliance Report FY2025", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2025", dueDate:"2025-08-31", submitTo:"submissions@ncr.org.za", status:"Submitted", preparer:"Compliance Officer", reviewer:"Chief Risk Officer", submittedDate:"2025-08-28", notes:"Submitted on time." },
  ];

  const statutoryAlerts = [
    { id:uid(), type:"Statutory", severity:"critical", title:"Form 39 Q1 2026 – Due 15 May 2026", msg:"Statistical return for period 1 Jan – 31 Mar 2026 due to NCR (returns@ncr.org.za) by 15 May 2026. Currently: In Progress. 44 days remaining.", read:false, ts:now },
    { id:uid(), type:"Statutory", severity:"warning", title:"Annual Reports – Due 31 August 2026", msg:"4 annual statutory reports due within 6 months of year-end (28 Feb 2026). Submit to submissions@ncr.org.za by 31 Aug 2026.", read:false, ts:now-1*day },
    { id:uid(), type:"Statutory", severity:"info", title:"NCR Registration Renewal – 31 July 2026", msg:"NCRCP22396 expires 31 July 2026. Renewal application must be submitted before expiry.", read:false, ts:now-2*day },
  ];

  return { customers, products, applications, loans, collections, alerts: [...alerts, ...statutoryAlerts], audit, provisions, comms, documents, statutoryReports, settings:{ companyName:"ThandoQ and Associates (Pty) Ltd", ncrReg:"NCRCP22396", ncrExpiry:"31 July 2026", branch:"East London, Nahoon Valley", yearEnd, annualDueDate, form39Required, totalDisbursed, ncrAddress:"127 – 15th Road, Randjies Park, Midrand, 1685", ncrPO:"PO Box 209, Halfway House, 1685", ncrEmailAnnual:"submissions@ncr.org.za", ncrEmailForm39:"returns@ncr.org.za" } };
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
    green: { text: C.green },
    amber: { text: C.amber },
    red: { text: C.red },
    blue: { text: C.blue },
    purple: { text: C.purple },
    cyan: { text: C.textDim },
    slate: { text: C.textMuted },
  };
  const s = map[color] || map.slate;
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:3, fontSize:11, fontWeight:600, letterSpacing:0.2, background:"transparent", color:s.text, border:`1px solid ${C.border}`, whiteSpace:"nowrap", lineHeight:"16px" }}>{children}</span>;
}
function statusBadge(s) {
  const m = { Approved:"green", Active:"green", Disbursed:"green", Verified:"green", Compliant:"green", Cleared:"green", Submitted:"blue", Underwriting:"cyan", Pending:"amber", "Pending Review":"amber", Due:"amber", Overdue:"red", Early:"amber", Mid:"amber", Late:"red", Declined:"red", Breach:"red", Received:"blue", "Under Review":"cyan" };
  return <Badge color={m[s] || "slate"}>{s}</Badge>;
}

function KPI({ label, value, sub }) {
  return (
    <div style={{ background: C.surface, borderRadius: 4, padding: "16px 20px", border: `1px solid ${C.border}`, flex: "1 1 200px", minWidth: 170 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>{sub}</div>}
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
  return <button disabled={disabled} onClick={onClick} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:pad, background:s.bg, color:s.color, border:s.border, borderRadius:3, fontSize:fs, fontWeight:500, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, transition:"all .15s", fontFamily:"inherit", letterSpacing:0.1 }}>{icon}{children}</button>;
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
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text }}>{title}</h3>
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
          <div style={{ fontSize: 10, fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginTop: 2 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, children, actions }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, marginBottom: 16, overflow: "hidden" }}>
      {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h3>
        {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
      </div>}
      <div style={{ padding: 16 }}>{children}</div>
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
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: done ? C.text : "transparent", color: done ? "#fff" : active ? C.text : C.textMuted, fontSize: 10, fontWeight: 600, border: `1px solid ${done ? C.text : C.border}` }}>
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

export default function App() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);
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
  const role = currentUser.role;
  const canDo = (mod, action) => can(role, mod, action);
  const canDoAny = (mod, actions) => canAny(role, mod, actions);

  useEffect(() => {
    (async () => {
      // Try Supabase with a 3-second timeout
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
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
          if (!results.settings) results.settings = { companyName:"ThandoQ and Associates (Pty) Ltd", ncrReg:"NCRCP22396", ncrExpiry:"31 July 2026", branch:"East London, Nahoon Valley" };
          setData(results);
          return;
        }
      } catch (e) { console.log("Supabase load skipped:", e.name); }
      // Fallback: window.storage
      try {
        const r = await store.get(SK);
        if (r?.value) {
          const loaded = JSON.parse(r.value);
          // Check if cached data has the current schema (qaSignedOff on apps)
          const hasCurrentSchema = loaded.applications?.some(a => a.qaSignedOff !== undefined);
          if (hasCurrentSchema) { setData(loaded); return; }
          // Outdated cache — discard and re-seed
        }
      } catch {}
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

  if (!data) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:C.bg, color:C.textMuted, fontFamily:"'Outfit',sans-serif", fontSize:13 }}>Loading…</div>;

  const { customers, products, applications, loans, collections, alerts, audit, provisions, comms, documents, statutoryReports, settings } = data;
  const unread = alerts.filter(a => !a.read).length;

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: I.dashboard },
    { key: "customers", label: "Customers", icon: I.customers, count: customers.length },
    { key: "origination", label: "Origination", icon: I.origination, count: applications.filter(a => ["Submitted","Underwriting"].includes(a.status)).length },
    { key: "underwriting", label: "Underwriting", icon: I.underwriting },
    { key: "loans", label: "Active Loans", icon: I.loans, count: loans.length },
    { key: "servicing", label: "Servicing", icon: I.servicing },
    { key: "collections", label: "Collections", icon: I.collections, count: loans.filter(l => l.dpd > 0).length },
    { key: "provisioning", label: "IFRS 9", icon: I.provisioning },
    { key: "governance", label: "Governance", icon: I.governance },
    { key: "statutory", label: "NCR Reporting", icon: I.calendar, count: (statutoryReports||[]).filter(r=>r.status!=="Submitted"&&new Date(r.dueDate)>new Date()).length },
    { key: "documents", label: "Documents", icon: I.documents },
    { key: "reports", label: "Reports", icon: I.reports },
    { key: "comms", label: "Communications", icon: I.comms, count: comms.length },
    { key: "products", label: "Products", icon: I.loans },
    { key: "settings", label: "Settings", icon: I.governance },
  ].filter(n => canDo(n.key, "view"));

  const markRead = id => save({ ...data, alerts: alerts.map(a => a.id === id ? { ...a, read: true } : a) });
  const addAudit = (action, entity, user, detail, category) => ({ id: uid(), action, entity, user, detail, ts: Date.now(), category });
  const addAlert = (type, severity, title, msg, extra = {}) => ({ id: uid(), type, severity, title, msg, read: false, ts: Date.now(), ...extra });

  const createCustomer = (form) => {
    if (!canDo("customers","create")) { alert("Permission denied."); return; }
    const c = { ...form, id:`C${String(customers.length+1).padStart(3,"0")}`, ficaStatus:"Pending", ficaDate:null, riskCategory:"Medium", created:Date.now(), beeStatus:"Pending Review", beeExpiry:null };
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
      case "products": return <Products />;
      case "settings": return <Settings />;
      default: return <Dashboard />;
    }
  }

  function Dashboard() {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>Dashboard</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>{currentUser.name} · {ROLES[role]?.label} · {roleSummary[role] || ""}</p>
        </div>
        {canDo("origination","create") && <Btn onClick={() => setModal("newApp")} icon={I.plus}>New Application</Btn>}
      </div>

      {/* KPIs — tiered by role */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {/* Everyone sees portfolio total and loan count */}
        <KPI label="Total Loan Book" value={fmt.cur(totalBook)} sub={`${loans.length} active loans`} />
        {/* Tier 0-3: see full financial KPIs */}
        {tier <= 3 && <KPI label="Total Disbursed" value={fmt.cur(totalDisbursed)} />}
        {/* Origination roles see pipeline */}
        {canDo("origination","view") && <KPI label="Pipeline" value={fmt.cur(pipeAmt)} sub={`${pipeline.length} pending`} />}
        {/* Collections and above see arrears */}
        {canDo("collections","view") && <KPI label="Arrears" value={fmt.cur(arrAmt)} sub={`${arrLoans.length} accounts`} />}
        {/* Finance, Credit Head, Exec, Admin see ECL */}
        {canDo("provisioning","view") && <KPI label="ECL Provision" value={fmt.cur(ecl)} sub="IFRS 9" />}
        {/* Tier 0-2 see rate */}
        {tier <= 2 && <KPI label="Weighted Avg Rate" value={`${avgRate}%`} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: tier <= 2 ? "1fr 1fr 1fr" : tier <= 4 ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 20 }}>
        {/* IFRS 9 — Finance, Credit, Compliance, Exec, Admin */}
        {canDo("provisioning","view") && (
          <SectionCard title="IFRS 9 Staging">
            {[1, 2, 3].map(s => {
              const sl = loans.filter(l => l.stage === s);
              const pct = loans.length ? Math.round(sl.length / loans.length * 100) : 0;
              const bal = sl.reduce((sum, l) => sum + l.balance, 0);
              const colors = { 1: C.green, 2: C.amber, 3: C.red };
              const labels = { 1: "Performing", 2: "Underperforming", 3: "Non-performing" };
              return (<div key={s} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 4 }}>
                  <span>Stage {s}: {labels[s]}</span><span>{sl.length} ({pct}%) · {fmt.cur(bal)}</span>
                </div>
                <ProgressBar value={pct} color={colors[s]} />
              </div>);
            })}
          </SectionCard>
        )}
        {/* Pipeline — Origination/Credit/Exec/Admin */}
        {canDo("origination","view") && (
          <SectionCard title="Application Pipeline">
            {["Submitted","Underwriting","Approved","Declined"].map(s => {
              const count = applications.filter(a => a.status === s).length;
              const amt = applications.filter(a => a.status === s).reduce((sum, a) => sum + a.amount, 0);
              return (<div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                {statusBadge(s)}<div style={{ textAlign:"right" }}><div style={{ fontSize:18, fontWeight:700, color:C.text }}>{count}</div><div style={{ fontSize:10, color:C.textMuted }}>{fmt.cur(amt)}</div></div>
              </div>);
            })}
          </SectionCard>
        )}
        {/* Impact — everyone */}
        <SectionCard title="Development Impact">
          {[["Jobs Supported", fmt.num(jobs), C.green], ["BEE Level 1 Clients", customers.filter(c => c.beeLevel === 1).length, C.accent], ["Women-Owned", "2", C.purple], ["Avg Social Impact Score", Math.round(applications.filter(a => a.socialScore).reduce((s, a) => s + a.socialScore, 0) / (applications.filter(a => a.socialScore).length || 1)), C.amber]].map(([l, v, c], i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:18, fontWeight:700, color:c }}>{v}</span>
            </div>
          ))}
        </SectionCard>
      </div>

      {/* Statutory Deadlines — Compliance, Finance, Admin, Exec only */}
      {canDo("statutory","view") && (statutoryReports||[]).filter(r => r.status !== "Submitted").length > 0 && (
        <SectionCard title="NCR Statutory Reporting Deadlines" actions={<Btn size="sm" variant="ghost" onClick={() => setPage("statutory")}>View All {I.chev}</Btn>}>
          {(statutoryReports||[]).filter(r => r.status !== "Submitted").sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 4).map(r => {
            const days = Math.ceil((new Date(r.dueDate) - new Date()) / 864e5);
            const uc = days < 0 ? C.red : days <= 30 ? C.red : days <= 60 ? C.amber : C.textDim;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 36, height: 36, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: uc, lineHeight: 1 }}>{days < 0 ? "!" : days}</div>
                  <div style={{ fontSize: 7, color: C.textMuted, fontWeight: 500 }}>{days < 0 ? "LATE" : "DAYS"}</div>
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
      )}

      {/* My Tasks — role-specific action items */}
      {(role === "LOAN_OFFICER" || role === "CREDIT" || role === "CREDIT_SNR" || role === "COLLECTIONS") && (
        <SectionCard title="My Tasks">
          {role === "LOAN_OFFICER" && applications.filter(a => a.status === "Submitted").map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{a.id}</span> — {cust(a.custId)?.name} — {fmt.cur(a.amount)} — awaiting DD initiation</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"application",id:a.id})}>Open</Btn>
            </div>
          ))}
          {(role === "CREDIT" || role === "CREDIT_SNR") && applications.filter(a => a.status === "Underwriting").map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{a.id}</span> — {cust(a.custId)?.name} — {fmt.cur(a.amount)} — underwriting in progress</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"application",id:a.id})}>Open</Btn>
            </div>
          ))}
          {role === "COLLECTIONS" && arrLoans.map(l => (
            <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{l.id}</span> — {cust(l.custId)?.name} — {l.dpd} DPD — {fmt.cur(l.balance)}</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"loan",id:l.id})}>Open</Btn>
            </div>
          ))}
          {role === "LOAN_OFFICER" && applications.filter(a=>a.status==="Submitted").length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No pending tasks.</div>}
          {(role === "CREDIT" || role === "CREDIT_SNR") && applications.filter(a=>a.status==="Underwriting").length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No pending tasks.</div>}
          {role === "COLLECTIONS" && arrLoans.length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No delinquent accounts.</div>}
        </SectionCard>
      )}

      {/* Alerts — filtered by role relevance */}
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
      setCForm({ name:"", contact:"", email:"", phone:"", idNum:"", regNum:"", industry:"Retail", sector:"", revenue:"", employees:"", years:"", beeLevel:3, address:"", province:"Eastern Cape" });
    };

    return (<div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
        <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>Customer Management</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>Onboarding, KYC/FICA verification, BEE profiling & relationship management</p></div>
        {canDo("customers","create") && <Btn onClick={()=>setShowCreate(!showCreate)} icon={I.plus}>New Customer</Btn>}
      </div>

      {showCreate && (
        <SectionCard title="Register New Customer">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <Field label="Business Name *"><Input value={cForm.name} onChange={e=>setCForm({...cForm,name:e.target.value})} placeholder="e.g. Nomsa Trading (Pty) Ltd" /></Field>
            <Field label="Contact Person *"><Input value={cForm.contact} onChange={e=>setCForm({...cForm,contact:e.target.value})} placeholder="Full name" /></Field>
            <Field label="Email"><Input value={cForm.email} onChange={e=>setCForm({...cForm,email:e.target.value})} placeholder="email@company.co.za" /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <Field label="Phone"><Input value={cForm.phone} onChange={e=>setCForm({...cForm,phone:e.target.value})} placeholder="0XX XXX XXXX" /></Field>
            <Field label="ID Number *"><Input value={cForm.idNum} onChange={e=>setCForm({...cForm,idNum:e.target.value})} placeholder="13-digit SA ID" /></Field>
            <Field label="Company Registration *"><Input value={cForm.regNum} onChange={e=>setCForm({...cForm,regNum:e.target.value})} placeholder="YYYY/XXXXXX/07" /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <Field label="Industry"><Select value={cForm.industry} onChange={e=>setCForm({...cForm,industry:e.target.value})} options={["Retail","Agriculture","Technology","Construction","Food Processing","Transport","Manufacturing","Professional Services","Other"].map(v=>({value:v,label:v}))} /></Field>
            <Field label="Sector"><Input value={cForm.sector} onChange={e=>setCForm({...cForm,sector:e.target.value})} placeholder="e.g. Consumer Goods" /></Field>
            <Field label="Annual Revenue (R)"><Input type="number" value={cForm.revenue} onChange={e=>setCForm({...cForm,revenue:e.target.value})} /></Field>
            <Field label="Employees"><Input type="number" value={cForm.employees} onChange={e=>setCForm({...cForm,employees:e.target.value})} /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <Field label="Years in Business"><Input type="number" value={cForm.years} onChange={e=>setCForm({...cForm,years:e.target.value})} /></Field>
            <Field label="BEE Level"><Select value={cForm.beeLevel} onChange={e=>setCForm({...cForm,beeLevel:e.target.value})} options={[1,2,3,4,5,6,7,8].map(v=>({value:v,label:`Level ${v}`}))} /></Field>
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
        { label:"Revenue", render:r=>fmt.cur(r.revenue) },
        { label:"BEE", render:r=><Badge color="purple">Level {r.beeLevel}</Badge> },
        { label:"FICA", render:r=>statusBadge(r.ficaStatus) },
        { label:"Risk", render:r=><Badge color={r.riskCategory==="Low"?"green":r.riskCategory==="Medium"?"amber":"red"}>{r.riskCategory}</Badge> },
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
        <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>Loan Origination</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>Application intake, QA & document validation, assignment & pipeline management</p></div>
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
        { label:"Applicant", render:r=>cust(r.custId)?.name },
        { label:"Product", render:r=>prod(r.product)?.name || r.product },
        { label:"Amount", render:r=>fmt.cur(r.amount) },
        { label:"Term", render:r=>`${r.term}m` },
        { label:"Date", render:r=>fmt.date(r.submitted || r.createdAt) },
        { label:"Assigned To", render:r=>{
          const u = SYSTEM_USERS.find(x=>x.id===r.assignedTo);
          if (u) return <span style={{ fontSize:11 }}>{u.name}</span>;
          if (!["Submitted","Underwriting"].includes(r.status)) return <span style={{ fontSize:10, color:C.textMuted }}>—</span>;
          if (!canDo("origination","assign")) return <span style={{ fontSize:10, color:C.amber }}>Unassigned</span>;
          return <select onChange={e=>{if(e.target.value)assignApplication(r.id,e.target.value)}} defaultValue="" style={{ fontSize:10, border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontFamily:"inherit", padding:"1px 3px" }}>
            <option value="">Assign...</option>
            {assignableUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>;
        }},
        { label:"QA", render:r=> r.qaSignedOff ? <span style={{ fontSize:10, color:C.green }}>Passed</span> : r.qaFindings?.result==="Failed" ? <span style={{ fontSize:10, color:C.red }}>Failed</span> : r.status==="Draft" ? <span style={{ fontSize:10, color:C.amber }}>Pending</span> : <span style={{ fontSize:10, color:C.textMuted }}>—</span> },
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
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Credit Assessment & Underwriting</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Risk analysis, affordability, scoring & credit decisions</p>
      <SectionCard title={`Pending Decisions (${pending.length})`}>
        <Table columns={[
          { label:"App ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
          { label:"Applicant", render:r=>cust(r.custId)?.name },
          { label:"Amount", render:r=>fmt.cur(r.amount) },
          { label:"Authority", render:r=>r.amount>1000000?"Credit Committee":r.amount>500000?"Head of Credit":r.amount>250000?"Senior Analyst":"Analyst" },
          { label:"Status", render:r=>statusBadge(r.status) },
          { label:"Actions", render:r=><div style={{ display:"flex", gap:6 }}>{r.status==="Submitted"&&canDo("underwriting","update")&&<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();moveToUnderwriting(r.id)}}>Start DD</Btn>}{r.status==="Underwriting"&&canDo("underwriting","view")&&<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();setDetail({type:"application",id:r.id})}}>Open Workflow</Btn>}</div> },
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
    const bookedLoans = loans.filter(l => l.status === "Booked");
    const activeLoans = loans.filter(l => l.status === "Active");
    const shown = tab === "booked" ? bookedLoans : tab === "active" ? activeLoans : loans;
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Loans</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>Booking, disbursement, portfolio monitoring & covenant tracking</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Total Portfolio" value={fmt.cur(activeLoans.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Active" value={activeLoans.length} />
        <KPI label="Booked (Awaiting Disbursement)" value={bookedLoans.length} />
        <KPI label="Total Monthly PMT" value={fmt.cur(activeLoans.reduce((s,l)=>s+l.monthlyPmt,0))} />
      </div>
      <Tab tabs={[{key:"all",label:"All",count:loans.length},{key:"booked",label:"Booked",count:bookedLoans.length},{key:"active",label:"Active",count:activeLoans.length}]} active={tab} onChange={setTab} />
      <Table columns={[
        { label:"Loan ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
        { label:"Borrower", render:r=>cust(r.custId)?.name },
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
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Loan Servicing</h2>
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
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Collections & Recovery</h2>
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
        { label:"Actions", render:r=>canDo("collections","create") ? <div style={{ display:"flex", gap:3 }}>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
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
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>IFRS 9 Impairment & Provisioning</h2>
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
        <div style={{ textAlign:"right", marginTop:14, fontSize:15, fontWeight:700, color:C.text }}>Total ECL: <span style={{ color:C.purple }}>{fmt.cur(totalECL)}</span></div>
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
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Governance, Risk & Compliance</h2>
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
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
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
            ["NCR Registration", settings.ncrReg],
            ["NCR Expiry", settings.ncrExpiry],
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
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
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
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>NCR Statutory Reporting</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Regulatory reporting calendar, deadlines & submission tracking — NCRCP22396</p>

      {/* Critical deadline banner */}
      {upcoming.length > 0 && (() => {
        const next = upcoming[0];
        const days = daysUntil(next.dueDate);
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
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
        <KPI label="Year-End" value={settings.yearEnd || "28 Feb 2026"} sub={`Annual reports due: ${settings.annualDueDate || "31 Aug 2026"}`} accent={C.purple} />
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
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
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10, lineHeight: 1.5 }}>{r.notes}</div>
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
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14, lineHeight: 1.6, padding: "10px 14px", background: C.surface2 }}>
            Credit providers registered under the NCA must submit the following reports to the NCR within <span style={{ fontWeight: 600, color: C.text }}>6 months</span> of their financial year-end. Year-end: <span style={{ fontWeight: 600, color: C.text }}>{settings.yearEnd}</span> → Deadline: <span style={{ fontWeight: 600, color: C.red }}>{settings.annualDueDate}</span>
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
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14, lineHeight: 1.6, padding: "10px 14px", background: C.surface2 }}>
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
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Annual Statutory Reports</div>
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
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Form 39 – Statistical Returns</div>
              <div style={{ padding: "8px 12px", background: C.surface2, border: `1px solid ${C.border}`, marginBottom: 10 }}>
                <span style={{ fontWeight: 700 }}>Current annual disbursements: {fmt.cur(totalDisbursedAmt)}</span> — {totalDisbursedAmt > 15000000
                  ? <span style={{ color: C.red, fontWeight: 700 }}>Exceeds R15 million → Quarterly submission required</span>
                  : <span style={{ color: C.green, fontWeight: 700 }}>Below R15 million → Annual submission (1 Jan – 31 Dec)</span>
                }
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Submission Channels</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["Annual Statutory Reports", "submissions@ncr.org.za", C.purple],
                  ["Form 39 Statistical Returns", "returns@ncr.org.za", C.blue],
                  ["Hand Delivery", settings.ncrAddress, C.amber],
                  ["Courier / Post", settings.ncrPO, C.green],
                ].map(([label, value, color], i) => (
                  <div key={i} style={{ background: C.surface2, padding: "8px 12px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginTop: 3, wordBreak: "break-all" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Company Details</div>
              <InfoGrid items={[
                ["Registered Name", settings.companyName],
                ["NCR Registration", settings.ncrReg],
                ["Registration Expiry", settings.ncrExpiry],
                ["Branch", settings.branch],
                ["Financial Year-End", settings.yearEnd || "28 February"],
                ["Annual Reports Deadline", settings.annualDueDate || "31 August"],
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
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Document Management</h2>
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
          <button key={c} onClick={()=>setCatFilter(c)} style={{ padding:"5px 12px", border:"none", borderBottom: catFilter===c?`2px solid ${C.textDim}`:"2px solid transparent", background:"transparent", color:catFilter===c?C.text:C.textMuted, fontSize:11, fontWeight:catFilter===c?600:400, cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }}>{c}</button>
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
                <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:6 }}>{name}</div>
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
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
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
        <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>Reports & Analytics</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>Portfolio performance, risk analysis, collections, servicing & impact reporting</p></div>
        {canDo("reports","export") && <div style={{ display:"flex", gap:6 }}>
          <Btn size="sm" variant="secondary" onClick={()=>exportCSV("Portfolio_Report",["Loan ID","Borrower","Amount","Balance","Rate","DPD","Stage","Status"],loans.map(l=>[l.id,cust(l.custId)?.name,l.amount,l.balance,l.rate,l.dpd,l.stage,l.status]))}>Export Portfolio</Btn>
          <Btn size="sm" variant="secondary" onClick={()=>exportCSV("Audit_Trail",["Timestamp","Category","Action","Entity","User","Detail"],audit.map(a=>[fmt.dateTime(a.ts),a.category,a.action,a.entity,a.user,a.detail]))}>Export Audit</Btn>
        </div>}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <SectionCard title="Portfolio Summary">
          {[["Total Loan Book",fmt.cur(totalBook)],["Active Loans",activeLoans.length],["Booked (Awaiting Disbursement)",loans.filter(l=>l.status==="Booked").length],["Settled",loans.filter(l=>l.status==="Settled").length],["Written Off",loans.filter(l=>l.status==="Written Off").length],["Total Disbursed",fmt.cur(loans.reduce((s,l)=>s+l.amount,0))],["Weighted Avg Rate",`${activeLoans.length?(activeLoans.reduce((s,l)=>s+l.rate,0)/activeLoans.length).toFixed(1):0}%`],["Total ECL",fmt.cur(totalECL)],["ECL Coverage",totalBook>0?fmt.pct(totalECL/totalBook):"0%"]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
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
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:13, fontWeight:700, color:typeof v==="number"&&v>0?C.red:C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Servicing Summary">
          {[["Payments Processed",allPmts.length],["Total Collected",fmt.cur(allPmts.reduce((s,p)=>s+p.amount,0))],["Interest Collected",fmt.cur(allPmts.reduce((s,p)=>s+(p.interest||0),0))],["Principal Collected",fmt.cur(allPmts.reduce((s,p)=>s+(p.principal||0),0))],["Monthly Receivable",fmt.cur(activeLoans.reduce((s,l)=>s+l.monthlyPmt,0))],["Overdue Accounts",delinquent.length]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:13, fontWeight:700, color:C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Application Outcomes">
          {["Approved","Declined","Submitted","Underwriting","Booked","Withdrawn"].map(s => {
            const count = applications.filter(a => a.status === s).length;
            if (count === 0) return null;
            return (<div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
              {statusBadge(s)}<div><span style={{ fontSize:16, fontWeight:700, color:C.text }}>{count}</span><span style={{ fontSize:11, color:C.textMuted, marginLeft:8 }}>({applications.length>0?fmt.pct(count/applications.length,0):"0%"})</span></div>
            </div>);
          })}
        </SectionCard>
        <SectionCard title="Development Impact">
          {[["Total Jobs Supported",fmt.num(customers.reduce((s,c)=>s+c.employees,0))],["BEE Level 1 Clients",customers.filter(c=>c.beeLevel===1).length],["BEE Level 1-2 Exposure",fmt.cur(activeLoans.filter(l=>cust(l.custId)?.beeLevel<=2).reduce((s,l)=>s+l.balance,0))],["Avg Social Impact Score",Math.round(applications.filter(a=>a.socialScore).reduce((s,a)=>s+a.socialScore,0)/(applications.filter(a=>a.socialScore).length||1))],["Provinces Covered",new Set(customers.map(c=>c.province)).size],["Industries Covered",new Set(customers.map(c=>c.industry)).size]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:13, fontWeight:700, color:C.accent }}>{v}</span>
            </div>
          ))}
        </SectionCard>
      </div>
    </div>);
  }

  function Comms() {
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Communication Center</h2>
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
          <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>{c.name}</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.textMuted }}>{c.id} · {c.industry} · {c.province}</p></div>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>{statusBadge(c.ficaStatus)}<Badge color="purple">BEE Level {c.beeLevel}</Badge><Badge color={c.riskCategory==="Low"?"green":c.riskCategory==="Medium"?"amber":"red"}>{c.riskCategory} Risk</Badge></div>
        </div>

        {/* Profile — read or edit */}
        <SectionCard title="Customer Profile" actions={canDo("customers","update") && !detailEditing ? <Btn size="sm" variant="ghost" onClick={()=>{setDetailForm({...c});setDetailEditing(true)}}>Edit</Btn> : null}>
          {!detailEditing ? (
            <InfoGrid items={[["Contact",c.contact],["Email",c.email],["Phone",c.phone],["ID Number",c.idNum],["Reg Number",c.regNum],["Address",c.address],["Annual Revenue",fmt.cur(c.revenue)],["Employees",c.employees],["Years in Business",c.years],["Sector",c.sector],["BEE Expiry",fmt.date(c.beeExpiry)],["FICA Date",fmt.date(c.ficaDate)],["Created",fmt.date(c.created)]]} />
          ) : (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="Business Name"><Input value={detailForm.name} onChange={e=>setDetailForm({...detailForm,name:e.target.value})} /></Field>
                <Field label="Contact"><Input value={detailForm.contact} onChange={e=>setDetailForm({...detailForm,contact:e.target.value})} /></Field>
                <Field label="Email"><Input value={detailForm.email} onChange={e=>setDetailForm({...detailForm,email:e.target.value})} /></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="Phone"><Input value={detailForm.phone} onChange={e=>setDetailForm({...detailForm,phone:e.target.value})} /></Field>
                <Field label="Industry"><Select value={detailForm.industry} onChange={e=>setDetailForm({...detailForm,industry:e.target.value})} options={["Retail","Agriculture","Technology","Construction","Food Processing","Transport","Manufacturing","Professional Services","Other"].map(v=>({value:v,label:v}))} /></Field>
                <Field label="Revenue"><Input type="number" value={detailForm.revenue} onChange={e=>setDetailForm({...detailForm,revenue:+e.target.value})} /></Field>
                <Field label="Employees"><Input type="number" value={detailForm.employees} onChange={e=>setDetailForm({...detailForm,employees:+e.target.value})} /></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="Address"><Input value={detailForm.address} onChange={e=>setDetailForm({...detailForm,address:e.target.value})} /></Field>
                <Field label="Province"><Select value={detailForm.province} onChange={e=>setDetailForm({...detailForm,province:e.target.value})} options={["Eastern Cape","Western Cape","Gauteng","KwaZulu-Natal","Free State","North West","Limpopo","Mpumalanga","Northern Cape"].map(v=>({value:v,label:v}))} /></Field>
                <Field label="Risk Category"><Select value={detailForm.riskCategory} onChange={e=>setDetailForm({...detailForm,riskCategory:e.target.value})} options={["Low","Medium","High"].map(v=>({value:v,label:v}))} /></Field>
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
            <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
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
            {canDoAny("customers",["update"]) && <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
              {c.beeStatus !== "Verified" && <Btn size="sm" onClick={()=>updateBeeStatus(c.id,"Verified",detailBeeForm.level,detailBeeForm.expiry)}>Verify BEE</Btn>}
              {c.beeStatus === "Verified" && <Btn size="sm" variant="secondary" onClick={()=>updateBeeStatus(c.id,"Expired",null,null)}>Mark Expired</Btn>}
              <Btn size="sm" variant="ghost" onClick={()=>updateBeeStatus(c.id,"Pending Review",null,null)}>Reset</Btn>
            </div>}
          </div>
          {canDoAny("customers",["update"]) && (
            <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
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
            {label:"Actions", render:r=><div style={{ display:"flex", gap:3 }}>
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
                <div style={{ display:"flex", gap:6, padding:"5px 8px", fontSize:11, alignItems:"center" }}>
                  <span style={{ width:40, flexShrink:0, fontWeight:500, color: f.status==="Pass"||f.status==="Verified"||f.status==="Confirmed (Override)"?C.green : f.status==="Flagged"?C.amber : f.status==="Rejected"||f.status==="Fail"||f.status==="Missing"?C.red : f.status==="Pending KYC"?C.amber : C.textMuted }}>{f.officerAction?f.status:(f.systemResult||f.status)}</span>
                  <span style={{ width:130, flexShrink:0, fontWeight:500, color:isInherited?C.textDim:C.text, fontSize:11 }}>{f.item}</span>
                  <span style={{ flex:1, color:C.textDim, fontSize:11 }}>{f.detail}{f.source?` (${f.source})`:""}{f.purpose&&!isInherited?<span style={{ color:C.textMuted, fontSize:10 }}> — {f.purpose}</span>:""}</span>
                  {/* View Document button */}
                  {doc && !isInherited && <button onClick={()=>setViewingDoc(isExpanded?null:`${stepKey}-${i}`)} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:isExpanded?C.surface2:"transparent", color:C.accent, cursor:"pointer", fontFamily:"inherit", fontWeight:isExpanded?600:400 }}>{isExpanded?"Close":"View"}</button>}
                  {/* Request button — shown for Missing non-inherited docs */}
                  {!doc && !isInherited && f.systemResult==="Missing" && isUW && (() => {
                    const reqs = (w.docRequests||[]).filter(r=>r.docType===f.item);
                    const lastReq = reqs[reqs.length-1];
                    return lastReq
                      ? <span style={{ fontSize:9, color:C.textMuted, flexShrink:0 }}>Requested {fmt.date(lastReq.requestedAt)} by {lastReq.requestedBy}</span>
                      : <button onClick={()=>requestDocFromApplicant(a.id,f.item,"")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Request</button>;
                  })()}
                  {/* Inherited indicator */}
                  {isInherited && <span style={{ fontSize:9, color:C.textMuted, flexShrink:0, fontStyle:"italic" }}>from Step 2</span>}
                  {/* Confirm / Flag / Reject — only for non-inherited items */}
                  {isActionable && !isInherited && !f.officerAction && (
                    <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Confirmed","")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Confirm</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Flagged","")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.amber, cursor:"pointer", fontFamily:"inherit" }}>Flag</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Rejected","")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject</button>
                    </div>
                  )}
                  {isActionable && !isInherited && f.officerAction && <span style={{ fontSize:9, color:C.textMuted, flexShrink:0 }}>{f.officerAction}</span>}
                  {/* Doc-level approve/reject — only for non-inherited items */}
                  {doc && !isInherited && isUW && doc.status!=="Verified" && canDo("documents","approve") && <button onClick={()=>approveDocument(doc.id,a.id)} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Approve Doc</button>}
                  {doc && !isInherited && isUW && doc.status!=="Rejected" && canDo("documents","update") && <button onClick={()=>rejectDocument(doc.id,"Re-submission required.")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject Doc</button>}
                </div>
                {/* Expanded document detail panel */}
                {isExpanded && doc && (
                  <div style={{ padding:"6px 8px 8px 46px", background:C.surface2, borderTop:`1px solid ${C.border}` }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, fontSize:10 }}>
                      <div><span style={{ color:C.textMuted }}>Document ID:</span> <span style={{ fontFamily:"monospace", fontWeight:500 }}>{doc.id}</span></div>
                      <div><span style={{ color:C.textMuted }}>Name:</span> <span style={{ fontWeight:500 }}>{doc.name}</span></div>
                      <div><span style={{ color:C.textMuted }}>Category:</span> {doc.category}</div>
                      <div><span style={{ color:C.textMuted }}>Status:</span> <span style={{ fontWeight:600, color:doc.status==="Verified"?C.green:doc.status==="Rejected"?C.red:C.amber }}>{doc.status}</span></div>
                      <div><span style={{ color:C.textMuted }}>Uploaded By:</span> {doc.uploadedBy||"—"}</div>
                      <div><span style={{ color:C.textMuted }}>Uploaded:</span> {fmt.date(doc.uploadedAt)}</div>
                      <div><span style={{ color:C.textMuted }}>Verified By:</span> {doc.verifiedBy||"—"}</div>
                      <div><span style={{ color:C.textMuted }}>Verified:</span> {fmt.date(doc.verifiedAt)}</div>
                      <div><span style={{ color:C.textMuted }}>Expiry:</span> {doc.expiryDate ? <span style={{ color: doc.expiryDate < now + 90*day ? C.red : C.textDim }}>{fmt.date(doc.expiryDate)}</span> : "None"}</div>
                      <div style={{ gridColumn:"1/4" }}><span style={{ color:C.textMuted }}>File:</span> <span style={{ fontFamily:"monospace", fontSize:9 }}>{doc.fileRef||"—"}</span></div>
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
          {isActionable && <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:10, color:C.textMuted }}>{allActioned?"Ready for sign-off.":`${reqItems.filter(f=>f.officerAction).length}/${reqItems.length} reviewed.`}</span>
            <Btn size="sm" onClick={()=>signOffStep(a.id,stepKey)} disabled={!allActioned}>Sign Off</Btn>
          </div>}
        </div>);
      };

      const renderReadOnly = (findings) => {
        if (!findings || !Array.isArray(findings)) return null;
        return (<div style={{ border:`1px solid ${C.border}` }}>
          {findings.map((f,i) => (
            <div key={i} style={{ display:"flex", gap:6, padding:"5px 8px", fontSize:11, borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
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
                <div key={i} style={{ display:"flex", gap:6, padding:"4px 8px", fontSize:11, borderBottom:i<(a.qaFindings.mandatoryDocs.length-1)?`1px solid ${C.border}`:"none" }}>
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
          {a.expiresAt && a.status === "Draft" && <div style={{ fontSize:10, color: a.expiresAt < Date.now() ? C.red : C.amber, marginTop:6 }}>
            {a.expiresAt < Date.now() ? `EXPIRED on ${fmt.date(a.expiresAt)}` : `Expires: ${fmt.date(a.expiresAt)} (${Math.ceil((a.expiresAt - Date.now())/day)} days remaining)`}
          </div>}
        </div>);
        if (s.key==="kyc") return (<div>
          {!w.kycDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Verify applicant identity and regulatory compliance: ID against Home Affairs, company registration against CIPC, bank account confirmation, address verification, sanctions screening (OFAC/UN/SA), and PEP check. Each item requires your review and sign-off.</div>}
          {w.kycFindings && renderChecklist(w.kycFindings, "kyc")}
          {w.kycComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.kycOfficer}</div>}
        </div>);
        if (s.key==="docs") return (<div>
          {!w.docsDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Check application document completeness. KYC documents (ID, PoA, Bank, Registration) carry forward from Step 2. This step verifies financial statements, business plan, and any industry-specific documents are on file and adequate for underwriting.</div>}
          {w.docsFindings && renderChecklist(w.docsFindings, "docs")}
          {isUW && <div style={{ marginTop:8, padding:"6px 8px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Request Document from Applicant</div>
            <div style={{ display:"flex", gap:4 }}>
              <input value={reqDocType} onChange={e=>setReqDocType(e.target.value)} placeholder="Document type..." style={{ flex:1, padding:"3px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
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
          {!w.siteVisitDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Click "Generate Findings" to create the site visit assessment form. Complete each field after the physical visit, then sign off.</div>}
          {isOldFormat && <div style={{ padding:10, background:"#fff8e1", border:`1px solid ${C.amber}`, marginBottom:8, fontSize:11 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Site visit data is in a legacy format (static/read-only).</div>
            <div style={{ color:C.textDim }}>Click "Re-generate" above to create the interactive assessment form. You will need to re-enter your observations.</div>
          </div>}
          {findings.length > 0 && !isOldFormat && <div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:6 }}>{filledCount}/{findings.length} sections completed{allFilled ? " — ready for sign-off" : ""}</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {findings.map((f, i) => (
                <div key={i} style={{ padding:"8px 10px", borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:C.text }}>{f.item}</span>
                    {f.value && f.value.trim().length > 5 ? <span style={{ fontSize:9, color:C.green }}>Completed</span> : <span style={{ fontSize:9, color:C.amber }}>Required</span>}
                  </div>
                  {isUW && !w.siteVisitComplete ? (
                    <textarea value={f.value||""} onChange={e=>saveSiteVisitField(a.id,i,e.target.value)} placeholder={f.placeholder||""} rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
                  ) : (
                    <div style={{ fontSize:11, color:f.value ? C.textDim : C.textMuted, lineHeight:1.5, fontStyle:f.value?"normal":"italic" }}>{f.value || "Not completed"}</div>
                  )}
                  {f.item === "Overall Assessment" && isUW && !w.siteVisitComplete && (
                    <div style={{ display:"flex", gap:6, marginTop:4 }}>
                      {["Satisfactory","Concerns Noted","Unsatisfactory"].map(r => (
                        <button key={r} onClick={()=>saveSiteVisitRating(a.id,i,r)} style={{ padding:"2px 8px", fontSize:10, border:`1px solid ${f.rating===r?C.text:C.border}`, background:f.rating===r?C.text:"transparent", color:f.rating===r?"#fff":C.textDim, cursor:"pointer", fontFamily:"inherit" }}>{r}</button>
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
            <textarea value={w.siteVisitNotes||""} onChange={e=>saveSiteVisitNotes(a.id,e.target.value)} placeholder="Any additional observations not covered above..." rows={2} style={{ width:"100%", padding:"5px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
          </div>}
          {isUW && w.siteVisitDate && !w.siteVisitComplete && !isOldFormat && (
            <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
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
          {!w.creditDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Pull credit bureau report and run automated financial analysis. System computes key ratios from submitted financials. Review each finding, add your professional assessment, flag concerns, then confirm.</div>}
          {isOldCreditFormat && <div style={{ padding:10, background:"#fff8e1", border:`1px solid ${C.amber}`, marginBottom:8, fontSize:11 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Credit analysis data is in a legacy format (static/read-only).</div>
            <div style={{ color:C.textDim }}>Click "Re-analyse" above to generate the interactive analyst review form.</div>
          </div>}
          {isOldCreditFormat && renderReadOnly(findings)}
          {hasNewFormat && findings.length > 0 && <div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:6 }}>{notedCount}/{findings.length} findings reviewed by analyst{canSignOff ? " — ready for confirmation" : ""}</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {findings.map((f, i) => (
                <div key={i} style={{ padding:"8px 10px", borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:C.text }}>{f.item}</span>
                    {f.flag && <span style={{ fontSize:9, padding:"1px 6px", background:f.flag==="Accept"?C.green:f.flag==="Override"?C.purple:C.red, color:"#fff" }}>{f.flag}</span>}
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
                          <button key={fl} onClick={()=>saveCreditFinding(a.id,i,"flag",f.flag===fl?"":fl)} style={{ padding:"1px 7px", fontSize:9, border:`1px solid ${f.flag===fl?(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red):C.border}`, background:f.flag===fl?(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red):"transparent", color:f.flag===fl?"#fff":(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red), cursor:"pointer", fontFamily:"inherit" }}>{fl}</button>
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
            <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:10, color:canSignOff?C.green:C.amber }}>{canSignOff ? "Risk assessment complete. Ready for confirmation." : "Provide analyst assessment on 'Risk Score & Recommendation' to confirm."}</span>
              <Btn size="sm" onClick={()=>signOffStep(a.id,"credit")} disabled={!canSignOff}>Confirm Analysis</Btn>
            </div>
          )}
          {w.financialAnalysisComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Confirmed by Credit Analyst</div>}
        </div>);
        }
        if (s.key==="collateral") return (<div>
          {!w.collateralDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Assess collateral and security linked to the customer. Computes LTV.</div>}
          {w.collateralFindings && renderReadOnly(w.collateralFindings)}
          {isUW && w.collateralDate && !w.collateralAssessed && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"collateral")}>Confirm</Btn></div>}
          {w.collateralAssessed && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Assessment confirmed</div>}
        </div>);
        if (s.key==="social") return (<div>
          {!w.socialDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Verify BEE status, employment impact, and development alignment.</div>}
          {w.socialFindings && renderReadOnly(w.socialFindings)}
          {isUW && w.socialDate && !w.socialVerified && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"social")}>Confirm</Btn></div>}
          {w.socialVerified && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Verified by {w.socialOfficer}</div>}
        </div>);
        if (s.key==="decision" && isDecided) return <InfoGrid items={[["Decision",a.status],["Date",fmt.date(a.decided)],["Approver",a.approver],["Risk",a.riskScore],["DSCR",`${a.dscr}x`],["Social",a.socialScore]]} />;
        return null;
      };

      return (<div><BackBtn />
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:700, color:C.text }}>{a.id}</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.textMuted }}>{c?.name} \u00b7 {p?.name} \u00b7 {fmt.cur(a.amount)} over {a.term}m</p></div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>{statusBadge(a.status)}<span style={{ fontSize:11, color:C.textMuted }}>{doneCount}/7</span></div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:10 }}>
          <KPI label="Amount" value={fmt.cur(a.amount)} /><KPI label="Term" value={`${a.term}m`} /><KPI label="Bureau" value={w.creditBureauScore??"-"} /><KPI label="Risk" value={a.riskScore??"-"} /><KPI label="DSCR" value={a.dscr?`${a.dscr}x`:"-"} /><KPI label="Social" value={a.socialScore??"-"} /><KPI label="LTV" value={w.collateralTotal?`${(a.amount/w.collateralTotal*100).toFixed(0)}%`:"-"} />
        </div>
        {isSub && <div style={{ border:`1px solid ${C.border}`, padding:"10px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:12, fontWeight:600, color:C.text }}>Application awaiting due diligence</div><div style={{ fontSize:11, color:C.textMuted }}>Initiate underwriting to begin step-by-step verification.</div></div>
          <Btn onClick={()=>moveToUnderwriting(a.id)}>Start Due Diligence</Btn>
        </div>}
        {/* Expandable workflow steps */}
        {steps.map((s,i) => {
          const isOpen = expandedStep===s.key;
          return (<div key={i} style={{ border:`1px solid ${C.border}`, marginBottom:1, background:C.surface }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", cursor:"pointer", background:isOpen?C.surface2:"transparent" }} onClick={()=>setExpandedStep(isOpen?null:s.key)}>
              <div style={{ width:16, height:16, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:s.done?C.text:"transparent", color:s.done?"#fff":C.textMuted, fontSize:8, fontWeight:600, border:`1px solid ${s.done?C.text:s.hasData&&!s.done?C.amber:C.border}` }}>{s.done?I.check:i}</div>
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
        {isUW && <div style={{ border:`1px solid ${C.border}`, marginTop:6, padding:"8px 10px" }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Analyst Notes</div>
          <textarea value={w.analystNotes||""} onChange={e=>saveAnalystNotes(a.id,e.target.value)} placeholder="Observations, concerns, conditions to propose..." rows={2} style={{ width:"100%", padding:"5px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
        </div>}
        {/* Notify applicant */}
        {isUW && <div style={{ border:`1px solid ${C.border}`, marginTop:1, padding:"8px 10px" }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Notify Applicant</div>
          <input value={notifForm.subject} onChange={e=>setNotifForm({...notifForm,subject:e.target.value})} placeholder="Subject" style={{ width:"100%", padding:"3px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:3 }} />
          <textarea value={notifForm.body} onChange={e=>setNotifForm({...notifForm,body:e.target.value})} placeholder="Message..." rows={2} style={{ width:"100%", padding:"3px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.4 }} />
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:3 }}>
            <Btn size="sm" variant="secondary" onClick={()=>{if(notifForm.subject&&notifForm.body){sendNotification(a.id,notifForm.subject,notifForm.body);setNotifForm({subject:"",body:""})}}}>Send</Btn>
          </div>
        </div>}
        {a.creditMemo && <SectionCard title="Credit Memorandum"><div style={{ fontSize:12, color:C.textDim, lineHeight:1.7, whiteSpace:"pre-line" }}>{a.creditMemo}</div></SectionCard>}
        {a.conditions.length>0 && <SectionCard title={`Conditions (${a.conditions.length})`}>{a.conditions.map((cond,i)=><div key={i} style={{ display:"flex", alignItems:"flex-start", gap:5, padding:"3px 0", fontSize:12 }}><span style={{ color:C.green, flexShrink:0, marginTop:1 }}>{I.check}</span><span>{cond}</span></div>)}</SectionCard>}
        {isUW && <div style={{ border:`1px solid ${C.border}`, padding:"10px 14px", marginTop:4 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><div style={{ fontSize:12, fontWeight:600, color:C.text }}>Credit Decision</div><div style={{ fontSize:11, color:C.textMuted }}>{allDDComplete?"All steps signed off. Ready for decision.":`${doneCount}/7 steps completed.`}</div></div>
            <div style={{ display:"flex", gap:6 }}><Btn onClick={()=>decideLoan(a.id,"Approved")} disabled={!allDDComplete}>Approve</Btn><Btn variant="danger" onClick={()=>decideLoan(a.id,"Declined")} disabled={!allDDComplete}>Decline</Btn></div>
          </div>
        </div>}
        {a.status === "Approved" && canDo("loans","update") && (
          <div style={{ border:`1px solid ${C.border}`, padding:"10px 14px", marginTop:4 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:C.text }}>Loan Booking</div>
                <div style={{ fontSize:11, color:C.textMuted }}>Verify conditions precedent and create loan record. This generates the loan agreement.</div>
              </div>
              <Btn onClick={()=>bookLoan(a.id)}>Book Loan</Btn>
            </div>
          </div>
        )}
        {a.status === "Booked" && (
          <div style={{ border:`1px solid ${C.border}`, padding:"10px 14px", marginTop:4, background:C.surface2 }}>
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
          <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>{l.id}</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>{c?.name}</p></div>
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
              <div key={i}><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>{l}</div><div style={{ fontSize:15, fontWeight:700, color:l==="ECL"?C.purple:C.text }}>{v}</div></div>
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

  function Products() {
    const blank = { name:"", description:"", minAmount:100000, maxAmount:5000000, minTerm:12, maxTerm:60, baseRate:14.5, repaymentType:"Amortising", arrangementFee:1.0, commitmentFee:0.5, gracePeriod:0, maxLTV:80, minDSCR:1.25, eligibleBEE:[1,2,3,4], eligibleIndustries:["All"], status:"Active" };
    const startEdit = (p) => { setProdForm({...p}); setProdEditing(p.id); };
    const startNew = () => { setProdForm({...blank}); setProdEditing("new"); };
    const cancelEdit = () => { setProdForm(null); setProdEditing(null); };
    const handleSave = () => {
      if (!prodForm.name) return;
      if (prodEditing === "new") saveProduct(prodForm);
      else saveProduct({ ...prodForm, id: prodEditing });
      cancelEdit();
    };

    return (<div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>Loan Products</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>Product catalog configuration — rates, terms, fees, eligibility</p></div>
        {canDo("products","create") && <Btn onClick={startNew} icon={I.plus}>New Product</Btn>}
      </div>

      {/* Edit/Create form */}
      {prodForm && (
        <SectionCard title={prodEditing === "new" ? "Create New Product" : `Edit: ${prodForm.name}`}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <Field label="Product Name"><Input value={prodForm.name} onChange={e=>setProdForm({...prodForm,name:e.target.value})} /></Field>
            <Field label="Repayment Type"><Select value={prodForm.repaymentType} onChange={e=>setProdForm({...prodForm,repaymentType:e.target.value})} options={["Amortising","Bullet","Balloon","Seasonal"].map(v=>({value:v,label:v}))} /></Field>
            <Field label="Status"><Select value={prodForm.status} onChange={e=>setProdForm({...prodForm,status:e.target.value})} options={["Active","Suspended","Retired"].map(v=>({value:v,label:v}))} /></Field>
          </div>
          <Field label="Description"><Textarea value={prodForm.description} onChange={e=>setProdForm({...prodForm,description:e.target.value})} rows={2} /></Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <Field label="Min Amount (R)"><Input type="number" value={prodForm.minAmount} onChange={e=>setProdForm({...prodForm,minAmount:+e.target.value})} /></Field>
            <Field label="Max Amount (R)"><Input type="number" value={prodForm.maxAmount} onChange={e=>setProdForm({...prodForm,maxAmount:+e.target.value})} /></Field>
            <Field label="Min Term (m)"><Input type="number" value={prodForm.minTerm} onChange={e=>setProdForm({...prodForm,minTerm:+e.target.value})} /></Field>
            <Field label="Max Term (m)"><Input type="number" value={prodForm.maxTerm} onChange={e=>setProdForm({...prodForm,maxTerm:+e.target.value})} /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <Field label="Base Rate %"><Input type="number" value={prodForm.baseRate} onChange={e=>setProdForm({...prodForm,baseRate:+e.target.value})} /></Field>
            <Field label="Arrangement Fee %"><Input type="number" value={prodForm.arrangementFee} onChange={e=>setProdForm({...prodForm,arrangementFee:+e.target.value})} /></Field>
            <Field label="Commitment Fee %"><Input type="number" value={prodForm.commitmentFee} onChange={e=>setProdForm({...prodForm,commitmentFee:+e.target.value})} /></Field>
            <Field label="Grace Period (m)"><Input type="number" value={prodForm.gracePeriod} onChange={e=>setProdForm({...prodForm,gracePeriod:+e.target.value})} /></Field>
            <Field label="Max LTV %"><Input type="number" value={prodForm.maxLTV} onChange={e=>setProdForm({...prodForm,maxLTV:+e.target.value})} /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <Field label="Min DSCR"><Input type="number" value={prodForm.minDSCR} onChange={e=>setProdForm({...prodForm,minDSCR:+e.target.value})} step="0.05" /></Field>
            <Field label="Eligible BEE Levels (comma-sep)"><Input value={(prodForm.eligibleBEE||[]).join(",")} onChange={e=>setProdForm({...prodForm,eligibleBEE:e.target.value.split(",").map(Number).filter(Boolean)})} /></Field>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <Btn onClick={handleSave}>Save Product</Btn>
            <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
          </div>
        </SectionCard>
      )}

      {/* Product catalog table */}
      <Table columns={[
        { label:"Product", render:r=><div><div style={{ fontWeight:600, fontSize:12 }}>{r.name}</div><div style={{ fontSize:10, color:C.textMuted }}>{r.description}</div></div> },
        { label:"Type", render:r=><span style={{ fontSize:11 }}>{r.repaymentType||"Amortising"}</span> },
        { label:"Rate", render:r=><span style={{ fontSize:12, fontWeight:600 }}>{r.baseRate}%</span> },
        { label:"Amount Range", render:r=><span style={{ fontSize:11 }}>{fmt.cur(r.minAmount)} – {fmt.cur(r.maxAmount)}</span> },
        { label:"Term", render:r=><span style={{ fontSize:11 }}>{r.minTerm}–{r.maxTerm}m</span> },
        { label:"Fees", render:r=><span style={{ fontSize:10, color:C.textDim }}>Arr: {r.arrangementFee||0}% · Com: {r.commitmentFee||0}%</span> },
        { label:"LTV/DSCR", render:r=><span style={{ fontSize:10, color:C.textDim }}>LTV≤{r.maxLTV||80}% · DSCR≥{r.minDSCR||1.2}x</span> },
        { label:"BEE", render:r=><span style={{ fontSize:10 }}>{(r.eligibleBEE||[]).join(",")}</span> },
        { label:"Status", render:r=>statusBadge(r.status||"Active") },
        { label:"Actions", render:r=><div style={{ display:"flex", gap:4 }}>
          {canDo("products","update") && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();startEdit(r)}}>Edit</Btn>}
          {canDo("products","update") && <Btn size="sm" variant={r.status==="Active"?"ghost":"secondary"} onClick={e=>{e.stopPropagation();toggleProductStatus(r.id)}}>{r.status==="Active"?"Suspend":"Activate"}</Btn>}
        </div> },
      ]} rows={products} />
    </div>);
  }

  function Settings() {
    const handleSaveSettings = () => {
      if (!canDo("settings","update")) { alert("Permission denied."); return; }
      save({ ...data, settings: settingsForm, audit:[...audit, addAudit("Settings Updated", "System", currentUser.name, "Company settings modified.", "Configuration")] });
      setSettingsEditing(false);
    };

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>System Administration</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Company details, user management, approval matrix & system configuration</p>

      {/* Company Details */}
      <SectionCard title="Company Details" actions={canDo("settings","update") && !settingsEditing ? <Btn size="sm" variant="ghost" onClick={()=>{setSettingsForm({...(settings||{})});setSettingsEditing(true)}}>Edit</Btn> : null}>
        {!settingsEditing ? (
          <InfoGrid items={[
            ["Company Name", settings?.companyName],
            ["NCR Registration", settings?.ncrReg],
            ["NCR Expiry", settings?.ncrExpiry],
            ["Branch", settings?.branch],
            ["Financial Year-End", settings?.yearEnd],
            ["Address", settings?.address || "East London, Nahoon Valley"],
          ]} />
        ) : (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
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

      {/* System Users */}
      <SectionCard title={`System Users (${SYSTEM_USERS.length})`}>
        <Table columns={[
          { label:"ID", render:r=><span style={{ fontFamily:"monospace", fontSize:11 }}>{r.id}</span> },
          { label:"Name", render:r=><div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:22, height:22, borderRadius:2, background:C.surface2, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:600, color:C.textDim }}>{r.initials}</div><span style={{ fontWeight:500 }}>{r.name}</span></div> },
          { label:"Email", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.email}</span> },
          { label:"Role", render:r=><Badge>{ROLES[r.role]?.label || r.role}</Badge> },
          { label:"Tier", render:r=><span style={{ fontSize:11 }}>{ROLES[r.role]?.tier}</span> },
          { label:"Approval Limit", render:r=>APPROVAL_LIMITS[r.role] ? (APPROVAL_LIMITS[r.role] === Infinity ? "Unlimited" : fmt.cur(APPROVAL_LIMITS[r.role])) : <span style={{ color:C.textMuted }}>—</span> },
        ]} rows={SYSTEM_USERS} />
      </SectionCard>

      {/* Approval Authority Matrix */}
      <SectionCard title="Approval Authority Matrix">
        <Table columns={[
          { label:"Role", render:r=><span style={{ fontWeight:500 }}>{ROLES[r.role]?.label}</span> },
          { label:"Max Amount", render:r=>r.limit === Infinity ? "Unlimited" : r.limit > 0 ? fmt.cur(r.limit) : <span style={{ color:C.textMuted }}>No approval authority</span> },
          { label:"Tier", render:r=>String(ROLES[r.role]?.tier) },
        ]} rows={Object.keys(ROLES).map(k => ({ role:k, limit: APPROVAL_LIMITS[k] || 0 }))} />
      </SectionCard>

      {/* Product Summary */}
      <SectionCard title={`Product Catalog Summary (${products.length})`} actions={<Btn size="sm" variant="ghost" onClick={()=>setPage("products")}>Manage Products {I.chev}</Btn>}>
        <Table columns={[
          { label:"Product", render:r=><span style={{ fontWeight:500 }}>{r.name}</span> },
          { label:"Rate", render:r=>`${r.baseRate}%` },
          { label:"Range", render:r=>`${fmt.cur(r.minAmount)} – ${fmt.cur(r.maxAmount)}` },
          { label:"Status", render:r=>statusBadge(r.status||"Active") },
        ]} rows={products} />
      </SectionCard>

      {/* RBAC Permission Matrix */}
      {canDo("settings","view") && (
        <SectionCard title="RBAC Permission Matrix">
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead><tr style={{ borderBottom:`2px solid ${C.border}` }}>
                <th style={{ textAlign:"left", padding:"4px 6px", fontWeight:600, color:C.text }}>Module</th>
                {Object.keys(ROLES).map(r=><th key={r} style={{ textAlign:"center", padding:"4px 3px", fontWeight:500, color:C.textDim, fontSize:9 }}>{r.replace("_"," ")}</th>)}
              </tr></thead>
              <tbody>{Object.keys(PERMS).map(mod=>(
                <tr key={mod} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"3px 6px", fontWeight:500, color:C.text }}>{mod}</td>
                  {Object.keys(ROLES).map(r=><td key={r} style={{ textAlign:"center", padding:"3px 2px", color:PERMS[mod]?.[r]?C.textDim:C.border, fontSize:9 }}>{PERMS[mod]?.[r]||"—"}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>);
  }

    return null;
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
        {p && <div style={{ background:C.surface2, padding:10, marginBottom:12, fontSize:11, color:C.textDim, border:`1px solid ${C.border}`, lineHeight:1.6 }}>
          {p.description}<br/>
          Range: {fmt.cur(p.minAmount)} – {fmt.cur(p.maxAmount)} · Term: {p.minTerm}–{p.maxTerm}m · Grace: {p.gracePeriod||0}m<br/>
          Fees: Arrangement {p.arrangementFee||0}% · Commitment {p.commitmentFee||0}% · Max LTV: {p.maxLTV||80}% · Min DSCR: {p.minDSCR||1.2}x<br/>
          BEE Eligibility: Level {(p.eligibleBEE||[]).join(", ")}
        </div>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Amount (R)"><Input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder={p?`${fmt.cur(p.minAmount)} – ${fmt.cur(p.maxAmount)}`:"e.g. 500000"} /></Field>
          <Field label="Term (months)"><Input type="number" value={form.term} onChange={e=>setForm({...form,term:e.target.value})} placeholder={p?`${p.minTerm} – ${p.maxTerm}`:"e.g. 36"} /></Field>
        </div>
        {errors.length > 0 && <div style={{ background:"#fff5f5", border:`1px solid ${C.red}`, padding:"6px 10px", marginBottom:12, fontSize:11, color:C.red }}>{errors.map((e,i)=><div key={i}>{e}</div>)}</div>}
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
      <style>{`
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#d4d4d4;border-radius:0}
        *{box-sizing:border-box}
      `}</style>

      {/* Sidebar */}
      <aside style={{ width:sideCollapsed?52:210, background:C.surface, borderRight:`1px solid ${C.border}`, transition:"width .15s", flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:sideCollapsed?"12px 8px":"14px 14px 10px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={()=>setSideCollapsed(!sideCollapsed)}>
          {!sideCollapsed && <div><div style={{ fontSize:13, fontWeight:600, color:C.text, letterSpacing:-0.2 }}>KwikBridge</div><div style={{ fontSize:9, color:C.textMuted, letterSpacing:0.5 }}>LOAN MANAGEMENT</div></div>}
        </div>
        <nav style={{ flex:1, padding:"6px 4px", overflowY:"auto" }}>
          {navItems.map(n => {
            const active = page === n.key && !detail;
            return (<button key={n.key} onClick={()=>{setPage(n.key);setDetail(null)}} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:sideCollapsed?"7px 0":"6px 10px", justifyContent:sideCollapsed?"center":"flex-start", background:active?C.surface2:"transparent", color:active?C.text:C.textDim, border:"none", borderLeft:active?`2px solid ${C.text}`:"2px solid transparent", fontSize:12, fontWeight:active?600:400, cursor:"pointer", marginBottom:0, fontFamily:"inherit" }}>
              {n.icon}
              {!sideCollapsed && <span style={{ flex:1, textAlign:"left" }}>{n.label}</span>}
              {!sideCollapsed && n.count != null && n.count > 0 && <span style={{ fontSize:10, color:C.textMuted }}>{n.count}</span>}
            </button>);
          })}
        </nav>
        {!sideCollapsed && <div style={{ padding:"8px 12px 12px", borderTop:`1px solid ${C.border}` }}>
          <div style={{ fontSize:10, fontWeight:500, color:C.text, marginBottom:2 }}>{currentUser.name}</div>
          <div style={{ fontSize:9, color:C.textMuted, marginBottom:4 }}>{ROLES[role]?.label}</div>
          <div style={{ fontSize:9, color:C.textMuted, lineHeight:1.5, letterSpacing:0.2 }}>ThandoQ & Associates<br/>NCR: {settings?.ncrReg||"—"}<br/>Valid: {settings?.ncrExpiry||"—"}</div>
          <button onClick={reset} style={{ marginTop:6, background:"none", border:`1px solid ${C.border}`, color:C.textMuted, borderRadius:2, padding:"2px 6px", fontSize:9, cursor:"pointer", fontFamily:"inherit" }}>Reset Demo</button>
        </div>}
      </aside>

      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 16px", height:48, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:C.surface2, padding:"5px 10px", width:280, border:`1px solid ${C.border}` }}>
            {I.search}
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ border:"none", background:"transparent", outline:"none", fontSize:12, color:C.text, width:"100%", fontFamily:"inherit" }} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ position:"relative" }}>
              <button onClick={()=>setNotifOpen(!notifOpen)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, position:"relative", padding:4 }}>
                {I.bell}
                {unread>0 && <span style={{ position:"absolute", top:-2, right:-2, width:14, height:14, borderRadius:7, background:C.red, color:C.white, fontSize:8, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center" }}>{unread}</span>}
              </button>
              {notifOpen && <div style={{ position:"absolute", right:0, top:34, width:340, background:C.surface, border:`1px solid ${C.border}`, boxShadow:"0 4px 16px rgba(0,0,0,0.06)", zIndex:100, maxHeight:380, overflow:"auto" }}>
                <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, fontSize:12, fontWeight:600, color:C.text }}>Notifications ({unread})</div>
                {alerts.slice(0,8).map(a => (
                  <div key={a.id} style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}`, opacity:a.read?0.35:1, cursor:"pointer" }} onClick={()=>{markRead(a.id)}}>
                    <div style={{ fontSize:11, fontWeight:500, color:C.text }}>{a.title}</div>
                    <div style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{a.msg}</div>
                  </div>
                ))}
              </div>}
            </div>
            <div style={{ width:1, height:20, background:C.border }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:26, height:26, borderRadius:2, background:C.surface2, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, color:C.textDim }}>{currentUser.initials}</div>
              <select value={currentUser.id} onChange={e=>{const u=SYSTEM_USERS.find(u=>u.id===e.target.value);if(u){setCurrentUser(u);setDetail(null)}}} style={{ border:"none", background:"transparent", fontSize:11, fontWeight:500, color:C.text, fontFamily:"inherit", outline:"none", cursor:"pointer", maxWidth:160 }}>
                {SYSTEM_USERS.map(u=><option key={u.id} value={u.id}>{u.name} ({ROLES[u.role]?.label})</option>)}
              </select>
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
