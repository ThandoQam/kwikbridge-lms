# KwikBridge LMS — Refactoring Roadmap

## Current Session: Modular Architecture Refactoring (Phases 0–3)
## Future Initiatives: Database Normalisation, TypeScript, RLS Hardening

---

## Execution Plan

### Phase 0: Foundation (Extract Shared Infrastructure)
- [ ] lib/supabase.js
- [ ] lib/store.js
- [ ] lib/permissions.js
- [ ] lib/theme.js
- [ ] lib/seed.js
- [ ] utils/format.js
- [ ] utils/ids.js
- [ ] utils/dpd.js
- [ ] utils/audit.js
- [ ] constants/roles.js
- [ ] constants/statuses.js

### Phase 1: UI Primitives
- [ ] components/ui/Btn.jsx
- [ ] components/ui/Badge.jsx
- [ ] components/ui/Table.jsx
- [ ] components/ui/Modal.jsx
- [ ] components/ui/KPI.jsx
- [ ] components/ui/SectionCard.jsx
- [ ] components/ui/Tab.jsx
- [ ] components/ui/Field.jsx
- [ ] components/ui/Input.jsx
- [ ] components/ui/Select.jsx
- [ ] components/ui/Textarea.jsx
- [ ] components/ui/InfoGrid.jsx
- [ ] components/ui/StatusBadge.jsx
- [ ] components/shared/PageHeader.jsx
- [ ] components/shared/BackButton.jsx

### Phase 2: App Shell and Providers
- [ ] app/providers/DataProvider.jsx
- [ ] app/providers/AuthProvider.jsx
- [ ] app/layouts/PublicLayout.jsx
- [ ] app/layouts/PortalLayout.jsx
- [ ] app/layouts/StaffLayout.jsx
- [ ] app/App.jsx
- [ ] hooks/useData.js
- [ ] hooks/useAuth.js
- [ ] hooks/usePermissions.js

### Phase 3: Feature Extraction
- [ ] features/public/ (landing, apply, track)
- [ ] features/auth/ (login, signup, OAuth)
- [ ] features/portal/ (6 pages)
- [ ] features/dashboard/
- [ ] features/customers/
- [ ] features/origination/
- [ ] features/underwriting/
- [ ] features/loans/
- [ ] features/servicing/
- [ ] features/collections/
- [ ] features/provisioning/
- [ ] features/governance/
- [ ] features/statutory/
- [ ] features/documents/
- [ ] features/reports/
- [ ] features/comms/
- [ ] features/admin/ (4 sub-features)

---

## Future Initiatives (Not In This Refactoring)

### FI-1: Database Normalisation
- Replace kwikbridge_data key-value table with relational tables
- customers, applications, loans, products, documents, audit_trail, etc.
- Add foreign keys, indexes, proper column types
- Migrate DataProvider from JSON blob to per-table queries
- Add Supabase RLS row-level policies per table

### FI-2: TypeScript Migration (Phase 4)
- Rename .jsx → .tsx
- Add interfaces: Customer, Application, Loan, Product, etc.
- Add prop types to all UI components
- Add strict null checks, no-any ESLint rules
- Migrate test suite to validate modular structure

### FI-3: Supabase RLS Hardening
- Replace permissive RLS policies with row-level security
- Staff roles: read all, write own scope
- Borrowers: read/write own records only
- Auditors: read-only across all tables
- Service role key for server-side operations only

### FI-4: Real File Upload (Supabase Storage)
- Replace metadata-only document records with actual file storage
- Supabase Storage buckets for KYB/FICA documents
- Signed URLs for download, virus scanning, file type validation

### FI-5: Notification System
- Replace in-memory alerts with persistent notifications
- Email delivery via Supabase Edge Functions or SendGrid
- SMS via Twilio for payment reminders and PTP confirmations
