# KwikBridge LMS — Database Normalisation

## Overview

This migration replaces the key-value storage pattern with 12 properly normalised
relational tables in Supabase. The application code continues to work unchanged —
the data layer already uses per-table CRUD operations via the `TABLES` mapping.

## Schema (12 Tables)

| Table | Primary Key | Foreign Keys | Rows | Description |
|-------|-------------|-------------|------|-------------|
| `customers` | `id` (TEXT) | — | Dynamic | Customer profiles, FICA/BEE status |
| `products` | `id` (TEXT) | — | 7 (seeded) | Loan products with rates, ECL data |
| `applications` | `id` (TEXT) | `cust_id → customers`, `product → products` | Dynamic | Loan applications with UW workflow |
| `loans` | `id` (TEXT) | `cust_id → customers`, `app_id → applications`, `product → products` | Dynamic | Active loans with payments (JSONB) |
| `documents` | `id` (TEXT) | `cust_id → customers` | Dynamic | KYC/KYB document registry |
| `collections` | `id` (TEXT) | `loan_id → loans` | Dynamic | PTP, restructure, write-off actions |
| `audit_trail` | `id` (TEXT) | — | Append-only | 47 event types, immutable log |
| `alerts` | `id` (TEXT) | — | Dynamic | System notifications |
| `provisions` | `id` (TEXT) | `loan_id → loans` | Dynamic | IFRS 9 ECL (PD × LGD × EAD) |
| `comms` | `id` (TEXT) | `cust_id → customers` | Dynamic | Email/SMS/Phone/Letter/Meeting log |
| `statutory_reports` | `id` (TEXT) | — | Pre-seeded | NCR regulatory calendar |
| `settings` | `id` (INT, =1) | — | 1 row | Company config (NCRCP22396) |

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase project: https://supabase.com/dashboard
2. Go to **SQL Editor**
3. Paste the contents of `supabase/migrations/001_normalise_schema.sql`
4. Click **Run**

### Option 2: CLI Script

```bash
SUPABASE_SERVICE_KEY=your_service_role_key node supabase/run_migration.js
```

## What Changed in the Code

### `src/lib/supabase.ts`

Added three new functions for normalised operations:

- `sbLoadAll(signal?)` — Reads all 12 tables in parallel via `Promise.allSettled`
- `sbSaveChanges(prev, next)` — Differential upsert (only changed/new rows)
- `toDb()` / `fromDb()` — camelCase ↔ snake_case key mapping (exported)

### `src/app/providers/DataProvider.tsx`

Updated load sequence to use `sbLoadAll()` instead of iterating tables sequentially.
Save uses `sbSaveChanges()` for differential persistence.

### Monolith (`src/kwikbridge-lms-v2.jsx`)

**No changes required.** The monolith already uses the same `TABLES` mapping, `toDb`/`fromDb`
helpers, and per-table `sbUpsert` calls. The normalised tables are drop-in compatible.

## Column Type Decisions

| Pattern | Column Type | Rationale |
|---------|-------------|-----------|
| IDs | `TEXT` | App generates `uid()` strings like "APP-1234" |
| Timestamps | `BIGINT` | App uses `Date.now()` (JS milliseconds) |
| Money | `NUMERIC` | Exact decimal arithmetic for ZAR amounts |
| Counts | `INTEGER` | Employees, terms, DPD |
| Booleans | `BOOLEAN` | Flags (qa_signed_off, sanctions_flag) |
| Nested objects | `JSONB` | UW workflow, QA findings, payments, PTP history |
| Status fields | `TEXT + CHECK` | Enum-like constraints with clear error messages |

## Indexes

Every foreign key column is indexed. Additional indexes on:
- `customers.email` — login matching
- `customers.fica_status` — compliance filtering  
- `applications.status` — pipeline queries
- `loans.dpd` — collections bucketing
- `loans.stage` — provisioning queries
- `audit_trail.ts DESC` — recent-first log viewing
- `alerts.read` — unread count

## RLS Policies

Initial policies are permissive (authenticated users have full access, anon has read).
Per-role hardening (borrowers see own data, auditors read-only) is a separate initiative (FI-3).

## Backward Compatibility

The migration uses `CREATE TABLE IF NOT EXISTS` — safe to run multiple times.
Existing data in the tables is preserved. No data is dropped or modified.

## Verification

After running the migration, verify in Supabase Dashboard → Table Editor:
1. All 12 tables appear
2. `settings` table has 1 row with default values
3. Foreign key relationships visible in the schema viewer
4. RLS shows "Enabled" on all tables
