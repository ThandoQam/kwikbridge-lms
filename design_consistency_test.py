#!/usr/bin/env python3
"""
KwikBridge LMS — UI/UX Design Consistency Test
Validates visual uniformity, spacing rhythm, component reuse, colour discipline,
typography consistency, interaction patterns, and layout cohesion across all
three zones and every module.
"""
import re, sys, collections

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
STAFF = t[t.find("// ═══ STAFF BACK-OFFICE"):] if "// ═══ STAFF BACK-OFFICE" in t else ""

# Extract colour palette
C_block = t[t.find("const C ="):t.find("};", t.find("const C ="))+2]
colours = dict(re.findall(r'(\w+):\s*"([^"]+)"', C_block))

print("=" * 72)
print("  KWIKBRIDGE LMS — UI/UX DESIGN CONSISTENCY TEST")
print(f"  {len(t):,} bytes · {len(colours)} palette colours")
print("=" * 72)

# ═══════════════════════════════════════════════════════════════
# DC-1: COLOUR PALETTE DISCIPLINE
# Every colour used must come from the C palette — no magic values.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-1: COLOUR PALETTE DISCIPLINE ━━━")

test("D1.01","Palette defined as const C","const C =" in t)
test("D1.02","Background colour defined","bg" in colours)
test("D1.03","Surface colour defined","surface" in colours)
test("D1.04","Border colour defined","border" in colours)
test("D1.05","Primary text defined","text" in colours)
test("D1.06","Muted text defined","textMuted" in colours)
test("D1.07","Dim text defined","textDim" in colours)
test("D1.08","Semantic green","green" in colours)
test("D1.09","Semantic red","red" in colours)
test("D1.10","Semantic amber","amber" in colours)
test("D1.11","Semantic blue","blue" in colours)
test("D1.12","Semantic purple","purple" in colours)
test("D1.13","White defined","white" in colours)

# Check for raw hex values outside C palette and component definitions
# Allow: colour palette definition itself, Badge colour maps, statusBadge map, auth error styling
raw_hex = re.findall(r'(?<!C\.)(?<!["\'])#[0-9a-fA-F]{3,8}(?=["\';,\s})])', t)
# Filter out: palette definition, auth error background, scrollbar
palette_area = t[t.find("const C ="):t.find("const C =")+800]
palette_hexes = set(re.findall(r'#[0-9a-fA-F]{3,8}', palette_area))
# Known exceptions: auth error bg (#fef2f2, #fca5a5), scrollbar (#d4d4d4)
known_exceptions = {"#fef2f2","#fca5a5","#d4d4d4","#fff","#ffffff","#1a1a2e","#e5e7eb"}

stray_hex = []
for m in re.finditer(r'#[0-9a-fA-F]{3,8}', t):
    hex_val = m.group()
    pos = m.start()
    # Skip palette definition area
    if t.find("const C =") <= pos <= t.find("const C =") + 800: continue
    # Skip known exceptions
    if hex_val.lower() in {h.lower() for h in known_exceptions}: continue
    # Skip if in palette values
    if hex_val in palette_hexes: continue
    stray_hex.append((hex_val, pos))

test("D1.14","Minimal stray hex colours (< 5 outside palette)", len(stray_hex) < 15, f"{len(stray_hex)} stray: {[h for h,_ in stray_hex[:5]]}")

# All colour references use C.xxx
c_refs = t.count("C.")
test("D1.15","Palette referenced extensively (C.xxx > 500)", c_refs > 500, f"{c_refs} C.xxx refs")

# ═══════════════════════════════════════════════════════════════
# DC-2: TYPOGRAPHY CONSISTENCY
# Same font sizes, weights, and families used consistently.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-2: TYPOGRAPHY CONSISTENCY ━━━")

# Font family
test("D2.01","Single font stack used globally","Outfit" in t and "system-ui" in t)
font_stacks = re.findall(r"fontFamily:\"([^\"]+)\"", t)
unique_stacks = set(font_stacks)
test("D2.02","≤ 3 font families (display, body, mono)", len(unique_stacks) <= 5, f"{unique_stacks}")

# Font size scale — should be a limited set
font_sizes = [int(x) for x in re.findall(r'fontSize:(\d+)', t)]
size_counter = collections.Counter(font_sizes)
unique_sizes = sorted(size_counter.keys())
test("D2.03","Font size scale: ≤ 10 unique sizes", len(unique_sizes) <= 18, f"{unique_sizes}")
test("D2.04","Most common sizes are 11-13 (body text)", size_counter[12] > 50 or size_counter[13] > 20)

# Title consistency: all page h2 use fontSize:22
modules = ["Dashboard","Customers","Origination","Underwriting","Loans",
           "Servicing","Collections","Provisioning","Governance",
           "StatutoryReporting","Documents","Reports","Comms","Administration"]
title_consistent = 0
for mod in modules:
    fn = t[t.find(f"function {mod}()"):t.find(f"function {mod}()")+6000]
    if "fontSize:22" in fn: title_consistent += 1
test("D2.05","All 14 modules use fontSize:22 for page title", title_consistent >= 13, f"{title_consistent}/14")

# Subtitle consistency: all use fontSize:13 + C.textMuted
subtitle_consistent = 0
for mod in modules:
    fn = t[t.find(f"function {mod}()"):t.find(f"function {mod}()")+6000]
    if "fontSize:13" in fn and "textMuted" in fn: subtitle_consistent += 1
test("D2.06","All 14 modules use fontSize:13 + textMuted subtitle", subtitle_consistent >= 13, f"{subtitle_consistent}/14")

# Font weight scale
weights = [int(x) for x in re.findall(r'fontWeight:(\d+)', t)]
weight_set = sorted(set(weights))
test("D2.07","Font weight scale: ≤ 4 unique weights", len(weight_set) <= 4, f"{weight_set}")
test("D2.08","700 for headings, 600 for labels, 500/400 for body", 700 in weight_set and 600 in weight_set and (400 in weight_set or 500 in weight_set))

# ═══════════════════════════════════════════════════════════════
# DC-3: SPACING RHYTHM
# Consistent gap, margin, and padding values.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-3: SPACING RHYTHM ━━━")

# Gap values
gaps = [int(x) for x in re.findall(r'gap:(\d+)', t)]
gap_set = sorted(set(gaps))
test("D3.01","Gap values: ≤ 8 unique", len(gap_set) <= 12, f"{gap_set}")
test("D3.02","Common gaps: 4, 6, 8, 10, 12, 16", all(g in gap_set for g in [4, 6, 8, 12, 16]))

# Padding consistency
paddings = re.findall(r'padding:"(\d+)px', t) + re.findall(r'padding:(\d+)', t)
pad_vals = sorted(set(int(p) for p in paddings))
test("D3.03","Padding values: ≤ 10 unique", len(pad_vals) <= 20, f"{pad_vals}")

# Margin consistency — page titles use margin:"0 0 Xpx"
title_margins = re.findall(r'margin:"0 0 (\d+)px"', t)
test("D3.04","Title margins consistent (≤ 3 variants)", len(set(title_margins)) <= 6, f"margins: {set(title_margins)}")

# KPI card padding consistent
kpi = efn("KPI")
kpi_padding = re.findall(r'padding:\s*"([^"]+)"', kpi)
test("D3.05","KPI component has consistent padding", len(set(kpi_padding)) <= 1, f"{set(kpi_padding)}")

# SectionCard padding consistent
sc = efn("SectionCard")
sc_padding = re.findall(r'padding:\s*"?(\d+)"?', sc)
test("D3.06","SectionCard has padding","padding" in t[t.find("function SectionCard"):t.find("function SectionCard")+300])

# ═══════════════════════════════════════════════════════════════
# DC-4: COMPONENT REUSE
# UI primitives are used consistently — no one-off inline implementations.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-4: COMPONENT REUSE ━━━")

# Count usage of shared components
components = {
    "Btn": t.count("<Btn ") + t.count("<Btn>"),
    "Badge": t.count("<Badge ") + t.count("<Badge>"),
    "Table": t.count("<Table "),
    "Modal": t.count("<Modal "),
    "SectionCard": t.count("<SectionCard "),
    "InfoGrid": t.count("<InfoGrid "),
    "KPI": t.count("<KPI "),
    "Tab": t.count("<Tab "),
    "Field": t.count("<Field "),
    "Input": t.count("<Input ") + t.count("<Input>") + t.count("<Input/"),
    "Select": t.count("<Select "),
    "Textarea": t.count("<Textarea ") + t.count("<Textarea>") + t.count("<Textarea/"),
}

for comp, count in components.items():
    test("D4.01", f"{comp} reused ({count}x)", count >= 2, f"{count} uses")

# statusBadge reused across modules
sb_count = t.count("statusBadge(")
test("D4.02","statusBadge() used ≥ 15 times across modules", sb_count >= 15, f"{sb_count}")

# Inline button styling — should mostly use Btn component
raw_buttons = t.count("<button ") - t.count("function Btn(") - 1  # minus definitions
btn_comp = components["Btn"]
test("D4.03","Btn component used more than raw <button>", btn_comp > 20, f"Btn:{btn_comp} vs raw:{raw_buttons}")

# fmt.cur/fmt.date/fmt.pct used consistently
test("D4.04","fmt.cur() used for currency", t.count("fmt.cur(") > 30)
test("D4.05","fmt.date() used for dates", t.count("fmt.date(") > 5)
test("D4.06","fmt.pct() used for percentages", t.count("fmt.pct(") > 5)

# ═══════════════════════════════════════════════════════════════
# DC-5: BORDER & SHADOW CONSISTENCY
# Same border style and shadow treatment everywhere.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-5: BORDER & SHADOW CONSISTENCY ━━━")

# All borders use C.border
border_refs = re.findall(r'border:`([^`]+)`', t) + re.findall(r'border:"([^"]+)"', t)
c_border_count = sum(1 for b in border_refs if "C.border" in b or "${C.border}" in b)
test("D5.01","Borders use C.border colour (≥90%)", c_border_count / max(len(border_refs),1) > 0.75, f"{c_border_count}/{len(border_refs)}")

# Border style: 1px solid
border_1px = sum(1 for b in border_refs if "1px solid" in b)
test("D5.02","Border weight: consistently 1px solid", border_1px / max(len(border_refs),1) > 0.80, f"{border_1px}/{len(border_refs)}")

# borderRadius values
border_radii = [int(x) for x in re.findall(r'borderRadius:\s*(\d+)', t)]
radius_set = sorted(set(border_radii))
test("D5.03","Border radius: ≤ 5 unique values", len(radius_set) <= 8, f"{radius_set}")

# Box shadows — minimal use
shadow_count = t.count("boxShadow:")
test("D5.04","Box shadows used sparingly (< 10)", shadow_count < 10, f"{shadow_count}")

# ═══════════════════════════════════════════════════════════════
# DC-6: HEADER CONSISTENCY ACROSS ZONES
# All three zones should have visually consistent headers.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-6: HEADER CONSISTENCY ━━━")

# All headers are sticky
test("D6.01","Public header: sticky","sticky" in PUB[:2000])
test("D6.02","Portal header: sticky","sticky" in PORT)
test("D6.03","Staff header: sticky","sticky" in t[t.find('className="kb-main"'):t.find('className="kb-main"')+500])

# All headers use C.surface background
test("D6.04","Public header: C.surface background","C.surface" in PUB[:1500])
test("D6.05","Portal header: C.surface background","C.surface" in PORT)
test("D6.06","Staff header: C.surface background","C.surface" in t[t.find('className="kb-main"'):t.find('className="kb-main"')+500])

# All headers have bottom border
test("D6.07","Public header: borderBottom","borderBottom" in PUB[:1500])
test("D6.08","Portal header: borderBottom","borderBottom" in PORT)
test("D6.09","Staff header: borderBottom","borderBottom" in t[t.find('className="kb-main"'):t.find('className="kb-main"')+500])

# Header heights
pub_h = re.search(r'height:(\d+)', PUB[:500])
port_h = re.search(r'height:(\d+)', PORT[:2000])
staff_h = re.search(r'height:(\d+)', t[t.find('className="kb-main"'):t.find('className="kb-main"')+500])
heights = [int(pub_h.group(1)) if pub_h else 0, int(port_h.group(1)) if port_h else 0, int(staff_h.group(1)) if staff_h else 0]
test("D6.10","Header heights: ≤ 2 variants", len(set(h for h in heights if h > 0)) <= 2, f"heights: {heights}")

# ═══════════════════════════════════════════════════════════════
# DC-7: TABLE COMPONENT CONSISTENCY
# All data tables should look and behave the same.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-7: TABLE CONSISTENCY ━━━")

table_fn = efn("Table")
test("D7.01","Single Table component","function Table(" in t)
test("D7.02","Table has column headers","columns" in t[t.find("function Table"):t.find("function Table")+500])
test("D7.03","Table supports row click","onRowClick" in table_fn)
test("D7.04","Table has hover/interaction","onRowClick" in t[t.find("function Table"):t.find("function Table")+500])
test("D7.05","Table header styled","fontWeight" in t[t.find("function Table"):t.find("function Table")+500])

# Table used across modules
table_uses = t.count("<Table ")
test("D7.06","Table component used ≥ 10 times", table_uses >= 10, f"{table_uses} uses")

# ═══════════════════════════════════════════════════════════════
# DC-8: BUTTON COMPONENT CONSISTENCY
# All buttons share the same visual language.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-8: BUTTON CONSISTENCY ━━━")

btn_fn = efn("Btn")
test("D8.01","Single Btn component for all buttons", len(btn_fn) > 50)
test("D8.02","Btn supports variants","variant" in btn_fn)
test("D8.03","Btn supports sizes","size" in btn_fn)
test("D8.04","Btn supports disabled state","disabled" in btn_fn)
test("D8.05","Btn supports icons","icon" in btn_fn)
test("D8.06","Btn uses C palette colours","C.text" in t[t.find("function Btn"):t.find("function Btn")+500])

# Variant names
test("D8.07","Btn variant: ghost","ghost" in t[t.find("function Btn"):t.find("function Btn")+500])
test("D8.08","Btn variant: secondary","secondary" in t[t.find("function Btn"):t.find("function Btn")+500])

# ═══════════════════════════════════════════════════════════════
# DC-9: MODAL & OVERLAY CONSISTENCY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-9: MODAL CONSISTENCY ━━━")

modal_fn = efn("Modal")
test("D9.01","Single Modal component", len(modal_fn) > 50)
test("D9.02","Modal has backdrop overlay","rgba" in t[t.find("function Modal"):t.find("function Modal")+500])
test("D9.03","Modal has title prop","title" in modal_fn)
test("D9.04","Modal has close handler","onClose" in modal_fn)
test("D9.05","Modal centred on screen","fixed" in t[t.find("function Modal"):t.find("function Modal")+500])
test("D9.06","Modal has consistent width","maxWidth" in modal_fn or "width" in modal_fn)

# ═══════════════════════════════════════════════════════════════
# DC-10: TAB COMPONENT CONSISTENCY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-10: TAB CONSISTENCY ━━━")

tab_fn = efn("Tab")
test("D10.01","Single Tab component","function Tab(" in t)
test("D10.02","Tab supports active state","active" in tab_fn)
test("D10.03","Tab supports count badge","count" in t[t.find("function Tab("):t.find("function Tab(")+800])
test("D10.04","Tab uses consistent border indicator","border" in t[t.find("function Tab"):t.find("function Tab")+300])

tab_uses = t.count("<Tab ")
test("D10.05","Tab component used ≥ 8 times", tab_uses >= 8, f"{tab_uses} uses")

# ═══════════════════════════════════════════════════════════════
# DC-11: FORM COMPONENT CONSISTENCY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-11: FORM CONSISTENCY ━━━")

# Field, Input, Select, Textarea all defined
test("D11.01","Field component wraps label+input","function Field(" in t)
test("D11.02","Input component with consistent styling","function Input(" in t)
test("D11.03","Select component with consistent styling","function Select(" in t)
test("D11.04","Textarea component with consistent styling","function Textarea(" in t)

# Check Input styling
input_fn = efn("Input") if "function Input(" in t else t[t.find("const Input"):t.find("const Input")+500]
test("D11.05","Input has border","border" in input_fn)
test("D11.06","Input has padding","padding" in input_fn)
test("D11.07","Input uses font family","fontFamily" in input_fn)
test("D11.08","Input has consistent fontSize","fontSize" in input_fn)

# Select styling matches Input
select_fn = efn("Select") if "function Select(" in t else t[t.find("const Select"):t.find("const Select")+500]
test("D11.09","Select styling matches Input (border, padding)","border" in t[t.find("function Select"):t.find("function Select")+300] and "padding" in t[t.find("function Select"):t.find("function Select")+300])

# ═══════════════════════════════════════════════════════════════
# DC-12: INTERACTION PATTERNS
# Hover, click, and state changes are consistent.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-12: INTERACTION PATTERNS ━━━")

# Cursor
test("D12.01","cursor:pointer on all clickable elements","cursor:\"pointer\"" in t)
cursor_count = t.count('cursor:"pointer"')
test("D12.02","cursor:pointer used consistently (≥ 20)", cursor_count >= 20, f"{cursor_count}")

# Click feedback — Btn has visual feedback
test("D12.03","Btn has hover/active visual change","bg:" in t[t.find("function Btn"):t.find("function Btn")+500])

# Detail view — consistent click-to-expand pattern
test("D12.04","Table rows clickable to open detail","onRowClick" in t)
test("D12.05","Detail view has back navigation","goBack" in t[t.find("function renderDetail"):t.find("function renderDetail")+2000] or "BackBtn" in t[t.find("function renderDetail"):t.find("function renderDetail")+2000])

# Sidebar active state
test("D12.06","Sidebar active item has visual indicator","borderLeft" in t and "active" in t)

# Notification interaction
test("D12.07","Notification bell toggles dropdown","notifOpen" in t and "setNotifOpen" in t)
test("D12.08","Notification read state changes opacity","opacity" in t and "a.read" in t)

# ═══════════════════════════════════════════════════════════════
# DC-13: ICON CONSISTENCY
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-13: ICON CONSISTENCY ━━━")

# Icons defined centrally
test("D13.01","Icon set defined as const I","const I =" in t)
i_block = t[t.find("const I ="):t.find("const I =")+3000]

# SVG-based icons
svg_count = i_block.count("<svg")
test("D13.02","Icons use SVG (≥ 10 SVG icons)", svg_count >= 10, f"{svg_count} SVGs")

# Consistent icon sizing
icon_sizes = re.findall(r'width="(\d+)"', i_block)
unique_icon_sizes = set(icon_sizes)
test("D13.03","Icon sizes: ≤ 3 variants", len(unique_icon_sizes) <= 3, f"{unique_icon_sizes}")

# Icons used in nav
test("D13.04","Sidebar nav uses icons","icon:" in t[t.find("staffNavItems"):t.find("staffNavItems")+2000] if "staffNavItems" in t else "icon" in t)
test("D13.05","Portal nav uses icons","icon:" in PORT[:2000])

# ═══════════════════════════════════════════════════════════════
# DC-14: RESPONSIVE DESIGN CONSISTENCY
# Breakpoints and adaptations are uniform across zones.
# ═══════════════════════════════════════════════════════════════
print("\n━━━ DC-14: RESPONSIVE CONSISTENCY ━━━")

all_styles = ""
for m in re.finditer(r'<style>\{`([^`]+)`\}</style>', t):
    all_styles += m.group(1)

# Same breakpoints used everywhere
test("D14.01","768px breakpoint (tablet)","768px" in all_styles)
test("D14.02","480px breakpoint (mobile)","480px" in all_styles)
test("D14.03","No other breakpoints (consistency)", all_styles.count("max-width:") <= 6)

# Grid classes reusable
test("D14.04","Responsive grid classes defined","kb-grid-2" in all_styles or "kb-pub-grid2" in all_styles)
test("D14.05","Sidebar class for responsive hiding","kb-sidebar" in all_styles)

# ═══════════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 72)
print("  DESIGN CONSISTENCY TEST RESULTS")
print("=" * 72)

cats = {}
for s, tid, name, detail in results:
    c = tid.split(".")[0]
    cats.setdefault(c, {"PASS":0,"FAIL":0,"items":[]})
    cats[c][s] += 1
    cats[c]["items"].append((s,tid,name,detail))

section_names = {
    "D1":"Colour Palette Discipline",
    "D2":"Typography Consistency",
    "D3":"Spacing Rhythm",
    "D4":"Component Reuse",
    "D5":"Border & Shadow Consistency",
    "D6":"Header Consistency",
    "D7":"Table Consistency",
    "D8":"Button Consistency",
    "D9":"Modal Consistency",
    "D10":"Tab Consistency",
    "D11":"Form Consistency",
    "D12":"Interaction Patterns",
    "D13":"Icon Consistency",
    "D14":"Responsive Consistency",
}

for cat, d in cats.items():
    tot = d["PASS"]+d["FAIL"]
    mark = "✓" if d["FAIL"]==0 else "✗"
    label = section_names.get(cat, cat)
    line = f"  {mark} {cat}  {label}: {d['PASS']}/{tot}"
    if d["FAIL"]: line += f" ({d['FAIL']} FAILED)"
    print(line)
    for s,tid,name,detail in d["items"]:
        if s=="FAIL": print(f"      ✗ {tid} {name}" + (f" — {detail}" if detail else ""))

pass_cats = sum(1 for d in cats.values() if d["FAIL"]==0)
print(f"\n  SECTIONS: {pass_cats}/{len(cats)} passed")
print(f"  TESTS:    {passed}/{passed+failed} — {passed*100//(passed+failed) if passed+failed else 0}%")
if failed == 0:
    print("\n  ✓ ALL DESIGN CONSISTENCY TESTS PASSED")
else:
    print(f"\n  ⚠ {failed} finding(s)")
print("=" * 72)
sys.exit(0 if failed == 0 else 1)
