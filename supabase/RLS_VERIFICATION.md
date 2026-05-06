# RLS Verification

## Purpose

Verify that Row-Level Security policies in `migrations/002_rls_hardening.sql`
are correctly applied and enforcing access control in production.

## Why this matters

Without RLS, a borrower with a valid auth token could query the database
directly via the Supabase REST API and see other borrowers' loans, customers'
PII, and audit trail. RLS is the only layer between authenticated users and
full data access.

## Two-stage verification

This project uses a two-stage approach:

### Stage 1 — Static analysis (runs in CI)

`scripts/security/analyse_rls.py` parses the migration SQL and verifies
the policy matrix is complete:

- Every table has at least one SELECT policy
- Every table has appropriate write policies
- Borrower-scoped tables have isolation policies (NOT public.is_staff() guard)
- `audit_trail` has no UPDATE/DELETE policies (append-only)
- Anonymous access is bounded to the expected 7 tables only
- Loans never have anon access
- All five helper functions (get_app_role, get_user_email, is_staff,
  is_admin, is_read_only) are referenced

Run locally:

```bash
npm run rls:analyse
```

This catches authoring mistakes before they ship — for example, forgetting
to add a borrower-scoped policy when adding a new table, or accidentally
giving anon access to loans.

**Runs automatically in CI on every push.** A failure here blocks merge.

### Stage 2 — Runtime verification (manual, against production)

`scripts/security/verify_rls.mjs` is an adversarial probe that signs in
as test borrowers and attempts unauthorised access. It produces a
pass/fail report and exits with a non-zero code on failure.

Run on demand:

```bash
npm run rls:verify
```

Exit codes:
- `0` — all checks passed
- `1` — one or more checks failed (RLS broken — investigate immediately)
- `2` — environment misconfigured (missing env vars or test data)

**Does not run in CI** because it requires production credentials and
test borrower accounts. Schedule:

- **Initial verification:** before first production user
- **Quarterly:** part of compliance audit cycle
- **Post-migration:** any time a new table is added or migration applied
- **After any RLS-related change:** before merging to main

## Setup for runtime verification

One-time setup:

1. **Create test accounts in Supabase Auth dashboard:**
   - `rls-borrower-1@kwikbridge.test`
   - `rls-borrower-2@kwikbridge.test`

   The script uses these exact email addresses to verify isolation.

2. **Insert customer rows for each test account:**

   ```sql
   INSERT INTO customers (id, name, email)
   VALUES
     ('RLS-CUST-1', 'RLS Test 1', 'rls-borrower-1@kwikbridge.test'),
     ('RLS-CUST-2', 'RLS Test 2', 'rls-borrower-2@kwikbridge.test');
   ```

3. **Optionally insert a loan row for B2** (so the script can verify B1
   doesn't see it):

   ```sql
   INSERT INTO loans (id, cust_id, amount, balance, status)
   VALUES ('RLS-LOAN-2', 'RLS-CUST-2', 100000, 100000, 'Active');
   ```

4. **Set environment variables:**

   ```bash
   export SUPABASE_URL=https://xxx.supabase.co
   export SUPABASE_ANON_KEY=eyJhbGc...
   export RLS_BORROWER_1_PWD=<password set in auth>
   export RLS_BORROWER_2_PWD=<password set in auth>

   # Optional — enables additional staff-side checks:
   export RLS_STAFF_EMAIL=admin@example.com
   export RLS_STAFF_PWD=<password>
   ```

## What the runtime script verifies

### Anonymous access boundary

- ✓ GET /products returns data (public)
- ✓ GET /customers blocked (anon SELECT not allowed)
- ✓ GET /loans blocked (no anon access at all)
- ✓ GET /audit_trail blocked
- ✓ POST /customers allowed (public application form)

### Borrower isolation

- ✓ Borrower 1 sees only own customer record
- ✓ Borrower 1 cannot read Borrower 2's loans
- ✓ Borrower 1 cannot UPDATE Borrower 2's customer record

### Append-only audit trail

- ✓ audit_trail rows cannot be UPDATEd (no UPDATE policy)
- ✓ audit_trail rows cannot be DELETEd (no DELETE policy)

### Staff access (if `RLS_STAFF_EMAIL`/`PWD` set)

- ✓ Staff can read all customers (more than 1 row)
- ✓ Staff can read loans
- ✓ Staff can read provisions

## Failure response

If runtime RLS verification fails:

1. **Immediately disable public access** to the affected table by removing
   the anon read policy via Supabase SQL Editor.
2. **Audit access logs** in Supabase Dashboard → Logs → API Logs to
   determine if any unauthorised access occurred during the window the
   policy was broken.
3. **Apply the migration fix** to correct the policy.
4. **Re-run** `npm run rls:verify` to confirm.
5. **POPIA notification:** if any borrower PII was accessible to other
   borrowers, the Information Officer must be notified within 72 hours
   per POPIA Section 22.

## Files

```
scripts/security/
├── analyse_rls.py          # Static analyser (CI-runnable)
└── verify_rls.mjs           # Runtime probe (production-only)

supabase/
├── migrations/002_rls_hardening.sql   # The policies themselves
└── RLS_VERIFICATION.md     # This document
```
