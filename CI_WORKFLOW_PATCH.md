# CI Workflow Patch — Apply Manually

The automation PAT cannot modify `.github/workflows/*.yml` files.
GitHub's server-side check rejects any push (commit OR branch) that
modifies a workflow file unless the PAT has `workflow` scope.

This patch wires our 97 Vitest unit tests + 168 journey tests into CI.
Currently CI only runs the Python test suites — meaning a regression
in `decisioning.ts`, `validation.ts`, `payments.ts`, `bureau.ts`, or
`amortisation.ts` will not be caught until manual testing.

## How to Apply (1-2 minutes via GitHub UI)

1. Go to: <https://github.com/ThandoQam/kwikbridge-lms/edit/main/.github/workflows/ci.yml>

2. Find this block in the `test:` job:

   ```yaml
             if [ -n "$FAILED_SUITES" ]; then
               echo ""
               echo "FAILED SUITES:$FAILED_SUITES"
               exit 1
             fi
   ```

3. Immediately after that block (still inside the `test:` job's
   `steps:` array), add these new steps:

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

4. Commit directly to main with message: `ci: run Vitest in CI`

## Verification

After committing, the next CI run will show four new steps under the
"Test Suite" job:
- "Setup Node.js for unit tests"
- "Install dependencies"
- "Run Vitest unit tests"
- "Run journey tests"

The first run might take 2-3 minutes longer than before (npm install).
Subsequent runs use the npm cache and add ~30 seconds.

## Alternative: Update the PAT scope

If you'd prefer to enable automated workflow changes:

1. <https://github.com/settings/tokens> → Find the existing PAT
2. Click "Edit"
3. Check the `workflow` scope checkbox (under "repo" section)
4. Update token

The next session will be able to push workflow changes directly.

## Why This Matters

Without this patch, the CI green tick is misleading. A bug in the
credit decisioning engine (the IP) could merge to main without
detection, then ship to production. With this patch, the 30 dedicated
decisioning tests run on every push and block bad code at the door.
