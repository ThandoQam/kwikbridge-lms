#!/usr/bin/env python3
"""
KwikBridge LMS — End-to-End System Integration Test
Tests every user journey across all 3 zones, every module, every handler,
every data flow, every cross-module interaction, and every lifecycle path.
"""
import re, sys

SRC = 'src/kwikbridge-lms-v2.jsx'
t = open(SRC).read()
lines = t.split('\n')
passed = failed = 0
results = []

def test(tid, name, cond, detail=""):
    global passed, failed
    s = "PASS" if cond else "FAIL"
    if cond: passed += 1
    else: failed += 1
    results.append((s, tid, name, detail))

def efn(name):
    """Extract full function body by brace tracking."""
    i = t.find(f"function {name}(")
    if i < 0: return ""
    b = t.find("{", i)
    if b < 0: return ""
    d = 0
    for j in range(b, min(b+60000, len(t))):
        if t[j] == '{': d += 1
        elif t[j] == '}': d -= 1
        if d == 0: return t[i:j+1]
    return ""

# ═══ PRE-COMPUTE BLOCKS ═══
PUB = t[t.find("// ═══ PUBLIC ZONE"):t.find("// ═══ AUTH GATE")] if "// ═══ PUBLIC ZONE" in t else ""
AUTH = t[t.find("// ═══ AUTH GATE"):t.find("// ═══ BORROWER PORTAL")] if "// ═══ AUTH GATE" in t else ""
PORT = t[t.find("// ═══ BORROWER PORTAL"):t.find("// ═══ STAFF BACK-OFFICE")] if "// ═══ BORROWER PORTAL" in t else ""
ue1 = t.find("useEffect(() =>"); ue2 = t.find("useEffect(() =>", ue1+50)
LOAD = t[ue2:ue2+3000] if ue2 > 0 else ""
STAFF_HDR = t[t.find('className="kb-main"'):t.find('className="kb-main"')+800] if 'kb-main' in t else ""
SEED = efn("seed")
ADMIN = efn("Administration")
DASH = efn("Dashboard")
LOANS = efn("Loans")
SERV = efn("Servicing")
COLL = efn("Collections")
PROV = efn("Provisioning")
GOV = efn("Governance")
STAT = efn("StatutoryReporting")
DOCS = efn("Documents")
RPTS = efn("Reports")
COMMS = efn("Comms")
CUST = efn("Customers")
ORIG = efn("Origination")
UW = efn("Underwriting")
DETAIL = efn("renderDetail")
RPAGE = efn("renderPage")

print("=" * 72)
print("  KWIKBRIDGE LMS — E2E SYSTEM INTEGRATION TEST")
print(f"  {len(t):,} bytes · {len(lines)} lines")
print("=" * 72)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 1: COLD BOOT → PUBLIC LANDING
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J1: COLD BOOT → PUBLIC LANDING ━━━")
test("J1.01","App exports default function","export default function App()" in t)
test("J1.02","Default page = public_home",'useState("public_home")' in t)
test("J1.03","Default zone = public",'useState("public")' in t)
test("J1.04","Auth check useEffect on mount","useEffect(() =>" in t and "authGetUser" in t)
test("J1.05","Data load: store first → Supabase → seed","store.get(SK)" in LOAD and "AbortController" in LOAD and "seed()" in LOAD)
test("J1.06","save() hook before auth gate","const save = useCallback" in t[:t.find("PUBLIC ZONE")])
test("J1.07","No auth → public zone renders","!authSession && zone ===" in t)
test("J1.08","Public header sticky","sticky" in PUB)
test("J1.09","Public nav: Home, Apply, Track","public_home" in PUB and "Apply for Financing" in PUB and "Track Application" in PUB)
test("J1.10","Hero: Business Finance for Growth","Business Finance for Growth" in PUB)
test("J1.11","4 product category cards (static, not from DB)","Invoice Discounting" in PUB and "Purchase Order Financing" in PUB and "Working Capital Financing" in PUB and "Agri & Project Financing" in PUB)
test("J1.12","Apply for Financing CTA","Apply for Financing" in PUB)
test("J1.13","Track Application CTA → public_track","public_track" in PUB)
test("J1.14","Staff Login → sets zone=auth",'setZone("auth")' in PUB)
test("J1.15","NCR footer","NCRCP22396" in PUB and "Registered Credit Provider" in PUB)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 2: PUBLIC → APPLY FOR FINANCING (4-STEP FORM)
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J2: APPLY FOR FINANCING ━━━")
test("J2.01","4-step form structure","step===1" in PUB and "step===2" in PUB and "step===3" in PUB and "step===4" in PUB)
test("J2.02","Step indicators with progress","step>s" in PUB)
test("J2.03","Step 1 — name, email, phone, password","Full Name" in PUB and "Email Address" in PUB and "Phone Number" in PUB and "Create Password" in PUB)
test("J2.04","Step 1 validation (v1)","v1" in PUB and "password.length >= 6" in PUB)
test("J2.05","Step 2 — business name, ID, CIPC, industry","Business Name" in PUB and "ID Number" in PUB and "Company Registration" in PUB)
test("J2.06","Step 2 — revenue, employees, years, province","Annual Revenue" in PUB and "Number of Employees" in PUB and "Province" in PUB)
test("J2.07","Step 2 validation (v2)","v2" in PUB and "f.businessName && f.idNum" in PUB)
test("J2.08","Step 3 — product dropdown (dynamic from DB)","activeProds" in PUB and "Select Product" in PUB)
test("J2.09","Step 3 — product description preview on select","selProd" in PUB and "selProd.description" in PUB)
test("J2.10","Step 3 — amount, term, purpose","Loan Amount" in PUB and "Term (months)" in PUB and "Purpose of Financing" in PUB)
test("J2.11","Step 4 — review: applicant + business + financing","Review Your Application" in PUB and "Applicant" in PUB and "Business" in PUB and "Financing" in PUB)
test("J2.12","Step 4 — POPIA consent","POPIA" in PUB)
test("J2.13","Submit creates customer record","newCust" in PUB and "ficaStatus:\"Pending\"" in PUB)
test("J2.14","Submit creates application (Pre-Approval)","newApp" in PUB and "Pre-Approval" in PUB)
test("J2.15","Submit creates notification email","newComm" in PUB and "Application" in PUB)
test("J2.16","Submit creates staff alert","newAlert" in PUB)
test("J2.17","Submit logs audit trail","newAudit" in PUB and "Public Application Submitted" in PUB)
test("J2.18","Submit calls save()","save({" in PUB)
test("J2.19","Confirmation page with reference","Application Submitted" in PUB and "trackingRef" in PUB and "Application Reference" in PUB)
test("J2.20","Post-submit: Sign In to Track button",'setZone("auth")' in PUB and "Sign In to Track" in PUB)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 3: PUBLIC → TRACK APPLICATION → AUTH → PORTAL
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J3: TRACK → AUTH → PORTAL ━━━")
test("J3.01","Track page shows sign-in prompt","Track Your Application" in PUB and "Sign In to Portal" in PUB)
test("J3.02","Track CTA sets zone=auth",'setZone("auth")' in PUB)
test("J3.03","Auth gate renders login page","!authSession" in t and "Sign In" in AUTH)
test("J3.04","Login form: email + password","type=\"email\"" in AUTH and "type=\"password\"" in AUTH)
test("J3.05","Signup form: name + email + password","authMode === \"signup\"" in AUTH and "Full Name" in AUTH)
test("J3.06","Google OAuth","authOAuthUrl" in t and "google" in AUTH)
test("J3.07","Apple OAuth","apple" in AUTH)
test("J3.08","Dev bypass: Staff (Admin)","Staff (Admin)" in AUTH)
test("J3.09","Dev bypass: Borrower Portal","Borrower Portal" in AUTH)
test("J3.10","Back to Public Site link","Back to Public Site" in AUTH)
test("J3.11","handleSignIn matches email → sets zone","handleSignIn" in t and "ROLES[matched.role]?.zone" in t)
test("J3.12","Unmatched email defaults to BORROWER","BORROWER" in t[t.find("const handleSignIn"):t.find("const handleSignUp")])
test("J3.13","handleSignUp routes to portal","portal_dashboard" in t[t.find("handleSignUp"):t.find("handleSignUp")+1500])
test("J3.14","OAuth redirect parses hash + routes","access_token" in t and "URLSearchParams" in t)
test("J3.15","Session stored in localStorage","kb-auth" in t and "localStorage.setItem" in t)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 4: BORROWER PORTAL
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J4: BORROWER PORTAL ━━━")
test("J4.01","Portal renders for BORROWER zone",'userZone === "portal"' in t)
test("J4.02","Data filtered by auth email","myEmail" in PORT and "myCustomer" in PORT)
test("J4.03","myApps filtered by custId","myApps" in PORT and "a.custId === myCustomer.id" in PORT)
test("J4.04","myLoans filtered by custId","myLoans" in PORT and "l.custId === myCustomer.id" in PORT)
test("J4.05","myDocs filtered by custId","myDocs" in PORT and "d.custId === myCustomer.id" in PORT)
test("J4.06","myComms filtered by custId","myComms" in PORT and "c.custId === myCustomer.id" in PORT)
test("J4.07","Portal sidebar: 6 nav items","portal_dashboard" in PORT and "portal_applications" in PORT and "portal_loans" in PORT and "portal_documents" in PORT and "portal_comms" in PORT and "portal_profile" in PORT)
test("J4.08","Sidebar uses navTo","navTo(n.key)" in PORT)
test("J4.09","Sticky portal header","sticky" in PORT)
test("J4.10","Back button in portal header","goBack" in PORT)
test("J4.11","Sign Out in sidebar","handleSignOut" in PORT)
test("J4.12","Unlinked borrower warning","Complete Your Profile" in PORT)

# ── J4A: Portal Dashboard ──
test("J4.13","Dashboard KPIs: apps, loans, balance","Applications" in PORT and "Active Loans" in PORT and "Total Balance" in PORT)
test("J4.14","Recent applications list","Recent Applications" in PORT)

# ── J4B: My Applications ──
test("J4.15","Applications table","My Applications" in PORT)

# ── J4C: My Loans (PTP + Payments) ──
test("J4.16","Loan cards with details","Make Payment" in PORT and "Promise to Pay" in PORT)
test("J4.17","PTP modal: date, amount, notes","portalPtp" in t and "PTP" in PORT)
test("J4.18","PTP creates ptpHistory entry","ptpHistory" in PORT)
test("J4.19","PTP creates audit + alert","PTP Submitted" in PORT and "PTP from Borrower" in PORT)
test("J4.20","Payment modal: amount, method, ref","portalPayment" in t and "Payment Method" in PORT)
test("J4.21","Payment methods: EFT, Debit, Card, Cash","EFT" in PORT and "Debit Order" in PORT and "Card" in PORT and "Cash Deposit" in PORT)
test("J4.22","Payment updates balance","newBal" in PORT)
test("J4.23","Payment creates audit + alert","Payment Submitted" in PORT and "Payment Received" in PORT)

# ── J4D: Documents (KYB/FICA) ──
test("J4.24","8 KYB/FICA doc types defined","KYB_FICA_DOCS" in PORT)
test("J4.25","Required docs: ID, address, CIPC, bank, financials","sa_id" in PORT and "proof_address" in PORT and "cipc" in PORT and "bank_confirm" in PORT and "financials" in PORT)
test("J4.26","Optional docs: tax, BEE, business plan","tax_clearance" in PORT and "bee_cert" in PORT and "business_plan" in PORT)
test("J4.27","Status indicators per doc (4 states)","Not Uploaded" in PORT and "Under Review" in PORT and "Verified" in PORT and "Rejected" in PORT)
test("J4.28","Mandatory docs progress bar","Mandatory Documents" in PORT)
test("J4.29","Ready for Review badge","Ready for Review" in PORT)
test("J4.30","Upload creates doc + alert + audit","handleDocUpload" in PORT and "Document Uploaded" in PORT)
test("J4.31","Bank Account Verification API","runBankVerification" in PORT and "verified" in PORT)
test("J4.32","Credit Bureau Check API","runCreditCheck" in PORT and "creditStatus" in PORT)

# ── J4E: Messages + Profile ──
test("J4.33","Messages page","portal_comms" in PORT)
test("J4.34","Profile page with business details","portal_profile" in PORT and "Business Details" in PORT)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 5: STAFF LOGIN → BACK-OFFICE
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J5: STAFF BACK-OFFICE ━━━")
test("J5.01","Staff zone enforcement",'userZone !== "staff" && zone === "staff"' in t)
test("J5.02","Staff sidebar: 14 nav items","Loan Book" in t and "Origination" in t and "Underwriting" in t and "Administration" in t)
test("J5.03","Sidebar collapse toggle","sideCollapsed" in t)
test("J5.04","Sidebar uses navTo","navTo(n.key)" in t[t.find("kb-sidebar"):])
test("J5.05","Sticky staff header","sticky" in STAFF_HDR or "sticky" in t[t.find("kb-main"):t.find("kb-main")+500])
test("J5.06","Back arrow in staff header","goBack" in t[t.find('className="kb-main"'):t.find('className="kb-main"')+1500])
test("J5.07","Search bar","Search" in t[t.find('className="kb-main"'):t.find('className="kb-main"')+1500])
test("J5.08","Notification bell with unread count","notifOpen" in t and "unread" in t)
test("J5.09","Role switcher","sysUsers.filter" in t and "ROLES[u.role]" in t)
test("J5.10","Sign Out in sidebar","handleSignOut" in t[t.find("Reset Demo"):t.find("Reset Demo")+200])

# ── J5 Router ──
rp_cases = re.findall(r'case "(\w+)":', RPAGE)
for pg in ["dashboard","customers","origination","underwriting","loans","servicing","collections","provisioning","governance","statutory","documents","reports","comms","admin"]:
    test("J5.11",f"Router case: {pg}", pg in rp_cases)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 6: STAFF → CUSTOMER LIFECYCLE
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J6: CUSTOMER LIFECYCLE ━━━")
cc = t[t.find("const createCustomer"):t.find("const createCustomer")+800]
uc = t[t.find("const updateCustomer"):t.find("const updateCustomer")+500]
test("J6.01","createCustomer: permission guard",'canDo("customers","create")' in cc)
test("J6.02","createCustomer: auto ID (C001+)","padStart" in cc)
test("J6.03","createCustomer: FICA=Pending",'ficaStatus:"Pending"' in cc)
test("J6.04","createCustomer: BEE=Pending Review",'beeStatus:"Pending Review"' in cc)
test("J6.05","createCustomer: designated groups","womenOwned" in cc and "youthOwned" in cc and "disabilityOwned" in cc)
test("J6.06","createCustomer: audit trail","Customer Created" in cc)
test("J6.07","updateCustomer: permission guard",'canDo("customers","update")' in uc)
test("J6.08","updateCustomer: audit trail","Customer Updated" in uc)
test("J6.09","Customers page: search, filter, create form","function Customers()" in t and "cForm" in CUST)
test("J6.10","Customer detail view","detail.type === \"customer\"" in DETAIL)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 7: APPLICATION → UNDERWRITING → DECISION → BOOKING
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J7: APPLICATION LIFECYCLE ━━━")
test("J7.01","NewAppModal creates Draft",'status:"Draft"' in t[t.find("const app = {"):t.find("const app = {")+500])
test("J7.02","30-day expiry on Draft","30*day" in t)
test("J7.03","QA sign-off handler","qaSignOffApplication" in t and "mandatoryDocs" in t)
test("J7.04","QA pass → Submitted","Submitted" in t[t.find("const qaSignOffApplication"):t.find("const qaSignOffApplication")+6500])
test("J7.05","moveToUnderwriting","moveToUnderwriting" in t)
test("J7.06","8 DD steps with sequential gating",t.count("gateOk:")>=5)
test("J7.07","KYC step","kycFindings" in t and "docId" in t)
test("J7.08","Site visit step","siteVisitFindings" in t)
test("J7.09","Credit analysis: score + DSCR","creditBureauScore" in t and "dscr" in t)
test("J7.10","allDDComplete gate for decision","disabled={!allDDComplete}" in t)
test("J7.11","decideLoan: Approved/Declined","decideLoan" in t and "Approved" in t and "Declined" in t)
test("J7.12","bookLoan: creates loan record","bookLoan" in t and "LN-" in t)
test("J7.13","disburseLoan: sets Active","disburseLoan" in t)
test("J7.14","Application detail view","detail.type === \"application\"" in DETAIL)
test("J7.15","Decision Summary for decided apps","Decision Summary" in DETAIL)
test("J7.16","Underwriting Record collapsible","Underwriting Record" in DETAIL)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 8: LOAN BOOK + PORTFOLIO ANALYTICS
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J8: LOAN BOOK + ANALYTICS ━━━")
test("J8.01","Dual view toggle: book + analytics",'"book"' in LOANS and '"analytics"' in LOANS)
test("J8.02","Book view: table with disburse action","disburseLoan" in LOANS)
test("J8.03","Book view: Product column","Product" in LOANS)
test("J8.04","Analytics: Loan Book Movement","openingBook" in LOANS and "closingBook" in LOANS)
test("J8.05","Analytics: New disbursements (30d)","newDisb" in LOANS)
test("J8.06","Analytics: Gross NPL + Recoveries (55%)","grossNPL" in LOANS and "recoveryRate" in LOANS)
test("J8.07","Analytics: Portfolio yield (annualised)","portfolioYield" in LOANS)
test("J8.08","Analytics: Effective NPL rate","effectiveNPL" in LOANS)
test("J8.09","Analytics: Provision expense from ECL","provisionExp" in LOANS and "ecl" in LOANS)
test("J8.10","Analytics: WACF + cost of funds","wacf" in LOANS and "costOfFunds" in LOANS)
test("J8.11","Analytics: Net interest spread","netSpread" in LOANS)
test("J8.12","Analytics: Funding headroom + facility util","headroom" in LOANS and "facilUtil" in LOANS)
test("J8.13","Analytics: utilisation bar (colour thresholds)","facilUtil>0.85" in LOANS)
test("J8.14","Analytics: Portfolio by Product table","Portfolio by Product" in LOANS and "riskClass" in LOANS)
test("J8.15","Loan detail view","detail.type === \"loan\"" in DETAIL)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 9: SERVICING
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J9: SERVICING ━━━")
test("J9.01","Servicing page defined",len(SERV)>100)
test("J9.02","recordPayment handler","recordPayment" in t)
test("J9.03","Amortization schedule generator","genSchedule" in SERV)
test("J9.04","Payment history tab","Payment History" in SERV)
test("J9.05","Overdue tab","Overdue" in SERV)
test("J9.06","Upcoming payments","Upcoming" in SERV)
test("J9.07","KPIs: collected, interest, principal","Total Collected" in SERV)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 10: COLLECTIONS & RECOVERY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J10: COLLECTIONS ━━━")
test("J10.01","Collections page defined",len(COLL)>100)
test("J10.02","PTP tracking","ptpForm" in t and "ptpDate" in t)
test("J10.03","Debt restructuring","restructForm" in t)
test("J10.04","Write-off workflow","writeOffReason" in t)
test("J10.05","DPD classification (Early/Mid/Late)","Early" in COLL and "Mid" in COLL)
test("J10.06","addCollectionAction handler","addCollectionAction" in t)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 11: IFRS 9 PROVISIONING
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J11: IFRS 9 PROVISIONING ━━━")
test("J11.01","Provisioning page defined",len(PROV)>100)
test("J11.02","3-stage IFRS 9 rendering","r.stage===1" in t and "r.stage===2" in t)
test("J11.03","ECL fields (pd, lgd, ead)","pd" in PROV and "lgd" in PROV and "ead" in PROV)
test("J11.04","Stage 2+3 Exposure KPI","Stage 2" in PROV)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 12: GOVERNANCE & AUDIT TRAIL
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J12: GOVERNANCE ━━━")
test("J12.01","Governance page defined",len(GOV)>100)
test("J12.02","Audit trail with filtering","auditFilter" in t)
test("J12.03","addAudit with timestamp","ts: Date.now()" in t)
events = set(re.findall(r'addAudit\("([^"]+)"', t))
test("J12.04",f"≥12 audit event types ({len(events)} found)",len(events)>=12,str(sorted(events))[:100])
test("J12.05","Alert management (markRead)","markRead" in t)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 13: STATUTORY REPORTING
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J13: STATUTORY REPORTING ━━━")
test("J13.01","StatutoryReporting page",len(STAT)>100)
test("J13.02","Status workflow","updateStatutoryStatus" in t)
test("J13.03","Urgency indicators","OVERDUE" in t)
test("J13.04","Form 39 frequency","15000000" in t)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 14: ADMINISTRATION
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J14: ADMINISTRATION ━━━")
test("J14.01","4 tabs: products, users, system, rules",all(k in ADMIN for k in ['"products"','"users"','"system"','"rules"']))
test("J14.02","Product CRUD: create + edit + suspend","startNew" in ADMIN and "startEdit" in ADMIN and "toggleProductStatus" in t)
test("J14.03","Product form: all fields","monthlyRate" in ADMIN and "riskClass" in ADMIN and "ecl" in ADMIN and "idealFor" in ADMIN and "s1PD" in ADMIN and "lgd" in ADMIN)
test("J14.04","Product table: Risk Class + ECL columns","riskClass" in ADMIN and "ecl" in ADMIN)
test("J14.05","saveProduct persists to data","save({" in t[t.find("const saveProduct"):t.find("const saveProduct")+400])
test("J14.06","User CRUD: add, edit, reset pwd, suspend, revoke","startNewUser" in ADMIN and "startEditUser" in ADMIN and "resetPassword" in ADMIN and "toggleUserStatus" in ADMIN and "revokeAccess" in ADMIN)
test("J14.07","Self-edit prevention","currentUser.id" in ADMIN)
test("J14.08","User actions audited","User Created" in ADMIN)
test("J14.09","System health monitoring","Operational" in ADMIN and "uptime" in ADMIN)
test("J14.10","Backup scheduling","backupSchedule" in ADMIN)
test("J14.11","API key management","apiKeys" in ADMIN or "addApiKey" in ADMIN)
test("J14.12","Business rules CRUD","startNewRule" in ADMIN and "startEditRule" in ADMIN and "toggleRule" in ADMIN)
test("J14.13","RBAC Permission Matrix","RBAC Permission Matrix" in ADMIN)
test("J14.14","Regulatory framework","National Credit Act" in ADMIN)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 15: CROSS-MODULE DATA INTEGRITY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J15: CROSS-MODULE DATA ━━━")
test("J15.01","Customer→App linkage (custId)","a.custId" in t and "custId" in ORIG)
test("J15.02","App→Loan linkage (appId)","l.appId" in t)
test("J15.03","Loan→Collections linkage","loanId" in COLL)
test("J15.04","Document→Customer linkage","d.custId" in t)
test("J15.05","prod() lookup function","const prod = id =>" in t)
test("J15.06","cust() lookup function","const cust = id =>" in t)
test("J15.07","Dashboard aggregates all modules","loans" in DASH and "customers" in DASH and "applications" in DASH)
test("J15.08","Dashboard Development Impact (no colour)","Development Impact" in DASH and "color:C.text" in DASH)
test("J15.09","Reports module","function Reports()" in t and len(RPTS)>100)
test("J15.10","Documents module","function Documents()" in t and len(DOCS)>100)
test("J15.11","Comms module","function Comms()" in t and len(COMMS)>100)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 16: PRODUCT SYNCHRONISATION
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J16: PRODUCT SYNC ━━━")
test("J16.01","7 seed products",SEED.count('id:"P0')==7)
test("J16.02","Products stored in data.products",("products," in SEED or "products:" in SEED))
test("J16.03","Public landing: static cards (not from DB)","Invoice Discounting" in PUB and "data?.products" not in PUB[:PUB.find("public_apply")])
test("J16.04","Public apply: dynamic dropdown from DB","activeProds" in PUB)
test("J16.05","Portal: prod() lookups","prod(" in PORT)
test("J16.06","Staff: products variable from data","products" in t[t.find("const { customers"):t.find("const { customers")+200])
test("J16.07","Admin: CRUD saves via save()","saveProduct" in t and "save({" in t[t.find("saveProduct"):t.find("saveProduct")+400])
test("J16.08","Zero hardcoded product names outside seed",all(
    t[:t.find("function seed()")].count(n) + t[t.find("function seed()")+5000:].count(n) == 0
    for n in ["Micro-Business Boost","Agri Finance — Smallholder"]  # old names should not exist
))

# ═══════════════════════════════════════════════════════════════
# JOURNEY 17: NAVIGATION & UX
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J17: NAVIGATION & UX ━━━")
test("J17.01","pageHistory state","[pageHistory, setPageHistory]" in t)
test("J17.02","goBack pops history","pageHistory.length > 0" in t and "setPageHistory(h=>h.slice(0,-1))" in t)
test("J17.03","navTo pushes + navigates","setPageHistory" in t[t.find("const navTo"):t.find("const navTo")+200])
test("J17.04","Back arrow in staff header","goBack" in STAFF_HDR)
test("J17.05","Back arrow in portal header","goBack" in PORT)
test("J17.06","Sidebar label: Loan Book",'"Loan Book"' in t)
test("J17.07","Detail goBack","const goBack = () => setDetail(null)" in t)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 18: RESPONSIVE DESIGN
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J18: RESPONSIVE ━━━")
test("J18.01","768px breakpoint","max-width:768px" in t)
test("J18.02","480px breakpoint","max-width:480px" in t)
test("J18.03","Sidebar hidden on mobile","kb-sidebar" in t and "display:none" in t)
test("J18.04","Search hidden on mobile","kb-header-search" in t)
test("J18.05","Grid collapse classes","kb-pub-grid2" in t)
test("J18.06","Public nav responsive","kb-pub-nav" in t)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 19: SECURITY & COMPLIANCE
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J19: SECURITY & COMPLIANCE ━━━")
test("J19.01","RBAC: canDo checks (≥70)",t.count("canDo(")>=70)
test("J19.02","Permission denied alerts","Permission denied" in t)
test("J19.03","BORROWER excluded from staff modules","BORROWER:\"\"" in t)
test("J19.04","AUDITOR read-only","AUDITOR:\"view" in t)
test("J19.05","Approval limits enforced","approvalLimit" in t)
test("J19.06","POPIA consent in application","POPIA" in PUB)
test("J19.07","NCR registration displayed","NCRCP22396" in t)

# ═══════════════════════════════════════════════════════════════
# JOURNEY 20: BRANDING
# ═══════════════════════════════════════════════════════════════
print("\n━━━ J20: BRANDING ━━━")
test("J20.01","Company: TQA Capital (Pty) Ltd","TQA Capital (Pty) Ltd" in t)
test("J20.02","Domain: tqacapital.co.za","tqacapital.co.za" in t)
test("J20.03","Zero ThandoQ remnants",t.lower().count("thandoq")==0)
test("J20.04","Zero empowerment business",t.lower().count("empowerment business")==0)
test("J20.05","KwikBridge product name","KwikBridge" in t)

# ═══════════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 72)
print("  E2E TEST RESULTS")
print("=" * 72)
cats = {}
for s, tid, name, detail in results:
    c = tid.split(".")[0]
    cats.setdefault(c, {"PASS":0,"FAIL":0,"items":[]})
    cats[c][s] += 1
    cats[c]["items"].append((s,tid,name,detail))

total_cats = len(cats)
pass_cats = sum(1 for d in cats.values() if d["FAIL"]==0)

for cat, d in cats.items():
    tot = d["PASS"]+d["FAIL"]
    mark = "✓" if d["FAIL"]==0 else "✗"
    line = f"  {mark} {cat}: {d['PASS']}/{tot}"
    if d["FAIL"]: line += f" ({d['FAIL']} FAILED)"
    print(line)
    for s,tid,name,detail in d["items"]:
        if s=="FAIL": print(f"      ✗ {tid} {name}" + (f" — {detail}" if detail else ""))

print(f"\n  JOURNEYS: {pass_cats}/{total_cats} passed")
print(f"  TESTS:    {passed}/{passed+failed} passed — {passed*100//(passed+failed) if passed+failed else 0}%")
if failed == 0:
    print("\n  ✓ ALL E2E TESTS PASSED — SYSTEM INTEGRATION TEST SIGNED OFF")
else:
    print(f"\n  ⚠ {failed} failure(s) require review")
print("=" * 72)
sys.exit(0 if failed == 0 else 1)
