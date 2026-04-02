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

// ─── Color System — Bank Grade ───
// Navy/slate text, white surfaces, single muted accent, no colored backgrounds
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

// ─── RBAC: Roles, Permissions, Users ───
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

// Permission matrix: module → role → allowed actions
// Actions: view, create, update, delete, approve, assign, signoff, export
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
};

// Approval authority by role (max loan amount)
const APPROVAL_LIMITS = {
  CREDIT: 250000, CREDIT_SNR: 500000, CREDIT_HEAD: 1000000, EXEC: 5000000, ADMIN: Infinity,
};

// System users (seeded)
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

// Permission check helper
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

// ─── SEED DATA ───
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
    { id:"P001", name:"SME Term Loan", minAmount:100000, maxAmount:5000000, minTerm:12, maxTerm:60, baseRate:14.5, description:"General purpose business finance for SMEs" },
    { id:"P002", name:"Agri Finance", minAmount:200000, maxAmount:10000000, minTerm:12, maxTerm:84, baseRate:13.0, description:"Agricultural and agro-processing finance" },
    { id:"P003", name:"Innovation Loan", minAmount:250000, maxAmount:3000000, minTerm:24, maxTerm:60, baseRate:15.0, description:"Technology and innovation business finance" },
    { id:"P004", name:"Trade Finance", minAmount:100000, maxAmount:8000000, minTerm:3, maxTerm:12, baseRate:12.5, description:"Short-term trade and import/export finance" },
    { id:"P005", name:"Asset Finance", minAmount:50000, maxAmount:5000000, minTerm:12, maxTerm:60, baseRate:13.5, description:"Equipment and asset acquisition finance" },
    { id:"P006", name:"Empowerment Finance", minAmount:100000, maxAmount:3000000, minTerm:12, maxTerm:72, baseRate:12.0, description:"Preferential rates for qualifying BEE enterprises" },
  ];

  const applications = [
    { id:"APP-001", custId:"C001", status:"Approved", product:"P001", amount:750000, term:36, purpose:"Working capital & inventory expansion for new retail outlet", rate:14.5, riskScore:72, dscr:1.85, currentRatio:1.92, debtEquity:0.65, socialScore:78, recommendation:"Approve", approver:"Head of Credit", creditMemo:"Strong trading history, solid cash flows, well-secured.", submitted:now-90*day, decided:now-80*day, conditions:["Maintain DSCR > 1.3","Submit quarterly financials","Insurance on stock"] },
    { id:"APP-002", custId:"C002", status:"Approved", product:"P002", amount:1200000, term:48, purpose:"Equipment purchase & irrigation system for expanded farming operations", rate:13.0, riskScore:68, dscr:1.62, currentRatio:1.45, debtEquity:0.78, socialScore:92, recommendation:"Approve", approver:"Credit Committee", creditMemo:"Strong social impact. Seasonal cash flow mitigated by crop insurance.", submitted:now-70*day, decided:now-55*day, conditions:["Crop insurance required","Annual audit","DSCR > 1.2"] },
    { id:"APP-003", custId:"C003", status:"Underwriting", product:"P003", amount:2000000, term:60, purpose:"Software platform development and market expansion", rate:null, riskScore:null, dscr:null, currentRatio:null, debtEquity:null, socialScore:null, recommendation:null, approver:null, creditMemo:null, submitted:now-10*day, decided:null, conditions:[], workflow:{ kycComplete:false, kycFindings:null, kycDate:null, docsComplete:false, docsFindings:null, docsDate:null, siteVisitComplete:false, siteVisitFindings:null, siteVisitDate:null, creditPulled:false, creditBureauScore:null, creditDate:null, financialAnalysisComplete:false, financialFindings:null, financialDate:null, socialVerified:false, socialFindings:null, socialDate:null, sanctionsCleared:false, sanctionsDate:null } },
    { id:"APP-004", custId:"C004", status:"Approved", product:"P001", amount:3500000, term:60, purpose:"Construction equipment fleet renewal and working capital", rate:15.0, riskScore:81, dscr:2.1, currentRatio:2.35, debtEquity:0.42, socialScore:85, recommendation:"Approve", approver:"Credit Committee", creditMemo:"Strong balance sheet. Key government contracts provide revenue visibility.", submitted:now-200*day, decided:now-185*day, conditions:["DSCR > 1.5","Insurance on all equipment","Submit quarterly financials","Maintain BEE Level 1"] },
    { id:"APP-005", custId:"C005", status:"Submitted", product:"P001", amount:500000, term:24, purpose:"Cold storage facility for food processing expansion", rate:null, riskScore:null, dscr:null, currentRatio:null, debtEquity:null, socialScore:null, recommendation:null, approver:null, creditMemo:null, submitted:now-5*day, decided:null, conditions:[], workflow:{ kycComplete:false, kycFindings:null, kycDate:null, docsComplete:false, docsFindings:null, docsDate:null, siteVisitComplete:false, siteVisitFindings:null, siteVisitDate:null, creditPulled:false, creditBureauScore:null, creditDate:null, financialAnalysisComplete:false, financialFindings:null, financialDate:null, socialVerified:false, socialFindings:null, socialDate:null, sanctionsCleared:false, sanctionsDate:null } },
    { id:"APP-006", custId:"C003", status:"Declined", product:"P004", amount:5000000, term:12, purpose:"Import of hardware components for resale", rate:null, riskScore:42, dscr:0.9, currentRatio:0.87, debtEquity:1.85, socialScore:55, recommendation:"Decline", approver:"Head of Credit", creditMemo:"Insufficient cash flow coverage. High leverage. Affordability test failed.", submitted:now-45*day, decided:now-35*day, conditions:[] },
    { id:"APP-007", custId:"C006", status:"Approved", product:"P005", amount:1800000, term:48, purpose:"Purchase of 3 additional delivery trucks", rate:13.5, riskScore:79, dscr:2.35, currentRatio:2.1, debtEquity:0.38, socialScore:80, recommendation:"Approve", approver:"Head of Credit", creditMemo:"Excellent payment history. Strong contract pipeline. Well-managed fleet.", submitted:now-250*day, decided:now-240*day, conditions:["Insurance on all vehicles","GPS tracking required","Quarterly financials"] },
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

  // ─── Document Registry ───
  // Categories: KYC (Know Your Customer), KYB (Know Your Business), Financial, Legal, Collateral, Compliance, Collections
  // Lifecycle: Required → Pending → Received → Under Review → Verified → Expired
  const documents = [
    // C001 – Nomsa Trading
    { id:"DOC-001", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"SA ID Document – Nomsa Dlamini", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-178*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-175*day, expiryDate:null, fileRef:"C001/KYC/id_document.pdf", notes:"Verified against Home Affairs database." },
    { id:"DOC-002", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-178*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-175*day, expiryDate:null, fileRef:"C001/KYB/cipc_cert.pdf", notes:"Reg 2019/123456/07 confirmed active on CIPC portal." },
    { id:"DOC-003", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"Proof of Business Address", category:"KYC", type:"Proof of Address", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-178*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-174*day, expiryDate:null, fileRef:"C001/KYC/proof_address.pdf", notes:"Municipal account dated within 3 months." },
    { id:"DOC-004", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"Bank Confirmation Letter – FNB", category:"KYC", type:"Bank Confirmation", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-176*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-174*day, expiryDate:null, fileRef:"C001/KYC/bank_confirmation.pdf", notes:"Account confirmed active. Bank stamp verified." },
    { id:"DOC-005", custId:"C001", appId:"APP-001", loanId:null, name:"Financial Statements FY2024", category:"Financial", type:"Annual Financials", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-170*day, verifiedBy:"Credit Analyst – P. Sithole", verifiedAt:now-165*day, expiryDate:null, fileRef:"C001/Financial/AFS_2024.pdf", notes:"Audited by BDO. Clean audit opinion." },
    { id:"DOC-006", custId:"C001", appId:"APP-001", loanId:null, name:"Business Plan 2025-2027", category:"Financial", type:"Business Plan", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-170*day, verifiedBy:"Credit Analyst – P. Sithole", verifiedAt:now-160*day, expiryDate:null, fileRef:"C001/Financial/business_plan.pdf", notes:"3-year plan. Revenue projections assessed as reasonable." },
    { id:"DOC-007", custId:"C001", appId:"APP-001", loanId:"LN-001", name:"Loan Agreement – LN-001", category:"Legal", type:"Loan Agreement", required:true, status:"Verified", uploadedBy:"System", uploadedAt:now-75*day, verifiedBy:"Legal – M. Zulu", verifiedAt:now-75*day, expiryDate:null, fileRef:"C001/Legal/loan_agreement_LN001.pdf", notes:"Electronically signed. Stored in secure repository." },
    { id:"DOC-008", custId:"C001", appId:null, loanId:"LN-001", name:"Stock Insurance Certificate", category:"Collateral", type:"Insurance", required:true, status:"Verified", uploadedBy:"Nomsa Dlamini", uploadedAt:now-70*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-68*day, expiryDate:now+295*day, fileRef:"C001/Collateral/stock_insurance.pdf", notes:"R1.2M cover. Hollard policy. Renewal due in 10 months." },
    { id:"DOC-009", custId:"C001", appId:null, loanId:"LN-001", name:"Personal Guarantee – Director", category:"Legal", type:"Guarantee", required:true, status:"Verified", uploadedBy:"System", uploadedAt:now-75*day, verifiedBy:"Legal – M. Zulu", verifiedAt:now-74*day, expiryDate:null, fileRef:"C001/Legal/personal_guarantee.pdf", notes:"Unlimited surety signed by Nomsa Dlamini." },
    // C002 – Sipho Agri
    { id:"DOC-010", custId:"C002", appId:"APP-002", loanId:"LN-002", name:"SA ID Document – Sipho Mabaso", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-118*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-115*day, expiryDate:null, fileRef:"C002/KYC/id_document.pdf", notes:"Verified against Home Affairs." },
    { id:"DOC-011", custId:"C002", appId:"APP-002", loanId:"LN-002", name:"Co-operative Registration", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-118*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-115*day, expiryDate:null, fileRef:"C002/KYB/coop_registration.pdf", notes:"Reg 2020/654321/07 active." },
    { id:"DOC-012", custId:"C002", appId:"APP-002", loanId:null, name:"Proof of Address – Farm 12", category:"KYC", type:"Proof of Address", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-118*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-114*day, expiryDate:null, fileRef:"C002/KYC/proof_address.pdf", notes:"Title deed used as proof. Farm address confirmed." },
    { id:"DOC-013", custId:"C002", appId:"APP-002", loanId:null, name:"Bank Confirmation Letter – Standard Bank", category:"KYC", type:"Bank Confirmation", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-116*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-114*day, expiryDate:null, fileRef:"C002/KYC/bank_confirmation.pdf", notes:"Account confirmed active." },
    { id:"DOC-014", custId:"C002", appId:"APP-002", loanId:null, name:"Financial Statements FY2024", category:"Financial", type:"Annual Financials", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-112*day, verifiedBy:"Credit Analyst – P. Sithole", verifiedAt:now-108*day, expiryDate:null, fileRef:"C002/Financial/AFS_2024.pdf", notes:"Reviewed by independent accountant." },
    { id:"DOC-015", custId:"C002", appId:"APP-002", loanId:null, name:"Business Plan – Irrigation Expansion", category:"Financial", type:"Business Plan", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-112*day, verifiedBy:"Credit Analyst – P. Sithole", verifiedAt:now-105*day, expiryDate:null, fileRef:"C002/Financial/business_plan.pdf", notes:"Clear expansion plan. Realistic projections." },
    { id:"DOC-016", custId:"C002", appId:null, loanId:"LN-002", name:"Land Title Deed", category:"Collateral", type:"Title Deed", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-55*day, verifiedBy:"Legal – M. Zulu", verifiedAt:now-52*day, expiryDate:null, fileRef:"C002/Collateral/title_deed.pdf", notes:"Unencumbered. Valued at R1.5M." },
    { id:"DOC-017", custId:"C002", appId:null, loanId:"LN-002", name:"Crop Insurance Certificate", category:"Collateral", type:"Insurance", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-50*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-48*day, expiryDate:now+315*day, fileRef:"C002/Collateral/crop_insurance.pdf", notes:"R2M cover. Old Mutual policy." },
    { id:"DOC-018", custId:"C002", appId:null, loanId:"LN-002", name:"BEE Level 1 Certificate", category:"Compliance", type:"BEE Certificate", required:true, status:"Verified", uploadedBy:"Sipho Mabaso", uploadedAt:now-110*day, verifiedBy:"Compliance Officer", verifiedAt:now-108*day, expiryDate:now+90*day, fileRef:"C002/Compliance/bee_cert.pdf", notes:"Level 1. Expires in 90 days — renewal required." },
    // C003 – Zenith Tech (application in underwriting – some docs pending)
    { id:"DOC-019", custId:"C003", appId:"APP-003", loanId:null, name:"SA ID Document – Ayanda Nkosi", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Ayanda Nkosi", uploadedAt:now-58*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-55*day, expiryDate:null, fileRef:"C003/KYC/id_document.pdf", notes:"Verified against Home Affairs." },
    { id:"DOC-020", custId:"C003", appId:"APP-003", loanId:null, name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Ayanda Nkosi", uploadedAt:now-58*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-55*day, expiryDate:null, fileRef:"C003/KYB/cipc_cert.pdf", notes:"Active on CIPC." },
    { id:"DOC-021", custId:"C003", appId:"APP-003", loanId:null, name:"Proof of Address", category:"KYC", type:"Proof of Address", required:true, status:"Verified", uploadedBy:"Ayanda Nkosi", uploadedAt:now-58*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-55*day, expiryDate:null, fileRef:"C003/KYC/proof_address.pdf", notes:"Lease agreement for office premises." },
    { id:"DOC-022", custId:"C003", appId:"APP-003", loanId:null, name:"Bank Confirmation Letter – Nedbank", category:"KYC", type:"Bank Confirmation", required:true, status:"Verified", uploadedBy:"Ayanda Nkosi", uploadedAt:now-57*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-55*day, expiryDate:null, fileRef:"C003/KYC/bank_confirmation.pdf", notes:"Confirmed active." },
    { id:"DOC-023", custId:"C003", appId:"APP-003", loanId:null, name:"Financial Statements FY2024", category:"Financial", type:"Annual Financials", required:true, status:"Received", uploadedBy:"Ayanda Nkosi", uploadedAt:now-12*day, verifiedBy:null, verifiedAt:null, expiryDate:null, fileRef:"C003/Financial/AFS_2024.pdf", notes:"Received. Awaiting credit analyst review." },
    { id:"DOC-024", custId:"C003", appId:"APP-003", loanId:null, name:"Business Plan – Platform Development", category:"Financial", type:"Business Plan", required:true, status:"Under Review", uploadedBy:"Ayanda Nkosi", uploadedAt:now-12*day, verifiedBy:null, verifiedAt:null, expiryDate:null, fileRef:"C003/Financial/business_plan.pdf", notes:"Under review by credit analyst." },
    // C004 – Khanyisa Construction (in collections)
    { id:"DOC-025", custId:"C004", appId:"APP-004", loanId:"LN-003", name:"SA ID Document – Thabo Mokoena", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Thabo Mokoena", uploadedAt:now-298*day, verifiedBy:"Loan Officer", verifiedAt:now-295*day, expiryDate:null, fileRef:"C004/KYC/id_document.pdf", notes:"Verified." },
    { id:"DOC-026", custId:"C004", appId:"APP-004", loanId:"LN-003", name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Thabo Mokoena", uploadedAt:now-298*day, verifiedBy:"Loan Officer", verifiedAt:now-295*day, expiryDate:null, fileRef:"C004/KYB/cipc_cert.pdf", notes:"Active." },
    { id:"DOC-027", custId:"C004", appId:"APP-004", loanId:null, name:"Financial Statements FY2024", category:"Financial", type:"Annual Financials", required:true, status:"Verified", uploadedBy:"Thabo Mokoena", uploadedAt:now-205*day, verifiedBy:"Credit Analyst", verifiedAt:now-200*day, expiryDate:null, fileRef:"C004/Financial/AFS_2024.pdf", notes:"Audited." },
    { id:"DOC-028", custId:"C004", appId:"APP-004", loanId:null, name:"Financial Statements FY2023", category:"Financial", type:"Annual Financials", required:false, status:"Verified", uploadedBy:"Thabo Mokoena", uploadedAt:now-205*day, verifiedBy:"Credit Analyst", verifiedAt:now-200*day, expiryDate:null, fileRef:"C004/Financial/AFS_2023.pdf", notes:"Prior year comparatives." },
    { id:"DOC-029", custId:"C004", appId:null, loanId:"LN-003", name:"CIDB Registration Grade 7", category:"Compliance", type:"Industry License", required:true, status:"Verified", uploadedBy:"Thabo Mokoena", uploadedAt:now-295*day, verifiedBy:"Compliance Officer", verifiedAt:now-290*day, expiryDate:now+70*day, fileRef:"C004/Compliance/cidb_registration.pdf", notes:"Grade 7 CE/PE. Renewal due in 70 days." },
    { id:"DOC-030", custId:"C004", appId:null, loanId:"LN-003", name:"Equipment Insurance – Fleet", category:"Collateral", type:"Insurance", required:true, status:"Verified", uploadedBy:"Thabo Mokoena", uploadedAt:now-180*day, verifiedBy:"Loan Officer", verifiedAt:now-178*day, expiryDate:now+185*day, fileRef:"C004/Collateral/fleet_insurance.pdf", notes:"R4M cover on construction equipment." },
    { id:"DOC-031", custId:"C004", appId:null, loanId:"LN-003", name:"Letter of Demand – NCA Section 129", category:"Collections", type:"Demand Letter", required:false, status:"Verified", uploadedBy:"Collections Specialist", uploadedAt:now-10*day, verifiedBy:"Legal – M. Zulu", verifiedAt:now-10*day, expiryDate:null, fileRef:"C004/Collections/demand_letter.pdf", notes:"Formal demand issued. 20 business day cure period." },
    // C005 – Ubuntu Foods (FICA pending – incomplete docs)
    { id:"DOC-032", custId:"C005", appId:"APP-005", loanId:null, name:"SA ID Document – Lindiwe Khumalo", category:"KYC", type:"ID Document", required:true, status:"Received", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-28*day, verifiedBy:null, verifiedAt:null, expiryDate:null, fileRef:"C005/KYC/id_document.pdf", notes:"Received. Pending verification against Home Affairs." },
    { id:"DOC-033", custId:"C005", appId:"APP-005", loanId:null, name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-28*day, verifiedBy:"Loan Officer – J. Ndaba", verifiedAt:now-25*day, expiryDate:null, fileRef:"C005/KYB/cipc_cert.pdf", notes:"Confirmed active." },
    { id:"DOC-034", custId:"C005", appId:"APP-005", loanId:null, name:"Proof of Address", category:"KYC", type:"Proof of Address", required:true, status:"Pending", uploadedBy:null, uploadedAt:null, verifiedBy:null, verifiedAt:null, expiryDate:null, fileRef:null, notes:"Outstanding. Requested from customer." },
    { id:"DOC-035", custId:"C005", appId:"APP-005", loanId:null, name:"Bank Confirmation Letter", category:"KYC", type:"Bank Confirmation", required:true, status:"Received", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-26*day, verifiedBy:null, verifiedAt:null, expiryDate:null, fileRef:"C005/KYC/bank_confirmation.pdf", notes:"Received. Pending verification." },
    { id:"DOC-036", custId:"C005", appId:"APP-005", loanId:null, name:"Financial Statements FY2024", category:"Financial", type:"Annual Financials", required:true, status:"Received", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-20*day, verifiedBy:null, verifiedAt:null, expiryDate:null, fileRef:"C005/Financial/AFS_2024.pdf", notes:"Received. Not yet reviewed." },
    { id:"DOC-037", custId:"C005", appId:"APP-005", loanId:null, name:"Business Plan – Cold Storage", category:"Financial", type:"Business Plan", required:true, status:"Received", uploadedBy:"Lindiwe Khumalo", uploadedAt:now-20*day, verifiedBy:null, verifiedAt:null, expiryDate:null, fileRef:"C005/Financial/business_plan.pdf", notes:"Received. Pending review." },
    // C006 – Msenge Logistics
    { id:"DOC-038", custId:"C006", appId:"APP-007", loanId:"LN-004", name:"SA ID Document – Mandla Gcwabe", category:"KYC", type:"ID Document", required:true, status:"Verified", uploadedBy:"Mandla Gcwabe", uploadedAt:now-348*day, verifiedBy:"Loan Officer", verifiedAt:now-345*day, expiryDate:null, fileRef:"C006/KYC/id_document.pdf", notes:"Verified." },
    { id:"DOC-039", custId:"C006", appId:"APP-007", loanId:"LN-004", name:"CIPC Registration Certificate", category:"KYB", type:"Company Registration", required:true, status:"Verified", uploadedBy:"Mandla Gcwabe", uploadedAt:now-348*day, verifiedBy:"Loan Officer", verifiedAt:now-345*day, expiryDate:null, fileRef:"C006/KYB/cipc_cert.pdf", notes:"Active." },
    { id:"DOC-040", custId:"C006", appId:null, loanId:"LN-004", name:"Operating License – Transport", category:"Compliance", type:"Operating License", required:true, status:"Verified", uploadedBy:"Mandla Gcwabe", uploadedAt:now-340*day, verifiedBy:"Compliance Officer", verifiedAt:now-338*day, expiryDate:now+25*day, fileRef:"C006/Compliance/operating_license.pdf", notes:"Valid. Renewal due in 25 days." },
    { id:"DOC-041", custId:"C006", appId:null, loanId:"LN-004", name:"Vehicle Insurance – 3x Trucks", category:"Collateral", type:"Insurance", required:true, status:"Verified", uploadedBy:"Mandla Gcwabe", uploadedAt:now-235*day, verifiedBy:"Loan Officer", verifiedAt:now-233*day, expiryDate:now+130*day, fileRef:"C006/Collateral/vehicle_insurance.pdf", notes:"Full comprehensive cover. R1.6M." },
    { id:"DOC-042", custId:"C006", appId:null, loanId:"LN-004", name:"GPS Tracking Confirmation", category:"Compliance", type:"Compliance Certificate", required:true, status:"Verified", uploadedBy:"Mandla Gcwabe", uploadedAt:now-230*day, verifiedBy:"Loan Officer", verifiedAt:now-228*day, expiryDate:null, fileRef:"C006/Compliance/gps_tracking.pdf", notes:"All 3 vehicles tracked. Covenant requirement met." },
  ];

  // ─── NCR Statutory Reporting Calendar ───
  // Year-end assumed: 28 February (common SA financial year-end)
  // Annual reports due within 6 months of year-end = 31 August
  // Form 39 quarterly if disbursements > R15M
  const yearEnd = "28 February 2026";
  const annualDueDate = "31 August 2026";
  const totalDisbursed = loans.reduce((s,l) => s + l.amount, 0);
  const form39Required = totalDisbursed > 15000000 ? "Quarterly" : "Annual";

  const statutoryReports = [
    // Annual reports (due within 6 months of year-end)
    { id:"SR-001", name:"Annual Compliance Report", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Comprehensive compliance report covering all NCA obligations for the financial year." },
    { id:"SR-002", name:"Annual Financial Statements", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Must include the auditor's report. Audited financial statements for the full financial year." },
    { id:"SR-003", name:"Annual Financial & Operational Return", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Detailed financial and operational data return as prescribed by the NCR." },
    { id:"SR-004", name:"Assurance Engagement Report", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Independent assurance engagement on compliance with NCA requirements." },
    // Form 39 Statistical Returns (Quarterly since disbursements > R15M)
    { id:"SR-005", name:"Form 39 – Q1 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Jan – 31 Mar 2026", dueDate:"2026-05-15", submitTo:"returns@ncr.org.za", status:"In Progress", preparer:"Finance Department", reviewer:"Chief Risk Officer", notes:"Quarterly statistical return. Reporting period: 1 January – 31 March 2026." },
    { id:"SR-006", name:"Form 39 – Q2 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Apr – 30 Jun 2026", dueDate:"2026-08-15", submitTo:"returns@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Quarterly statistical return. Reporting period: 1 April – 30 June 2026." },
    { id:"SR-007", name:"Form 39 – Q3 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Jul – 30 Sep 2026", dueDate:"2026-11-15", submitTo:"returns@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Quarterly statistical return. Reporting period: 1 July – 30 September 2026." },
    { id:"SR-008", name:"Form 39 – Q4 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Oct – 31 Dec 2026", dueDate:"2027-02-15", submitTo:"returns@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Quarterly statistical return. Reporting period: 1 October – 31 December 2026." },
    // Previous submissions (for history)
    { id:"SR-009", name:"Form 39 – Q4 2025 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Oct – 31 Dec 2025", dueDate:"2026-02-15", submitTo:"returns@ncr.org.za", status:"Submitted", preparer:"Finance Department", reviewer:"Chief Risk Officer", submittedDate:"2026-02-12", notes:"Submitted on time via email to returns@ncr.org.za." },
    { id:"SR-010", name:"Annual Compliance Report FY2025", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2025", dueDate:"2025-08-31", submitTo:"submissions@ncr.org.za", status:"Submitted", preparer:"Compliance Officer", reviewer:"Chief Risk Officer", submittedDate:"2025-08-28", notes:"Submitted on time." },
  ];

  // Add statutory deadline alerts
  const statutoryAlerts = [
    { id:uid(), type:"Statutory", severity:"critical", title:"Form 39 Q1 2026 – Due 15 May 2026", msg:"Statistical return for period 1 Jan – 31 Mar 2026 due to NCR (returns@ncr.org.za) by 15 May 2026. Currently: In Progress. 44 days remaining.", read:false, ts:now },
    { id:uid(), type:"Statutory", severity:"warning", title:"Annual Reports – Due 31 August 2026", msg:"4 annual statutory reports due within 6 months of year-end (28 Feb 2026). Submit to submissions@ncr.org.za by 31 Aug 2026.", read:false, ts:now-1*day },
    { id:uid(), type:"Statutory", severity:"info", title:"NCR Registration Renewal – 31 July 2026", msg:"NCRCP22396 expires 31 July 2026. Renewal application must be submitted before expiry.", read:false, ts:now-2*day },
  ];

  return { customers, products, applications, loans, collections, alerts: [...alerts, ...statutoryAlerts], audit, provisions, comms, documents, statutoryReports, settings:{ companyName:"ThandoQ and Associates (Pty) Ltd", ncrReg:"NCRCP22396", ncrExpiry:"31 July 2026", branch:"East London, Nahoon Valley", yearEnd, annualDueDate, form39Required, totalDisbursed, ncrAddress:"127 – 15th Road, Randjies Park, Midrand, 1685", ncrPO:"PO Box 209, Halfway House, 1685", ncrEmailAnnual:"submissions@ncr.org.za", ncrEmailForm39:"returns@ncr.org.za" } };
}

// ─── Icons ───
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

// ─── Reusable Components ───
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

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(SYSTEM_USERS[0]); // default: Admin
  const role = currentUser.role;
  const canDo = (mod, action) => can(role, mod, action);
  const canDoAny = (mod, actions) => canAny(role, mod, actions);

  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get(SK); if (r?.value) { setData(JSON.parse(r.value)); return; } } catch {}
      const d = seed();
      try { await window.storage.set(SK, JSON.stringify(d)); } catch {}
      setData(d);
    })();
  }, []);

  const save = useCallback(async next => { setData(next); try { await window.storage.set(SK, JSON.stringify(next)); } catch {} }, []);
  const reset = async () => { const d = seed(); await save(d); setDetail(null); setModal(null); };
  const cust = id => data?.customers?.find(c => c.id === id);
  const prod = id => data?.products?.find(p => p.id === id);
  const loanForApp = appId => data?.loans?.find(l => l.appId === appId);

  if (!data) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:C.bg, color:C.textMuted, fontFamily:"'Outfit',sans-serif", fontSize:13 }}>Loading…</div>;

  const { customers, products, applications, loans, collections, alerts, audit, provisions, comms, documents, statutoryReports, settings } = data;
  const unread = alerts.filter(a => !a.read).length;

  // ─── Nav (filtered by role) ───
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
  ].filter(n => canDo(n.key, "view"));

  const markRead = id => save({ ...data, alerts: alerts.map(a => a.id === id ? { ...a, read: true } : a) });
  const addAudit = (action, entity, user, detail, category) => ({ id: uid(), action, entity, user, detail, ts: Date.now(), category });
  const addAlert = (type, severity, title, msg, extra = {}) => ({ id: uid(), type, severity, title, msg, read: false, ts: Date.now(), ...extra });

  // ─── Handlers (RBAC-enforced) ───
  const submitApp = form => {
    if (!canDo("origination","create")) { alert("Permission denied: you cannot create applications."); return; }
    const app = { id:`APP-${String(applications.length+1).padStart(3,"0")}`, custId:form.custId, status:"Submitted", product:form.product, amount:+form.amount, term:+form.term, purpose:form.purpose, rate:null, riskScore:null, dscr:null, currentRatio:null, debtEquity:null, socialScore:null, recommendation:null, approver:null, creditMemo:null, submitted:Date.now(), decided:null, conditions:[], assignedTo:null, createdBy:currentUser.id };
    const c = cust(form.custId);
    save({ ...data,
      applications: [...applications, app],
      audit: [...audit, addAudit("Application Submitted", app.id, c?.contact || "Customer", `New ${prod(form.product)?.name} application for ${fmt.cur(form.amount)} submitted.`, "Origination")],
      alerts: [...alerts, addAlert("Application", "info", `New Application – ${c?.name}`, `${app.id} for ${fmt.cur(form.amount)} submitted.`)]
    });
    setModal(null);
  };

  const moveToUnderwriting = appId => {
    if (!canDo("underwriting","update")) { alert("Permission denied."); return; }
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

  // Officer actions on individual KYC/Doc checklist items
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

  // Sign off on a step — only when all items have been actioned
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

  // Document-level actions within underwriting (RBAC-enforced)
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
    const notification = { id:uid(), custId:a?.custId, loanId:null, channel:"Email", direction:"Outbound", from:currentUser.name, subject:`Document Request – ${docType}`, body:message || `Dear ${c?.contact}, please submit the following document for your application ${appId}: ${docType}. Upload via the KwikBridge portal or email to documents@kwikbridge.co.za. Regards, KwikBridge Lending Operations.`, ts:Date.now() };
    save({ ...data, comms:[...comms, notification], audit:[...audit, addAudit("Document Requested", appId, currentUser.name, `Request sent to ${c?.contact} for: ${docType}.`, "Underwriting")] });
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
        { item:"ID Document", source:"Home Affairs API", doc: appDocs.find(d => d.type === "ID Document") },
        { item:"Proof of Address", source:"Manual verification", doc: appDocs.find(d => d.type === "Proof of Address") },
        { item:"Bank Confirmation", source:"Bank letter", doc: appDocs.find(d => d.type === "Bank Confirmation") },
        { item:"Company Registration", source:"CIPC API", doc: appDocs.find(d => d.type === "Company Registration") },
      ];
      const findings = checks.map(ch => ({
        item: ch.item, source: ch.source,
        systemResult: ch.doc?.status === "Verified" ? "Pass" : ch.doc ? "Fail" : "Missing",
        status: "Pending Review",
        detail: ch.doc?.status === "Verified" ? `Verified on ${fmt.date(ch.doc.verifiedAt)} by ${ch.doc.verifiedBy || "System"}`
          : ch.doc ? `Document status: ${ch.doc.status}. Requires officer verification.`
          : "Not on file. Request from customer before sign-off.",
        officerAction: null, officerNote: ""
      }));
      findings.push({ item:"Sanctions Screening", source:"OFAC / UN / SA Consolidated Lists", systemResult:"Pass", status:"Pending Review", detail:"Automated screening returned no matches. Officer must confirm.", officerAction:null, officerNote:"" });
      findings.push({ item:"PEP Screening", source:"PEP Database", systemResult:"Pass", status:"Pending Review", detail:"No politically exposed persons identified. Officer must confirm.", officerAction:null, officerNote:"" });
      w.kycComplete = false;
      w.kycFindings = findings;
      w.kycDate = Date.now();
      w.kycOfficer = null;
      w.sanctionsCleared = false;
      newAudit.push(addAudit("KYC Checks Initiated", a.id, "System", `${checks.length + 2} automated checks run. Awaiting Loan Officer review and sign-off.`, "Compliance"));
    }

    if (stepKey === "docs") {
      const reqTypes = ["ID Document","Proof of Address","Bank Confirmation","Company Registration","Annual Financials","Business Plan"];
      const findings = reqTypes.map(type => {
        const doc = appDocs.find(d => d.type === type || d.name.includes(type.split(" ")[0]));
        return {
          item: type, required: true,
          systemResult: doc?.status === "Verified" ? "Verified" : doc?.status === "Under Review" ? "Under Review" : doc ? "Received" : "Missing",
          status: "Pending Review",
          detail: doc ? `${doc.id} — ${doc.status}${doc.verifiedBy ? ` by ${doc.verifiedBy}` : ""}` : "Not uploaded. Request from customer.",
          docId: doc?.id || null,
          officerAction: null, officerNote: ""
        };
      });
      const industryDocs = appDocs.filter(d => ["Industry License","Operating License","CIDB Registration"].includes(d.type));
      industryDocs.forEach(d => findings.push({ item:d.type, required:false, systemResult:d.status, status:"Pending Review", detail:`${d.id} — ${d.status}`, docId:d.id, officerAction:null, officerNote:"" }));
      w.docsComplete = false;
      w.docsFindings = findings;
      w.docsDate = Date.now();
      w.docsOfficer = null;
      newAudit.push(addAudit("Document Review Initiated", a.id, "System", `${findings.length} documents checked. Awaiting Loan Officer review and sign-off.`, "Underwriting"));
    }

    if (stepKey === "sitevisit") {
      const findings = [
        { item:"Premises Inspection", detail:`Visited ${c?.address}. Premises are ${c?.industry === "Construction" ? "an operational yard with equipment storage" : c?.industry === "Agriculture" ? "a working farm with crop/livestock areas" : "a commercial premises suitable for stated operations"}.` },
        { item:"Operational Activity", detail:`Business is actively trading. ${c?.employees || 0} staff observed on site. Equipment and inventory consistent with stated operations.` },
        { item:"Management Interview", detail:`Interview conducted with ${c?.contact} (${c?.years || 0} years experience). Management demonstrates ${c?.riskCategory === "Low" ? "strong" : c?.riskCategory === "Medium" ? "adequate" : "developing"} understanding of business operations, market dynamics, and financial management.` },
        { item:"Infrastructure Assessment", detail:`Facilities are ${c?.revenue > 5000000 ? "well-maintained and adequate for current and projected volumes" : "functional and adequate for current operations. Expansion may require additional investment"}.` },
        { item:"Revenue Verification", detail:`Stated annual revenue of ${fmt.cur(c?.revenue || 0)} is ${c?.employees > 20 ? "consistent" : "broadly consistent"} with observed activity levels, staffing, and industry benchmarks for ${c?.sector || c?.industry}.` },
        { item:"Risk Observations", detail: c?.riskCategory === "High" ? "Concentration risk noted — significant revenue dependence on limited number of contracts. Cash flow timing mismatch between project milestones and debt service dates." : c?.riskCategory === "Medium" ? "Moderate seasonal cash flow variation observed. Customer aware and manages through working capital facility." : "No material risk factors observed beyond normal business risk for the sector." },
      ];
      w.siteVisitComplete = false;
      w.siteVisitFindings = findings;
      w.siteVisitDate = Date.now();
      w.siteVisitOfficer = null;
      newAudit.push(addAudit("Site Visit Completed", a.id, "Loan Officer – J. Ndaba", `Site visit at ${c?.address}. ${c?.employees} staff on site. ${findings.length} areas assessed.`, "Underwriting"));
    }

    if (stepKey === "credit") {
      // Gate: KYC and docs should be done first
      if (!w.kycComplete) { alert("Complete KYC/FICA verification before running credit analysis."); return; }
      if (!w.docsComplete) { alert("Complete document review before running credit analysis."); return; }
      const bureauScore = Math.floor(Math.random() * 200 + 500);
      const monthlyPmt = Math.round(a.amount * (0.145 / 12) / (1 - Math.pow(1 + 0.145 / 12, -a.term)));
      const monthlyIncome = Math.round((c?.revenue || 3000000) / 12);
      const existingDebt = Math.round(monthlyIncome * (Math.random() * 0.2 + 0.05));
      const dscr = +((monthlyIncome - existingDebt) / monthlyPmt).toFixed(2);
      const currentRatio = +(1.0 + Math.random() * 1.5).toFixed(2);
      const debtEquity = +(Math.random() * 1.8).toFixed(2);
      const grossMargin = +(Math.random() * 0.25 + 0.2).toFixed(2);
      const affordable = dscr >= 1.2;
      const findings = [
        { item:"Credit Bureau Report", detail:`TransUnion report pulled. Bureau score: ${bureauScore}/900. ${bureauScore >= 650 ? "No adverse information. Clean payment record across all listed accounts." : bureauScore >= 550 ? "Minor adverse items noted (1 late payment >30 days in past 24 months). Overall profile acceptable." : "Material adverse information present. Multiple defaults/judgments. Elevated credit risk."}` },
        { item:"Affordability Assessment (NCA)", detail:`Monthly gross income: ${fmt.cur(monthlyIncome)}. Existing debt service: ${fmt.cur(existingDebt)}. Proposed instalment: ${fmt.cur(monthlyPmt)}. Disposable income after all obligations: ${fmt.cur(monthlyIncome - existingDebt - monthlyPmt)}. NCA affordability result: ${affordable ? "PASSED" : "FAILED"}.` },
        { item:"Debt Service Coverage Ratio", detail:`DSCR: ${dscr}x. ${dscr >= 1.5 ? "Strong — cash flow comfortably covers debt service with buffer for variability." : dscr >= 1.2 ? "Adequate — debt service covered with limited buffer. Sensitivity to revenue decline noted." : dscr >= 1.0 ? "Marginal — cash flow barely covers obligations. High vulnerability to adverse events." : "Insufficient — projected cash flow does not cover proposed debt service."}` },
        { item:"Balance Sheet Analysis", detail:`Current ratio: ${currentRatio}x (${currentRatio >= 1.5 ? "strong" : currentRatio >= 1.0 ? "adequate" : "weak"} liquidity). Debt-to-equity: ${debtEquity}x (${debtEquity <= 0.5 ? "conservative" : debtEquity <= 1.0 ? "moderate" : "elevated"} leverage). Gross margin: ${fmt.pct(grossMargin, 0)}.` },
        { item:"Cash Flow Projection Review", detail:`${a.term}-month cash flow projection reviewed. Revenue assumptions ${c?.years >= 5 ? "supported by established track record" : "based on limited operating history — conservative scenario applied"}. Seasonal variation ${c?.industry === "Agriculture" ? "significant — mitigated by crop insurance and seasonal payment structure" : "within normal range for sector"}.` },
        { item:"Comprehensive Risk Score", detail:`Composite score: ${Math.min(99, Math.max(20, Math.round(bureauScore / 10 + dscr * 10 + (currentRatio > 1.2 ? 10 : 0) - (debtEquity > 1.0 ? 10 : 0))))}/100. Risk grade: ${bureauScore >= 600 && dscr >= 1.3 ? "Low-Medium" : dscr >= 1.0 ? "Medium" : "High"}.` },
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
      updatedApp.riskScore = Math.min(99, Math.max(20, Math.round(bureauScore / 10 + dscr * 10 + (currentRatio > 1.2 ? 10 : 0) - (debtEquity > 1.0 ? 10 : 0))));
      newAudit.push(addAudit("Credit Report Pulled", a.id, "System (TransUnion API)", `Bureau: ${bureauScore}. DSCR: ${dscr}x. Affordability: ${affordable ? "Pass" : "Fail"}.`, "Underwriting"));
      newAudit.push(addAudit("Financial Analysis", a.id, "Credit Analyst – P. Sithole", `Risk score: ${updatedApp.riskScore}. CR: ${currentRatio}x. D/E: ${debtEquity}x. Margin: ${fmt.pct(grossMargin,0)}.`, "Underwriting"));
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
    // Approval authority check
    const limit = approvalLimit(role);
    if (decision === "Approved" && a.amount > limit) { alert(`Authority exceeded: your limit is ${fmt.cur(limit)}. This application (${fmt.cur(a.amount)}) requires escalation to ${a.amount > 1000000 ? "Credit Committee" : "Head of Credit"}.`); return; }
    // Separation of duties: creator cannot approve their own application
    if (a.createdBy === currentUser.id) { alert("Separation of duties: you cannot approve an application you created. Reassign to another officer."); return; }
    const w = a.workflow || {};
    const c = cust(a.custId);
    const p = prod(a.product);
    // Build credit memo from DD findings
    const memoSections = [];
    if (w.kycFindings?.length) memoSections.push(`KYC/FICA: ${w.kycComplete ? "All checks passed." : "Incomplete — see findings."}`);
    if (w.docsFindings?.length) { const vd = w.docsFindings.filter(f=>f.status==="Verified").length; memoSections.push(`Documents: ${vd}/${w.docsFindings.length} verified.`); }
    if (w.siteVisitFindings?.length) memoSections.push(`Site visit completed ${fmt.date(w.siteVisitDate)}. ${w.siteVisitFindings.length} areas assessed.`);
    if (w.creditFindings?.length) memoSections.push(`Bureau: ${w.creditBureauScore}. DSCR: ${a.dscr}x. Risk score: ${a.riskScore}/100.`);
    if (w.collateralFindings?.length) memoSections.push(`Security: ${fmt.cur(w.collateralTotal)}. LTV: ${a.amount && w.collateralTotal ? (a.amount/w.collateralTotal*100).toFixed(0) : "—"}%.`);
    if (w.socialFindings?.length) memoSections.push(`Social impact: ${a.socialScore}/100. BEE Level ${c?.beeLevel}.`);
    if (w.analystNotes) memoSections.push(`Analyst notes: ${w.analystNotes}`);
    const recommendation = decision === "Approved" ? `Recommendation: APPROVE. ${p?.name} of ${fmt.cur(a.amount)} over ${a.term} months. Risk acceptable within policy parameters.` : `Recommendation: DECLINE. Application does not meet minimum credit standards. ${a.dscr < 1.2 ? "DSCR below threshold." : ""} ${a.riskScore < 50 ? "Risk score below acceptable level." : ""}`;
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
    const newData = { ...data, applications: applications.map(x => x.id === appId ? updated : x), audit: [...audit, addAudit(`Credit Decision – ${decision}`, appId, approver, `${decision}. Risk: ${a.riskScore}. DSCR: ${a.dscr}x. Bureau: ${w.creditBureauScore}. Social: ${a.socialScore}.`, "Decision")] };
    if (decision === "Approved") {
      const rate = p?.baseRate || 14.5;
      const monthlyPmt = Math.round(a.amount * (rate / 100 / 12) / (1 - Math.pow(1 + rate / 100 / 12, -a.term)));
      const loan = { id:`LN-${String(loans.length+1).padStart(3,"0")}`, appId, custId:a.custId, status:"Active", amount:a.amount, balance:a.amount, rate, term:a.term, monthlyPmt, disbursed:Date.now(), nextDue:Date.now()+30*day, lastPmt:null, lastPmtAmt:null, totalPaid:0, dpd:0, stage:1, payments:[], covenants:conditions.map(c=>({name:c,status:"Compliant",value:"—",checked:Date.now()})), collateral:w.collateralFindings?.filter(f=>f.item!=="Security Coverage").map(f=>({type:f.item,value:0,description:f.detail}))||[] };
      newData.loans = [...loans, loan];
      newData.provisions = [...provisions, {loanId:loan.id,stage:1,pd:0.02,lgd:0.25,ead:a.amount,ecl:Math.round(a.amount*0.005),method:"12-month ECL"}];
      newData.audit = [...newData.audit, addAudit("Loan Disbursed",loan.id,"Finance Department",`${fmt.cur(a.amount)} disbursed to ${c?.name}. Rate: ${rate}%. Term: ${a.term}m.`,"Disbursement")];
    }
    save(newData);
  };

  const recordPayment = (loanId, amount) => {
    if (!canDo("servicing","create")) { alert("Permission denied: you cannot record payments."); return; }
    const l = loans.find(x => x.id === loanId);
    if (!l) return;
    const pmt = { date: Date.now(), amount: +amount, type: "Instalment", status: "Cleared", recordedBy: currentUser.id };
    const updated = { ...l, payments: [...l.payments, pmt], balance: Math.max(0, l.balance - amount), totalPaid: l.totalPaid + +amount, lastPmt: Date.now(), lastPmtAmt: +amount, dpd: 0, nextDue: Date.now() + 30 * day };
    updated.stage = stage(updated.dpd);
    save({ ...data,
      loans: loans.map(x => x.id === loanId ? updated : x),
      audit: [...audit, addAudit("Payment Received", loanId, currentUser.name, `Payment of ${fmt.cur(amount)} received and allocated.`, "Servicing")]
    });
  };

  const addCollectionAction = (loanId, actionType, notes) => {
    if (!canDo("collections","create")) { alert("Permission denied: you cannot log collection actions."); return; }
    const l = loans.find(x => x.id === loanId);
    const entry = { id: uid(), loanId, custId: l?.custId, stage: l?.dpd <= 30 ? "Early" : l?.dpd <= 90 ? "Mid" : "Late", dpd: l?.dpd || 0, action: actionType, channel: "System", officer: currentUser.name, notes, created: Date.now() };
    save({ ...data,
      collections: [...collections, entry],
      audit: [...audit, addAudit(`Collection Action: ${actionType}`, loanId, "Collections Specialist", notes, "Collections")]
    });
  };

  // ═══ PAGE ROUTER ═══
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
      default: return <Dashboard />;
    }
  }

  // ═══ 1. DASHBOARD ═══
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

    // Role-specific summary line
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

  // ═══ 2. CUSTOMERS ═══
  function Customers() {
    const filtered = customers.filter(c => !search || [c.name,c.contact,c.industry,c.id].some(f => f?.toLowerCase().includes(search.toLowerCase())));
    return (<div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>Customer Management</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>KYC/FICA verification, BEE profiling & relationship management</p></div>
      </div>
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

  // ═══ 3. ORIGINATION ═══
  function Origination() {
    const [tab, setTab] = useState("all");
    const tabs = [{ key:"all", label:"All" }, { key:"Submitted", label:"Submitted", count:applications.filter(a=>a.status==="Submitted").length }, { key:"Underwriting", label:"Underwriting", count:applications.filter(a=>a.status==="Underwriting").length }];
    const filtered = applications.filter(a => tab === "all" || a.status === tab).filter(a => !search || [a.id, cust(a.custId)?.name].some(f => f?.toLowerCase().includes(search.toLowerCase())));
    return (<div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>Loan Origination</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>Application intake, validation & pipeline management</p></div>
        {canDo("origination","create") && <Btn onClick={() => setModal("newApp")} icon={I.plus}>New Application</Btn>}
      </div>
      <Tab tabs={tabs} active={tab} onChange={setTab} />
      <Table columns={[
        { label:"App ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
        { label:"Applicant", render:r=>cust(r.custId)?.name },
        { label:"Product", render:r=>prod(r.product)?.name || r.product },
        { label:"Amount", render:r=>fmt.cur(r.amount) },
        { label:"Term", render:r=>`${r.term}m` },
        { label:"Submitted", render:r=>fmt.date(r.submitted) },
        { label:"Status", render:r=>statusBadge(r.status) },
        { label:"", render:()=><span style={{ color:C.accent }}>{I.chev}</span> },
      ]} rows={filtered} onRowClick={r=>setDetail({type:"application",id:r.id})} />
    </div>);
  }

  // ═══ 4. UNDERWRITING ═══
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

  // ═══ 5. ACTIVE LOANS ═══
  function Loans() {
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Active Loans</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Portfolio monitoring, covenant tracking & risk grading</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <KPI label="Total Portfolio" value={fmt.cur(loans.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Active Loans" value={loans.length} accent={C.green} />
        <KPI label="Avg Loan Size" value={fmt.cur(loans.reduce((s,l)=>s+l.amount,0)/loans.length)} accent={C.blue} />
        <KPI label="Total Monthly PMT" value={fmt.cur(loans.reduce((s,l)=>s+l.monthlyPmt,0))} accent={C.amber} />
      </div>
      <Table columns={[
        { label:"Loan ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
        { label:"Borrower", render:r=>cust(r.custId)?.name },
        { label:"Disbursed", render:r=>fmt.cur(r.amount) },
        { label:"Balance", render:r=><span style={{ fontWeight:700 }}>{fmt.cur(r.balance)}</span> },
        { label:"Rate", render:r=>`${r.rate}%` },
        { label:"Monthly", render:r=>fmt.cur(r.monthlyPmt) },
        { label:"DPD", render:r=><span style={{ fontWeight:700, color:r.dpd===0?C.green:r.dpd<=30?C.amber:r.dpd<=90?C.amber:C.red }}>{r.dpd}</span> },
        { label:"Stage", render:r=><Badge color={r.stage===1?"green":r.stage===2?"amber":"red"}>Stage {r.stage}</Badge> },
        { label:"", render:()=><span style={{ color:C.accent }}>{I.chev}</span> },
      ]} rows={loans} onRowClick={r=>setDetail({type:"loan",id:r.id})} />
    </div>);
  }

  // ═══ 6. SERVICING ═══
  function Servicing() {
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Loan Servicing</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Payment processing, statements, debit orders & account management</p>
      <SectionCard title="Recent Payments">
        <Table columns={[
          { label:"Date", render:r=>fmt.date(r.date) },
          { label:"Loan", key:"loanId" },
          { label:"Borrower", render:r=>cust(loans.find(l=>l.id===r.loanId)?.custId)?.name },
          { label:"Amount", render:r=><span style={{ fontWeight:700, color:C.green }}>{fmt.cur(r.amount)}</span> },
          { label:"Type", key:"type" },
          { label:"Status", render:r=>statusBadge(r.status) },
        ]} rows={loans.flatMap(l => l.payments.map(p => ({ ...p, loanId: l.id }))).sort((a,b) => b.date - a.date).slice(0, 15)} />
      </SectionCard>
      <SectionCard title="Upcoming Payments">
        <Table columns={[
          { label:"Due Date", render:r=>fmt.date(r.nextDue) },
          { label:"Loan", render:r=><span style={{ fontFamily:"monospace", fontSize:12 }}>{r.id}</span> },
          { label:"Borrower", render:r=>cust(r.custId)?.name },
          { label:"Amount Due", render:r=>fmt.cur(r.monthlyPmt) },
          { label:"DPD", render:r=><span style={{ fontWeight:700, color:r.dpd===0?C.green:C.amber }}>{r.dpd}</span> },
          { label:"Action", render:r=>canDo("servicing","create")?<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();recordPayment(r.id, r.monthlyPmt)}}>Record Payment</Btn>:<span style={{fontSize:10,color:C.textMuted}}>View only</span> },
        ]} rows={[...loans].sort((a,b)=>a.nextDue-b.nextDue)} />
      </SectionCard>
    </div>);
  }

  // ═══ 7. COLLECTIONS ═══
  function Collections() {
    const delinquent = loans.filter(l => l.dpd > 0);
    const [tab, setTab] = useState("accounts");
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Collections & Recovery</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>NCA-compliant delinquency management, PTP tracking & legal recovery</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <KPI label="Early (1-30 DPD)" value={delinquent.filter(l=>l.dpd<=30).length} sub={fmt.cur(delinquent.filter(l=>l.dpd<=30).reduce((s,l)=>s+l.balance,0))} accent={C.amber} />
        <KPI label="Mid (31-90 DPD)" value={delinquent.filter(l=>l.dpd>30&&l.dpd<=90).length} sub={fmt.cur(delinquent.filter(l=>l.dpd>30&&l.dpd<=90).reduce((s,l)=>s+l.balance,0))} accent={C.red} />
        <KPI label="Late (91+ DPD)" value={delinquent.filter(l=>l.dpd>90).length} accent={C.red} />
        <KPI label="Total Arrears" value={fmt.cur(delinquent.reduce((s,l)=>s+l.balance,0))} accent={C.red} />
      </div>
      <Tab tabs={[{key:"accounts",label:"Delinquent Accounts",count:delinquent.length},{key:"activity",label:"Activity Log",count:collections.length},{key:"ptp",label:"Promise-to-Pay",count:collections.filter(c=>c.ptpDate).length}]} active={tab} onChange={setTab} />
      {tab==="accounts" && <Table columns={[
        { label:"Loan", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
        { label:"Borrower", render:r=>cust(r.custId)?.name },
        { label:"Balance", render:r=>fmt.cur(r.balance) },
        { label:"DPD", render:r=><span style={{ fontSize:18, fontWeight:700, color:r.dpd<=30?C.amber:r.dpd<=90?C.red:C.red }}>{r.dpd}</span> },
        { label:"Stage", render:r=><Badge color={r.dpd<=30?"amber":r.dpd<=90?"red":"red"}>{r.dpd<=30?"Early":r.dpd<=90?"Mid":"Late"}</Badge> },
        { label:"Actions", render:r=><div style={{ display:"flex", gap:6 }}>
          {canDo("collections","create")&&<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();addCollectionAction(r.id,"Phone Call","Outbound call to customer.")}}>Log Call</Btn>}
          {r.dpd>30&&canDo("collections","create")&&<Btn size="sm" variant="danger" onClick={e=>{e.stopPropagation();addCollectionAction(r.id,"Letter of Demand","Formal NCA demand issued.")}}>Demand</Btn>}
        </div> },
      ]} rows={delinquent} onRowClick={r=>setDetail({type:"loan",id:r.id})} />}
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
      {tab==="ptp" && <Table columns={[
        { label:"Loan", key:"loanId" },
        { label:"PTP Date", render:r=>fmt.date(r.ptpDate) },
        { label:"PTP Amount", render:r=>fmt.cur(r.ptpAmount) },
        { label:"Status", render:r=>r.ptpDate>Date.now()?<Badge color="amber">Pending</Badge>:<Badge color="red">Overdue</Badge> },
        { label:"Notes", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.notes}</span> },
      ]} rows={collections.filter(c=>c.ptpDate)} />}
    </div>);
  }

  // ═══ 8. IFRS 9 ═══
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

  // ═══ 9. GOVERNANCE ═══
  function Governance() {
    const [tab, setTab] = useState("audit");
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Governance, Risk & Compliance</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Audit trail, approval authorities, regulatory compliance & risk appetite</p>
      <Tab tabs={[{key:"audit",label:"Audit Trail",count:audit.length},{key:"authority",label:"Approval Matrix"},{key:"regulatory",label:"Regulatory"},{key:"alerts",label:"All Alerts",count:alerts.length}]} active={tab} onChange={setTab} />
      {tab==="audit" && <Table columns={[
        { label:"Timestamp", render:r=>fmt.dateTime(r.ts) },
        { label:"Category", render:r=><Badge color={r.category==="Risk"||r.category==="Collections"?"red":r.category==="Compliance"?"amber":r.category==="Decision"?"purple":"cyan"}>{r.category}</Badge> },
        { label:"Action", render:r=><span style={{ fontWeight:600 }}>{r.action}</span> },
        { label:"Entity", render:r=><span style={{ fontFamily:"monospace", fontSize:11 }}>{r.entity}</span> },
        { label:"User", key:"user" },
        { label:"Detail", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.detail}</span> },
      ]} rows={[...audit].sort((a,b)=>b.ts-a.ts)} />}
      {tab==="authority" && <SectionCard title="Credit Approval Authority Matrix">
        <Table columns={[
          { label:"Authority Level", key:"level" },
          { label:"Approval Limit", key:"limit" },
          { label:"Scope", key:"scope" },
        ]} rows={[
          { level:"Credit Analyst", limit:"Up to R250,000", scope:"Standard SME loans within policy" },
          { level:"Senior Credit Analyst", limit:"Up to R500,000", scope:"Standard loans, minor policy exceptions" },
          { level:"Head of Credit", limit:"Up to R1,000,000", scope:"All products, moderate risk" },
          { level:"Credit Committee", limit:"Above R1,000,000", scope:"Large loans, high risk, policy exceptions" },
          { level:"Board Credit Committee", limit:"Unlimited", scope:"Strategic decisions, major policy changes" },
        ]} />
      </SectionCard>}
      {tab==="regulatory" && <div>
        <SectionCard title="Regulatory Status">
          <InfoGrid items={[
            ["NCR Registration", settings.ncrReg],
            ["NCR Expiry", settings.ncrExpiry],
            ["FICA Compliance", "Active"],
            ["POPIA Compliance", "Active"],
            ["NCA Registration", "Active – Section 40"],
            ["Last NCR Return", "Q4 2025"],
          ]} />
        </SectionCard>
        <SectionCard title="Regulatory Framework">
          {[
            ["National Credit Act (NCA) 34 of 2005","Governs credit agreements, affordability assessments, consumer protection"],
            ["Financial Intelligence Centre Act (FICA) 38 of 2001","KYC/CDD, suspicious transaction reporting, record keeping"],
            ["Protection of Personal Information Act (POPIA) 4 of 2013","Data privacy, consent, data subject rights"],
            ["Companies Act 71 of 2008","Corporate governance, director responsibilities"],
            ["BB-BEE Act 53 of 2003","Empowerment verification, transformation reporting"],
            ["Debt Collectors Act 114 of 1998","Collection conduct standards, registration requirements"],
          ].map(([name, desc], i) => (
            <div key={i} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.accent }}>{name}</div>
              <div style={{ fontSize:12, color:C.textDim, marginTop:2 }}>{desc}</div>
            </div>
          ))}
        </SectionCard>
      </div>}
      {tab==="alerts" && <Table columns={[
        { label:"Date", render:r=>fmt.dateTime(r.ts) },
        { label:"Severity", render:r=><Badge color={r.severity==="critical"?"red":r.severity==="warning"?"amber":"blue"}>{r.severity}</Badge> },
        { label:"Type", render:r=><Badge color="cyan">{r.type}</Badge> },
        { label:"Title", render:r=><span style={{ fontWeight:600 }}>{r.title}</span> },
        { label:"Message", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.msg}</span> },
        { label:"Status", render:r=>r.read?<Badge color="slate">Read</Badge>:<Badge color="amber">Unread</Badge> },
      ]} rows={[...alerts].sort((a,b)=>b.ts-a.ts)} />}
    </div>);
  }

  // ═══ STATUTORY REPORTING ═══
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

  // ═══ 10. DOCUMENTS ═══
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

  // ═══ 11. REPORTS ═══
  function Reports() {
    const totalBook = loans.reduce((s,l)=>s+l.balance,0);
    const totalECL = provisions.reduce((s,p)=>s+p.ecl,0);
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Reports & Analytics</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Portfolio performance, risk analysis, regulatory & impact reporting</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <SectionCard title="Portfolio Summary">
          {[["Total Loan Book",fmt.cur(totalBook)],["Active Loans",loans.length],["Total Disbursed",fmt.cur(loans.reduce((s,l)=>s+l.amount,0))],["Weighted Avg Rate",`${(loans.reduce((s,l)=>s+l.rate,0)/loans.length).toFixed(1)}%`],["Total ECL Provision",fmt.cur(totalECL)],["ECL Coverage",fmt.pct(totalECL/totalBook)],["Stage 1 %",fmt.pct(loans.filter(l=>l.stage===1).length/loans.length,0)],["Stage 2+ %",fmt.pct(loans.filter(l=>l.stage>=2).length/loans.length,0)]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:13, fontWeight:700, color:C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Concentration Analysis">
          {Object.entries(loans.reduce((acc, l) => { const c = cust(l.custId); const ind = c?.industry || "Unknown"; acc[ind] = (acc[ind]||0) + l.balance; return acc; }, {})).sort((a,b)=>b[1]-a[1]).map(([ind, bal], i) => (
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.textDim, marginBottom:4 }}><span>{ind}</span><span>{fmt.cur(bal)} ({fmt.pct(bal/totalBook,0)})</span></div>
              <ProgressBar value={bal} max={totalBook} color={C.accent} />
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Application Outcome Analysis">
          {["Approved","Declined","Submitted","Underwriting"].map(s => {
            const count = applications.filter(a => a.status === s).length;
            return (<div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              {statusBadge(s)}<div><span style={{ fontSize:16, fontWeight:700, color:C.text }}>{count}</span><span style={{ fontSize:11, color:C.textMuted, marginLeft:8 }}>({fmt.pct(count/applications.length,0)})</span></div>
            </div>);
          })}
        </SectionCard>
        <SectionCard title="Development Impact Summary">
          {[["Total Jobs Supported",fmt.num(customers.reduce((s,c)=>s+c.employees,0))],["BEE Level 1 Clients",customers.filter(c=>c.beeLevel===1).length],["Avg Social Impact Score",Math.round(applications.filter(a=>a.socialScore).reduce((s,a)=>s+a.socialScore,0)/(applications.filter(a=>a.socialScore).length||1))],["Empowerment Exposure",fmt.cur(loans.filter(l=>cust(l.custId)?.beeLevel<=2).reduce((s,l)=>s+l.balance,0))],["Provinces Covered",new Set(customers.map(c=>c.province)).size],["Industries Covered",new Set(customers.map(c=>c.industry)).size]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:13, fontWeight:700, color:C.accent }}>{v}</span>
            </div>
          ))}
        </SectionCard>
      </div>
    </div>);
  }

  // ═══ 12. COMMUNICATIONS ═══
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

  // ═══ DETAIL VIEWS ═══
  function renderDetail() {
    const goBack = () => setDetail(null);
    const BackBtn = () => <button onClick={goBack} style={{ background:"none", border:"none", color:C.accent, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:16, display:"flex", alignItems:"center", gap:4, fontFamily:"inherit" }}>{I.back} Back</button>;

    if (detail.type === "customer") {
      const c = customers.find(x=>x.id===detail.id); if (!c) return <div>Not found</div>;
      const ca = applications.filter(a=>a.custId===c.id);
      const cl = loans.filter(l=>l.custId===c.id);
      return (<div><BackBtn />
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
          <div style={{ width:40, height:40, borderRadius:2, background:C.surface2, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.textDim, fontSize:16, fontWeight:600 }}>{c.name.charAt(0)}</div>
          <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>{c.name}</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.textMuted }}>{c.id} · {c.industry} · {c.province}</p></div>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>{statusBadge(c.ficaStatus)}<Badge color="purple">BEE Level {c.beeLevel}</Badge><Badge color={c.riskCategory==="Low"?"green":c.riskCategory==="Medium"?"amber":"red"}>{c.riskCategory} Risk</Badge></div>
        </div>
        <InfoGrid items={[["Contact",c.contact],["Email",c.email],["Phone",c.phone],["ID Number",c.idNum],["Reg Number",c.regNum],["Address",c.address],["Annual Revenue",fmt.cur(c.revenue)],["Employees",c.employees],["Years in Business",c.years],["Sector",c.sector],["BEE Expiry",fmt.date(c.beeExpiry)],["FICA Date",fmt.date(c.ficaDate)]]} />
        <div style={{ marginTop:20 }} />
        {(() => { const custDocs = (documents||[]).filter(d=>d.custId===c.id); return (
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
          ]} rows={custDocs} />
        </SectionCard>
        ); })()}
        {ca.length>0 && <SectionCard title={`Applications (${ca.length})`}>
          <Table columns={[{label:"ID",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.id}</span>},{label:"Product",render:r=>prod(r.product)?.name},{label:"Amount",render:r=>fmt.cur(r.amount)},{label:"Status",render:r=>statusBadge(r.status)}]} rows={ca} onRowClick={r=>setDetail({type:"application",id:r.id})} />
        </SectionCard>}
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
      const [expandedStep, setExpandedStep] = useState(null);
      const [notifForm, setNotifForm] = useState({subject:"",body:""});
      const [reqDocType, setReqDocType] = useState("");

      const steps = [
        { key:"submitted", label:"1. Application Received", done:true, hasData:true },
        { key:"kyc", label:"2. KYC/FICA & Sanctions", done:w.kycComplete, hasData:!!w.kycDate, canRun:isUW, gateOk:true, runLabel:w.kycDate?"Re-run Checks":"Run Automated Checks" },
        { key:"docs", label:"3. Document Completeness Review", done:w.docsComplete, hasData:!!w.docsDate, canRun:isUW, gateOk:true, runLabel:w.docsDate?"Re-check":"Run Document Check" },
        { key:"sitevisit", label:"4. Site Visit & Management Interview", done:w.siteVisitComplete, hasData:!!w.siteVisitDate, canRun:isUW, gateOk:true, runLabel:w.siteVisitDate?"Re-generate":"Generate Findings" },
        { key:"credit", label:"5. Credit Bureau & Financial Analysis", done:w.financialAnalysisComplete, hasData:!!w.creditDate, canRun:isUW, gateOk:w.kycComplete&&w.docsComplete, gateMsg:"Complete steps 2 & 3 first", runLabel:w.creditPulled?"Re-analyse":"Pull Credit & Analyse" },
        { key:"collateral", label:"6. Collateral & Security Assessment", done:w.collateralAssessed, hasData:!!w.collateralDate, canRun:isUW, gateOk:true, runLabel:w.collateralDate?"Re-assess":"Run Assessment" },
        { key:"social", label:"7. Social Impact & BEE Verification", done:w.socialVerified, hasData:!!w.socialDate, canRun:isUW, gateOk:true, runLabel:w.socialDate?"Re-verify":"Run Verification" },
        { key:"decision", label:"8. Credit Decision", done:isDecided, hasData:isDecided },
      ];
      const doneCount = steps.filter(s=>s.done).length - 1;

      const renderChecklist = (findings, stepKey) => {
        if (!findings || !Array.isArray(findings)) return null;
        const isActionable = isUW && (stepKey==="kyc"||stepKey==="docs");
        const reqItems = findings.filter(f => stepKey==="docs" ? f.required!==false : true);
        const allActioned = isActionable && reqItems.every(f => f.officerAction);
        return (<div>
          <div style={{ border:`1px solid ${C.border}` }}>
            {findings.map((f,i) => (
              <div key={i} style={{ borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
                <div style={{ display:"flex", gap:6, padding:"5px 8px", fontSize:11, alignItems:"center" }}>
                  <span style={{ width:40, flexShrink:0, fontWeight:500, color: f.status==="Pass"||f.status==="Verified"||f.status==="Confirmed (Override)"?C.green : f.status==="Flagged"?C.amber : f.status==="Rejected"||f.status==="Fail"||f.status==="Missing"?C.red : C.textMuted }}>{f.officerAction?f.status:(f.systemResult||f.status)}</span>
                  <span style={{ width:130, flexShrink:0, fontWeight:500, color:C.text, fontSize:11 }}>{f.item}</span>
                  <span style={{ flex:1, color:C.textDim, fontSize:11 }}>{f.detail}{f.source?` (${f.source})`:""}</span>
                  {isActionable && !f.officerAction && (
                    <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Confirmed","")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Confirm</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Flagged","")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.amber, cursor:"pointer", fontFamily:"inherit" }}>Flag</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Rejected","")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject</button>
                    </div>
                  )}
                  {isActionable && f.officerAction && <span style={{ fontSize:9, color:C.textMuted, flexShrink:0 }}>{f.officerAction}</span>}
                  {stepKey==="docs" && f.docId && isUW && (documents||[]).find(d=>d.id===f.docId)?.status!=="Verified" && <button onClick={()=>approveDocument(f.docId,a.id)} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Approve Doc</button>}
                  {stepKey==="docs" && f.docId && isUW && (documents||[]).find(d=>d.id===f.docId)?.status!=="Rejected" && <button onClick={()=>rejectDocument(f.docId,"Re-submission required.")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject Doc</button>}
                  {stepKey==="docs" && !f.docId && isUW && <button onClick={()=>requestDocFromApplicant(a.id,f.item,"")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Request</button>}
                </div>
                {isActionable && f.officerAction && (
                  <div style={{ padding:"0 8px 4px 46px" }}>
                    <input value={f.officerNote||""} onChange={e=>updateFindingNote(a.id,stepKey,i,e.target.value)} placeholder="Note..." style={{ width:"100%", padding:"2px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                )}
              </div>
            ))}
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
        if (s.key==="submitted") return <InfoGrid items={[["Applicant",c?.name],["Product",p?.name],["Amount",fmt.cur(a.amount)],["Term",`${a.term}m`],["Submitted",fmt.date(a.submitted)],["Purpose",a.purpose]]} />;
        if (s.key==="kyc") return (<div>
          {!w.kycDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Run automated checks to verify identity, company registration, and sanctions. Results require your review and sign-off.</div>}
          {w.kycFindings && renderChecklist(w.kycFindings, "kyc")}
          {w.kycComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.kycOfficer}</div>}
        </div>);
        if (s.key==="docs") return (<div>
          {!w.docsDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Check document completeness. You can approve, reject, or request each document individually.</div>}
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
        if (s.key==="sitevisit") return (<div>
          {!w.siteVisitDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Generate site visit findings template, add your observations, then sign off.</div>}
          {w.siteVisitFindings && renderReadOnly(w.siteVisitFindings)}
          {isUW && <div style={{ marginTop:6 }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Officer Observations</div>
            <textarea value={w.siteVisitNotes||""} onChange={e=>saveSiteVisitNotes(a.id,e.target.value)} placeholder="Site visit observations, management impressions, concerns..." rows={3} style={{ width:"100%", padding:"5px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
          </div>}
          {isUW && w.siteVisitDate && !w.siteVisitComplete && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"sitevisit")}>Sign Off</Btn></div>}
          {w.siteVisitComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.siteVisitOfficer}</div>}
        </div>);
        if (s.key==="credit") return (<div>
          {!w.creditDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Pull credit bureau report, run affordability and ratio analysis. Review results and confirm.</div>}
          {w.creditFindings && renderReadOnly(w.creditFindings)}
          {isUW && w.creditDate && !w.financialAnalysisComplete && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"credit")}>Confirm Analysis</Btn></div>}
          {w.financialAnalysisComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Confirmed by Credit Analyst</div>}
        </div>);
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
      </div>);
    }


    if (detail.type === "loan") {
      const l = loans.find(x=>x.id===detail.id); if (!l) return <div>Not found</div>;
      const c = cust(l.custId); const prov = provisions.find(p=>p.loanId===l.id);
      const lc = collections.filter(x=>x.loanId===l.id);
      const repaidPct = Math.round((1-l.balance/l.amount)*100);
      return (<div><BackBtn />
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:24 }}>
          <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>{l.id}</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>{c?.name}</p></div>
          <div style={{ display:"flex", gap:8 }}><Badge color={l.dpd===0?"green":l.dpd<=30?"amber":"red"}>{l.dpd} DPD</Badge><Badge color={l.stage===1?"green":l.stage===2?"amber":"red"}>Stage {l.stage}</Badge></div>
        </div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
          <KPI label="Disbursed" value={fmt.cur(l.amount)} accent={C.blue} />
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
            { label:"Amount", render:r=><span style={{ fontWeight:700, color:C.green }}>{fmt.cur(r.amount)}</span> },
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

  // ═══ MODALS ═══
  function NewAppModal() {
    const [form, setForm] = useState({ custId: customers[0]?.id, product: products[0]?.id, amount: "", term: "36", purpose: "" });
    const p = prod(form.product);
    return (
      <Modal open={modal === "newApp"} onClose={() => setModal(null)} title="New Loan Application" width={540}>
        <Field label="Customer"><Select value={form.custId} onChange={e=>setForm({...form,custId:e.target.value})} options={customers.map(c=>({value:c.id,label:c.name}))} /></Field>
        <Field label="Loan Product"><Select value={form.product} onChange={e=>setForm({...form,product:e.target.value})} options={products.map(p=>({value:p.id,label:`${p.name} (${p.baseRate}%)`}))} /></Field>
        {p && <div style={{ background:C.surface2, padding:10, marginBottom:16, fontSize:11, color:C.textDim, border:`1px solid ${C.border}` }}>{p.description} · Range: {fmt.cur(p.minAmount)} – {fmt.cur(p.maxAmount)} · Term: {p.minTerm}–{p.maxTerm}m</div>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Amount (R)"><Input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="e.g. 500000" /></Field>
          <Field label="Term (months)"><Input type="number" value={form.term} onChange={e=>setForm({...form,term:e.target.value})} placeholder="e.g. 36" /></Field>
        </div>
        <Field label="Purpose of Loan"><Textarea value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})} placeholder="Describe the purpose..." rows={3} /></Field>
        <div style={{ display:"flex", gap:12, marginTop:20 }}>
          <Btn variant="ghost" onClick={()=>setModal(null)} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={()=>{if(form.amount&&form.purpose)submitApp(form)}} disabled={!form.amount||!form.purpose}>Submit Application</Btn>
        </div>
      </Modal>
    );
  }

  // ═══ LAYOUT ═══
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
          <div style={{ fontSize:9, color:C.textMuted, lineHeight:1.5, letterSpacing:0.2 }}>ThandoQ & Associates<br/>NCR: {settings.ncrReg}<br/>Valid: {settings.ncrExpiry}</div>
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
