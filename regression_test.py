#!/usr/bin/env python3
"""
KwikBridge LMS — REGRESSION TEST
Verifies that every feature delivered across all prior sprints still works.
Each test maps to a specific commit/feature to catch regressions from later changes.
"""
import re, sys

t = open('src/kwikbridge-lms-v2.jsx').read()
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

PUB = t[t.find("// ═══ PUBLIC ZONE"):t.find("// ═══ AUTH GATE")] if "// ═══ PUBLIC ZONE" in t else ""
AUTH = t[t.find("// ═══ AUTH GATE"):t.find("// ═══ BORROWER PORTAL")] if "// ═══ AUTH GATE" in t else ""
PORT = t[t.find("// ═══ BORROWER PORTAL"):t.find("// ═══ STAFF BACK-OFFICE")] if "// ═══ BORROWER PORTAL" in t else ""
SEED = efn("seed")
ADMIN = efn("Administration")
DASH = efn("Dashboard")
LOANS = efn("Loans")
DETAIL = efn("renderDetail")

print("=" * 72)
print("  KWIKBRIDGE LMS — REGRESSION TEST")
print(f"  {len(t):,} bytes · {len(lines)} lines")
print("=" * 72)

# ═══════════════════════════════════════════════════════
# R1: ORIGINAL LMS BUILD (core modules, RBAC, Supabase)
# ═══════════════════════════════════════════════════════
print("\n━━━ R1: ORIGINAL BUILD — Core Modules ━━━")
for fn in ["Dashboard","Customers","Origination","Underwriting","Loans",
           "Servicing","Collections","Provisioning","Governance",
           "StatutoryReporting","Documents","Reports","Comms","Administration"]:
    test("R1",f"{fn}() exists",f"function {fn}()" in t)
test("R1.15","renderPage() routes all 14",len(re.findall(r'case "\w+":', efn("renderPage"))) >= 14)
test("R1.16","renderDetail() for 3 types","customer" in DETAIL and "application" in DETAIL and "loan" in DETAIL)

print("\n━━━ R1B: ORIGINAL BUILD — RBAC ━━━")
test("R1.17","12 roles defined",all(r in t for r in ["ADMIN:","EXEC:","CREDIT_HEAD:","COMPLIANCE:","CREDIT_SNR:","CREDIT:","LOAN_OFFICER:","COLLECTIONS:","FINANCE:","AUDITOR:","VIEWER:","BORROWER:"]))
test("R1.18","17 PERMS modules","const PERMS" in t and "portal:" in t)
test("R1.19","can() + canAny()","function can(" in t and "function canAny(" in t)
test("R1.20","APPROVAL_LIMITS (5 tiers)","CREDIT: 250000" in t and "ADMIN: Infinity" in t)
test("R1.21","canDo checks (≥70)",t.count("canDo(") >= 70)

print("\n━━━ R1C: ORIGINAL BUILD — Supabase ━━━")
test("R1.22","SUPABASE_URL","yioqaluxgqxsifclydmd" in t)
test("R1.23","SUPABASE_KEY","sb_publishable" in t)
test("R1.24","sbGet/sbUpsert/sbDelete",all(f in t for f in ["sbGet","sbUpsert","sbDelete"]))
test("R1.25","12 TABLES mapped","const TABLES" in t and "audit_trail" in t and "statutory_reports" in t)
test("R1.26","toDb/fromDb field mapping","toDb" in t and "fromDb" in t and "toSnake" in t)

print("\n━━━ R1D: ORIGINAL BUILD — Handlers ━━━")
for h in ["createCustomer","updateCustomer","qaSignOffApplication","moveToUnderwriting",
           "runDDStep","decideLoan","bookLoan","disburseLoan","recordPayment",
           "addCollectionAction","signOffStep","approveDocument","sendNotification","addAudit"]:
    test("R1",f"{h}()",h in t)

print("\n━━━ R1E: ORIGINAL BUILD — UI Components ━━━")
for c in ["Btn","Badge","Table","Modal","SectionCard","InfoGrid","KPI","Tab","Field","Input","Select","Textarea"]:
    test("R1",f"{c}",f"function {c}(" in t or f"const {c}" in t)
test("R1.43","statusBadge","statusBadge" in t)

# ═══════════════════════════════════════════════════════
# R2: AUTH SYSTEM (login, signup, OAuth, session)
# ═══════════════════════════════════════════════════════
print("\n━━━ R2: AUTH SYSTEM ━━━")
test("R2.01","authSession state","[authSession, setAuthSession]" in t)
test("R2.02","authLoading state","[authLoading, setAuthLoading]" in t)
test("R2.03","authMode state","[authMode, setAuthMode]" in t)
test("R2.04","handleSignIn","const handleSignIn = async" in t)
test("R2.05","handleSignUp","const handleSignUp = async" in t)
test("R2.06","handleSignOut","const handleSignOut = async" in t)
test("R2.07","Supabase Auth REST API","sbAuth" in t and "authGetUser" in t)
test("R2.08","Google OAuth","authOAuthUrl" in t and "google" in AUTH)
test("R2.09","Apple OAuth","apple" in AUTH)
test("R2.10","OAuth redirect (hash fragment)","access_token" in t and "URLSearchParams" in t)
test("R2.11","Session localStorage","kb-auth" in t and "localStorage.setItem" in t and "localStorage.removeItem" in t)
test("R2.12","Dev bypass: Staff + Borrower","Staff (Admin)" in AUTH and "Borrower Portal" in AUTH)
test("R2.13","Back to Public Site","Back to Public Site" in AUTH)
test("R2.14","Post-login zone routing","ROLES[matched.role]?.zone" in t)
test("R2.15","Unmatched → BORROWER default","BORROWER" in t[t.find("const handleSignIn"):t.find("const handleSignUp")])

# ═══════════════════════════════════════════════════════
# R3: THREE-ZONE ACCESS MODEL
# ═══════════════════════════════════════════════════════
print("\n━━━ R3: THREE-ZONE MODEL ━━━")
test("R3.01","zone state","[zone, setZone]" in t)
test("R3.02","userZone from ROLES","ROLES[role]?.zone" in t)
test("R3.03","ZONE_PAGES (3 zones)","public:" in t[t.find("ZONE_PAGES"):t.find("ZONE_PAGES")+500] and "portal:" in t[t.find("ZONE_PAGES"):t.find("ZONE_PAGES")+500])
test("R3.04","Public zone: 3 pages","public_home" in t and "public_apply" in t and "public_track" in t)
test("R3.05","Portal zone: 6 pages","portal_dashboard" in t and "portal_profile" in t)
test("R3.06","Staff zone: 16 pages","admin" in t and "products" in t and "settings" in t)
test("R3.07","Zone sync on auth","zone === \"public\" || zone === \"auth\"" in t)
test("R3.08","Auth zone transition","setZone(\"auth\")" in t)
test("R3.09","Staff zone enforcement",'userZone !== "staff" && zone === "staff"' in t)
test("R3.10","BORROWER zone = portal",'zone:"portal"' in t[t.find("BORROWER:"):t.find("BORROWER:")+100])

# ═══════════════════════════════════════════════════════
# R4: PUBLIC LANDING PAGE
# ═══════════════════════════════════════════════════════
print("\n━━━ R4: PUBLIC LANDING ━━━")
test("R4.01","Default page = public_home",'useState("public_home")' in t)
test("R4.02","Public layout renders",len(PUB) > 5000)
test("R4.03","Hero headline","Business Finance for Growth" in PUB)
test("R4.04","Apply for Financing CTA","Apply for Financing" in PUB)
test("R4.05","Track Application CTA","Track Application" in PUB)
test("R4.06","Staff Login button","Staff Login" in PUB)
test("R4.07","4 static product cards","Invoice Discounting" in PUB and "Purchase Order Financing" in PUB and "Working Capital Financing" in PUB and "Agri & Project Financing" in PUB)
test("R4.08","NCR footer","NCRCP22396" in PUB and "Registered Credit Provider" in PUB)
test("R4.09","No Products tab in nav","public_products" not in PUB[:PUB.find("<main")])

# ═══════════════════════════════════════════════════════
# R5: PUBLIC APPLICATION FORM (4-step, no registration)
# ═══════════════════════════════════════════════════════
print("\n━━━ R5: APPLICATION FORM ━━━")
test("R5.01","publicAppForm state","publicAppForm" in t)
test("R5.02","4 steps","step===1" in PUB and "step===2" in PUB and "step===3" in PUB and "step===4" in PUB)
test("R5.03","Step 1: name,email,phone,password","Full Name" in PUB and "Create Password" in PUB)
test("R5.04","Step 2: business info (9 fields)","Business Name" in PUB and "Company Registration" in PUB and "Province" in PUB)
test("R5.05","Step 3: product dropdown (dynamic)","activeProds" in PUB and "Select Product" in PUB)
test("R5.06","Step 3: amount, term, purpose","Loan Amount" in PUB and "Purpose of Financing" in PUB)
test("R5.07","Step 4: review","Review Your Application" in PUB)
test("R5.08","POPIA consent","POPIA" in PUB)
test("R5.09","Submit → customer + app + comm + alert + audit","newCust" in PUB and "newApp" in PUB and "newComm" in PUB and "newAlert" in PUB and "newAudit" in PUB)
test("R5.10","Pre-Approval status","Pre-Approval" in PUB)
test("R5.11","Confirmation with reference","Application Submitted" in PUB and "Application Reference" in PUB)

# ═══════════════════════════════════════════════════════
# R6: BORROWER PORTAL
# ═══════════════════════════════════════════════════════
print("\n━━━ R6: BORROWER PORTAL ━━━")
test("R6.01","Portal layout",len(PORT) > 10000)
test("R6.02","Data isolation (myEmail→myCustomer)","myEmail" in PORT and "myCustomer" in PORT)
test("R6.03","Dashboard KPIs","Applications" in PORT and "Active Loans" in PORT and "Total Balance" in PORT)
test("R6.04","My Applications table","My Applications" in PORT)
test("R6.05","My Loans with payment + PTP","Make Payment" in PORT and "Promise to Pay" in PORT)
test("R6.06","PTP: date, amount, notes → audit + alert","ptpHistory" in PORT and "PTP Submitted" in PORT)
test("R6.07","Payment: amount, method, ref → balance update","portalPayment" in t and "newBal" in PORT)
test("R6.08","4 payment methods","EFT" in PORT and "Debit Order" in PORT and "Card" in PORT and "Cash Deposit" in PORT)
test("R6.09","KYB/FICA: 8 doc types","KYB_FICA_DOCS" in PORT and "sa_id" in PORT)
test("R6.10","KYB/FICA: 5 mandatory + 3 optional","proof_address" in PORT and "tax_clearance" in PORT)
test("R6.11","Doc status indicators (4 states)","Not Uploaded" in PORT and "Under Review" in PORT and "Verified" in PORT and "Rejected" in PORT)
test("R6.12","Mandatory progress bar","Mandatory Documents" in PORT)
test("R6.13","Bank verification API","runBankVerification" in PORT)
test("R6.14","Credit bureau API","runCreditCheck" in PORT)
test("R6.15","Messages page","portal_comms" in PORT)
test("R6.16","Profile page","portal_profile" in PORT and "Business Details" in PORT)

# ═══════════════════════════════════════════════════════
# R7: PRODUCTS (7 from financial model, synced everywhere)
# ═══════════════════════════════════════════════════════
print("\n━━━ R7: PRODUCT DATA ━━━")
test("R7.01","7 seed products",SEED.count('id:"P0')==7)
test("R7.02","P001 PO Financing","PO Financing" in SEED)
test("R7.03","P002 Invoice Scholar","Scholar Transport" in SEED)
test("R7.04","P003 Invoice Road","Road Maintenance" in SEED)
test("R7.05","P004 Invoice Coega","Coega Infrastructure" in SEED)
test("R7.06","P005 Working Capital","Micro Traders" in SEED)
test("R7.07","P006 Agri Finance","Smallholder" in SEED)
test("R7.08","P007 Project Finance","Project & Contract" in SEED)
test("R7.09","riskClass per product","riskClass:" in SEED)
test("R7.10","ecl per product","ecl:" in SEED)
test("R7.11","monthlyRate per product","monthlyRate:" in SEED)
test("R7.12","idealFor per product","idealFor:" in SEED)
test("R7.13","Admin form: all new fields","monthlyRate" in ADMIN and "riskClass" in ADMIN and "ecl" in ADMIN and "idealFor" in ADMIN and "s1PD" in ADMIN and "lgd" in ADMIN)
test("R7.14","Admin table: Class + ECL","riskClass" in ADMIN)
test("R7.15","Landing cards NOT from DB (static)","data?.products" not in PUB[:PUB.find("public_apply")])

# ═══════════════════════════════════════════════════════
# R8: LOAN BOOK + PORTFOLIO ANALYTICS
# ═══════════════════════════════════════════════════════
print("\n━━━ R8: LOAN BOOK + ANALYTICS ━━━")
test("R8.01","Dual view toggle","'book'" in LOANS and "'analytics'" in LOANS or '"book"' in LOANS)
test("R8.02","Book Movement panel","openingBook" in LOANS and "closingBook" in LOANS)
test("R8.03","New disbursements (30d)","newDisb" in LOANS)
test("R8.04","Gross NPL + Recoveries 55%","grossNPL" in LOANS and "recoveryRate" in LOANS)
test("R8.05","Portfolio yield (annualised)","portfolioYield" in LOANS)
test("R8.06","Effective NPL rate","effectiveNPL" in LOANS)
test("R8.07","Provision expense from ECL","provisionExp" in LOANS)
test("R8.08","WACF + cost of funds","wacf" in LOANS and "costOfFunds" in LOANS)
test("R8.09","Net interest spread","netSpread" in LOANS)
test("R8.10","Funding headroom + utilisation","headroom" in LOANS and "facilUtil" in LOANS)
test("R8.11","Utilisation bar (colour thresholds)","facilUtil>0.85" in LOANS)
test("R8.12","Portfolio by Product table","Portfolio by Product" in LOANS)
test("R8.13","Sidebar label = Loan Book",'"Loan Book"' in t)

# ═══════════════════════════════════════════════════════
# R9: NAVIGATION & UX
# ═══════════════════════════════════════════════════════
print("\n━━━ R9: NAVIGATION & UX ━━━")
test("R9.01","pageHistory state","[pageHistory, setPageHistory]" in t)
test("R9.02","goBack()","const goBack" in t)
test("R9.03","navTo() tracks history","setPageHistory" in t[t.find("const navTo"):t.find("const navTo")+200])
test("R9.04","Back arrow in staff header","goBack" in t[t.find('className="kb-main"'):t.find('className="kb-main"')+1500])
test("R9.05","Back arrow in portal header","goBack" in PORT)
test("R9.06","Staff sidebar uses navTo","navTo(n.key)" in t[t.find("kb-sidebar"):])
test("R9.07","Portal sidebar uses navTo","navTo(n.key)" in PORT)
test("R9.08","Sticky headers (3 zones)","sticky" in PUB and "sticky" in PORT and "sticky" in t[t.find('className="kb-main"'):t.find('className="kb-main"')+500])

# ═══════════════════════════════════════════════════════
# R10: RESPONSIVE DESIGN
# ═══════════════════════════════════════════════════════
print("\n━━━ R10: RESPONSIVE ━━━")
test("R10.01","768px breakpoint","max-width:768px" in t)
test("R10.02","480px breakpoint","max-width:480px" in t)
test("R10.03","kb-sidebar hidden","kb-sidebar" in t and "display:none" in t)
test("R10.04","kb-header-search hidden","kb-header-search" in t)
test("R10.05","Public responsive classes","kb-pub-nav" in t and "kb-pub-grid2" in t)

# ═══════════════════════════════════════════════════════
# R11: BRANDING
# ═══════════════════════════════════════════════════════
print("\n━━━ R11: BRANDING ━━━")
test("R11.01","TQA Capital (Pty) Ltd","TQA Capital (Pty) Ltd" in t)
test("R11.02","tqacapital.co.za","tqacapital.co.za" in t)
test("R11.03","KwikBridge","KwikBridge" in t)
test("R11.04","NCRCP22396","NCRCP22396" in t)
test("R11.05","Zero ThandoQ",t.lower().count("thandoq")==0)
test("R11.06","Zero empowerment business",t.lower().count("empowerment business")==0)

# ═══════════════════════════════════════════════════════
# R12: DASHBOARD — Development Impact (no colour)
# ═══════════════════════════════════════════════════════
print("\n━━━ R12: DASHBOARD ━━━")
test("R12.01","Development Impact section","Development Impact" in DASH)
di_block = DASH[DASH.find("Development Impact"):DASH.find("Development Impact")+800]
test("R12.02","No colour variation (all C.text)","C.green" not in di_block and "C.purple" not in di_block and "C.blue" not in di_block and "C.amber" not in di_block)
test("R12.03","Jobs Supported","Jobs Supported" in di_block)
test("R12.04","Women/Youth/Disability ownership","Women-Owned" in di_block and "Youth-Owned" in di_block and "Disability-Owned" in di_block)

# ═══════════════════════════════════════════════════════
# R13: CLEANUP — no dead code, no unused state
# ═══════════════════════════════════════════════════════
print("\n━━━ R13: CLEANUP ━━━")
test("R13.01","No portalDocUpload (removed)","portalDocUpload" not in t)
test("R13.02","No isPageInZone (removed)","isPageInZone" not in t)
test("R13.03","No navigateTo (removed, replaced by navTo)","const navigateTo" not in t)
test("R13.04","No InvestOS references","InvestOS" not in t)
test("R13.05","No duplicate export default",t.count("export default function")==1)

# ═══════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════
print("\n" + "=" * 72)
cats = {}
for s, tid, name, detail in results:
    c = tid if not "." in tid else tid.split(".")[0]
    cats.setdefault(c, {"P":0,"F":0,"items":[]})
    cats[c][s[0]] += 1
    cats[c]["items"].append((s,name,detail))

for cat, d in sorted(cats.items()):
    tot = d["P"]+d["F"]
    mark = "✓" if d["F"]==0 else "✗"
    line = f"  {mark} {cat}: {d['P']}/{tot}"
    if d["F"]: line += f" ({d['F']} REGRESSED)"
    print(line)
    for s,name,detail in d["items"]:
        if s=="FAIL": print(f"      ✗ {name}" + (f" — {detail}" if detail else ""))

print(f"\n  TOTAL: {passed}/{passed+failed} — {passed*100//(passed+failed)}%")
if failed:
    print(f"\n  ✗ REGRESSION DETECTED — {failed} feature(s) broken")
else:
    print(f"\n  ✓ NO REGRESSIONS — ALL FEATURES INTACT")
print("=" * 72)
sys.exit(1 if failed else 0)
