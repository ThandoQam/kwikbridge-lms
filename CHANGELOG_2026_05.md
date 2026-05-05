# CHANGELOG — May 2026 Production Hardening Sprint

## [3.0.0] — 2026-05-05

This release represents the execution of the technical due diligence
audit's 30-day and 90-day remediation plan. Major focus on production
readiness, observability, security, and integration adapter patterns.

### Added — Infrastructure

- **Error Boundaries** (`src/components/system/ErrorBoundary.tsx`)
  - 3 fallback variants: page-level, widget-level, inline
  - Error reference IDs (ERR-XXXXXX) for support quoting
  - PII-safe error display
  - Wired around every page in `renderPage()`
- **Observability** (`src/lib/observability.ts`)
  - Structured logging with PII scrubbing
  - SA ID numbers, phones, emails auto-redacted from logs
  - Sentry adapter (lazy-loaded if VITE_SENTRY_DSN set)
  - PostHog adapter for product analytics
  - `timing()` wrapper for operation latency
- **Configuration** (`src/lib/config.ts`)
  - Environment-driven Supabase URL/key
  - Removes hardcoded secrets from monolith
- **Validation Library** (`src/lib/validation.ts`)
  - SA ID validation with Luhn checksum
  - CIPC company registration format check
  - SA phone, email, currency, password, term, rate
- **Responsive Helpers** (`src/lib/responsive.ts`)
  - useResponsive hook with debounced resize
- **Data Context** (`src/contexts/DataContext.tsx`)
  - Foundation for monolith refactor
  - Typed Customer, Application, Loan, Product interfaces

### Added — Integration Adapters

- **Payment Adapter** (`src/lib/payments.ts`)
  - PaymentProvider interface (disburse, mandate, collect, reconcile)
  - MockPaymentProvider for development
  - Reconciliation logic (matched/over/under/missing/unexpected)
  - Ready for Stitch / Peach Payments / NAEDO swap-in
- **Bureau/KYC Adapter** (`src/lib/bureau.ts`)
  - BureauProvider interface (report, score, identity, sanctions)
  - MockBureauProvider with deterministic dev data
  - Composite onboarding decision: auto_pass / auto_decline / manual_review
  - POPIA consent enforcement
  - Ready for TransUnion / Experian / DHA NPR swap-in

### Added — Backend

- **Webhooks Edge Function** (`supabase/functions/webhooks/index.ts`)
  - HMAC-SHA256 signed payloads
  - Exponential backoff: 5min → 25min → 2h → 12h
  - Dead-letter after 4 attempts
  - 10s timeout
- **API Rate Limiting** (`supabase/functions/api/index.ts`)
  - Token bucket per user/IP
  - 60 req/min anonymous, 300 req/min authenticated
  - Returns 429 with X-RateLimit-* headers
- **Migration 007** — webhook_subscriptions + webhook_events tables
  with PostgreSQL triggers to emit loan events
- **Migration 008** — pg_cron schedules for EOD, webhooks, statutory
  deadline alerts, audit archival

### Added — Frontend

- **Investor Dashboard** — new sidebar entry for DFI partners
  - Portfolio book, deployed, NPL ratio, avg DSCR
  - IFRS 9 staging visualisation
  - DFI covenant compliance with breach detection
  - Product concentration bars
  - Development impact metrics
  - CSV export
- **Borrower Portal Dashboard** — major upgrade
  - 7-stage application timeline visualization
  - Visual progress tracker with completion indicators
  - Contextual CTAs (e.g. "Upload Documents →" when status = Submitted)
  - Quick Actions grid
- **Public Application Form** — already had dipstick fields, no changes

### Changed

- `main.jsx` now wraps app in ErrorBoundary + global error handlers
- Auth functions return normalised `{ ok, data, error, code }` shape
- Common Supabase errors mapped to friendly messages
- `tsconfig.json` strict mode enabled
- `vite.config.js` Sentry externalised, code splitting enabled
- `check.py` v3 with JSX-comment-aware brace counting
- Tablet breakpoint (481-1024px) added
- Touch targets meet WCAG AA (44px min)
- prefers-contrast and prefers-reduced-motion supported

### Fixed

- **TD-2:** Render bugs no longer crash entire app (error boundaries)
- **TD-3:** Hardcoded JWT removed from monolith
- **TD-13:** XSS vector in loan offer / term sheet print closed
  (document.write replaced with DOMParser/textContent)
- **TD-14:** Auth flow surfaces real error messages instead of "Network error"
- **Amortisation engine:** now rejects negative principal, zero term,
  rates above NCA cap (was silently producing nonsense schedules)

### Documentation

- `DEPLOY.md` — full deployment workflow with rollback procedures
- `RUNBOOK.md` — on-call response, incident playbook, capacity limits
- `supabase/RLS_VERIFICATION.md` — quarterly RLS audit procedure
- `.env.example` — documents all required environment variables
- `PRODUCTION_HARDENING_STATUS.md` — current state vs audit baseline
- `CI_WORKFLOW_PATCH.md` — manual workflow update instructions

### Testing

- Vitest installed and configured
- 67 unit tests across 4 test files:
  - `tests/unit/amortisation.test.ts` (7 tests)
  - `tests/unit/validation.test.ts` (30 tests)
  - `tests/unit/payments.test.ts` (16 tests)
  - `tests/unit/bureau.test.ts` (14 tests)
- `npm run test:unit` and `npm run test:coverage` scripts added
- All Python integration suites still pass (168/168)
- Security suite: 123/130 (94%)

### Metrics

- Codebase: 7,623 → 7,750+ lines (monolith), +3,500 lines new modules
- Bundle size: 448KB → 457KB (1.5KB gzipped increase)
- Test coverage: 168 integration → 168 integration + 67 unit
- New Edge Functions: 1 (webhooks)
- New migrations: 2 (007 webhooks, 008 scheduled jobs)
