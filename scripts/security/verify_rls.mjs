#!/usr/bin/env node
/**
 * RLS Runtime Verification — adversarial test suite for production Supabase.
 *
 * Replaces the manual procedure in supabase/RLS_VERIFICATION.md with an
 * automated, repeatable check. Outputs a pass/fail report and exits with
 * a non-zero code on failure (suitable for CI scheduling).
 *
 * SETUP (one-time):
 *   1. Create two test borrower accounts in Supabase Auth:
 *        rls-borrower-1@kwikbridge.test
 *        rls-borrower-2@kwikbridge.test
 *      Note: emails must match these exact values — the test uses them
 *      to verify isolation between accounts.
 *
 *   2. Insert a customer row for each:
 *        INSERT INTO customers (id, name, email)
 *        VALUES
 *          ('RLS-CUST-1', 'RLS Test 1', 'rls-borrower-1@kwikbridge.test'),
 *          ('RLS-CUST-2', 'RLS Test 2', 'rls-borrower-2@kwikbridge.test');
 *
 *   3. Set environment variables:
 *        export SUPABASE_URL=https://xxx.supabase.co
 *        export SUPABASE_ANON_KEY=eyJhbGc...
 *        export RLS_BORROWER_1_PWD=<password set in auth>
 *        export RLS_BORROWER_2_PWD=<password set in auth>
 *        export RLS_STAFF_EMAIL=<staff account email — optional>
 *        export RLS_STAFF_PWD=<staff account password — optional>
 *
 * RUN:
 *   node scripts/security/verify_rls.mjs
 *
 * EXIT CODES:
 *   0 — all checks passed
 *   1 — one or more checks failed (RLS broken — investigate immediately)
 *   2 — environment misconfigured (missing env vars or test data)
 */

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const B1_EMAIL = 'rls-borrower-1@kwikbridge.test';
const B2_EMAIL = 'rls-borrower-2@kwikbridge.test';
const B1_PWD = process.env.RLS_BORROWER_1_PWD;
const B2_PWD = process.env.RLS_BORROWER_2_PWD;
const STAFF_EMAIL = process.env.RLS_STAFF_EMAIL;
const STAFF_PWD = process.env.RLS_STAFF_PWD;

// ── Result tracking ──
const results = [];
let failed = 0;

function record(category, name, passed, detail = '') {
  results.push({ category, name, passed, detail });
  const icon = passed ? '✓' : '✗';
  const colour = passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`  ${colour}${icon}${reset} ${name}${detail ? ' — ' + detail : ''}`);
  if (!passed) failed++;
}

function envCheck() {
  if (!URL || !ANON) {
    console.error('\x1b[31mERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set\x1b[0m');
    process.exit(2);
  }
  if (!B1_PWD || !B2_PWD) {
    console.error('\x1b[31mERROR: RLS_BORROWER_1_PWD and RLS_BORROWER_2_PWD must be set\x1b[0m');
    console.error('See header comment in verify_rls.mjs for setup instructions.');
    process.exit(2);
  }
}

// ── Auth helper ──
async function signIn(email, password) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Sign-in failed for ${email}: ${r.status} ${text}`);
  }
  const j = await r.json();
  return j.access_token;
}

// ── Query helper ──
async function query(path, token = null) {
  const headers = { apikey: ANON };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers });
  return { status: r.status, data: r.ok ? await r.json() : null };
}

async function insert(table, body, token = null) {
  const headers = {
    apikey: ANON,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: r.status, data: r.ok ? await r.json() : await r.text() };
}

// ═══════════════════════════════════════════════════════════════
async function main() {
  envCheck();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RLS Runtime Verification                                     ║');
  console.log(`║  Target: ${URL.padEnd(54)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // ── Sign in test accounts ──
  let b1Token, b2Token, staffToken;
  try {
    b1Token = await signIn(B1_EMAIL, B1_PWD);
    b2Token = await signIn(B2_EMAIL, B2_PWD);
  } catch (e) {
    console.error(`\x1b[31m${e.message}\x1b[0m`);
    console.error('Test accounts not set up — see header for instructions.');
    process.exit(2);
  }
  if (STAFF_EMAIL && STAFF_PWD) {
    try {
      staffToken = await signIn(STAFF_EMAIL, STAFF_PWD);
    } catch (e) {
      console.warn(`Staff sign-in failed (skipping staff checks): ${e.message}`);
    }
  }

  // ═══ Anonymous (unauthenticated) checks ═══
  console.log('═══ Anonymous access ═══');
  {
    // Should read products
    const { status, data } = await query('products?select=*');
    record('anon', 'GET /products returns data', status === 200 && Array.isArray(data));

    // Should NOT read customers (no anon SELECT policy)
    const { status: s2, data: d2 } = await query('customers?select=*');
    record(
      'anon',
      'GET /customers blocked',
      s2 === 200 && Array.isArray(d2) && d2.length === 0,
      s2 === 200 ? `returned ${d2?.length ?? '?'} rows (RLS filters anon)` : `status=${s2}`
    );

    // Should NOT read loans
    const { status: s3, data: d3 } = await query('loans?select=*');
    record(
      'anon',
      'GET /loans blocked',
      s3 === 200 && Array.isArray(d3) && d3.length === 0
    );

    // Should NOT read audit_trail without auth
    const { status: s4, data: d4 } = await query('audit_trail?select=*');
    record(
      'anon',
      'GET /audit_trail blocked',
      s4 === 200 && Array.isArray(d4) && d4.length === 0
    );

    // Should be able to INSERT a customer (public application form)
    const stamp = Date.now();
    const { status: s5 } = await insert('customers', {
      id: `RLS-VERIFY-${stamp}`,
      name: 'RLS Verification Probe',
      email: `rls-probe-${stamp}@example.test`,
    });
    record(
      'anon',
      'POST /customers allowed (public apply form)',
      s5 === 201,
      s5 !== 201 ? `status=${s5}` : ''
    );
  }
  console.log();

  // ═══ Borrower isolation ═══
  console.log('═══ Borrower isolation ═══');
  {
    // Borrower 1 reads /customers — should ONLY see own row
    const { data: d1 } = await query('customers?select=*', b1Token);
    const ownOnly = Array.isArray(d1) && d1.length === 1 && d1[0]?.email === B1_EMAIL;
    record(
      'borrower-isolation',
      'B1 sees only own customer',
      ownOnly,
      Array.isArray(d1)
        ? `returned ${d1.length} row(s); expected 1 with email=${B1_EMAIL}`
        : 'no array'
    );

    // Borrower 1 reads /loans — should NOT see B2's loans
    const { data: dl } = await query('loans?select=*', b1Token);
    const noBleed = Array.isArray(dl) && dl.every(
      r => !r.cust_id || r.cust_id !== 'RLS-CUST-2'
    );
    record(
      'borrower-isolation',
      "B1 cannot read B2's loans",
      noBleed,
      Array.isArray(dl)
        ? `${dl.length} loan(s) returned, none with cust_id=RLS-CUST-2`
        : 'no array'
    );

    // Borrower 1 attempts to UPDATE B2's customer record — must fail
    const upd = await fetch(
      `${URL}/rest/v1/customers?id=eq.RLS-CUST-2`,
      {
        method: 'PATCH',
        headers: {
          apikey: ANON,
          Authorization: `Bearer ${b1Token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ name: 'PWNED' }),
      }
    );
    const updData = upd.ok ? await upd.json() : null;
    const updateBlocked = !updData || updData.length === 0;
    record(
      'borrower-isolation',
      "B1 cannot UPDATE B2's customer",
      updateBlocked,
      updateBlocked ? 'no rows updated' : `${updData.length} row(s) modified — CRITICAL`
    );
  }
  console.log();

  // ═══ Append-only audit trail ═══
  console.log('═══ Append-only audit trail ═══');
  {
    // Borrower attempts to UPDATE an audit row — must fail (no UPDATE policy)
    const stamp = Date.now();
    const ins = await insert(
      'audit_trail',
      { id: `RLS-AUDIT-${stamp}`, action: 'rls-probe', user_id: B1_EMAIL, ts: new Date().toISOString() },
      b1Token
    );
    if (ins.status === 201) {
      // Now try to update it
      const upd = await fetch(
        `${URL}/rest/v1/audit_trail?id=eq.RLS-AUDIT-${stamp}`,
        {
          method: 'PATCH',
          headers: {
            apikey: ANON,
            Authorization: `Bearer ${b1Token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ action: 'TAMPERED' }),
        }
      );
      const updData = upd.ok ? await upd.json() : null;
      const cannotUpdate = !updData || updData.length === 0;
      record(
        'append-only',
        'audit_trail cannot be UPDATEd',
        cannotUpdate,
        cannotUpdate ? 'no rows modified' : 'audit row was tampered — CRITICAL'
      );

      // And cannot DELETE
      const del = await fetch(
        `${URL}/rest/v1/audit_trail?id=eq.RLS-AUDIT-${stamp}`,
        {
          method: 'DELETE',
          headers: {
            apikey: ANON,
            Authorization: `Bearer ${b1Token}`,
            Prefer: 'return=representation',
          },
        }
      );
      const delData = del.ok ? await del.json() : null;
      const cannotDelete = !delData || delData.length === 0;
      record(
        'append-only',
        'audit_trail cannot be DELETEd',
        cannotDelete,
        cannotDelete ? 'no rows deleted' : 'audit row was deleted — CRITICAL'
      );
    } else {
      record('append-only', 'audit insert succeeded (precondition for tamper test)', false,
        `insert failed: status=${ins.status}`);
    }
  }
  console.log();

  // ═══ Staff access (optional) ═══
  if (staffToken) {
    console.log('═══ Staff access ═══');
    const { data: dCust } = await query('customers?select=*', staffToken);
    record(
      'staff',
      'staff can read all customers',
      Array.isArray(dCust) && dCust.length > 1,
      Array.isArray(dCust) ? `${dCust.length} customer(s) visible` : 'no array'
    );

    const { data: dLoans } = await query('loans?select=*', staffToken);
    record('staff', 'staff can read loans', Array.isArray(dLoans));

    const { data: dProv } = await query('provisions?select=*', staffToken);
    record('staff', 'staff can read provisions', Array.isArray(dProv));
    console.log();
  }

  // ═══ Summary ═══
  console.log('═══ Summary ═══');
  const passed = results.length - failed;
  console.log(`  Passed: ${passed}/${results.length}`);
  console.log(`  Failed: ${failed}`);
  console.log();
  if (failed > 0) {
    console.log('\x1b[31m✗ RLS verification FAILED. Investigate immediately.\x1b[0m');
    console.log('Failed checks:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ✗ [${r.category}] ${r.name} ${r.detail ? '— ' + r.detail : ''}`);
    });
    process.exit(1);
  } else {
    console.log('\x1b[32m✓ All RLS checks passed.\x1b[0m');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('\x1b[31mUnexpected error:\x1b[0m', e);
  process.exit(1);
});
