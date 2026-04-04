// KwikBridge LMS — RBAC Configuration

export const ROLES = {
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

export const PERMS = {
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

export const APPROVAL_LIMITS = {
  CREDIT: 250000, CREDIT_SNR: 500000, CREDIT_HEAD: 1000000, EXEC: 5000000, ADMIN: Infinity,
};

export const ZONE_PAGES = {
    public: ["public_home", "public_apply", "public_track"],
    portal: ["portal_dashboard", "portal_applications", "portal_loans", "portal_documents", "portal_comms", "portal_profile"],
    staff: ["dashboard","customers","origination","underwriting","loans","servicing","collections","provisioning","governance","statutory","documents","reports","comms","admin","products","settings"],
  };

export const SYSTEM_USERS = [
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
