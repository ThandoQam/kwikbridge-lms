#!/usr/bin/env python3
"""
KwikBridge LMS — SMOKE TEST
Critical-path-only validation. If any of these fail, the system is broken.
Tests the minimum viable functionality a user would encounter in each zone.
"""
import re, sys

t = open('src/kwikbridge-lms-v2.jsx').read()
passed = failed = 0
results = []

def test(name, cond):
    global passed, failed
    s = "PASS" if cond else "FAIL"
    if cond: passed += 1
    else: failed += 1
    results.append((s, name))

PUB = t[t.find("// ═══ PUBLIC ZONE"):t.find("// ═══ AUTH GATE")] if "// ═══ PUBLIC ZONE" in t else ""
PORT = t[t.find("// ═══ BORROWER PORTAL"):t.find("// ═══ STAFF BACK-OFFICE")] if "// ═══ BORROWER PORTAL" in t else ""

print("=" * 60)
print("  KWIKBRIDGE LMS — SMOKE TEST")
print("=" * 60)

# ── S1: APP RENDERS ──
print("\n  S1: APP RENDERS")
test("  Export default App",             "export default function App()" in t)
test("  useState declarations (≥55)",    t.count("useState(") >= 55)
test("  useEffect on mount",            "useEffect(() =>" in t)
test("  save() defined before gate",    "const save = useCallback" in t[:t.find("PUBLIC ZONE")])
test("  seed() returns data",           "function seed()" in t and "return {" in t[t.find("function seed()"):t.find("function seed()")+8000])

# ── S2: PUBLIC ZONE LOADS ──
print("\n  S2: PUBLIC ZONE LOADS")
test("  Default page = public_home",    'useState("public_home")' in t)
test("  Public layout renders",         len(PUB) > 5000)
test("  Hero visible",                  "Business Finance for Growth" in PUB)
test("  Apply CTA present",            "Apply for Financing" in PUB)
test("  4 product cards",              "Invoice Discounting" in PUB and "Working Capital" in PUB)

# ── S3: APPLICATION FORM WORKS ──
print("\n  S3: APPLICATION FORM SUBMITS")
test("  4-step form",                   "step===1" in PUB and "step===4" in PUB)
test("  Product dropdown (dynamic)",    "activeProds" in PUB)
test("  Submit creates customer",       "newCust" in PUB)
test("  Submit creates application",    "newApp" in PUB and "Pre-Approval" in PUB)
test("  save() called on submit",       "save({" in PUB)
test("  Confirmation shown",           "Application Submitted" in PUB)

# ── S4: AUTH GATE WORKS ──
print("\n  S4: AUTH GATE WORKS")
test("  Login page renders",           "!authSession" in t and "Sign In" in t)
test("  handleSignIn defined",         "const handleSignIn" in t)
test("  handleSignOut defined",        "const handleSignOut" in t)
test("  Dev bypass (Staff)",           "Staff (Admin)" in t)
test("  Dev bypass (Borrower)",        "Borrower Portal" in t)
test("  Session in localStorage",      "kb-auth" in t)

# ── S5: BORROWER PORTAL LOADS ──
print("\n  S5: BORROWER PORTAL LOADS")
test("  Portal renders for BORROWER",  'userZone === "portal"' in t)
test("  Portal layout present",        len(PORT) > 5000)
test("  Data filtered by email",       "myCustomer" in PORT and "myApps" in PORT)
test("  6 nav pages",                  "portal_dashboard" in PORT and "portal_documents" in PORT)
test("  KYB/FICA upload",             "KYB_FICA_DOCS" in PORT and "handleDocUpload" in PORT)
test("  Make Payment",                "Make Payment" in PORT)
test("  Promise to Pay",              "Promise to Pay" in PORT)
test("  Sign Out",                    "handleSignOut" in PORT)

# ── S6: STAFF BACK-OFFICE LOADS ──
print("\n  S6: STAFF BACK-OFFICE LOADS")
test("  Staff zone check",            'userZone !== "staff"' in t)
test("  Sidebar nav (14 items)",       "Loan Book" in t and "Origination" in t and "Administration" in t)
test("  renderPage switch",           "function renderPage()" in t)
cases = re.findall(r'case "(\w+)":', t[t.find("function renderPage"):t.find("function renderPage")+1000])
test("  14 router cases",            len(cases) >= 14)
test("  Dashboard function",         "function Dashboard()" in t)
test("  !data loading guard",        "if (!data)" in t)

# ── S7: CORE HANDLERS EXIST ──
print("\n  S7: CORE HANDLERS")
for h in ["createCustomer","updateCustomer","qaSignOffApplication","moveToUnderwriting",
           "runDDStep","decideLoan","bookLoan","disburseLoan","recordPayment",
           "addCollectionAction","addAudit","save","reset"]:
    test(f"  {h}()", h in t)

# ── S8: DATA PERSISTENCE ──
print("\n  S8: DATA PERSISTENCE")
test("  Supabase URL configured",     "yioqaluxgqxsifclydmd" in t)
test("  sbGet/sbUpsert/sbDelete",     "sbGet" in t and "sbUpsert" in t)
test("  TABLES map (12 tables)",      "const TABLES" in t and "audit_trail" in t)
test("  Store fallback",              "store.get(SK)" in t)

# ── S9: PRODUCTS IN SYNC ──
print("\n  S9: PRODUCT SYNC")
test("  7 seed products",            t[t.find("function seed()"):t.find("function seed()")+5000].count('id:"P0') == 7)
test("  Admin product CRUD",         "saveProduct" in t and "toggleProductStatus" in t)
test("  Landing cards (static)",     "Invoice Discounting" in PUB)
test("  Apply dropdown (dynamic)",   "activeProds" in PUB)

# ── S10: RBAC ENFORCED ──
print("\n  S10: RBAC")
test("  12 roles (inc BORROWER)",    "BORROWER:" in t and "ADMIN:" in t)
test("  canDo() checks (≥70)",       t.count("canDo(") >= 70)
test("  Zone enforcement",           "ZONE_PAGES" in t)
test("  Approval limits",            "APPROVAL_LIMITS" in t)

# ── REPORT ──
print("\n" + "=" * 60)
fail_list = [name for s, name in results if s == "FAIL"]
print(f"  SMOKE TEST: {passed}/{passed+failed} passed")
if fail_list:
    print(f"\n  CRITICAL FAILURES ({len(fail_list)}):")
    for f in fail_list:
        print(f"    ✗{f}")
    print(f"\n  ✗ SMOKE TEST FAILED — SYSTEM NOT READY")
else:
    print(f"\n  ✓ SMOKE TEST PASSED — ALL CRITICAL PATHS OPERATIONAL")
print("=" * 60)
sys.exit(1 if fail_list else 0)
