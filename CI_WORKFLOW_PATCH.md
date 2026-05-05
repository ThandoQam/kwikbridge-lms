# CI Workflow Patch — Apply Manually

The Personal Access Token used for automated commits cannot modify
`.github/workflows/*.yml` files (requires `workflow` scope). Apply this
patch manually via the GitHub web UI:

## Where
`.github/workflows/ci.yml`

## What to Change

In the `test` job, after the Python test suite block ending in:

```yaml
          if [ -n "$FAILED_SUITES" ]; then
            echo ""
            echo "FAILED SUITES:$FAILED_SUITES"
            exit 1
          fi
```

Add the following steps:

```yaml
      - name: Setup Node.js for unit tests
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Vitest unit tests
        run: npm run test:unit

      - name: Run journey tests
        run: node test-journeys.cjs
```

## Why

The repository now has 67 Vitest unit tests covering:
- `src/lib/amortisation.ts` — schedule generation, edge cases
- `src/lib/validation.ts` — SA ID Luhn, CIPC, phone, email
- `src/lib/payments.ts` — disbursement validation, reconciliation
- `src/lib/bureau.ts` — onboarding decision tree, POPIA consent

These tests catch real bugs that the static-analysis Python suites
cannot. Running them in CI prevents regressions before merge.

## How to Apply

1. Open https://github.com/ThandoQam/kwikbridge-lms/edit/main/.github/workflows/ci.yml
2. Locate the `test:` job
3. Add the Node.js setup + npm test steps after the Python suite
4. Commit directly to main with message: "ci: run Vitest unit tests in CI"

## Verification

After pushing, the next CI run should show "Run Vitest unit tests"
as a passing step under the "Test Suite" job.
