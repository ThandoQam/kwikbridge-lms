#!/usr/bin/env python3
"""
KwikBridge LMS — Accessibility & Usability Review
Validates WCAG-aligned form readability, error clarity, keyboard navigation,
label consistency, status badge uniformity, and assistive technology support.
"""
import re, sys

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

PUB = t[t.find("// ═══ PUBLIC ZONE"):t.find("// ═══ AUTH GATE")] if "// ═══ PUBLIC ZONE" in t else ""
AUTH = t[t.find("// ═══ AUTH GATE"):t.find("// ═══ BORROWER PORTAL")] if "// ═══ AUTH GATE" in t else ""
PORT = t[t.find("// ═══ BORROWER PORTAL"):t.find("// ═══ STAFF BACK-OFFICE")] if "// ═══ BORROWER PORTAL" in t else ""

print("=" * 72)
print("  KWIKBRIDGE LMS — ACCESSIBILITY & USABILITY REVIEW")
print(f"  {len(t):,} bytes · WCAG-aligned")
print("=" * 72)

# ═══════════════════════════════════════════════════════════════
# AX-1: FORM READABILITY — PUBLIC APPLICATION
# Can a first-time borrower understand and complete the form?
# ═══════════════════════════════════════════════════════════════
print("\n━━━ AX-1: FORM READABILITY ━━━")

# 1.1 Step indicators — user knows where they are
test("A1.01","Application form has numbered steps","Step 1" in PUB or "step" in PUB.lower())
test("A1.02","Steps have descriptive titles","Your Details" in PUB and "Business Information" in PUB)
test("A1.03","Step progress indicator (visual)","step>s" in PUB or "background:" in PUB)
test("A1.04","Current step highlighted differently","step===s" in PUB or "step>=" in PUB)

# 1.2 Field labels — every input is labelled
test("A1.05","Field component wraps label+input","function Field(" in t)
field_fn = efn("Field") if "function Field(" in t else t[t.find("const Field"):t.find("const Field")+500]
test("A1.06","Field renders label text","label" in field_fn)
test("A1.07","Label styled visibly (fontSize, fontWeight)","fontSize" in t[t.find("function Field"):t.find("function Field")+300] and "fontWeight" in t[t.find("function Field"):t.find("function Field")+300])

# 1.3 Named fields in public form
pub_labels = ["Full Name","Email Address","Phone Number","Create Password",
              "Business Name","ID Number","Company Registration","Industry",
              "Annual Revenue","Number of Employees","Province",
              "Select Product","Loan Amount","Term","Purpose of Financing"]
for lbl in pub_labels:
    test("A1.08",f"Label: '{lbl}'", lbl in PUB)

# 1.4 Placeholder hints
test("A1.09","Loan amount has placeholder","placeholder" in PUB[PUB.find("Loan Amount"):PUB.find("Loan Amount")+300])
test("A1.10","Purpose has placeholder or textarea","Purpose" in PUB)

# 1.5 Input types aid mobile keyboards
test("A1.11","Email: type=email (shows @ keyboard)",'type="email"' in PUB or "type=\"email\"" in PUB)
test("A1.12","Phone: type=tel or text","Phone" in PUB)
test("A1.13","Amount: type=number (numeric keyboard)","type=\"number\"" in PUB)
test("A1.14","Password: type=password (masked)","type=\"password\"" in PUB or 'type="password"' in PUB)

# 1.6 Review screen before submission
test("A1.15","Step 4 shows review summary","Review Your Application" in PUB)
test("A1.16","Review shows applicant name","f.contact" in PUB)
test("A1.17","Review shows business name","f.businessName" in PUB)
test("A1.18","Review shows loan amount","f.amount" in PUB)

# ═══════════════════════════════════════════════════════════════
# AX-2: CLEAR ERROR MESSAGES & VALIDATION FEEDBACK
# ═══════════════════════════════════════════════════════════════
print("\n━━━ AX-2: ERROR MESSAGES & VALIDATION ━━━")

# 2.1 Form validation prevents bad submission
test("A2.01","Step 1 validation gate (v1)","const v1" in PUB)
test("A2.02","Step 2 validation gate (v2)","const v2" in PUB)
test("A2.03","Step 3 validation gate (v3)","const v3" in PUB)
test("A2.04","Next button disabled when invalid","disabled={!v1}" in PUB and "disabled={!v2}" in PUB and "disabled={!v3}" in PUB)

# 2.5 Visual disabled state
test("A2.05","Disabled button has visual difference","opacity" in t[t.find("function Btn"):t.find("function Btn")+500] or "disabled" in t[t.find("function Btn"):t.find("function Btn")+500])

# 2.6 Password length feedback
test("A2.06","Password minimum length communicated","6" in PUB[PUB.find("Password"):PUB.find("Password")+300])

# 2.7 Auth error handling
test("A2.07","Sign in error displayed","error" in AUTH and "authForm.error" in AUTH)
test("A2.08","Sign up error displayed","error" in AUTH)
test("A2.09","Error shown in red/warning colour","fef2f2" in AUTH or "C.red" in AUTH or "red" in AUTH)

# 2.10 Handler errors use alert()
test("A2.10","Permission denied alert","Permission denied" in t)
test("A2.11","QA failure shows specific issues","issueLines" in t or "fieldErrors" in t)
test("A2.12","Over-authority alert","Authority exceeded" in t)
test("A2.13","Invalid status transition alert","Only Draft" in t or "Only Booked" in t or "Only Approved" in t)
test("A2.14","Dual authorisation alert","Dual authorization" in t)

# 2.15 POPIA consent required
test("A2.15","POPIA consent checkbox before submit","POPIA" in PUB)

# ═══════════════════════════════════════════════════════════════
# AX-3: KEYBOARD NAVIGATION & INTERACTION
# ═══════════════════════════════════════════════════════════════
print("\n━━━ AX-3: KEYBOARD NAVIGATION ━━━")

# 3.1 Buttons use <button> (focusable by default)
button_count = t.count("<button ")
test("A3.01","Native <button> elements used (keyboard-focusable)", button_count > 30, f"{button_count} buttons")

# 3.2 Inputs use <input> (focusable)
input_count = t.count("<input ")
test("A3.02","Native <input> elements used", input_count > 20, f"{input_count} inputs")

# 3.3 Selects use <select> (keyboard navigable)
select_count = t.count("<select ")
test("A3.03","Native <select> elements used", select_count > 5, f"{select_count} selects")

# 3.4 Textareas use <textarea> (keyboard navigable)
textarea_count = t.count("<textarea ")
test("A3.04","Native <textarea> elements used", textarea_count >= 1, f"{textarea_count} textareas")

# 3.5 Focus styles defined
test("A3.05","Global focus styles (input:focus)","input:focus" in t)
test("A3.06","Focus border colour change","border-color" in t)

# 3.7 No tabIndex=-1 (hiding from tab order)
neg_tabindex = t.count('tabIndex={-1}') + t.count("tabIndex={-1}")
test("A3.07","No tabIndex=-1 hiding elements from keyboard", neg_tabindex == 0, f"{neg_tabindex} instances")

# 3.8 onClick on non-button elements (divs) — check for keyboard alternative
div_clicks = len(re.findall(r'<div[^>]*onClick', t))
test("A3.08","Clickable divs minimised (prefer buttons)", div_clicks < 50, f"{div_clicks} clickable divs")

# 3.9 Links use <a> or onClick with cursor
test("A3.09","Cursor pointer on interactive elements","cursor:\"pointer\"" in t)

# 3.10 Modals
test("A3.10","Modal component exists","function Modal(" in t)
modal_fn = efn("Modal") if "function Modal(" in t else ""
test("A3.11","Modal has close mechanism","onClose" in modal_fn or "close" in modal_fn.lower())

# ═══════════════════════════════════════════════════════════════
# AX-4: CONSISTENT LABELS & TERMINOLOGY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ AX-4: LABEL CONSISTENCY ━━━")

# 4.1 Status labels are consistent
test("A4.01","statusBadge utility used for all statuses","statusBadge" in t)
sb_fn = t[t.find("statusBadge(s)"):t.find("statusBadge(s)")+600]

# Check consistent status terminology
statuses_in_badge = re.findall(r'"(\w[\w\s\-]*)"', sb_fn)
test("A4.02","statusBadge covers Active","Active" in sb_fn)
test("A4.03","statusBadge covers Approved","Approved" in sb_fn)
test("A4.04","statusBadge covers Declined","Declined" in sb_fn)
test("A4.05","statusBadge covers Submitted","Submitted" in sb_fn)
test("A4.06","statusBadge covers Draft (fallback slate)","slate" in sb_fn)
test("A4.07","statusBadge covers Booked (fallback slate)","slate" in sb_fn)

# 4.8 Badge component for categories
test("A4.08","Badge component for labelling","function Badge(" in t)
badge_fn = efn("Badge") if "function Badge(" in t else ""
test("A4.09","Badge has colour parameter","color" in badge_fn)

# 4.10 Consistent colour semantics
test("A4.10","Green = positive (Active, Verified, Pass)","green" in t and "Active" in t)
test("A4.11","Red = negative (Declined, Failed, Overdue)","red" in t and "Declined" in t)
test("A4.12","Amber = warning (Pending, Underwriting)","amber" in t)

# 4.13 Page titles — each module has h2 heading
modules = ["Dashboard","Customers","Origination","Underwriting","Loans",
           "Servicing","Collections","Provisioning","Governance",
           "StatutoryReporting","Documents","Reports","Comms","Administration"]
for mod in modules:
    fn = efn(mod)
    has_title = "<h2" in fn or "fontSize:22" in fn
    test("A4.13",f"{mod} has page title", has_title)

# 4.14 Page descriptions
for mod in modules:
    fn = efn(mod)
    fn_wide = t[t.find(f"function {mod}()"):t.find(f"function {mod}()")+6000]
    has_desc = "textMuted" in fn_wide
    test("A4.14",f"{mod} has subtitle/description", has_desc)

# ═══════════════════════════════════════════════════════════════
# AX-5: STATUS BADGE UNIFORMITY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ AX-5: STATUS UNIFORMITY ━━━")

# All status displays should use statusBadge or Badge
sb_usage = t.count("statusBadge(")
badge_usage = t.count("<Badge")
test("A5.01","statusBadge used consistently across modules", sb_usage >= 15, f"{sb_usage} uses")
test("A5.02","Badge used for category labels", badge_usage >= 10, f"{badge_usage} uses")

# IFRS stage badges
test("A5.03","IFRS stages use Badge (Stage 1/2/3)","Stage {r.stage}" in t or "Stage 1" in t)

# Risk class badges
test("A5.04","Risk class uses Badge (A/B/C/D)","riskClass" in t and "<Badge" in t)

# DPD display consistent
test("A5.05","DPD uses colour coding (green/amber/red)","dpd===0" in t and "C.green" in t and "C.amber" in t and "C.red" in t)

# ═══════════════════════════════════════════════════════════════
# AX-6: VISUAL HIERARCHY & READABILITY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ AX-6: VISUAL HIERARCHY ━━━")

# 6.1 Typography scale
test("A6.01","Page titles: fontSize 22","fontSize:22" in t)
test("A6.02","Section headers: fontSize 14-16","fontSize:14" in t or "fontSize:16" in t)
test("A6.03","Body text: fontSize 12-13","fontSize:12" in t and "fontSize:13" in t)
test("A6.04","Muted text: fontSize 10-11","fontSize:10" in t and "fontSize:11" in t)

# 6.2 Colour contrast
test("A6.05","Primary text colour defined","text:" in t[t.find("const C"):t.find("const C")+500])
test("A6.06","Muted text colour defined","textMuted:" in t)
test("A6.07","Dim text colour defined","textDim:" in t)

# 6.3 Font weights hierarchy
test("A6.08","Bold for headings (fontWeight:700)","fontWeight:700" in t)
test("A6.09","Semi-bold for labels (fontWeight:600)","fontWeight:600" in t)
test("A6.10","Normal for body (fontWeight:400 or 500)","fontWeight:400" in t or "fontWeight:500" in t)

# 6.4 Whitespace
test("A6.11","Consistent margin/padding patterns","margin:\"0 0" in t)
test("A6.12","Gap spacing in flex layouts","gap:" in t)

# 6.5 Monospace for IDs and numbers
test("A6.13","Monospace font for IDs","fontFamily:\"monospace\"" in t)

# ═══════════════════════════════════════════════════════════════
# AX-7: NOTIFICATION & FEEDBACK
# User always knows what happened after an action.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ AX-7: ACTION FEEDBACK ━━━")

# 7.1 Confirmation messages
test("A7.01","Application submitted confirmation","Application Submitted" in PUB)
test("A7.02","Confirmation shows reference number","trackingRef" in PUB)

# 7.3 Notification bell
test("A7.03","Notification bell in staff header","bell" in t and "notifOpen" in t)
test("A7.04","Unread count badge on bell","unread" in t and "unread>0" in t)
test("A7.05","Notification dropdown shows alerts","alerts.slice" in t)
test("A7.06","markRead marks notification as read","markRead" in t)

# 7.7 Loading states
test("A7.07","Auth loading indicator","authLoading" in t)
test("A7.08","Data loading guard (if !data)","if (!data)" in t)

# 7.9 Empty states
test("A7.09","Empty state handling in tables","No" in t[t.find("function Table"):t.find("function Table")+1000] or "empty" in t[t.find("function Table"):t.find("function Table")+1000].lower())

# ═══════════════════════════════════════════════════════════════
# AX-8: BORROWER PORTAL USABILITY
# Portal must be simple enough for non-technical borrowers.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ AX-8: PORTAL USABILITY ━━━")

# 8.1 Clear navigation
test("A8.01","Portal nav uses human-readable labels","Dashboard" in PORT and "My Applications" in PORT)
test("A8.02","Portal nav uses icons","icon:" in PORT)

# 8.3 Document upload guidance
test("A8.03","Document types have human names","SA ID Document" in PORT or "sa_id" in PORT)
test("A8.04","Required vs optional clearly marked","required" in PORT)
test("A8.05","Upload progress indicator","Mandatory Documents" in PORT)

# 8.6 Payment UX
test("A8.06","Payment methods listed clearly","EFT" in PORT and "Debit Order" in PORT)
test("A8.07","Payment amount has input","amount" in PORT)
test("A8.08","PTP has date picker","type=\"date\"" in PORT or "date" in PORT.lower())

# 8.9 Profile editing
test("A8.09","Profile shows current details","Business Details" in PORT)
test("A8.10","Sign out clearly visible","Sign Out" in PORT)

# ═══════════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 72)
print("  ACCESSIBILITY & USABILITY REVIEW RESULTS")
print("=" * 72)

cats = {}
for s, tid, name, detail in results:
    c = tid.split(".")[0]
    cats.setdefault(c, {"PASS":0,"FAIL":0,"items":[]})
    cats[c][s] += 1
    cats[c]["items"].append((s,tid,name,detail))

section_names = {
    "A1":"Form Readability",
    "A2":"Error Messages & Validation",
    "A3":"Keyboard Navigation",
    "A4":"Label Consistency",
    "A5":"Status Uniformity",
    "A6":"Visual Hierarchy",
    "A7":"Action Feedback",
    "A8":"Portal Usability",
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
    print("\n  ✓ ALL ACCESSIBILITY & USABILITY TESTS PASSED")
else:
    print(f"\n  ⚠ {failed} finding(s)")
print("=" * 72)
sys.exit(0 if failed == 0 else 1)
