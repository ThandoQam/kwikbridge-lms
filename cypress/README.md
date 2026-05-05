# KwikBridge Cypress E2E Tests

End-to-end browser tests covering the 5 critical user journeys.

## What's Tested

| File | Flow | Why It Matters |
|---|---|---|
| `01-public-application.cy.ts` | Public 4-step application form | Highest-traffic user journey; failure = lost applications |
| `02-staff-dashboard.cy.ts` | Staff login + module navigation | Verifies error boundaries protect the back-office |
| `03-loan-lifecycle.cy.ts` | Origination → underwriting → loans → servicing → collections | Core money movement flow |
| `04-borrower-portal.cy.ts` | Borrower portal with documents and loans | Customer self-service; required for real production |
| `05-error-recovery.cy.ts` | Error boundary behaviour and session preservation | Proves the production hardening works |

## Running Locally

```bash
# Open the Cypress UI (interactive)
npm run e2e:open

# Run headless against local dev server
# 1. In one terminal:
npm run dev
# 2. In another terminal:
npm run e2e

# Run against staging
CYPRESS_BASE_URL=https://kwikbridge-staging.vercel.app npm run e2e

# Run against production (read-only operations only)
CYPRESS_BASE_URL=https://kwikbridge-lms.vercel.app npm run e2e
```

## Custom Commands

Defined in `cypress/support/e2e.ts`:

```typescript
cy.loginAsStaffAdmin();   // Bypass auth via dev access button
cy.loginAsBorrower();     // Bypass auth as borrower portal user
cy.navigateTo('label');   // Click sidebar item by label
```

## CI Integration

The CI workflow patch in `CI_WORKFLOW_PATCH.md` adds Cypress to the
test job. Recommended CI configuration:

```yaml
- name: Cypress E2E
  uses: cypress-io/github-action@v6
  with:
    start: npm run dev
    wait-on: 'http://localhost:5173'
    browser: chrome
```

## Adding New Tests

1. Create a new `.cy.ts` file in `cypress/e2e/`
2. Use the `describe('...', () => {...})` pattern
3. Reuse `cy.loginAsStaffAdmin()` or `cy.loginAsBorrower()` for auth
4. Prefer `contains()` over CSS selectors — survives UI refactors
5. Use `{ timeout: 10000 }` for elements that load asynchronously
6. Run locally before committing: `npm run e2e`

## Limitations

- Tests run against the dev access bypass (no real auth flow tested in CI)
- For real auth testing, point at staging with a seeded test account
- Application submission test creates real data — clean up after CI runs
