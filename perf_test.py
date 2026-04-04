#!/usr/bin/env python3
"""
KwikBridge LMS — Performance & Load Test
Measures parse time, render complexity, data throughput, memory footprint,
concurrent user simulation, and scalability under load.
"""
import re, sys, time, json, os

SRC = 'src/kwikbridge-lms-v2.jsx'
t = open(SRC).read()
lines = t.split('\n')
file_size = os.path.getsize(SRC)
passed = failed = 0
results = []

def test(tid, name, cond, metric="", threshold=""):
    global passed, failed
    s = "PASS" if cond else "FAIL"
    if cond: passed += 1
    else: failed += 1
    results.append((s, tid, name, metric, threshold))

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

print("=" * 72)
print("  KWIKBRIDGE LMS — PERFORMANCE & LOAD TEST")
print(f"  {file_size:,} bytes · {len(lines)} lines")
print("=" * 72)

# ═══════════════════════════════════════════════════════════════
# P1: SOURCE PARSE & BUNDLE SIZE
# ═══════════════════════════════════════════════════════════════
print("\n━━━ P1: BUNDLE SIZE & PARSE COMPLEXITY ━━━")

# File size budget
test("P1.01","Source size < 500KB", file_size < 512000, f"{file_size/1024:.0f}KB", "<500KB")
test("P1.02","Source size < 400KB", file_size < 409600, f"{file_size/1024:.0f}KB", "<400KB")

# Line count
test("P1.03","Line count < 5000", len(lines) < 5000, f"{len(lines)}", "<5000")

# Parse time (Python regex as proxy for JS parse)
t0 = time.perf_counter()
for _ in range(10):
    _ = re.findall(r'function \w+\(', t)
    _ = re.findall(r'useState\(', t)
    _ = re.findall(r'const \[', t)
t_parse = (time.perf_counter() - t0) / 10 * 1000
test("P1.04","Regex parse < 50ms per pass", t_parse < 50, f"{t_parse:.1f}ms", "<50ms")

# Function count (render tree depth)
func_count = len(re.findall(r'function \w+\(', t))
test("P1.05","Function count < 50", func_count < 50, f"{func_count}", "<50")

# useState count (state complexity)
state_count = t.count("useState(")
test("P1.06","useState count < 70", state_count < 70, f"{state_count}", "<70")

# JSX depth estimate (max nested div count per line)
max_nesting = max(l.count("<div") + l.count("<span") for l in lines)
test("P1.07","Max JSX nesting per line < 8", max_nesting < 8, f"{max_nesting}", "<8")

# Inline style count (render cost driver)
style_count = t.count("style={{")
test("P1.08","Inline style count < 1500", style_count < 1500, f"{style_count}", "<1500")

# ═══════════════════════════════════════════════════════════════
# P2: PAGE RENDER COMPLEXITY
# Measures component size as proxy for render time.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ P2: PAGE RENDER COMPLEXITY ━━━")

page_sizes = {}
for name in ["Dashboard","Customers","Origination","Underwriting","Loans",
             "Servicing","Collections","Provisioning","Governance",
             "StatutoryReporting","Documents","Reports","Comms","Administration"]:
    fn = efn(name)
    page_sizes[name] = len(fn)

# Sort by size
sorted_pages = sorted(page_sizes.items(), key=lambda x: -x[1])

# Individual page budgets
for name, size in sorted_pages:
    kb = size / 1024
    limit = 30 if name == "Administration" else 20
    test("P2", f"{name}: {kb:.1f}KB", kb < limit, f"{kb:.1f}KB", f"<{limit}KB")

# Total page code
total_page_kb = sum(page_sizes.values()) / 1024
test("P2.15","Total page code < 200KB", total_page_kb < 200, f"{total_page_kb:.0f}KB", "<200KB")

# Largest single function
largest = sorted_pages[0]
test("P2.16",f"Largest page ({largest[0]}) < 30KB", largest[1] < 30720, f"{largest[1]/1024:.1f}KB", "<30KB")

# Detail view complexity
detail_size = len(efn("renderDetail")) / 1024
test("P2.17","renderDetail < 25KB", detail_size < 25, f"{detail_size:.1f}KB", "<25KB")

# ═══════════════════════════════════════════════════════════════
# P3: DATA THROUGHPUT SIMULATION
# Simulates load/save operations with varying dataset sizes.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ P3: DATA THROUGHPUT ━━━")

# Generate test datasets of increasing size
def gen_dataset(n_customers, n_apps, n_loans):
    customers = [{"id":f"C{i:04d}","name":f"Customer {i}","email":f"c{i}@test.co.za","industry":"Retail","ficaStatus":"Verified"} for i in range(n_customers)]
    apps = [{"id":f"APP-{i:04d}","custId":f"C{i%n_customers:04d}","status":"Approved","amount":500000,"term":12} for i in range(n_apps)]
    loans = [{"id":f"LN-{i:04d}","custId":f"C{i%n_customers:04d}","appId":f"APP-{i:04d}","amount":500000,"balance":400000,"rate":14.5,"dpd":0,"stage":1,"status":"Active","payments":[]} for i in range(n_loans)]
    return {"customers":customers,"applications":apps,"loans":loans,"products":[],"collections":[],"alerts":[],"audit":[],"provisions":[],"comms":[],"documents":[],"statutoryReports":[],"settings":{}}

# Small dataset (startup)
ds_small = gen_dataset(10, 20, 15)
t0 = time.perf_counter()
for _ in range(100):
    j = json.dumps(ds_small)
    _ = json.loads(j)
t_small = (time.perf_counter() - t0) / 100 * 1000
small_kb = len(json.dumps(ds_small)) / 1024
test("P3.01",f"Small dataset ({len(ds_small['customers'])}c/{len(ds_small['loans'])}l) serialize < 5ms", t_small < 5, f"{t_small:.2f}ms ({small_kb:.0f}KB)", "<5ms")

# Medium dataset (year 2)
ds_med = gen_dataset(100, 300, 200)
t0 = time.perf_counter()
for _ in range(50):
    j = json.dumps(ds_med)
    _ = json.loads(j)
t_med = (time.perf_counter() - t0) / 50 * 1000
med_kb = len(json.dumps(ds_med)) / 1024
test("P3.02",f"Medium dataset ({len(ds_med['customers'])}c/{len(ds_med['loans'])}l) serialize < 20ms", t_med < 20, f"{t_med:.2f}ms ({med_kb:.0f}KB)", "<20ms")

# Large dataset (year 5)
ds_large = gen_dataset(500, 1500, 1000)
t0 = time.perf_counter()
for _ in range(10):
    j = json.dumps(ds_large)
    _ = json.loads(j)
t_large = (time.perf_counter() - t0) / 10 * 1000
large_kb = len(json.dumps(ds_large)) / 1024
test("P3.03",f"Large dataset ({len(ds_large['customers'])}c/{len(ds_large['loans'])}l) serialize < 100ms", t_large < 100, f"{t_large:.2f}ms ({large_kb:.0f}KB)", "<100ms")

# Stress dataset (year 10)
ds_stress = gen_dataset(2000, 5000, 3000)
t0 = time.perf_counter()
for _ in range(3):
    j = json.dumps(ds_stress)
    _ = json.loads(j)
t_stress = (time.perf_counter() - t0) / 3 * 1000
stress_kb = len(json.dumps(ds_stress)) / 1024
test("P3.04",f"Stress dataset ({len(ds_stress['customers'])}c/{len(ds_stress['loans'])}l) serialize < 500ms", t_stress < 500, f"{t_stress:.2f}ms ({stress_kb:.0f}KB)", "<500ms")

# localStorage 5MB limit check
test("P3.05","Small dataset < 5MB localStorage limit", small_kb < 5120, f"{small_kb:.0f}KB", "<5MB")
test("P3.06","Medium dataset < 5MB localStorage limit", med_kb < 5120, f"{med_kb:.0f}KB", "<5MB")
test("P3.07","Large dataset < 5MB localStorage limit", large_kb < 5120, f"{large_kb:.0f}KB", "<5MB")

# ═══════════════════════════════════════════════════════════════
# P4: CONCURRENT USER SIMULATION
# Simulates N users performing operations simultaneously.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ P4: CONCURRENT USER SIMULATION ━━━")

import threading, queue

def simulate_user(user_id, results_q):
    """Simulates a user session: login check, data load, page render, save."""
    t0 = time.perf_counter()
    # Auth check (parse session)
    session = json.dumps({"token":"tok","user":{"email":f"user{user_id}@test.co.za"}})
    _ = json.loads(session)
    # Data load (deserialize)
    data = json.dumps(ds_med)
    loaded = json.loads(data)
    # Page render (simulate filter/reduce)
    active = [l for l in loaded["loans"] if l["status"] == "Active"]
    total = sum(l["balance"] for l in active)
    overdue = [l for l in active if l["dpd"] > 0]
    # Save (serialize)
    _ = json.dumps(loaded)
    elapsed = (time.perf_counter() - t0) * 1000
    results_q.put(("ok", user_id, elapsed))

# 10 concurrent users
rq = queue.Queue()
threads = [threading.Thread(target=simulate_user, args=(i, rq)) for i in range(10)]
t0 = time.perf_counter()
for th in threads: th.start()
for th in threads: th.join()
t_10 = (time.perf_counter() - t0) * 1000
times_10 = []
while not rq.empty():
    s, uid, elapsed = rq.get()
    times_10.append(elapsed)
avg_10 = sum(times_10) / len(times_10)
max_10 = max(times_10)
test("P4.01","10 concurrent users: avg response < 50ms", avg_10 < 50, f"avg={avg_10:.1f}ms max={max_10:.1f}ms", "<50ms avg")
test("P4.02","10 concurrent users: total wall time < 200ms", t_10 < 200, f"{t_10:.1f}ms", "<200ms")

# 50 concurrent users
rq2 = queue.Queue()
threads2 = [threading.Thread(target=simulate_user, args=(i, rq2)) for i in range(50)]
t0 = time.perf_counter()
for th in threads2: th.start()
for th in threads2: th.join()
t_50 = (time.perf_counter() - t0) * 1000
times_50 = []
while not rq2.empty():
    s, uid, elapsed = rq2.get()
    times_50.append(elapsed)
avg_50 = sum(times_50) / len(times_50)
max_50 = max(times_50)
test("P4.03","50 concurrent users: avg response < 100ms", avg_50 < 100, f"avg={avg_50:.1f}ms max={max_50:.1f}ms", "<100ms avg")
test("P4.04","50 concurrent users: total wall time < 500ms", t_50 < 500, f"{t_50:.1f}ms", "<500ms")

# 100 concurrent users
rq3 = queue.Queue()
threads3 = [threading.Thread(target=simulate_user, args=(i, rq3)) for i in range(100)]
t0 = time.perf_counter()
for th in threads3: th.start()
for th in threads3: th.join()
t_100 = (time.perf_counter() - t0) * 1000
times_100 = []
while not rq3.empty():
    s, uid, elapsed = rq3.get()
    times_100.append(elapsed)
avg_100 = sum(times_100) / len(times_100)
max_100 = max(times_100)
test("P4.05","100 concurrent users: avg response < 200ms", avg_100 < 200, f"avg={avg_100:.1f}ms max={max_100:.1f}ms", "<200ms avg")
test("P4.06","100 concurrent users: total wall time < 2000ms", t_100 < 2000, f"{t_100:.1f}ms", "<2s")

# ═══════════════════════════════════════════════════════════════
# P5: REPORT GENERATION (LIST RENDERING PERFORMANCE)
# Simulates rendering large tables and aggregate computations.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ P5: REPORT GENERATION ━━━")

# Portfolio report: filter + aggregate 1000 loans
loans_1k = ds_large["loans"]
t0 = time.perf_counter()
for _ in range(100):
    active = [l for l in loans_1k if l["status"] == "Active"]
    total_book = sum(l["balance"] for l in active)
    by_stage = {1:0,2:0,3:0}
    for l in active:
        by_stage[l["stage"]] = by_stage.get(l["stage"],0) + l["balance"]
    overdue = [l for l in active if l["dpd"] > 0]
    npl = sum(l["balance"] for l in active if l["dpd"] > 90)
    yield_est = sum(l["balance"] * l["rate"]/100/12 for l in active)
t_report_1k = (time.perf_counter() - t0) / 100 * 1000
test("P5.01","Portfolio report (1000 loans) < 5ms", t_report_1k < 5, f"{t_report_1k:.2f}ms", "<5ms")

# Portfolio report: 3000 loans (stress)
loans_3k = ds_stress["loans"]
t0 = time.perf_counter()
for _ in range(50):
    active = [l for l in loans_3k if l["status"] == "Active"]
    total_book = sum(l["balance"] for l in active)
    npl = sum(l["balance"] for l in active if l["dpd"] > 90)
    yield_est = sum(l["balance"] * l["rate"]/100/12 for l in active)
t_report_3k = (time.perf_counter() - t0) / 50 * 1000
test("P5.02","Portfolio report (3000 loans) < 20ms", t_report_3k < 20, f"{t_report_3k:.2f}ms", "<20ms")

# Dashboard KPI computation (all modules)
t0 = time.perf_counter()
for _ in range(100):
    n_cust = len(ds_large["customers"])
    n_apps = len(ds_large["applications"])
    n_loans = len(ds_large["loans"])
    active = [l for l in ds_large["loans"] if l["status"] == "Active"]
    pipeline = [a for a in ds_large["applications"] if a["status"] in ["Submitted","Underwriting"]]
    book_val = sum(l["balance"] for l in active)
t_dash = (time.perf_counter() - t0) / 100 * 1000
test("P5.03","Dashboard KPI computation < 3ms", t_dash < 3, f"{t_dash:.2f}ms", "<3ms")

# Audit trail: filter 10K entries
audit_10k = [{"id":f"A{i}","action":"Test","ts":i,"category":"Test","user":"U001"} for i in range(10000)]
t0 = time.perf_counter()
for _ in range(50):
    filtered = [a for a in audit_10k if a["category"] == "Test" and a["user"] == "U001"]
    sorted_a = sorted(filtered, key=lambda x: -x["ts"])
    page = sorted_a[:50]
t_audit = (time.perf_counter() - t0) / 50 * 1000
test("P5.04","Audit trail filter+sort (10K entries) < 10ms", t_audit < 10, f"{t_audit:.2f}ms", "<10ms")

# ═══════════════════════════════════════════════════════════════
# P6: DOCUMENT UPLOAD/DOWNLOAD SIMULATION
# ═══════════════════════════════════════════════════════════════
print("\n━━━ P6: DOCUMENT OPERATIONS ━━━")

# Document record creation (simulates upload metadata save)
t0 = time.perf_counter()
for _ in range(1000):
    doc = {"id":f"D{_}","custId":"C001","name":"ID Document","category":"KYC","docType":"sa_id","status":"Pending Review","uploadedAt":time.time(),"fileType":"PDF","size":"2.4MB"}
    j = json.dumps(doc)
    _ = json.loads(j)
t_doc_create = (time.perf_counter() - t0) / 1000 * 1000
test("P6.01","Document record creation < 0.5ms", t_doc_create < 0.5, f"{t_doc_create:.3f}ms", "<0.5ms")

# Document list rendering (500 docs)
docs_500 = [{"id":f"D{i}","custId":f"C{i%100:04d}","name":f"Doc {i}","category":"KYC" if i%2==0 else "KYB","status":"Verified" if i%3==0 else "Pending","uploadedAt":time.time()} for i in range(500)]
t0 = time.perf_counter()
for _ in range(100):
    by_cust = [d for d in docs_500 if d["custId"] == "C0050"]
    by_cat = [d for d in docs_500 if d["category"] == "KYC"]
    by_status = [d for d in docs_500 if d["status"] == "Pending"]
t_doc_filter = (time.perf_counter() - t0) / 100 * 1000
test("P6.02","Document filter (500 docs, 3 filters) < 1ms", t_doc_filter < 1, f"{t_doc_filter:.3f}ms", "<1ms")

# Batch document status update (simulate 20 docs)
t0 = time.perf_counter()
for _ in range(500):
    updated = [{**d, "status":"Verified"} for d in docs_500[:20]]
    j = json.dumps(updated)
t_doc_batch = (time.perf_counter() - t0) / 500 * 1000
test("P6.03","Batch doc status update (20 docs) < 0.5ms", t_doc_batch < 0.5, f"{t_doc_batch:.3f}ms", "<0.5ms")

# ═══════════════════════════════════════════════════════════════
# P7: QUEUE / LIST PERFORMANCE
# Simulates rendering paginated lists and work queues.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ P7: QUEUE & LIST PERFORMANCE ━━━")

# Application queue: filter + sort + paginate (500 apps)
apps_500 = [{"id":f"APP-{i:04d}","status":["Draft","Submitted","Underwriting","Approved","Declined"][i%5],"amount":100000+i*1000,"submitted":time.time()-i*3600,"custId":f"C{i%50:04d}"} for i in range(500)]
t0 = time.perf_counter()
for _ in range(100):
    submitted = [a for a in apps_500 if a["status"] == "Submitted"]
    sorted_q = sorted(submitted, key=lambda x: x["submitted"])
    page1 = sorted_q[:25]
    page2 = sorted_q[25:50]
t_queue = (time.perf_counter() - t0) / 100 * 1000
test("P7.01","App queue filter+sort+paginate (500 apps) < 2ms", t_queue < 2, f"{t_queue:.2f}ms", "<2ms")

# Collections work queue: group by DPD band
loans_500 = [{"id":f"LN-{i:04d}","dpd":i%120,"balance":500000-i*100,"custId":f"C{i%50:04d}","status":"Active"} for i in range(500)]
t0 = time.perf_counter()
for _ in range(100):
    early = [l for l in loans_500 if 1 <= l["dpd"] <= 30]
    mid = [l for l in loans_500 if 31 <= l["dpd"] <= 90]
    late = [l for l in loans_500 if l["dpd"] > 90]
    total_arr = sum(l["balance"] for l in loans_500 if l["dpd"] > 0)
t_coll_q = (time.perf_counter() - t0) / 100 * 1000
test("P7.02","Collections queue (500 loans, 3 bands) < 2ms", t_coll_q < 2, f"{t_coll_q:.2f}ms", "<2ms")

# Notification queue: 1000 alerts
alerts_1k = [{"id":f"A{i}","read":i%3==0,"ts":time.time()-i*60,"title":f"Alert {i}","severity":"info"} for i in range(1000)]
t0 = time.perf_counter()
for _ in range(200):
    unread = [a for a in alerts_1k if not a["read"]]
    recent = sorted(alerts_1k, key=lambda x: -x["ts"])[:20]
    count = len(unread)
t_notif = (time.perf_counter() - t0) / 200 * 1000
test("P7.03","Notification queue (1000 alerts) < 2ms", t_notif < 2, f"{t_notif:.2f}ms", "<2ms")

# Customer search: substring match across 2000 customers
custs_2k = [{"id":f"C{i:04d}","name":f"Company {i} {'Alpha' if i%3==0 else 'Beta' if i%3==1 else 'Gamma'}","email":f"c{i}@test.co.za","industry":["Retail","Construction","Agriculture","Transport"][i%4]} for i in range(2000)]
t0 = time.perf_counter()
for _ in range(100):
    query = "alpha"
    matched = [c for c in custs_2k if query in c["name"].lower() or query in c["email"].lower()]
t_search = (time.perf_counter() - t0) / 100 * 1000
test("P7.04","Customer search (2000 records, substring) < 5ms", t_search < 5, f"{t_search:.2f}ms", "<5ms")

# Product dropdown render (7 products)
products_7 = [{"id":f"P00{i}","name":f"Product {i}","status":"Active","baseRate":14.5,"description":"x"*100} for i in range(7)]
t0 = time.perf_counter()
for _ in range(10000):
    active = [p for p in products_7 if p["status"] == "Active"]
    options = [(p["id"], f"{p['name']} ({p['baseRate']}%)") for p in active]
t_prod = (time.perf_counter() - t0) / 10000 * 1000
test("P7.05","Product dropdown render (7 products) < 0.05ms", t_prod < 0.05, f"{t_prod:.4f}ms", "<0.05ms")

# IFRS 9 provision calculation (1000 loans)
t0 = time.perf_counter()
for _ in range(50):
    total_ecl = 0
    for l in loans_1k:
        pd = 0.03 if l["stage"] == 1 else 0.22 if l["stage"] == 2 else 1.0
        lgd = 0.65
        ead = l["balance"]
        ecl = pd * lgd * ead
        total_ecl += ecl
    coverage = total_ecl / sum(l["balance"] for l in loans_1k) if loans_1k else 0
t_ecl = (time.perf_counter() - t0) / 50 * 1000
test("P7.06","IFRS 9 ECL calculation (1000 loans) < 10ms", t_ecl < 10, f"{t_ecl:.2f}ms", "<10ms")

# ═══════════════════════════════════════════════════════════════
# P8: MEMORY FOOTPRINT ESTIMATION
# ═══════════════════════════════════════════════════════════════
print("\n━━━ P8: MEMORY FOOTPRINT ━━━")

# Estimate in-memory data sizes
import sys as _sys
small_mem = _sys.getsizeof(json.dumps(ds_small)) / 1024
med_mem = _sys.getsizeof(json.dumps(ds_med)) / 1024
large_mem = _sys.getsizeof(json.dumps(ds_large)) / 1024
stress_mem = _sys.getsizeof(json.dumps(ds_stress)) / 1024

test("P8.01","Small dataset memory < 100KB", small_mem < 100, f"{small_mem:.0f}KB", "<100KB")
test("P8.02","Medium dataset memory < 500KB", med_mem < 500, f"{med_mem:.0f}KB", "<500KB")
test("P8.03","Large dataset memory < 2MB", large_mem < 2048, f"{large_mem:.0f}KB", "<2MB")
test("P8.04","Stress dataset memory < 5MB", stress_mem < 5120, f"{stress_mem:.0f}KB", "<5MB")

# Source code memory
src_mem = _sys.getsizeof(t) / 1024
test("P8.05","Source in memory < 500KB", src_mem < 500, f"{src_mem:.0f}KB", "<500KB")

# ═══════════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 72)
print("  PERFORMANCE TEST RESULTS")
print("=" * 72)

cats = {}
for s, tid, name, metric, threshold in results:
    c = tid.split(".")[0]
    cats.setdefault(c, {"PASS":0,"FAIL":0,"items":[]})
    cats[c][s] += 1
    cats[c]["items"].append((s,tid,name,metric,threshold))

section_names = {
    "P1":"Bundle Size & Parse",
    "P2":"Page Render Complexity",
    "P3":"Data Throughput",
    "P4":"Concurrent Users",
    "P5":"Report Generation",
    "P6":"Document Operations",
    "P7":"Queue & List Performance",
    "P8":"Memory Footprint",
}

for cat, d in cats.items():
    tot = d["PASS"]+d["FAIL"]
    mark = "✓" if d["FAIL"]==0 else "✗"
    label = section_names.get(cat, cat)
    print(f"\n  {mark} {cat} {label}: {d['PASS']}/{tot}")
    for s,tid,name,metric,threshold in d["items"]:
        icon = "✓" if s=="PASS" else "✗"
        print(f"    {icon} {name}  [{metric}] (threshold: {threshold})")

pass_cats = sum(1 for d in cats.values() if d["FAIL"]==0)
print(f"\n  SECTIONS: {pass_cats}/{len(cats)} passed")
print(f"  TESTS:    {passed}/{passed+failed} — {passed*100//(passed+failed) if passed+failed else 0}%")
if failed == 0:
    print("\n  ✓ ALL PERFORMANCE TESTS PASSED")
else:
    print(f"\n  ⚠ {failed} threshold(s) exceeded")
print("=" * 72)
sys.exit(0 if failed == 0 else 1)
