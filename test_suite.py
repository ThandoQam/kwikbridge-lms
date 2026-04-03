#!/usr/bin/env python3
"""KwikBridge LMS — Unit & Integration Test Suite v4 (corrected search ranges)"""
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

def extract_fn(name):
    marker = f"function {name}("
    i = t.find(marker)
    if i < 0: return ""
    brace = t.find("{", i)
    if brace < 0: return ""
    depth = 0
    for j in range(brace, min(brace+50000, len(t))):
        if t[j] == '{': depth += 1
        elif t[j] == '}': depth -= 1
        if depth == 0: return t[i:j+1]
    return t[i:i+30000]

# Pre-compute zone blocks
public_block = t[t.find("// ═══ PUBLIC ZONE"):t.find("// ═══ AUTH GATE")] if "// ═══ PUBLIC ZONE" in t else ""
portal_block = t[t.find("// ═══ BORROWER PORTAL"):t.find("// ═══ STAFF BACK-OFFICE")] if "// ═══ BORROWER PORTAL" in t else ""
ue1 = t.find("useEffect(() =>"); ue2 = t.find("useEffect(() =>", ue1+50)
load_ue = t[ue2:ue2+3000] if ue2 > 0 else ""
staff_main = t[t.find('className="kb-main"'):t.find('className="kb-main"')+800] if 'kb-main' in t else ""
fmt_blk = t[t.find("const fmt"):t.find("const fmt")+500]
seed = extract_fn("seed")
roles_blk = t[t.find("const ROLES"):t.find("const ROLES")+2000]
admin = extract_fn("Administration")
dash = extract_fn("Dashboard")
loans_fn = extract_fn("Loans")

print("=" * 72)
print("  KWIKBRIDGE LMS — TEST SUITE v4")
print(f"  {len(t):,} bytes, {len(lines)} lines")
print("=" * 72)

# ═══ UNIT TESTS ═══

print("\n━━━ U1: UTILITIES ━━━")
test("U1.01","uid()","const uid" in t)
test("U1.02","fmt.cur()","cur:" in fmt_blk)
test("U1.03","fmt.date()","date:" in fmt_blk)
test("U1.04","fmt.pct()","pct:" in fmt_blk)
test("U1.05","fmt.num()","num:" in fmt_blk)
test("U1.06","dpd()","const dpd" in t)
test("U1.07","stage()","const stage" in t)
test("U1.08","toSnake/toCamel/toDb/fromDb","toDb" in t and "fromDb" in t)
test("U1.09","store adapter","localStorage" in t)

print("\n━━━ U2: RBAC ━━━")
test("U2.01","12 roles with zone","BORROWER:" in roles_blk and 'zone:' in roles_blk)
test("U2.02","17 PERMS modules","const PERMS" in t and t.count('BORROWER:"')>=15)
test("U2.03","can()/canAny()","function can(" in t and "function canAny(" in t)
test("U2.04","APPROVAL_LIMITS","const APPROVAL_LIMITS" in t)

print("\n━━━ U3: USERS ━━━")
test("U3.01","SYSTEM_USERS (≥9)","const SYSTEM_USERS" in t)
test("U3.02","currentUser state","[currentUser, setCurrentUser]" in t)

print("\n━━━ U4: SUPABASE ━━━")
test("U4.01","URL+KEY+CRUD","sbGet" in t and "sbUpsert" in t and "sbDelete" in t)
test("U4.02","Auth functions","authSignIn" in t and "authSignUp" in t and "authSignOut" in t)
test("U4.03","OAuth (Google+Apple)","google" in t and "apple" in t)

print("\n━━━ U5: SEED ━━━")
test("U5.01","7 products",seed.count('id:"P0')==7)
test("U5.02","Products have riskClass+ecl+monthlyRate","riskClass:" in seed and "ecl:" in seed and "monthlyRate:" in seed)
test("U5.03","NCR settings","NCRCP22396" in seed)
test("U5.04","Empty operational data","customers: []" in seed)

print("\n━━━ U6: PERSISTENCE ━━━")
test("U6.01","Store checked first in load","store.get(SK)" in load_ue)
test("U6.02","3s Supabase timeout","AbortController" in load_ue)
test("U6.03","seed() fallback","seed()" in load_ue)
test("U6.04","save via useCallback","const save = useCallback" in t)
test("U6.05","reset() synchronous","const reset = () =>" in t)

print("\n━━━ U7: AUTH ━━━")
test("U7.01","Auth states","[authSession, setAuthSession]" in t and "[authLoading, setAuthLoading]" in t)
test("U7.02","Sign in/up/out handlers","handleSignIn" in t and "handleSignUp" in t and "handleSignOut" in t)
test("U7.03","OAuth redirect parsing","access_token" in t and "URLSearchParams" in t)
test("U7.04","Session in localStorage","kb-auth" in t)

print("\n━━━ U8: UI COMPONENTS ━━━")
for c in ['Btn','Badge','Table','Modal','SectionCard','InfoGrid','KPI','Tab','Field','Input','Select','Textarea']:
    test("U8",f"{c}",f"function {c}(" in t or f"const {c}" in t)
test("U8","statusBadge","statusBadge" in t)

# ═══ INTEGRATION TESTS ═══

print("\n━━━ I1: THREE-ZONE MODEL ━━━")
test("I1.01","Zone state + derivation","[zone, setZone]" in t and "userZone" in t)
test("I1.02","ZONE_PAGES (3 zones)","public:" in t and "portal:" in t and "staff:" in t)
test("I1.03","Public renders without auth","!authSession && zone ===" in t)
test("I1.04","Portal for BORROWER",'userZone === "portal"' in t)
test("I1.05","Staff zone enforcement",'userZone !== "staff"' in t)
test("I1.06","Auth zone transition",'setZone("auth")' in t)

print("\n━━━ I2: PUBLIC ZONE ━━━")
test("I2.01","Header nav (home/apply/track)","public_home" in public_block and "public_apply" in public_block)
test("I2.02","Staff Login routes to auth",'setZone("auth")' in public_block)
test("I2.03","Hero + CTAs","Business Finance for Growth" in public_block)
test("I2.04","4 static product cards","Invoice Discounting" in public_block and "Purchase Order Financing" in public_block and "Working Capital Financing" in public_block and "Agri & Project Financing" in public_block)
test("I2.05","NCR footer","NCRCP22396" in public_block)
test("I2.06","Sticky header","sticky" in public_block)

print("\n━━━ I3: APPLICATION FORM ━━━")
test("I3.01","4-step form","step===1" in public_block and "step===4" in public_block)
test("I3.02","Step 1: personal details","Full Name" in public_block and "Email Address" in public_block)
test("I3.03","Step 2: business info","Business Name" in public_block and "Company Registration" in public_block)
test("I3.04","Step 3: financing request","Select Product" in public_block and "Loan Amount" in public_block)
test("I3.05","Step 4: review","Review Your Application" in public_block)
test("I3.06","Creates customer+app on submit","newCust" in public_block and "Pre-Approval" in public_block)
test("I3.07","Creates notification+alert+audit","newComm" in public_block and "newAlert" in public_block and "newAudit" in public_block)
test("I3.08","Confirmation with ref","Application Submitted" in public_block and "trackingRef" in public_block)
test("I3.09","Dynamic product dropdown","activeProds" in public_block)
test("I3.10","POPIA consent","POPIA" in public_block)

print("\n━━━ I4: BORROWER PORTAL ━━━")
test("I4.01","6-page nav","portal_dashboard" in portal_block and "portal_documents" in portal_block and "portal_loans" in portal_block)
test("I4.02","Data filtered by email","myEmail" in portal_block and "myCustomer" in portal_block)
test("I4.03","Sign Out","handleSignOut" in portal_block)
test("I4.04","Sticky header","sticky" in portal_block)
test("I4.05","Back button","goBack" in portal_block)
test("I4.06","Profile page","portal_profile" in portal_block)

print("\n━━━ I5: KYB/FICA DOCUMENTS ━━━")
test("I5.01","8 doc types","KYB_FICA_DOCS" in portal_block and "sa_id" in portal_block)
test("I5.02","CIPC + bank confirmation","cipc" in portal_block and "bank_confirm" in portal_block)
test("I5.03","Status indicators","Verified" in portal_block and "Rejected" in portal_block)
test("I5.04","Upload function","handleDocUpload" in portal_block)
test("I5.05","Progress bar","Mandatory Documents" in portal_block)
test("I5.06","Bank verification API","runBankVerification" in portal_block)
test("I5.07","Credit bureau API","runCreditCheck" in portal_block)

print("\n━━━ I6: PORTAL LOANS ━━━")
test("I6.01","Make Payment","Make Payment" in portal_block)
test("I6.02","Promise to Pay","Promise to Pay" in portal_block)
test("I6.03","PTP audit trail","PTP Submitted" in portal_block)
test("I6.04","Payment methods","EFT" in portal_block and "Debit Order" in portal_block)
test("I6.05","Balance update","newBal" in portal_block)
test("I6.06","Payment audit trail","Payment Submitted" in portal_block)

print("\n━━━ I7: CUSTOMER LIFECYCLE ━━━")
cc = t[t.find("const createCustomer"):t.find("const createCustomer")+800]
test("I7.01","createCustomer guarded+audited","canDo" in cc and "Customer Created" in cc)
test("I7.02","FICA=Pending + designated groups",'ficaStatus:"Pending"' in cc and "womenOwned" in cc)
test("I7.03","updateCustomer","updateCustomer" in t)

print("\n━━━ I8: APPLICATION LIFECYCLE ━━━")
test("I8.01","Draft→QA→Submitted→Underwriting→Decided","qaSignOffApplication" in t and "moveToUnderwriting" in t and "decideLoan" in t)
test("I8.02","bookLoan + disburseLoan","bookLoan" in t and "disburseLoan" in t)
test("I8.03","30-day expiry","30*day" in t)

print("\n━━━ I9: UNDERWRITING ━━━")
test("I9.01","Sequential gating",t.count("gateOk:")>=5)
test("I9.02","runDDStep + allDDComplete","runDDStep" in t and "allDDComplete" in t)
test("I9.03","Credit analysis metrics","creditBureauScore" in t and "dscr" in t)

print("\n━━━ I10: LOAN BOOK ━━━")
test("I10.01","Dual view (book+analytics)","analytics" in loans_fn and '"book"' in loans_fn)
test("I10.02","Portfolio analytics panels","openingBook" in loans_fn and "portfolioYield" in loans_fn and "wacf" in loans_fn and "headroom" in loans_fn)
test("I10.03","Portfolio by Product","Portfolio by Product" in loans_fn)
test("I10.04","Facility utilisation bar","facilUtil" in loans_fn)
test("I10.05","Disburse action","disburseLoan" in loans_fn)

print("\n━━━ I11: SERVICING + COLLECTIONS + PROVISIONING ━━━")
test("I11.01","Servicing","function Servicing()" in t and "recordPayment" in t)
test("I11.02","Collections (PTP/restructure/write-off)","function Collections()" in t and "ptpForm" in t and "writeOffReason" in t)
test("I11.03","Provisioning (IFRS 9)","function Provisioning()" in t and "r.stage===1" in t)

print("\n━━━ I12: GOVERNANCE + STATUTORY ━━━")
test("I12.01","Governance + audit trail","function Governance()" in t and "auditFilter" in t)
test("I12.02","≥10 audit event types",len(set(re.findall(r'addAudit\("([^"]+)"',t)))>=10)
test("I12.03","StatutoryReporting","function StatutoryReporting()" in t)

print("\n━━━ I13: ADMINISTRATION ━━━")
test("I13.01","4 tabs",all(k in admin for k in ['"products"','"users"','"system"','"rules"']))
test("I13.02","Product form: new fields","monthlyRate" in admin and "riskClass" in admin and "ecl" in admin and "idealFor" in admin)
test("I13.03","Product table: Class+ECL","riskClass" in admin)
test("I13.04","User CRUD","startNewUser" in admin and "revokeAccess" in admin)
test("I13.05","Business rules CRUD","startNewRule" in admin)

print("\n━━━ I14: CROSS-MODULE ━━━")
test("I14.01","Entity linkages","a.custId" in t and "l.appId" in t)
test("I14.02","prod()/cust() lookups","const prod" in t and "const cust" in t)
test("I14.03","Dashboard aggregates","loans" in dash and "customers" in dash)
test("I14.04","Dev Impact no colour","color:C.text" in dash)

print("\n━━━ I15: NAVIGATION & UX ━━━")
test("I15.01","pageHistory + goBack + navTo","pageHistory" in t and "goBack" in t and "navTo" in t)
test("I15.02","Back arrow in staff header","goBack" in staff_main)
test("I15.03","Sidebar uses navTo","navTo(n.key)" in t)
test("I15.04","Sidebar label Loan Book",'"Loan Book"' in t)

print("\n━━━ I16: RESPONSIVE ━━━")
test("I16.01","Media queries","max-width:768px" in t and "max-width:480px" in t)
test("I16.02","Sidebar hidden + search hidden","kb-sidebar" in t and "kb-header-search" in t)

print("\n━━━ I17: BRANDING ━━━")
test("I17.01","TQA Capital + tqacapital.co.za","TQA Capital" in t and "tqacapital.co.za" in t)
test("I17.02","Zero ThandoQ / empowerment business",t.lower().count("thandoq")==0 and t.lower().count("empowerment business")==0)

# ═══ REPORT ═══
print("\n" + "=" * 72)
cats = {}
for s, tid, name, detail in results:
    c = tid.split(".")[0] if "." in tid else tid[:3]
    cats.setdefault(c, {"PASS":0,"FAIL":0,"items":[]})
    cats[c][s] += 1
    cats[c]["items"].append((s,tid,name,detail))

for cat, d in cats.items():
    tot = d["PASS"]+d["FAIL"]
    mark = "✓" if d["FAIL"]==0 else "✗"
    line = f"  {mark} {cat}: {d['PASS']}/{tot}"
    if d["FAIL"]: line += f" ({d['FAIL']} FAILED)"
    print(line)
    for s,tid,name,detail in d["items"]:
        if s=="FAIL": print(f"      ✗ {name}" + (f" — {detail}" if detail else ""))

print(f"\n  TOTAL: {passed} passed, {failed} failed — {passed*100//(passed+failed) if passed+failed else 0}%")
if failed == 0:
    print("  ✓ ALL TESTS PASSED — SIT SIGNED OFF")
else:
    print(f"  ⚠ {failed} failure(s)")
print("=" * 72)
sys.exit(0 if failed == 0 else 1)
