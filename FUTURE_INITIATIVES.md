# KwikBridge LMS — Future Initiatives Plan

## Overview

This document outlines post-refactoring initiatives that are **not part of the modular
architecture refactoring** but should be executed in sequence after it completes.

---

## FI-1: Database Normalisation

**Priority:** High
**Dependency:** Phases 0–3 complete (DataProvider exists as single persistence point)
**Estimated effort:** 2–3 weeks

### Current State
- Single `kwikbridge_data` table (key-value, one row per collection)
- Entire dataset serialised as JSON blob
- No foreign keys, no indexes, no column-level types
- RLS policies are permissive (no row-level filtering)

### Target State
```
Tables (12):
  customers       — id, name, email, industry, fica_status, bee_level, ...
  applications    — id, cust_id (FK), product_id (FK), status, amount, term, ...
  loans           — id, cust_id (FK), app_id (FK), product_id (FK), balance, dpd, ...
  products        — id, name, base_rate, monthly_rate, risk_class, ecl, ...
  documents       — id, cust_id (FK), app_id (FK), doc_type, status, ...
  audit_trail     — id, action, entity, user_name, timestamp, category, details
  alerts          — id, type, severity, title, msg, read, timestamp
  collections     — id, loan_id (FK), action, notes, timestamp
  provisions      — id, loan_id (FK), stage, pd, lgd, ead, ecl
  comms           — id, cust_id (FK), type, subject, body, timestamp
  statutory_reports — id, name, type, due_date, status, ...
  settings        — key, value (single row)
```

### Migration Steps
1. Create new tables in Supabase with proper column types
2. Write migration script: read JSON blob → insert into normalised tables
3. Update DataProvider to load/save from individual tables
4. Add foreign key constraints
5. Add indexes on frequently filtered columns (cust_id, status, dpd)
6. Update feature service hooks to use table-level queries
7. Delete kwikbridge_data table

### Risks
- Data loss during migration → run in parallel (dual-write) for 1 week
- Query performance with Supabase REST → add proper indexes
- Breaking existing save() atomicity → use Supabase Edge Functions for transactions

---

## FI-2: TypeScript Migration (Phase 4)

**Priority:** High
**Dependency:** Phase 3 complete (all features extracted)
**Estimated effort:** 1–2 weeks

### Deliverables
- Rename all .jsx → .tsx
- TypeScript interfaces for all domain entities:
  ```
  Customer, Application, Loan, Product, Document,
  AuditEntry, Alert, Communication, Provision,
  StatutoryReport, Settings, SystemUser
  ```
- Prop types for all 12 UI components
- Generic type for DataProvider state
- Strict tsconfig: noImplicitAny, strictNullChecks, exhaustive-deps
- ESLint with @typescript-eslint/recommended

### Approach
- Start with constants/ and utils/ (pure data, no JSX)
- Then lib/ (Supabase client, permissions, theme)
- Then hooks/ (useData, useAuth, usePermissions)
- Then components/ui/ (prop interfaces)
- Finally features/ (page components)

---

## FI-3: Supabase RLS Hardening

**Priority:** Critical (security)
**Dependency:** FI-1 (database normalisation)
**Estimated effort:** 1 week

### Current State
- RLS policies are permissive (all rows visible to all authenticated users)
- Anon key used client-side (acceptable for read-only public data)
- No row-level filtering by user/role

### Target Policies
```sql
-- Borrowers: see only own records
CREATE POLICY "borrower_own_data" ON customers
  FOR ALL USING (auth.uid() = user_id);

-- Staff: see all records (filtered by app logic)
CREATE POLICY "staff_all_data" ON customers
  FOR ALL USING (auth.jwt() ->> 'role' IN ('ADMIN','CREDIT','LOAN_OFFICER',...));

-- Auditors: read-only
CREATE POLICY "auditor_read_only" ON customers
  FOR SELECT USING (auth.jwt() ->> 'role' = 'AUDITOR');
```

### Implementation
1. Map ROLES to Supabase JWT custom claims
2. Create RLS policies per table per role
3. Add service_role key for server-side operations (Edge Functions)
4. Remove anon key write access
5. Test every role against every table

---

## FI-4: Real File Upload (Supabase Storage)

**Priority:** Medium
**Dependency:** FI-1 (normalised documents table)
**Estimated effort:** 1 week

### Current State
- Document uploads create metadata-only records
- No actual file storage, download, or preview
- Bank verification and credit check are simulated (1.5s/2s delay)

### Target State
- Supabase Storage bucket: `kyb-fica-documents`
- Upload flow: file → Storage → metadata row in documents table
- Download: signed URL (15-minute expiry)
- File types: PDF, JPG, PNG (max 10MB)
- Virus scanning: Supabase Edge Function with ClamAV
- Preview: PDF viewer in modal, image preview inline

### Implementation
1. Create Storage bucket with RLS (borrower uploads own, staff views all)
2. Update portal document upload to POST to Storage API
3. Store storage_path in documents table
4. Generate signed URLs for staff document review
5. Add file type validation (client + server)
6. Add virus scan Edge Function

---

## FI-5: Notification & Communication System

**Priority:** Medium
**Dependency:** FI-1 (normalised comms/alerts tables)
**Estimated effort:** 2 weeks

### Current State
- Notifications are in-memory (alerts array)
- Email content generated but not sent (stored as comms records)
- No SMS, no push notifications

### Target State
- Email: Supabase Edge Function → SendGrid/Resend
- SMS: Supabase Edge Function → Twilio
- Push: Browser notifications (service worker)
- Templates: Pre-built for each notification type
- Preferences: Borrower can opt out of SMS

### Notification Triggers
- Application submitted → email to borrower + staff alert
- QA pass/fail → email to borrower
- Approval/decline → email + SMS to borrower
- Disbursement → email + SMS to borrower
- Payment due (3 days before) → SMS reminder
- Payment missed (1 day after) → SMS + email
- PTP reminder (1 day before PTP date) → SMS
- Document request → email to borrower

---

## FI-6: CI/CD Pipeline

**Priority:** Medium
**Dependency:** Phase 4 (TypeScript + tests)
**Estimated effort:** 3 days

### Target
- GitHub Actions workflow:
  1. On push to main: lint → type-check → test → build → deploy
  2. On PR: lint → type-check → test (no deploy)
- Pre-commit hooks: ESLint + Prettier + integrity check
- Branch protection: require PR review + passing checks

---

## FI-7: Monitoring & Observability

**Priority:** Low (post-launch)
**Dependency:** Production deployment
**Estimated effort:** 3 days

### Target
- Error tracking: Sentry (React SDK)
- Performance: Vercel Analytics (built-in)
- Uptime: Vercel cron or external (UptimeRobot)
- Audit log export: scheduled Edge Function → S3/GCS

---

## Execution Order

| Order | Initiative | Depends On | Duration |
|-------|-----------|-----------|----------|
| 1 | Modular Refactoring (Phases 0–3) | — | Current |
| 2 | TypeScript (FI-2 / Phase 4) | Phases 0–3 | 1–2 weeks |
| 3 | Database Normalisation (FI-1) | Phase 2 (DataProvider) | 2–3 weeks |
| 4 | RLS Hardening (FI-3) | FI-1 | 1 week |
| 5 | File Upload (FI-4) | FI-1 | 1 week |
| 6 | Notifications (FI-5) | FI-1 | 2 weeks |
| 7 | CI/CD (FI-6) | FI-2 | 3 days |
| 8 | Monitoring (FI-7) | Production | 3 days |

**Total post-refactoring effort: 8–10 weeks**
