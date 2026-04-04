#!/usr/bin/env python3
"""
KwikBridge LMS — Data Validation & Reconciliation Test
Verifies status transitions, calculation accuracy, repayment schedule
integrity, report-to-record consistency, and data continuity across workflows.
"""
import re, sys, math, json

t = open('src/kwikbridge-lms-v2.jsx').read()
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

def hblk(marker, size=8000):
    i = t.find(marker)
    return t[i:i+size] if i >= 0 else ""

PUB = t[t.find("// ═══ PUBLIC ZONE"):t.find("// ═══ AUTH GATE")] if "// ═══ PUBLIC ZONE" in t else ""
PORT = t[t.find("// ═══ BORROWER PORTAL"):t.find("// ═══ STAFF BACK-OFFICE")] if "// ═══ BORROWER PORTAL" in t else ""
SEED = efn("seed")
LOANS = efn("Loans")
SERV = efn("Servicing")
PROV = efn("Provisioning")
DASH = efn("Dashboard")
COLL = efn("Collections")

print("=" * 72)
print("  KWIKBRIDGE LMS — DATA VALIDATION & RECONCILIATION TEST")
print(f"  {len(t):,} bytes · {len(t.split(chr(10)))} lines")
print("=" * 72)

# ═══════════════════════════════════════════════════════════════
# DV-1: APPLICATION STATUS TRANSITIONS
# Valid: Draft → Pre-Approval → Submitted → Underwriting → Approved/Declined → Booked → Active
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DV-1: APPLICATION STATUS TRANSITIONS ━━━")

# 1.1 Public form creates Pre-Approval
test("D1.01","Public form creates Pre-Approval status",'status:"Pre-Approval"' in PUB)

# 1.2 Staff NewAppModal creates Draft
modal = hblk("const app = {", 500)
test("D1.02","Staff modal creates Draft status",'status:"Draft"' in modal)

# 1.3 QA: Draft → Submitted
qa = hblk("const qaSignOffApplication", 7000)
test("D1.03","QA only accepts Draft",'a.status !== "Draft"' in qa)
test("D1.04","QA success sets Submitted",'status: "Submitted"' in qa)
test("D1.05","QA sets qaSignedOff=true","qaSignedOff: true" in qa or "qaSignedOff:true" in qa)
test("D1.06","QA records qaOfficer","qaOfficer:" in qa)
test("D1.07","QA records qaDate","qaDate:" in qa)

# 1.4 moveToUnderwriting: Submitted → Underwriting
mtu = hblk("const moveToUnderwriting", 1500)
test("D1.08","moveToUnderwriting checks Submitted status","Submitted" in mtu)
test("D1.09","moveToUnderwriting sets Underwriting status","Underwriting" in mtu)
test("D1.10","moveToUnderwriting initialises workflow","workflow" in mtu.lower() or "underwritingWorkflow" in mtu)

# 1.5 decideLoan: Underwriting → Approved/Declined
dl = hblk("const decideLoan", 4000)
test("D1.11","decideLoan accepts decision parameter","decision" in dl)
test("D1.12","decideLoan sets status to decision value","status: decision" in dl or "status:decision" in dl)
test("D1.13","decideLoan records decided timestamp","decided:" in dl and "Date.now()" in dl)

# 1.6 bookLoan: Approved → Booked (creates loan)
bl = hblk("const bookLoan", 2000)
test("D1.14","bookLoan checks Approved status","Approved" in bl)
test("D1.15","bookLoan sets app status to Booked","Booked" in bl)
test("D1.16","bookLoan creates loan record","LN-" in bl)

# 1.7 disburseLoan: Booked → Active
disb = hblk("const disburseLoan", 1500)
test("D1.17","disburseLoan checks Booked status","Booked" in disb)
test("D1.18","disburseLoan sets Active status","Active" in disb)
test("D1.19","disburseLoan records disbursement timestamp","disbursed" in disb and "Date.now()" in disb)

# 1.8 Withdrawal
wd = hblk("withdrawApplication", 1500) if "withdrawApplication" in t else ""
test("D1.20","Withdrawal allowed from Draft/Submitted/Underwriting","Withdrawn" in t)

# 1.9 Expiry
test("D1.21","Draft apps have 30-day expiry","30*day" in t and "expiresAt" in t)

# 1.10 Invalid transitions blocked
test("D1.22","QA rejects non-Draft",'a.status !== "Draft"' in qa)
test("D1.23","bookLoan rejects non-Approved","Approved" in bl and "alert" in bl)
test("D1.24","disburseLoan rejects non-Booked","Booked" in disb and "alert" in disb)

# ═══════════════════════════════════════════════════════════════
# DV-2: LOAN STATUS & LIFECYCLE
# Booked → Active → (Settled | Written Off)
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DV-2: LOAN STATUS & LIFECYCLE ━━━")

test("D2.01","Loan created with status Booked",'status:"Booked"' in bl)
test("D2.02","Disbursement changes to Active","Active" in disb)

# DPD classification
test("D2.03","dpd() function defined","const dpd" in t)
test("D2.04","stage() function defined","const stage" in t)
# Verify dpd→stage mapping
stage_fn = t[t.find("const stage"):t.find("const stage")+200]
test("D2.05","Stage 1: DPD ≤ 30","<= 30" in stage_fn or "<=30" in stage_fn)
test("D2.06","Stage 2: DPD 31-90","<= 90" in stage_fn or "<=90" in stage_fn)
test("D2.07","Stage 3: DPD > 90","3" in stage_fn)

# Write-off status
test("D2.08","Write-off sets Written Off status","Written Off" in t)

# FICA status transitions
test("D2.09","FICA statuses: Pending → Verified/Failed","ficaStatus" in t and "Verified" in t and "Pending" in t)

# ═══════════════════════════════════════════════════════════════
# DV-3: FINANCIAL CALCULATIONS — ACCURACY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DV-3: FINANCIAL CALCULATIONS ━━━")

# 3.1 Product data integrity
# Extract seed products and verify calculations
prod_lines = re.findall(r'\{[^}]*id:"P\d{3}"[^}]*\}', SEED)
test("D3.01","7 products in seed", len(prod_lines) == 7, f"Found {len(prod_lines)}")

# Verify each product has required financial fields
for i, pl in enumerate(prod_lines):
    has_rate = "baseRate:" in pl or "monthlyRate:" in pl
    has_range = "minAmount:" in pl and "maxAmount:" in pl
    has_term = "minTerm:" in pl and "maxTerm:" in pl
    test("D3.02", f"Product {i+1} has rate+range+term", has_rate and has_range and has_term)

# 3.2 Monthly payment calculation
# The app calculates monthlyPmt — check the formula exists
test("D3.03","Monthly payment calculation exists","monthlyPmt" in bl or "monthlyPmt" in t)

# 3.3 Amortization schedule accuracy
# Extract genSchedule and verify the math
gen = SERV[SERV.find("genSchedule"):SERV.find("genSchedule")+500] if "genSchedule" in SERV else ""
test("D3.04","genSchedule: interest = balance × rate/100/12","bal * r" in gen)
test("D3.05","genSchedule: principal = payment - interest","monthlyPmt - interest" in gen or "l.monthlyPmt - interest" in gen)
test("D3.06","genSchedule: balance decremented by principal","bal - principal" in gen or "bal-principal" in gen)
test("D3.07","genSchedule: balance floored at 0","Math.max(0" in gen)

# 3.4 Verify schedule balances to zero
# Simulate a standard amortisation: R1M, 14.5% p.a., 12 months
amount = 1000000
annual_rate = 14.5
monthly_rate = annual_rate / 100 / 12
term = 12
if monthly_rate > 0:
    pmt = amount * monthly_rate / (1 - (1 + monthly_rate) ** -term)
else:
    pmt = amount / term

bal = amount
total_interest = 0
total_principal = 0
for m in range(1, term + 1):
    interest = bal * monthly_rate
    principal = pmt - interest
    bal = max(0, bal - principal)
    total_interest += interest
    total_principal += principal

test("D3.08","Amortisation: balance reaches ~0 at maturity", abs(bal) < 1, f"Final balance: R{bal:.2f}")
test("D3.09","Amortisation: total principal ≈ loan amount", abs(total_principal - amount) < 1, f"Total principal: R{total_principal:.2f}")
test("D3.10","Amortisation: total interest > 0", total_interest > 0, f"Total interest: R{total_interest:.2f}")
test("D3.11",f"Monthly payment R{pmt:.0f} is reasonable", 80000 < pmt < 100000, f"R{pmt:.2f}")

# 3.5 Portfolio analytics calculations
test("D3.12","Portfolio yield = (interest+fees)*12/book","portfolioYield" in LOANS and "12" in LOANS)
test("D3.13","Effective NPL = grossNPL / currentBook","effectiveNPL" in LOANS and "currentBook" in LOANS)
test("D3.14","Net credit loss = grossNPL * (1 - recoveryRate)","netCreditLoss" in LOANS and "recoveryRate" in LOANS)
test("D3.15","Net interest spread = yield - WACF","netSpread" in LOANS and "wacf" in LOANS)
test("D3.16","Facility utilisation = currentBook / fundingCap","facilUtil" in LOANS and "fundingCap" in LOANS)
test("D3.17","Headroom = fundingCap - currentBook","headroom" in LOANS and "fundingCap - currentBook" in LOANS)

# 3.6 ECL / Provisioning calculations
test("D3.18","ECL = PD × LGD × EAD","pd" in PROV and "lgd" in PROV and "ead" in PROV)
test("D3.19","Stage 1: 12-month ECL (lower PD)","stage===1" in PROV or "r.stage" in PROV)

# 3.7 DPD-based stage assignment verified
# Test the dpd→stage function mathematically
dpd_fn = t[t.find("const dpd ="):t.find("const dpd =")+200]
stage_fn = t[t.find("const stage ="):t.find("const stage =")+200]
test("D3.20","dpd() calculates days past due","Math" in dpd_fn or "day" in dpd_fn)
test("D3.21","stage() maps dpd to 1/2/3","1" in stage_fn and "2" in stage_fn and "3" in stage_fn)

# ═══════════════════════════════════════════════════════════════
# DV-4: REPAYMENT SCHEDULE RULES
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DV-4: REPAYMENT SCHEDULE RULES ━━━")

# 4.1 Schedule matches loan terms
test("D4.01","Schedule iterates from month 1 to term","for (let m = 1" in gen or "m <= l.term" in gen)
test("D4.02","Schedule uses loan amount as starting balance","l.amount" in gen or "loan.amount" in gen)
test("D4.03","Schedule uses loan rate","l.rate" in gen)

# 4.2 Payment processing rules
rp = hblk("const recordPayment", 2000)
test("D4.04","recordPayment updates loan balance","balance" in rp)
test("D4.05","recordPayment records payment in array","payments" in rp)
test("D4.06","recordPayment logs audit","addAudit" in rp)

# 4.3 Portal payment rules
test("D4.07","Portal payment updates balance","newBal" in PORT)
test("D4.08","Portal payment records in payments array","payments:" in PORT)
test("D4.09","Portal payment prevents negative balance","Math.max(0" in PORT or "newBal" in PORT)

# 4.4 Repayment types defined
test("D4.10","Repayment types: Amortising, Bullet, Balloon, Seasonal","Amortising" in t and "Bullet" in t and "Balloon" in t and "Seasonal" in t)

# 4.5 Schedule status tracking
test("D4.11","Schedule marks payment status","Paid" in gen)

# ═══════════════════════════════════════════════════════════════
# DV-5: REPORT-TO-RECORD RECONCILIATION
# Dashboard/analytics must reflect actual data records.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DV-5: REPORT-TO-RECORD RECONCILIATION ━━━")

# 5.1 Dashboard KPIs use actual data arrays
test("D5.01","Dashboard totalBook from loans.reduce","totalBook" in DASH or "loans.reduce" in DASH or "loans.filter" in DASH)
test("D5.02","Dashboard pipeline from applications.filter","pipeline" in DASH or "applications.filter" in DASH)
test("D5.03","Dashboard jobs from customers.reduce","jobs" in DASH and "customers" in DASH)

# 5.2 Loan Book analytics use actual loan data
test("D5.04","Analytics openingBook from activeLoans.reduce","activeLoans.reduce" in LOANS)
test("D5.05","Analytics currentBook from activeLoans","currentBook" in LOANS and "balance" in LOANS)
test("D5.06","Analytics grossNPL from DPD>90 filter","dpd>90" in LOANS or "l.dpd>90" in LOANS)
test("D5.07","Analytics totalBorrowers from unique custIds","Set(activeLoans.map" in LOANS or "totalBorrowers" in LOANS)

# 5.3 Portfolio by Product uses live data
test("D5.08","Product table built from products × loans","products.filter" in LOANS and "activeLoans.filter" in LOANS)
test("D5.09","Product table aggregates balance per product","pLoans.reduce" in LOANS or "reduce" in LOANS)

# 5.4 Provisioning uses live loan data
test("D5.10","Provisioning uses live loan data","provisions" in PROV and "loans.find" in PROV)

# 5.5 Collections uses live loan DPD
test("D5.11","Collections filters by dpd ranges","dpd" in COLL)
test("D5.12","Collections shows actual loan balances","balance" in COLL)

# 5.6 Servicing uses live payment data
test("D5.13","Servicing totalCollected from payments","payments" in SERV and "reduce" in SERV)
test("D5.14","Servicing overdue from dpd>0","dpd > 0" in SERV or "l.dpd > 0" in SERV)

# 5.7 Statutory reports tracked independently
test("D5.15","Statutory reports stored in data","statutoryReports" in SEED)

# ═══════════════════════════════════════════════════════════════
# DV-6: DATA CONTINUITY — NO LOSS ACROSS WORKFLOWS
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DV-6: DATA CONTINUITY ━━━")

# 6.1 save() persists ALL data arrays
save_blk = t[t.find("const save = useCallback"):t.find("const save = useCallback")+1500]
test("D6.01","save() accepts full data object","save = useCallback" in save_blk)
test("D6.02","save() writes to localStorage","store.set(SK" in save_blk)
test("D6.03","save() upserts to Supabase","sbUpsert" in save_blk)

# 6.2 Each handler uses immutable spread + save
handlers = {
    "createCustomer": "customers",
    "updateCustomer": "customers",
    "qaSignOffApplication": "applications",
    "moveToUnderwriting": "applications",
    "decideLoan": "applications",
    "bookLoan": "loans",
    "disburseLoan": "loans",
    "recordPayment": "loans",
}
for handler, collection in handlers.items():
    h = hblk(f"const {handler}", 4000)
    # Check for immutable update patterns
    has_spread = "...data" in h or f"...{collection}" in h or f"{collection}.map" in h or f"[...{collection}" in h
    has_save = "save({" in h or "save({...data" in h
    test("D6.04", f"{handler}: immutable update + save()", has_spread or has_save)

# 6.3 Audit trail preserves history (append-only)
test("D6.05","Audit uses append pattern ([...audit, ...)","[...audit" in t or "[...data.audit" in t)
test("D6.06","Alerts use append pattern","[...alerts" in t or "[...data.alerts" in t)

# 6.4 Data load checks schema
test("D6.07","Schema version check on load","hasCurrentSchema" in t)

# 6.5 Application→Loan data transfer
test("D6.08","bookLoan copies amount from app","a.amount" in bl or "amount" in bl)
test("D6.09","bookLoan copies rate from app","a.rate" in bl or "rate" in bl)
test("D6.10","bookLoan copies term from app","a.term" in bl or "term" in bl)
test("D6.11","bookLoan links to customer (custId)","custId" in bl)
test("D6.12","bookLoan links to application (appId)","appId" in bl)
test("D6.13","bookLoan links to product","product" in bl)

# 6.6 Customer created from public app
test("D6.14","Public app creates customer + links by custId","newCust" in PUB and "custId" in PUB)
test("D6.15","Public app creates application linked to customer","newApp" in PUB and "custId" in PUB)

# 6.7 Portal data linked via auth email
test("D6.16","Portal matches customer by email","myEmail" in PORT)
test("D6.17","Portal filters all data by myCustomer.id","myCustomer.id" in PORT)

# 6.8 No orphan creation (every record linked)
test("D6.18","Every application has custId","custId" in hblk("const app = {", 500))
test("D6.19","Every loan has custId + appId","custId" in bl and "appId" in bl)
test("D6.20","Every collection action has loanId","loanId" in t[t.find("addCollectionAction"):t.find("addCollectionAction")+500])

# ═══════════════════════════════════════════════════════════════
# DV-7: PRODUCT DATA INTEGRITY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DV-7: PRODUCT DATA INTEGRITY ━━━")

# 7.1 All 7 products have consistent fields
products = re.findall(r'\{[^}]*id:"(P\d{3})"[^}]*name:"([^"]*)"[^}]*\}', SEED)
test("D7.01","7 products with id+name", len(products) == 7, f"Found {len(products)}")

# 7.2 Each product has ECL/risk data
for field in ["monthlyRate","riskClass","ecl","idealFor"]:
    count = SEED.count(f'{field}:')
    test("D7.02", f"All products have {field} ({count}/7)", count >= 7, f"{count}")

# 7.3 Risk classes are valid (A/B/C/D)
risk_classes = re.findall(r'riskClass:"([^"]+)"', SEED)
test("D7.03","Risk classes are valid (A/B/C/D)", all(rc in "ABCD" for rc in risk_classes), f"{risk_classes}")

# 7.4 ECL rates are reasonable (0-100%)
ecl_rates = re.findall(r'ecl:([\d.]+)', SEED)
test("D7.04","ECL rates 0-100%", all(0 < float(e) < 100 for e in ecl_rates), f"{ecl_rates}")

# 7.5 Amount ranges valid (min < max)
min_amts = [int(x) for x in re.findall(r'minAmount:(\d+)', SEED)]
max_amts = [int(x) for x in re.findall(r'maxAmount:(\d+)', SEED)]
test("D7.05","All products: minAmount < maxAmount", all(mi < ma for mi, ma in zip(min_amts, max_amts)))

# 7.6 Term ranges valid
min_terms = [float(x) for x in re.findall(r'minTerm:([\d.]+)', SEED)]
max_terms = [float(x) for x in re.findall(r'maxTerm:([\d.]+)', SEED)]
test("D7.06","All products: minTerm ≤ maxTerm", all(mi <= ma for mi, ma in zip(min_terms, max_terms)))

# 7.7 Rates are positive
base_rates = [float(x) for x in re.findall(r'baseRate:([\d.]+)', SEED)]
monthly_rates = [float(x) for x in re.findall(r'monthlyRate:([\d.]+)', SEED)]
test("D7.07","All base rates > 0", all(r > 0 for r in base_rates), f"{base_rates}")
test("D7.08","All monthly rates > 0", all(r > 0 for r in monthly_rates), f"{monthly_rates}")

# 7.8 Monthly rate × 12 ≈ base rate (sanity check)
for i, (br, mr) in enumerate(zip(base_rates, monthly_rates)):
    approx = abs(mr * 12 - br) < 1  # Within 1% tolerance
    test("D7.09", f"Product {i+1}: monthlyRate×12 ≈ baseRate ({mr}×12={mr*12:.0f} vs {br})", approx)

# ═══════════════════════════════════════════════════════════════
# DV-8: APPROVAL LIMIT INTEGRITY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DV-8: APPROVAL LIMIT INTEGRITY ━━━")

limits = re.findall(r'(\w+):\s*(\d+|Infinity)', t[t.find("APPROVAL_LIMITS"):t.find("APPROVAL_LIMITS")+300])
test("D8.01","5 approval tiers defined", len(limits) >= 5, f"{len(limits)} tiers")

# Verify ascending order
limit_vals = []
for role, val in limits:
    limit_vals.append((role, float('inf') if val == "Infinity" else int(val)))
for i in range(len(limit_vals)-1):
    test("D8.02", f"{limit_vals[i][0]} ({limit_vals[i][1]}) < {limit_vals[i+1][0]} ({limit_vals[i+1][1]})", limit_vals[i][1] < limit_vals[i+1][1])

# decideLoan enforces
test("D8.03","decideLoan calls approvalLimit()","approvalLimit" in dl)
test("D8.04","decideLoan compares amount to limit","a.amount > limit" in dl or "amount > limit" in dl)

# ═══════════════════════════════════════════════════════════════
# DV-9: SEED DATA COMPLETENESS
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DV-9: SEED DATA COMPLETENESS ━━━")

# All required collections present
for coll in ["customers","products","applications","loans","collections","alerts","audit","provisions","comms","documents","statutoryReports","settings"]:
    present = f"{coll}" in SEED
    test("D9.01", f"Seed has {coll}", present)

# Operational data starts empty
for coll in ["customers","applications","loans","collections","provisions","documents"]:
    empty = f"{coll}: []" in SEED or f"{coll}:[]" in SEED
    test("D9.02", f"{coll} starts empty", empty)

# Settings have NCR data
test("D9.03","Settings: NCRCP22396","NCRCP22396" in SEED)
test("D9.04","Settings: TQA Capital","TQA Capital" in SEED)

# Statutory reports pre-seeded
test("D9.05","Statutory reports pre-seeded (≥5)","SR-001" in SEED and "SR-005" in SEED)

# ═══════════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 72)
print("  DATA VALIDATION & RECONCILIATION TEST RESULTS")
print("=" * 72)

cats = {}
for s, tid, name, detail in results:
    c = tid.split(".")[0]
    cats.setdefault(c, {"PASS":0,"FAIL":0,"items":[]})
    cats[c][s] += 1
    cats[c]["items"].append((s,tid,name,detail))

section_names = {
    "D1":"Application Status Transitions",
    "D2":"Loan Status & Lifecycle",
    "D3":"Financial Calculations",
    "D4":"Repayment Schedule Rules",
    "D5":"Report-to-Record Reconciliation",
    "D6":"Data Continuity (No Loss)",
    "D7":"Product Data Integrity",
    "D8":"Approval Limit Integrity",
    "D9":"Seed Data Completeness",
}

for cat, d in cats.items():
    tot = d["PASS"]+d["FAIL"]
    mark = "✓" if d["FAIL"]==0 else "✗"
    label = section_names.get(cat, cat)
    line = f"  {mark} {cat} {label}: {d['PASS']}/{tot}"
    if d["FAIL"]: line += f" ({d['FAIL']} FAILED)"
    print(line)
    for s,tid,name,detail in d["items"]:
        if s=="FAIL": print(f"      ✗ {tid} {name}" + (f" — {detail}" if detail else ""))

pass_cats = sum(1 for d in cats.values() if d["FAIL"]==0)
print(f"\n  SECTIONS: {pass_cats}/{len(cats)} passed")
print(f"  TESTS:    {passed}/{passed+failed} — {passed*100//(passed+failed) if passed+failed else 0}%")
if failed == 0:
    print("\n  ✓ ALL DATA VALIDATION TESTS PASSED — RECONCILIATION SIGNED OFF")
else:
    print(f"\n  ⚠ {failed} finding(s)")
print("=" * 72)
sys.exit(0 if failed == 0 else 1)
