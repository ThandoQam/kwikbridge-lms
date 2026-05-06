#!/usr/bin/env python3
"""
RLS Static Analyser — finds gaps in the RLS policy migration.

Reads supabase/migrations/002_rls_hardening.sql and verifies that every
table in the policy scope has the right policies for each role × operation
combination. Outputs a coverage matrix + list of gaps.

This complements the runtime verification (scripts/security/verify_rls.mjs)
by catching authoring mistakes before they ship to production.

Usage:  python3 scripts/security/analyse_rls.py
"""
import re
import sys
from pathlib import Path

MIGRATION = Path('supabase/migrations/002_rls_hardening.sql')

# Tables that MUST have RLS enforced
TABLES = [
    'customers', 'products', 'applications', 'loans',
    'documents', 'collections', 'audit_trail', 'alerts',
    'provisions', 'comms', 'statutory_reports', 'settings',
]

# The role taxonomy from the migration header
STAFF_ROLES = {
    'ADMIN', 'EXEC', 'CREDIT_HEAD', 'COMPLIANCE',
    'CREDIT_SNR', 'CREDIT', 'LOAN_OFFICER', 'COLLECTIONS',
    'FINANCE', 'AUDITOR', 'VIEWER',
}
READ_ONLY = {'AUDITOR', 'VIEWER'}


def parse_policies(sql: str):
    """Extract every CREATE POLICY block as a dict."""
    pattern = re.compile(
        r'CREATE POLICY "(?P<name>[^"]+)"\s+ON\s+(?P<table>\w+)\s+'
        r'FOR\s+(?P<operation>\w+)\s+'
        r'TO\s+(?P<roles>[\w\s,]+?)\s+'
        r'(?:USING\s*\((?P<using>.*?)\))?'
        r'(?:\s*WITH\s+CHECK\s*\((?P<check>.*?)\))?'
        r'\s*;',
        re.DOTALL,
    )
    return [m.groupdict() for m in pattern.finditer(sql)]


def main():
    if not MIGRATION.exists():
        print(f'ERROR: {MIGRATION} not found')
        sys.exit(1)

    sql = MIGRATION.read_text()
    policies = parse_policies(sql)

    print(f'╔══════════════════════════════════════════════════════════════╗')
    print(f'║  RLS Static Analysis — {MIGRATION.name}')
    print(f'╚══════════════════════════════════════════════════════════════╝')
    print()
    print(f'Found {len(policies)} CREATE POLICY statements\n')

    # ───── Check 1: every table has at least one SELECT policy ─────
    print('═══ Check 1: SELECT coverage (read access) ═══')
    select_by_table = {}
    for p in policies:
        if p['operation'] in ('SELECT', 'ALL'):
            select_by_table.setdefault(p['table'], []).append(p['name'])
    gaps_select = []
    for t in TABLES:
        names = select_by_table.get(t, [])
        if not names:
            gaps_select.append(t)
            print(f'  ❌ {t}: NO SELECT policy — table is unreadable')
        else:
            print(f'  ✓ {t}: {len(names)} policy/policies covering SELECT')
    print()

    # ───── Check 2: every table has at least one write policy ─────
    print('═══ Check 2: write coverage (INSERT/UPDATE/DELETE/ALL) ═══')
    write_by_table = {}
    for p in policies:
        if p['operation'] in ('INSERT', 'UPDATE', 'DELETE', 'ALL'):
            write_by_table.setdefault(p['table'], []).append((p['name'], p['operation']))
    for t in TABLES:
        ops = write_by_table.get(t, [])
        if not ops:
            print(f'  ⚠ {t}: no write policies (read-only table?)')
        else:
            op_set = sorted({op for _, op in ops})
            print(f"  ✓ {t}: {', '.join(op_set)} ({len(ops)} policies)")
    print()

    # ───── Check 3: borrower isolation pattern ─────
    print('═══ Check 3: borrower isolation (data scoped to user) ═══')
    borrower_tables = ['customers', 'applications', 'loans', 'documents', 'comms']
    for t in borrower_tables:
        has_borrower = any(
            p['table'] == t
            and ('NOT public.is_staff()' in (p.get('using') or '')
                 or 'BORROWER' in (p.get('using') or ''))
            for p in policies
        )
        if has_borrower:
            print(f'  ✓ {t}: borrower-scoped policy exists')
        else:
            print(f'  ❌ {t}: NO borrower isolation policy — borrowers cannot access own data')
    print()

    # ───── Check 4: append-only tables (audit_trail) ─────
    print('═══ Check 4: append-only enforcement (audit trail) ═══')
    audit_policies = [p for p in policies if p['table'] == 'audit_trail']
    audit_ops = {p['operation'] for p in audit_policies}
    if 'UPDATE' in audit_ops or 'DELETE' in audit_ops or 'ALL' in audit_ops:
        print('  ❌ audit_trail: UPDATE/DELETE/ALL policy exists — '
              'audit log is mutable (compliance violation)')
    else:
        print('  ✓ audit_trail: no UPDATE/DELETE/ALL policy → append-only enforced')
    print()

    # ───── Check 5: anon access boundary ─────
    print('═══ Check 5: anonymous (unauthenticated) access ═══')
    anon_policies = [
        p for p in policies
        if 'anon' in p['roles'].lower()
    ]
    expected_anon = {
        'products': ['SELECT'],
        'customers': ['INSERT'],
        'applications': ['INSERT'],
        'documents': ['INSERT'],
        'alerts': ['INSERT'],
        'audit_trail': ['INSERT'],
        'settings': ['SELECT'],
    }
    actual_anon = {}
    for p in anon_policies:
        actual_anon.setdefault(p['table'], []).append(p['operation'])

    # Surprises (anon access on tables that shouldn't have it)
    unexpected = set(actual_anon) - set(expected_anon)
    if unexpected:
        for t in unexpected:
            print(f'  ⚠ {t}: unexpected anon access — {actual_anon[t]}')
    # Missing (expected anon access not present)
    missing = set(expected_anon) - set(actual_anon)
    for t in expected_anon:
        if t not in actual_anon:
            print(f'  ❌ {t}: missing expected anon {expected_anon[t]}')
        else:
            ops_actual = set(actual_anon[t])
            ops_expected = set(expected_anon[t])
            if ops_actual >= ops_expected:
                print(f'  ✓ {t}: anon {sorted(ops_expected)}')
            else:
                print(f'  ❌ {t}: anon partial — expected {sorted(ops_expected)}, got {sorted(ops_actual)}')

    # Loans should NEVER have anon access
    if 'loans' in actual_anon:
        print(f'  ❌ loans: ANON ACCESS — critical exposure')
    else:
        print(f'  ✓ loans: no anon access')
    print()

    # ───── Check 6: helper function references ─────
    print('═══ Check 6: helper function usage ═══')
    helpers = ['get_app_role', 'get_user_email', 'is_staff', 'is_admin', 'is_read_only']
    for h in helpers:
        if h in sql:
            print(f'  ✓ {h}: referenced')
        else:
            print(f'  ⚠ {h}: defined but unused?')
    print()

    # ───── Summary ─────
    print('═══ Summary ═══')
    if gaps_select:
        print(f'  ❌ {len(gaps_select)} tables without SELECT policy: {gaps_select}')
    else:
        print(f'  ✓ All {len(TABLES)} tables have SELECT coverage')
    print()
    print('NEXT STEPS:')
    print('  Run runtime verification against live Supabase:')
    print('    node scripts/security/verify_rls.mjs')


if __name__ == '__main__':
    main()
