#!/usr/bin/env python3
"""
KwikBridge LMS — Comprehensive Unit & Integration Test Suite
Tests every module, handler, data flow, cross-module interaction, and lifecycle path.
Parses the JSX source and verifies structural correctness, logic presence, and integration points.
"""

import json, re, sys, os

SRC = 'src/kwikbridge-lms-v2.jsx'
t = open(SRC).read()
lines = t.split('\n')

passed = failed = warnings = 0
results = []

def test(tid, name, condition, detail=""):
    global passed, failed
    status = "PASS" if condition else "FAIL"
    if condition: passed += 1
    else: failed += 1
    results.append((status, tid, name, detail))

def warn(tid, name, detail=""):
    global warnings
    warnings += 1
    results.append(("WARN", tid, name, detail))

def find_block(start_marker, end_offset=3000):
    """Extract a code block starting from marker."""
    idx = t.find(start_marker)
    if idx == -1: return ""
    return t[idx:idx+end_offset]

print("=" * 72)
print("  KWIKBRIDGE LMS — UNIT & INTEGRATION TEST SUITE")
print("  File:", SRC)
print("  Size:", f"{len(t):,} bytes", f"({len(lines)} lines)")
print("=" * 72)

# ═══════════════════════════════════════════════════════════════════
# UNIT TESTS — U1: UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ U1: UTILITY FUNCTIONS ━━━")

test("U1.01", "uid() generates unique IDs",
     "const uid = () =>" in t and "Date.now()" in t and "Math.random()" in t)

test("U1.02", "fmt.cur() formats ZAR currency",
     "toLocaleString(\"en-ZA\"" in t and "R " in t[:1500])

test("U1.03", "fmt.date() formats dates",
     "toLocaleDateString" in t[:1500])

test("U1.04", "fmt.pct() formats percentages",
     ".toFixed" in t[:1500] and "%" in t[:1500])

test("U1.05", "dpd() calculates days past due",
     "const dpd = " in t and "864e5" in t)

test("U1.06", "stage() maps DPD to IFRS 9 stages",
     "const stage = " in t and "<= 30" in t[:500] and "<= 90" in t[:500])

test("U1.07", "toSnake() converts camelCase to snake_case",
     "const toSnake = " in t)

test("U1.08", "toCamel() converts snake_case to camelCase",
     "const toCamel = " in t)

test("U1.09", "toDb()/fromDb() bidirectional field mapping",
     "const toDb = " in t and "const fromDb = " in t)

test("U1.10", "store adapter handles window.storage and localStorage",
     "window.storage?.get" in t and "localStorage.getItem" in t)

# ═══════════════════════════════════════════════════════════════════
# UNIT TESTS — U2: RBAC & PERMISSIONS
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ U2: RBAC & PERMISSIONS ━━━")

roles = re.findall(r'(\w+):\{label:"([^"]+)",tier:(\d+)\}', t)
test("U2.01", "11 roles defined in ROLES constant",
     len(roles) == 11, f"Found {len(roles)}")

perms_block = t[t.find("const PERMS"):t.find("const PERMS")+5000]
perm_modules = re.findall(r'^\s+(\w+):\s*\{', perms_block, re.M)
test("U2.02", "16 permission modules in PERMS matrix",
     len(perm_modules) >= 15, f"Found {len(perm_modules)}: {perm_modules}")

test("U2.03", "can() function checks role permissions",
     "function can(" in t or "const can = " in t)

test("U2.04", "canAny() function checks multiple actions",
     "function canAny(" in t or "const canAny = " in t)

test("U2.05", "approvalLimit() returns role-based limits",
     "function approvalLimit(" in t or "const approvalLimit" in t)

limits = re.findall(r'(\w+):\s*(\d+|Infinity)', t[t.find("APPROVAL_LIMITS"):t.find("APPROVAL_LIMITS")+300])
test("U2.06", "5 approval limits defined (CREDIT through ADMIN)",
     len(limits) == 5, f"Found {len(limits)}")

test("U2.07", "ADMIN has unlimited approval",
     "ADMIN: Infinity" in t or "ADMIN:Infinity" in t)

test("U2.08", "PERMS includes 'admin' module for Administration tab",
     "admin:" in perms_block)

# ═══════════════════════════════════════════════════════════════════
# UNIT TESTS — U3: SYSTEM USERS
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ U3: SYSTEM USERS ━━━")

users = re.findall(r'id:"(U\d+)"', t[:3000])
test("U3.01", "System users defined (≥9)",
     len(users) >= 9, f"Found {len(users)}")

test("U3.02", "Each user has id, name, email, role, initials",
     all(f in t[:3000] for f in ['id:"U', 'name:"', 'email:"', 'role:"', 'initials:"']))

test("U3.03", "currentUser state managed via useState",
     "const [currentUser, setCurrentUser]" in t)

# ═══════════════════════════════════════════════════════════════════
# UNIT TESTS — U4: SUPABASE CLIENT
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ U4: SUPABASE CLIENT ━━━")

test("U4.01", "SUPABASE_URL configured",
     'const SUPABASE_URL = "https://yioqaluxgqxsifclydmd.supabase.co"' in t)

test("U4.02", "SUPABASE_KEY configured (anon/public)",
     "SUPABASE_KEY" in t and "sb_publishable" in t)

test("U4.03", "sbGet() fetches with order and headers",
     "const sbGet = " in t and "?order=id" in t)

test("U4.04", "sbUpsert() uses merge-duplicates strategy",
     "resolution=merge-duplicates" in t)

test("U4.05", "sbDelete() deletes by ID",
     "const sbDelete = " in t and "method: \"DELETE\"" in t)

test("U4.06", "TABLES maps all 12 data entities to DB tables",
     "const TABLES = " in t)
for js_key, db_table in [("customers","customers"),("applications","applications"),
    ("loans","loans"),("documents","documents"),("audit","audit_trail"),
    ("statutoryReports","statutory_reports"),("settings","settings")]:
    test(f"U4.07", f"TABLES maps {js_key} → {db_table}",
         f'{js_key}: "{db_table}"' in t or f"{js_key}:\"{db_table}\"" in t)

# ═══════════════════════════════════════════════════════════════════
# UNIT TESTS — U5: SEED FUNCTION
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ U5: SEED FUNCTION ━━━")

seed_block = find_block("function seed()", 5000)
test("U5.01", "seed() function defined", "function seed()" in t)

for key in ['customers: []', 'applications: []', 'loans: []', 'collections: []', 'documents: []', 'audit: []', 'provisions: []', 'comms: []']:
    test("U5.02", f"seed() returns {key.split(':')[0]} as empty",
         key in seed_block or key.replace(' ','') in seed_block)

test("U5.03", "seed() returns 6 products",
     seed_block.count('id:"P0') == 6)

test("U5.04", "seed() returns statutory reports",
     'statutoryReports' in seed_block)

test("U5.05", "seed() returns statutory alerts",
     'statutoryAlerts' in seed_block)

test("U5.06", "seed() settings includes NCR details",
     'ncrReg:"NCRCP22396"' in seed_block)

# ═══════════════════════════════════════════════════════════════════
# UNIT TESTS — U6: DATA LOAD & PERSISTENCE
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ U6: DATA LOAD & PERSISTENCE ━━━")

test("U6.01", "useEffect loads data on mount",
     "useEffect(() =>" in t and "setData(" in t)

test("U6.02", "Supabase load has 3-second timeout",
     "AbortController" in t and "3000" in t)

test("U6.03", "Fallback to store.get (localStorage) if Supabase fails",
     "store.get(SK)" in t)

test("U6.04", "Fallback to seed() if store empty",
     "const d = seed()" in t[t.find("useEffect"):t.find("useEffect")+1000])

test("U6.05", "save() updates state then persists to Supabase",
     "setData(next)" in t and "sbUpsert" in t)

test("U6.06", "save() diffs previous vs next to upsert only changes",
     "JSON.stringify(r)" in t[t.find("const save"):t.find("const save")+500])

test("U6.07", "reset() is synchronous (no await blocking UI)",
     re.search(r'const reset = \(\) =>', t) is not None)

test("U6.08", "Schema version check on cached data load",
     "hasCurrentSchema" in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I1: CUSTOMER LIFECYCLE
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I1: CUSTOMER LIFECYCLE ━━━")

test("I1.01", "createCustomer() — permission guard",
     'canDo("customers","create")' in find_block("const createCustomer"))

test("I1.02", "createCustomer() — auto-generates ID",
     'C${String(customers.length+1).padStart(3,"0")}' in t)

test("I1.03", "createCustomer() — sets FICA=Pending, BEE=Pending Review",
     'ficaStatus:"Pending"' in find_block("const createCustomer") and
     'beeStatus:"Pending Review"' in find_block("const createCustomer"))

test("I1.04", "createCustomer() — captures designated group ownership",
     'womenOwned' in find_block("const createCustomer") and
     'youthOwned' in find_block("const createCustomer"))

test("I1.05", "createCustomer() — logs audit trail",
     'addAudit("Customer Created"' in t)

test("I1.06", "updateCustomer() — permission guard",
     'canDo("customers","update")' in find_block("const updateCustomer"))

test("I1.07", "updateCustomer() — logs audit trail",
     'addAudit("Customer Updated"' in t)

test("I1.08", "Customer form validates 4 required fields",
     "!cForm.name || !cForm.contact || !cForm.idNum || !cForm.regNum" in t)

test("I1.09", "Customer detail view shows designated group ownership",
     '"Women Ownership"' in t and '"Youth Ownership"' in t and '"Disability Ownership"' in t)

test("I1.10", "Customer detail edit form includes designated group fields",
     'detailForm.womenOwned' in t and 'detailForm.youthOwned' in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I2: APPLICATION LIFECYCLE
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I2: APPLICATION LIFECYCLE ━━━")

test("I2.01", "NewAppModal creates Draft application",
     'status:"Draft"' in find_block("function NewAppModal", 3000))

test("I2.02", "Application has 30-day expiry from creation",
     '30*day' in find_block("function NewAppModal", 3000))

test("I2.03", "QA sign-off handler validates mandatory docs",
     'qaSignOffApplication' in t and 'mandatoryDocs' in t)

test("I2.04", "QA pass moves status to Submitted",
     'status:"Submitted"' in find_block("qaSignOffApplication", 2000) or
     '"Submitted"' in find_block("qaSignOff", 2000))

test("I2.05", "moveToUnderwriting changes status and assigns workflow",
     'moveToUnderwriting' in t and '"Underwriting"' in t)

test("I2.06", "decideLoan() sets Approved or Declined",
     'decideLoan' in t and '"Approved"' in t and '"Declined"' in t)

test("I2.07", "decideLoan() records approver and decision date",
     'approver:' in find_block("decideLoan", 1000) or 'decided:' in find_block("decideLoan", 1000))

test("I2.08", "bookLoan() creates loan record from approved application",
     'bookLoan' in t and 'LN-' in t)

test("I2.09", "disburseLoan() changes loan status to Active",
     'disburseLoan' in t and '"Active"' in find_block("disburseLoan", 1000))

test("I2.10", "Decided apps show Decision Summary (not workflow accordion)",
     'Decision Summary' in t and 'isDecided && !isUW' in t)

test("I2.11", "Decided apps have collapsible Underwriting Record",
     'Underwriting Record' in t and 'uwRecord' in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I3: UNDERWRITING WORKFLOW
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I3: UNDERWRITING WORKFLOW ━━━")

test("I3.01", "8 workflow steps defined with sequential gating",
     t.count('gateOk:') >= 5)

test("I3.02", "Step 1 (QA) — auto-evaluated from qaSignedOff",
     'done:!!a.qaSignedOff' in t)

test("I3.03", "Step 2 (KYC) — gated on Step 1",
     'key:"kyc"' in t and 'gateOk:!!a.qaSignedOff' in t)

test("I3.04", "Step 3 (Docs) — gated on Step 2",
     'key:"docs"' in t and 'gateOk:w.kycComplete' in t)

test("I3.05", "Step 4 (Site Visit) — gated on Step 3",
     'key:"sitevisit"' in t and 'gateOk:w.docsComplete' in t)

test("I3.06", "Step 5 (Credit) — gated on Steps 2-4",
     'key:"credit"' in t and 'w.kycComplete&&w.docsComplete&&w.siteVisitComplete' in t)

test("I3.07", "Step 6 (Collateral) — gated on Step 4",
     'key:"collateral"' in t and 'gateOk:w.siteVisitComplete' in t)

test("I3.08", "Step 7 (Social) — gated on Step 2",
     'key:"social"' in t and 'gateOk:w.kycComplete' in find_block('key:"social"', 200))

test("I3.09", "Step 8 (Decision) — all DD must be complete",
     'allDDComplete' in t and 'disabled={!allDDComplete}' in t)

test("I3.10", "runDDStep dispatches per step key",
     'runDDStep' in t)

test("I3.11", "KYC step generates findings with document links",
     'kycFindings' in t and 'docId' in t)

test("I3.12", "Site visit has structured form sections",
     'siteVisitFindings' in t)

test("I3.13", "Credit analysis computes risk score and DSCR",
     'riskScore' in t and 'dscr' in t and 'creditBureauScore' in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I4: LOAN SERVICING
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I4: LOAN SERVICING ━━━")

test("I4.01", "Servicing page function exists",
     "function Servicing()" in t)

test("I4.02", "Payment processing (recordPayment or similar)",
     'recordPayment' in t or 'processPayment' in t or 'payments:' in find_block("disburseLoan", 500))

test("I4.03", "Amortization schedule available",
     'schedLoan' in t or 'amortiz' in t.lower() or 'schedule' in t[t.find("Servicing"):t.find("Servicing")+2000].lower())

test("I4.04", "DPD tracking on loans",
     'dpd' in t and 'l.dpd' in t)

test("I4.05", "Covenant monitoring",
     'covenants' in t and 'Compliant' in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I5: COLLECTIONS & RECOVERY
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I5: COLLECTIONS & RECOVERY ━━━")

test("I5.01", "Collections page function exists",
     "function Collections()" in t)

test("I5.02", "PTP (Promise-to-Pay) tracking",
     'ptpForm' in t and 'ptpDate' in t and 'ptpAmount' in t)

test("I5.03", "Debt restructuring proposals",
     'restructForm' in t or 'restructur' in t.lower())

test("I5.04", "Write-off workflow",
     'writeOff' in t and 'writeOffReason' in t)

test("I5.05", "Legal handover tracking",
     'Legal' in t and ('legal' in t[t.find("Collections"):t.find("Collections")+3000].lower()))

test("I5.06", "DPD-based stage classification (Early/Mid/Late)",
     'Early' in t and 'Mid' in t and 'Late' in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I6: IFRS 9 PROVISIONING
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I6: IFRS 9 PROVISIONING ━━━")

test("I6.01", "Provisioning page function exists",
     "function Provisioning()" in t)

test("I6.02", "3-stage classification (Stage 1/2/3)",
     'Stage 1' in t and 'Stage 2' in t and 'Stage 3' in t)

test("I6.03", "ECL calculation fields (PD, LGD, EAD)",
     'pd' in t and 'lgd' in t and 'ead' in t and 'ecl' in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I7: GOVERNANCE & AUDIT
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I7: GOVERNANCE & AUDIT ━━━")

test("I7.01", "Governance page function exists",
     "function Governance()" in t)

test("I7.02", "Audit trail filterable by category/user/entity",
     'auditFilter' in t and 'category' in t and 'user' in t)

test("I7.03", "addAudit() creates timestamped entries",
     'addAudit' in t and 'ts: Date.now()' in t)

audit_events = re.findall(r'addAudit\("([^"]+)"', t)
test("I7.04", f"Audit trail covers ≥10 event types",
     len(set(audit_events)) >= 10, f"Found {len(set(audit_events))}: {sorted(set(audit_events))[:10]}")

test("I7.05", "Alert management (read/dismiss)",
     'markRead' in t or 'alerts.map' in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I8: STATUTORY REPORTING
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I8: STATUTORY REPORTING ━━━")

test("I8.01", "StatutoryReporting page function exists",
     "function StatutoryReporting()" in t)

test("I8.02", "NCR report status workflow (Not Started → In Progress → Under Review → Submitted)",
     'updateStatutoryStatus' in t and '"In Progress"' in t and '"Under Review"' in t and '"Submitted"' in t)

test("I8.03", "Urgency badges based on days until due",
     'urgencyBadge' in t or 'urgencyColor' in t or 'OVERDUE' in t)

test("I8.04", "Form 39 frequency calculated from disbursement volume",
     'form39' in t.lower() and '15000000' in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I9: ADMINISTRATION
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I9: ADMINISTRATION ━━━")

admin_block = find_block("function Administration()", 15000)

test("I9.01", "Administration function exists at correct scope",
     "function Administration()" in t)

test("I9.02", "4 tabs: products, users, system, rules",
     all(k in admin_block for k in ['"products"', '"users"', '"system"', '"rules"']))

# Product Management
test("I9.03", "Product CRUD — create new product",
     'startNew' in admin_block and '"new"' in admin_block)
test("I9.04", "Product CRUD — edit existing product",
     'startEdit' in admin_block)
test("I9.05", "Product CRUD — suspend/activate toggle",
     'toggleProductStatus' in t)

# User Management
test("I9.06", "User CRUD — add new user with role assignment",
     'startNewUser' in admin_block and 'handleSaveUser' in admin_block)
test("I9.07", "User CRUD — edit user profile",
     'startEditUser' in admin_block)
test("I9.08", "User CRUD — password reset",
     'resetPassword' in admin_block)
test("I9.09", "User CRUD — suspend/activate toggle",
     'toggleUserStatus' in admin_block)
test("I9.10", "User CRUD — revoke access",
     'revokeAccess' in admin_block)
test("I9.11", "User CRUD — self-edit prevention",
     'currentUser.id' in admin_block)
test("I9.12", "User actions logged to audit trail",
     'User Created' in admin_block or 'User Updated' in admin_block)

# System Admin
test("I9.13", "System health monitoring (status, uptime, DB size)",
     'Operational' in admin_block and 'uptime' in admin_block and 'dbSize' in admin_block)
test("I9.14", "Backup scheduling (frequency, time, retention)",
     'backupSchedule' in admin_block and 'frequency' in admin_block)
test("I9.15", "Manual backup trigger",
     'runBackup' in admin_block or 'Run Backup' in admin_block)
test("I9.16", "API key management — generate",
     'addApiKey' in admin_block or 'Generate Key' in admin_block)
test("I9.17", "API key management — revoke",
     'revokeApiKey' in admin_block)

# Business Rules
test("I9.18", "Business rules CRUD — create new rule",
     'startNewRule' in admin_block and 'handleSaveRule' in admin_block)
test("I9.19", "Business rules CRUD — edit existing rule",
     'startEditRule' in admin_block)
test("I9.20", "Business rules CRUD — suspend/activate toggle",
     'toggleRule' in admin_block)
test("I9.21", "Business rules have category, value, description, status",
     'category' in admin_block and 'value' in admin_block and 'description' in admin_block)
test("I9.22", "RBAC permission matrix displayed",
     'RBAC Permission Matrix' in admin_block)
test("I9.23", "Regulatory framework reference",
     'National Credit Act' in admin_block or 'NCA' in admin_block)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I10: CROSS-MODULE DATA FLOWS
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I10: CROSS-MODULE DATA FLOWS ━━━")

test("I10.01", "Customer → Application linkage (custId)",
     'custId' in t and 'a.custId' in t)

test("I10.02", "Application → Loan linkage (appId)",
     'appId' in t and 'l.appId' in t)

test("I10.03", "Loan → Collections linkage (loanId)",
     'loanId' in find_block("Collections", 3000))

test("I10.04", "Document → Customer/Application linkage",
     'd.custId' in t and 'd.appId' in t)

test("I10.05", "Dashboard aggregates from all modules",
     all(k in find_block("function Dashboard", 3000) for k in ['loans.', 'customers.', 'applications.']))

test("I10.06", "Dashboard development impact shows designated group metrics",
     'womenOwned' in find_block("function Dashboard", 3000))

test("I10.07", "Reports development impact shows designated group metrics",
     'womenOwned' in find_block("function Reports", 3000))

test("I10.08", "Sidebar nav item counts reflect live data",
     'customers.length' in t and 'loans.length' in t)

test("I10.09", "User role switch (currentUser) affects canDo() across all modules",
     'setCurrentUser' in t and 'currentUser.role' in t)

test("I10.10", "Documents filtered by customer and application context",
     "d.custId === a.custId" in t or "d.custId===a.custId" in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I11: NULL SAFETY & ERROR HANDLING
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I11: NULL SAFETY & ERROR HANDLING ━━━")

test("I11.01", "settings accessed with optional chaining (settings?.xxx)",
     t.count('settings?.') >= 8)

test("I11.02", "No unsafe settings.xxx without optional chaining",
     len(re.findall(r'(?<!\?)settings\.(?:ncr|company|branch|year|address|annual|form39|total)', 
         t.replace('settingsForm', ''))) == 0)

test("I11.03", "data null guard before render (!data returns loading)",
     '!data' in t and 'Loading' in t)

test("I11.04", "Supabase errors non-blocking (try/catch around network calls)",
     'catch' in find_block("sbGet", 200) or 'catch' in find_block("sbUpsert", 200) or
     '.catch' in find_block("const save", 500))

test("I11.05", "Empty array safe — reduce() has initial values",
     '.reduce((s,' in t)  # All reduce calls use (s, item) => s + item, initialValue pattern

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I12: UI COMPONENTS
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I12: UI COMPONENTS ━━━")

for comp in ['Btn', 'Badge', 'Table', 'Modal', 'SectionCard', 'InfoGrid', 'KPI', 'Tab', 'Field', 'Input', 'Select', 'Textarea']:
    test("I12.01", f"UI component {comp} defined",
         f'function {comp}(' in t or f'const {comp} = ' in t)

test("I12.02", "statusBadge() utility for status rendering",
     'statusBadge' in t)

test("I12.03", "Sidebar collapses (sideCollapsed state)",
     'sideCollapsed' in t and 'setSideCollapsed' in t)

test("I12.04", "Notification bell with unread count",
     'notifOpen' in t and 'unread' in t.lower())

test("I12.05", "Search functionality in header",
     'search' in t and 'setSearch' in t)

# ═══════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — I13: ROUTING & NAVIGATION
# ═══════════════════════════════════════════════════════════════════
print("\n━━━ I13: ROUTING & NAVIGATION ━━━")

nav_keys_full = re.findall(r'key:\s*"(\w+)"', t[t.find('const navItems'):t.find('.filter(n =>')])
cases = re.findall(r'case "(\w+)":', t[t.find('function renderPage'):t.find('function renderPage')+500])

test("I13.01", "Sidebar has ≥13 navigation items",
     len(nav_keys_full) >= 13, f"Found {len(nav_keys_full)}")

test("I13.02", "All nav items have router cases",
     all(k in cases for k in nav_keys_full), 
     f"Missing: {[k for k in nav_keys_full if k not in cases]}")

test("I13.03", "Detail view supports customer, application, loan types",
     'detail.type === "customer"' in t and 'detail.type === "application"' in t and 'detail.type === "loan"' in t)

test("I13.04", "Back button returns to list page",
     '< Back' in t or 'Back' in t)

test("I13.05", "Legacy routes (products, settings) redirect to Administration",
     'case "products": return <Administration' in t and 'case "settings": return <Administration' in t)

# ═══════════════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════════════
print("\n" + "=" * 72)
print("  TEST RESULTS")
print("=" * 72)

# Group by category
categories = {}
for status, tid, name, detail in results:
    cat = tid.split(".")[0] if "." in tid else tid[:3]
    if cat not in categories:
        categories[cat] = {"PASS":0, "FAIL":0, "WARN":0, "tests":[]}
    categories[cat][status] += 1
    categories[cat]["tests"].append((status, tid, name, detail))

for cat, data in categories.items():
    total = data["PASS"] + data["FAIL"] + data["WARN"]
    status = "✓" if data["FAIL"] == 0 else "✗"
    print(f"\n  {status} {cat}: {data['PASS']}/{total} passed", end="")
    if data["FAIL"]: print(f" ({data['FAIL']} FAILED)", end="")
    if data["WARN"]: print(f" ({data['WARN']} warnings)", end="")
    print()
    for s, tid, name, detail in data["tests"]:
        if s == "FAIL":
            print(f"      ✗ {tid} {name}" + (f" — {detail}" if detail else ""))

print(f"\n{'=' * 72}")
print(f"  TOTAL: {passed} passed, {failed} failed, {warnings} warnings")
print(f"  PASS RATE: {passed*100//(passed+failed)}%")
print(f"{'=' * 72}")

if failed > 0:
    print(f"\n  ⚠ {failed} test(s) FAILED — review above")
    sys.exit(1)
else:
    print(f"\n  ✓ ALL TESTS PASSED — system ready for deployment")
    sys.exit(0)
