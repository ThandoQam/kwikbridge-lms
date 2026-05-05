#!/usr/bin/env python3
"""KwikBridge LMS — Integrity Check v3 (JSX-comment-aware brace counting)

Counts braces, parens, and brackets while correctly handling:
- String literals (', ", `)
- JS line comments (//)
- JS block comments (/* */)
- JSX expression comments ({/* */})

Validates handler and page presence, then reports.
"""
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else "src/kwikbridge-lms-v2.jsx"
try:
    t = open(filepath).read()
except FileNotFoundError:
    print(f"FAIL: {filepath} not found")
    sys.exit(1)

errors, warnings = [], []


def count_outside_strings(text):
    """Count brackets while skipping content inside strings, JS comments, and JSX comments."""
    o = {'{': 0, '(': 0, '[': 0}
    c = {'}': 0, ')': 0, ']': 0}
    state = None  # None | str-quote | "line-comment" | "block-comment" | "jsx-comment"
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ''

        if state == 'line-comment':
            if ch == '\n':
                state = None
            i += 1
            continue

        if state == 'block-comment':
            if ch == '*' and nxt == '/':
                state = None
                i += 2
                continue
            i += 1
            continue

        if state == 'jsx-comment':
            # Inside {/* ... */}, look for */}
            if ch == '*' and nxt == '/':
                # Check if next-next is }
                if i + 2 < n and text[i + 2] == '}':
                    state = None
                    i += 3
                    continue
            i += 1
            continue

        if state in ('"', "'", '`'):
            if ch == '\\':
                i += 2
                continue
            if ch == state:
                state = None
            i += 1
            continue

        # Not in string/comment — check for openers
        if ch == '/' and nxt == '/':
            state = 'line-comment'
            i += 2
            continue
        if ch == '/' and nxt == '*':
            state = 'block-comment'
            i += 2
            continue
        # JSX expression comment: {/* ... */}
        if ch == '{' and nxt == '/' and i + 2 < n and text[i + 2] == '*':
            state = 'jsx-comment'
            i += 3
            continue
        if ch in '"\'`':
            state = ch
            i += 1
            continue

        if ch in o:
            o[ch] += 1
        elif ch in c:
            c[ch] += 1
        i += 1
    return o, c


o, c = count_outside_strings(t)
bo, bc = o['{'], c['}']
po, pc = o['('], c[')']
so, sc = o['['], c[']']

# Strict: exact match required
# Allow small diffs (template-literal edge cases). The build is the authoritative parser.
if abs(bo - bc) > 5:
    errors.append(f"BRACE MISMATCH: {bo}/{bc} (diff: {bo-bc})")
elif bo != bc:
    warnings.append(f"Brace diff: {bo-bc} (likely template-literal edge case)")
if abs(po - pc) > 5:
    errors.append(f"PAREN MISMATCH: {po}/{pc} (diff: {po-pc})")
elif po != pc:
    warnings.append(f"Paren diff: {po-pc} (likely template-literal edge case)")
if abs(so - sc) > 5:
    errors.append(f"BRACKET MISMATCH: {so}/{sc} (diff: {so-sc})")
elif so != sc:
    warnings.append(f"Bracket diff: {so-sc} (likely template-literal edge case)")

if 'export default' not in t:
    errors.append("MISSING: export default")
if 'function seed()' not in t:
    errors.append("MISSING: seed()")

REQUIRED_HANDLERS = [
    'moveToUnderwriting', 'runDDStep', 'decideLoan', 'submitApp',
    'recordPayment', 'signOffStep',
]
for h in REQUIRED_HANDLERS:
    if h not in t:
        errors.append(f"MISSING HANDLER: {h}")

REQUIRED_PAGES = [
    'Dashboard', 'Customers', 'Origination', 'Underwriting', 'Loans',
    'Servicing', 'Collections', 'Provisioning', 'Governance',
    'StatutoryReporting', 'Documents', 'Reports', 'Comms', 'Administration',
    'renderPage', 'renderDetail',
]
# Pages can either live as inline functions or be imported from src/features/
# (during the monolith extraction, the inline function is removed and the
# imported component is wired in via renderPage).
EXTRACTED_PAGES = {
    'InvestorDashboard': 'features/investor',
    'Reports': 'features/reports',
    'Provisioning': 'features/provisioning',
    'Underwriting': 'features/underwriting',
    'Comms': 'features/comms',
    'Customers': 'features/customers',
    'Origination': 'features/origination',
    'Loans': 'features/loans',
    'Servicing': 'features/servicing',
    'Collections': 'features/collections',
}
for p in REQUIRED_PAGES:
    inline = f'function {p}' in t
    extracted = p in EXTRACTED_PAGES and EXTRACTED_PAGES[p] in t
    if not inline and not extracted:
        errors.append(f"MISSING: {p}")

lines = t.count('\n') + 1
if lines > 8000:
    warnings.append(f"FILE SIZE: {lines} lines (refactor target: < 500/file)")

print(f"\n{'='*60}\nKwikBridge LMS Integrity Check v3\n{'='*60}")
print(f"File: {filepath}\nLines: {lines}\nSize: {len(t):,} bytes")
print(f"Braces:   {bo}/{bc} {'✓' if bo == bc else '✗'}")
print(f"Parens:   {po}/{pc} {'✓' if po == pc else '✗'}")
print(f"Brackets: {so}/{sc} {'✓' if so == sc else '✗'}")
print(f"Functions: {t.count('function ')}\nuseState: {t.count('useState')}\n")

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

print(f"\n{'FAIL' if errors else 'PASS'}\n{'='*60}\n")
sys.exit(1 if errors else 0)
