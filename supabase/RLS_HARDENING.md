# KwikBridge LMS — RLS Hardening

## Overview

This migration replaces the permissive "all authenticated users can do everything"
RLS policies with per-role, per-table security rules that enforce the principle of
least privilege at the database level.

## Architecture

```
User signs in → Supabase Auth → Trigger assigns app_role → JWT contains role
                                                              ↓
Browser sends JWT → Supabase REST API → RLS checks get_app_role() → Allow/Deny
```

The `app_role` is stored in `auth.users.raw_user_meta_data` and appears in every
JWT as `user_metadata.app_role`. RLS policies read it via `get_app_role()`.

## Role → Access Matrix

| Table | ADMIN/EXEC | CREDIT_HEAD | CREDIT/CREDIT_SNR | LOAN_OFFICER | COLLECTIONS | FINANCE | COMPLIANCE | AUDITOR/VIEWER | BORROWER |
|-------|-----------|-------------|-------------------|-------------|-------------|---------|-----------|---------------|----------|
| customers | RW | RW | R | RW | R | R | R | R | Own RW |
| products | RW | R | R | R | R | R | R | R | R (anon) |
| applications | RW | RW | RW | RW | R | R | R | R | Own RW |
| loans | RW | RW | RW | RW | R | RW | R | R | Own R+U |
| documents | RW | RW | RW | RW | R | R | R | R | Own RW |
| collections | RW | RW | — | RW | RW | — | — | R | — |
| audit_trail | R+I | R+I | R+I | R+I | R+I | R+I | R+I | R | — |
| alerts | RW | RW | RW | RW | RW | RW | RW | R | R |
| provisions | RW | RW | — | — | — | RW | — | R | — |
| comms | RW | RW | RW | RW | RW | RW | RW | R | Own R |
| statutory_reports | RW | R | R | R | R | R | RW | R | — |
| settings | RW | R | R | R | R | R | R | R | — |

**Legend:** R=Read, W=Write (insert+update), I=Insert only, Own=filtered by customer email

## Key Security Rules

### Audit Trail is Append-Only
No RLS policy exists for UPDATE or DELETE on `audit_trail`. Since RLS is enabled,
the absence of a policy means those operations are blocked for everyone. Only INSERT
is allowed (for staff) — ensuring the audit log is immutable.

### Borrower Data Isolation
Borrowers can only see/modify records linked to their own customer profile. The
matching is done by email: `cust_id IN (SELECT id FROM customers WHERE email = get_user_email())`.
This means a borrower can never see another borrower's data, even via direct API calls.

### Public Application Form
Anonymous users (not signed in) can create customers, applications, documents, alerts,
and audit entries — this supports the public "Apply for Financing" form.

### Product Catalog is Public
Products are readable by anonymous users (landing page needs to display them).
Only ADMIN/EXEC can create or modify products.

### Settings is Read-Only for Most
All authenticated users can read settings (for NCR registration display).
Only ADMIN/EXEC can modify settings.

## Migrations to Apply (in order)

```
1. supabase/migrations/001_normalise_schema.sql    — Tables + indexes
2. supabase/migrations/002_rls_hardening.sql        — Per-role RLS policies
3. supabase/migrations/003_auth_role_assignment.sql — Role trigger + staff_roles
```

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Run `002_rls_hardening.sql` first
3. Run `003_auth_role_assignment.sql` second

### Option 2: CLI

```bash
# Requires service_role key for DDL operations
SUPABASE_SERVICE_KEY=your_key node supabase/run_migration.js
```

## Verification

After applying, verify in Supabase Dashboard:

### 1. Check Policies
Go to **Authentication → Policies**. Each table should show multiple policies
(not just one permissive one).

### 2. Test Borrower Isolation
```sql
-- As a borrower user, this should return only their own records:
SELECT * FROM customers;  -- Should return 1 row (their own)
SELECT * FROM loans;      -- Should return only their loans
SELECT * FROM provisions; -- Should return 0 rows (no access)
```

### 3. Test Audit Immutability
```sql
-- This should fail (no UPDATE policy):
UPDATE audit_trail SET action = 'tampered' WHERE id = 'any_id';
-- Error: new row violates row-level security policy

-- This should fail (no DELETE policy):
DELETE FROM audit_trail WHERE id = 'any_id';
-- Error: new row violates row-level security policy
```

### 4. Test Role Assignment
```sql
SELECT id, email,
       raw_user_meta_data ->> 'app_role' as app_role
FROM auth.users
ORDER BY email;
```

## Code Changes Required

### None for the monolith
The monolith uses the anon key for all operations. Since anon policies allow
public form submission and product reading, the public zone works unchanged.

### Staff Authentication
Staff users must sign in via Supabase Auth (email/password). The auth trigger
automatically assigns their `app_role` from the `staff_roles` table. The JWT
then contains the role, and RLS enforces access per-table.

### Future: Service Role Key
For server-side operations (Edge Functions, batch processing), use the
`service_role` key which bypasses RLS. This key must never be exposed to
the browser.
