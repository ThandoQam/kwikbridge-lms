# KwikBridge LMS — Real Integration Playbook

**Purpose:** Step-by-step procedures for swapping mock adapters with real
production providers when commercial agreements are in place. Each
section is structured as a runbook: prerequisites → implementation →
verification → rollback.

**Workplan items:**
- TD-6 (Payment integration — Stitch/Peach)
- TD-7 (Bureau/KYC integration — TransUnion/Experian)
- TD-9 (RLS hardening — Supabase production access)

---

## TD-6 — Payment Provider Integration

### Current state
- `src/lib/payments.ts` exposes a stable public API: `disburseLoan()`,
  `setupRepaymentMandate()`, `collectRepayment()`, `reconcilePayment()`.
- All callers go through these functions.
- The active provider is swappable via `setPaymentProvider(provider)`.
- `MockPaymentProvider` is the default and produces realistic responses
  for development and demo.
- Stub classes `StitchPaymentProvider` and `PeachPaymentProvider`
  exist; calling any method throws a `NotImplementedError` with setup
  instructions.

### Stitch Money integration

**Prerequisites**
1. Commercial agreement signed with Stitch Money (Pty) Ltd.
2. Sandbox API credentials issued by Stitch.
3. Production API credentials (issued after sandbox testing pass).
4. POPIA data-sharing addendum executed.

**Implementation**
1. Replace each `throw new NotImplementedError(...)` in
   `StitchPaymentProvider` (in `src/lib/payments.ts`) with a real
   call to Stitch's REST API per their developer docs at
   <https://stitch.money/docs>.
2. Use `fetch()` with `Authorization: Bearer ${apiKey}` header.
3. Add credentials to environment via `.env.production`:
   - `VITE_STITCH_API_KEY` (server-side only — do NOT expose to browser)
   - `VITE_STITCH_API_BASE` (sandbox vs production switch)
4. Map Stitch response codes to the `PaymentResult.errorCode` field.
5. Implement webhook handler for async settlement notifications at
   `/api/webhooks/stitch` — verify HMAC signature using Stitch secret.
6. Call `setPaymentProvider(new StitchPaymentProvider())` in app
   bootstrap, gated behind `if (config.paymentProvider === 'stitch')`.

**Verification**
1. Run `npm run test:unit` — stub tests should now fail
   (expected — no longer throws). Update tests to assert real-fetch
   behaviour using mocked `fetch`.
2. Manual sandbox test: disburse R10 to a test account, verify
   webhook delivery, reconcile.
3. Reconciliation report after 7 days: every disbursement_id appears
   exactly once in Stitch's settlement file.

**Rollback**
- `setPaymentProvider(new MockPaymentProvider())` reverts immediately.
- All in-flight transactions remain valid (Stitch processes them);
  no new transactions go via Stitch.

---

### Peach Payments integration (fallback)

Same pattern as Stitch. Trigger conditions for Peach over Stitch:
- Stitch coverage gap (e.g. specific bank not supported)
- Stitch rate-limit / outage
- Specific products requiring DebiCheck Authenticated Collections at
  scale (Peach has stronger DebiCheck coverage in some segments)

The provider registry supports per-loan provider selection; future
work could implement smart routing (`PaymentRouter` class) that picks
provider based on bank code and rules.

---

## TD-7 — Credit Bureau Integration

### Current state
- `src/lib/bureau.ts` exposes `pullCreditReport()`, `pullCreditScore()`,
  `verifyIdentity()`, `screenSanctions()`.
- `MockBureauProvider` produces realistic SA bureau responses.
- Stubs: `TransUnionBureauProvider`, `ExperianBureauProvider`.

### TransUnion integration

**Prerequisites**
1. Bureau membership (TransUnion ITC SA — formal application + financial
   review required, ~2–3 months lead time).
2. POPIA data-sharing compliance review (internal + bureau review).
3. Bureau Code of Conduct adherence assertion.
4. NCR consent handling: every `pullCreditReport()` requires a
   recorded consent reference linking to the customer's signed
   credit application authorising the bureau pull.

**Implementation**
1. Replace `throw` statements in `TransUnionBureauProvider` with calls
   to TransUnion's API per their integration guide.
2. Map their report payload to our `BureauReport` interface
   (defined in `src/lib/bureau.ts`).
3. Cache scores for 90 days per FICA — re-pulling within that window
   should hit a local cache, not the bureau (cost + bureau policy).
4. Log every pull to the audit trail with consent reference.
5. Add credentials: `VITE_TRANSUNION_USERNAME`, `VITE_TRANSUNION_PASSWORD`,
   `VITE_TRANSUNION_API_BASE`.
6. Call `setBureauProvider(new TransUnionBureauProvider())` in
   bootstrap.

**Verification**
1. Sandbox pull with synthetic ID — expect known test response.
2. Real ID pull on a consenting test customer — verify report fields
   map correctly (no nulls in mandatory fields).
3. Cost reconciliation: bureau invoices match audit-logged pull count.

---

### Experian (cross-bureau verification)

For applications above R1m, pull both TransUnion and Experian for
cross-verification. If scores diverge by >50 points, flag for manual
review. Implementation pattern same as TransUnion.

---

## TD-9 — RLS Hardening

### Current state
- Supabase tables created with permissive RLS policies for development.
- `supabase/RLS_VERIFICATION.md` documents the procedure.
- Production access blocked: requires Supabase project admin who has
  not been onboarded to verification.

### Procedure (when access available)

1. Open Supabase SQL editor → run the policy verification queries from
   `supabase/RLS_VERIFICATION.md` against the production project.
2. For each table, confirm:
   - `SELECT` restricted to authenticated users with appropriate role
   - `INSERT/UPDATE/DELETE` blocked from anon JWT
   - Borrower JWTs only see their own records (test with two test
     borrower accounts; account A must not see account B's loans)
3. If any policy is missing or too permissive, apply the corrective
   SQL from `supabase/migrations/` (existing migration files are
   already in the repo).
4. Re-run `npm run cypress` against production to verify end-to-end
   that browser-side requests can't bypass RLS.

### Why this is blocked

The verification needs to be run as an authenticated session against
the actual production Supabase project — local development uses an
isolated project with different policies. Without that access, the
policy state in production is asserted by the migration history but
not empirically verified.

---

## Provider Selection Configuration

The bootstrap should respect a configuration flag rather than
hard-coding a provider:

```typescript
// In src/main.jsx or App.jsx, before render:
import { setPaymentProvider, MockPaymentProvider, StitchPaymentProvider } from './lib/payments';
import { setBureauProvider, MockBureauProvider, TransUnionBureauProvider } from './lib/bureau';
import { config } from './lib/config';

if (config.paymentProvider === 'stitch') {
  setPaymentProvider(new StitchPaymentProvider());
} else if (config.paymentProvider === 'peach') {
  setPaymentProvider(new PeachPaymentProvider());
}
// else: leaves the default MockPaymentProvider in place

if (config.bureauProvider === 'transunion') {
  setBureauProvider(new TransUnionBureauProvider());
}
```

Add to `src/lib/config.ts`:
```typescript
export const config = {
  // ... existing keys
  paymentProvider: import.meta.env.VITE_PAYMENT_PROVIDER ?? 'mock',
  bureauProvider: import.meta.env.VITE_BUREAU_PROVIDER ?? 'mock',
};
```

This pattern means:
- Local dev: no env var → mock provider, no risk of accidental real calls.
- Staging: `VITE_PAYMENT_PROVIDER=stitch` in staging env vars.
- Production: same, with production credentials.

---

## Closing Notes

The mock providers are not a placeholder — they are a permanent part
of the testing infrastructure. They will continue to be used by:
- All unit tests (`tests/unit/payments.test.ts`, etc.)
- Integration tests in CI
- Local development environments
- Customer demo environments

The real providers are added alongside them, not replacing them.
This is the standard pattern for financial-services adapters and is
already structurally in place — TD-6 and TD-7 are predominantly a
contractual / commercial gating issue, not an engineering one.
