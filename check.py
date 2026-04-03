#!/usr/bin/env python3
"""KwikBridge LMS — Integrity Check v2 (string-aware brace counting)"""
import sys, re
filepath = sys.argv[1] if len(sys.argv) > 1 else "src/kwikbridge-lms-v2.jsx"
try: t = open(filepath).read()
except FileNotFoundError: print(f"FAIL: {filepath} not found"); sys.exit(1)
errors, warnings = [], []
def count_outside_strings(text):
    o = {'{':0,'(':0,'[':0}; c = {'}':0,')':0,']':0}; s = None; i = 0
    while i < len(text):
        ch = text[i]
        if s:
            if ch == '\\': i += 2; continue
            if ch == s: s = None
        elif ch in '"\'': s = ch
        elif ch == '`': s = ch
        elif ch in o: o[ch] += 1
        elif ch in c: c[ch] += 1
        i += 1
    return o, c
o, c = count_outside_strings(t)
ro,rc,rpo,rpc,rso,rsc = t.count('{'),t.count('}'),t.count('('),t.count(')'),t.count('['),t.count(']')
bo,bc,po,pc,so,sc = o['{'],c['}'],o['('],c[')'],o['['],c[']']
if abs(bo-bc)>2: errors.append(f"BRACE MISMATCH: {bo}/{bc} (diff:{bo-bc})")
elif bo!=bc: warnings.append(f"Brace diff: {bo-bc} (template literal edge case)")
if abs(po-pc)>2: errors.append(f"PAREN MISMATCH: {po}/{pc} (diff:{po-pc})")
elif po!=pc: warnings.append(f"Paren diff: {po-pc} (string literal edge case)")
if so!=sc: errors.append(f"BRACKET MISMATCH: {so}/{sc}")
if 'export default' not in t: errors.append("MISSING: export default")
if 'function seed()' not in t: errors.append("MISSING: seed()")
for h in ['moveToUnderwriting','runDDStep','decideLoan','submitApp','recordPayment','signOffStep']:
    if h not in t: errors.append(f"MISSING HANDLER: {h}")
for p in ['Dashboard','Customers','Origination','Underwriting','Loans','Servicing','Collections','Provisioning','Governance','StatutoryReporting','Documents','Reports','Comms','Administration','renderPage','renderDetail']:
    if f'function {p}' not in t: errors.append(f"MISSING: {p}")
lines = t.count('\n')+1
if lines > 3000: warnings.append(f"FILE SIZE: {lines} lines")
print(f"\n{'='*60}\nKwikBridge LMS Integrity Check v2\n{'='*60}")
print(f"File: {filepath}\nLines: {lines}\nSize: {len(t):,} bytes")
print(f"Braces: {bo}/{bc} {'✓' if bo==bc else '~'} (raw:{ro}/{rc})")
print(f"Parens: {po}/{pc} {'✓' if po==pc else '~'} (raw:{rpo}/{rpc})")
print(f"Brackets: {so}/{sc} {'✓' if so==sc else '✗'}")
print(f"Functions: {t.count('function ')}\nuseState: {t.count('useState')}\n")
if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors: print(f"  ✗ {e}")
else: print("✓ No errors found")
if warnings:
    print(f"\nWARNINGS ({len(warnings)}):")
    for w in warnings: print(f"  ⚠ {w}")
print(f"\n{'FAIL' if errors else 'PASS'}\n{'='*60}\n")
sys.exit(1 if errors else 0)
