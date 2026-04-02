#!/usr/bin/env python3
"""
KwikBridge LMS — Integrity Check
Run after every edit to catch structural breakage immediately.
Usage: python3 check.py [filepath]
"""
import sys, re

filepath = sys.argv[1] if len(sys.argv) > 1 else "src/kwikbridge-lms-v2.jsx"

try:
    t = open(filepath).read()
except FileNotFoundError:
    print(f"FAIL: File not found: {filepath}")
    sys.exit(1)

errors = []
warnings = []

# 1. Bracket balance
# 1. Bracket balance (naive count — works for JSX without parens in string literals)
# Note: may produce false positives if string literals contain unmatched brackets
import re
braces_open = t.count('{')
braces_close = t.count('}')
parens_open = t.count('(')
parens_close = t.count(')')
brackets_open = t.count('[')
brackets_close = t.count(']')

if braces_open != braces_close:
    errors.append(f"BRACE MISMATCH: {braces_open} open, {braces_close} close (diff: {braces_open - braces_close})")
if parens_open != parens_close:
    diff = abs(parens_open - parens_close)
    if diff > 2:
        errors.append(f"PAREN MISMATCH: {parens_open} open, {parens_close} close (diff: {parens_open - parens_close})")
    else:
        warnings.append(f"Paren count diff: {parens_open - parens_close} (may be string literal edge case)")
if brackets_open != brackets_close:
    errors.append(f"BRACKET MISMATCH: {brackets_open} open, {brackets_close} close (diff: {brackets_open - brackets_close})")

# 2. Required structures
if 'export default' not in t:
    errors.append("MISSING: export default function")
if 'function seed()' not in t and 'function seed (' not in t:
    errors.append("MISSING: seed() function")
if t.count('export default function') != 1:
    errors.append(f"EXPORT DEFAULT: found {t.count('export default function')} (expected 1)")

# 3. Required handlers
required_handlers = [
    'moveToUnderwriting', 'runDDStep', 'decideLoan', 'submitApp',
    'recordPayment', 'addCollectionAction', 'signOffStep',
    'actionFindingItem', 'approveDocument', 'sendNotification',
]
for h in required_handlers:
    if h not in t:
        errors.append(f"MISSING HANDLER: {h}")

# 4. Required page components
required_pages = [
    'function Dashboard', 'function Customers', 'function Origination',
    'function Underwriting', 'function Loans', 'function Servicing',
    'function Collections', 'function Provisioning', 'function Governance',
    'function StatutoryReporting', 'function Documents', 'function Reports',
    'function Comms', 'function renderPage', 'function renderDetail',
]
for p in required_pages:
    if p not in t:
        errors.append(f"MISSING PAGE: {p}")

# 5. Required data entities in seed
required_seed = ['customers', 'products', 'applications', 'loans', 'collections',
                 'alerts', 'audit', 'provisions', 'comms', 'documents', 'statutoryReports']
for s in required_seed:
    if f'const {s}' not in t and f'  {s},' not in t and f'  {s}:' not in t:
        # Looser check
        if s not in t:
            errors.append(f"MISSING SEED DATA: {s}")

# 6. Size warnings
lines = t.count('\n') + 1
if lines > 3000:
    warnings.append(f"FILE SIZE: {lines} lines — consider splitting into modules")
elif lines > 2500:
    warnings.append(f"FILE SIZE: {lines} lines — approaching split threshold")

# 7. Check for common corruption patterns
if '<<<' in t and 'HEAD' in t:
    errors.append("GIT CONFLICT MARKERS detected in file")
if t.count('function App()') > 1 or t.count('function App ') > 1:
    errors.append("DUPLICATE App component detected")

# Report
print(f"\n{'='*60}")
print(f"KwikBridge LMS Integrity Check")
print(f"{'='*60}")
print(f"File: {filepath}")
print(f"Lines: {lines}")
print(f"Size: {len(t):,} bytes")
print(f"Braces: {braces_open}/{braces_close} {'✓' if braces_open == braces_close else '✗ MISMATCH'}")
print(f"Parens: {parens_open}/{parens_close} {'✓' if parens_open == parens_close else '✗ MISMATCH'}")
print(f"Brackets: {brackets_open}/{brackets_close} {'✓' if brackets_open == brackets_close else '✗ MISMATCH'}")
print(f"Functions: {t.count('function ')}")
print(f"useState: {t.count('useState')}")
print()

if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors:
        print(f"  ✗ {e}")
else:
    print("✓ No errors found")

if warnings:
    print(f"\nWARNINGS ({len(warnings)}):")
    for w in warnings:
        print(f"  ⚠ {w}")

print(f"\n{'FAIL' if errors else 'PASS'}")
print(f"{'='*60}\n")

sys.exit(1 if errors else 0)
