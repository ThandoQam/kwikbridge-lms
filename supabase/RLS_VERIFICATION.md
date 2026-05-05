# RLS Verification Procedure

## Purpose
Verify that Row-Level Security policies in `migrations/002_rls_hardening.sql`
are correctly applied and enforcing access control in production.

## Why This Matters
Without RLS, a borrower with a valid auth token could query the database directly
via the Supabase REST API and see other borrowers' loans, customers' PII, and
audit trail. RLS is the only layer between authenticated users and full data access.

## Verification Steps

### 1. Confirm Migration Applied (Supabase Dashboard)

```
Supabase Dashboard → Database → Migrations
Confirm 002_rls_hardening.sql is in "Applied" state
```

If not applied:
```bash
supabase db push --linked
```

### 2. Confirm RLS Enabled on All Tables

Run in SQL Editor:
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'customers', 'products', 'applications', 'loans',
    'documents', 'collections', 'audit_trail', 'alerts',
    'provisions', 'comms', 'statutory_reports', 'settings'
  );
```

Expected: every row shows `rowsecurity = true`.

### 3. Confirm Helper Functions Exist

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname IN (
  'get_app_role', 'get_user_email',
  'is_staff', 'is_admin', 'is_read_only'
);
```

Expected: 5 rows returned.

### 4. Test Borrower Isolation (Critical)

Create two test borrower accounts with different emails. Sign in as
borrower-1 and attempt to query customer records belonging to borrower-2.

```javascript
// Sign in as borrower-1
const { access_token } = await authSignIn("borrower1@example.com", "password");

// Try to read all customers (should only return borrower-1's record)
const r = await fetch(
  "https://YOUR-PROJECT.supabase.co/rest/v1/customers?select=*",
  { headers: { apikey: ANON, Authorization: `Bearer ${access_token}` } }
);
const data = await r.json();
// Expected: data.length === 1 (only borrower-1's record)
// FAIL: data.length > 1 (RLS broken — escalate immediately)
```

### 5. Test Anonymous Insert (Public Application)

The public application form must be able to create customer + application
records WITHOUT auth. Test:

```javascript
const r = await fetch(
  "https://YOUR-PROJECT.supabase.co/rest/v1/customers",
  {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ id: "TEST-001", name: "Test", email: "test@test.com" }),
  }
);
// Expected: 201 Created (customers_anon_create policy allows INSERT)
```

### 6. Test Staff Read

Sign in with a staff account (admin@thandoq.com → ADMIN role).
Verify the staff user can see all customers, all loans, all applications.

```javascript
// Should return all rows
const r = await fetch(
  "https://YOUR-PROJECT.supabase.co/rest/v1/customers?select=*",
  { headers: { apikey: ANON, Authorization: `Bearer ${staffToken}` } }
);
```

## Failure Response

If RLS is NOT correctly applied:

1. **Immediately disable public access** to the affected table by removing the
   anon read policy
2. **Audit access logs** in Supabase Dashboard → Logs → API Logs to determine
   if any unauthorised access occurred
3. **Apply the migration** to fix
4. **Re-test** with the procedure above
5. **POPIA notification:** if any borrower PII was accessible to other borrowers,
   the Information Officer must be notified within 72 hours

## Schedule

- **Initial verification:** Before first production user
- **Quarterly re-verification:** Part of compliance audit cycle
- **Post-migration:** Any time a new table is added or migration applied
