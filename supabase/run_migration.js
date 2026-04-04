#!/usr/bin/env node
/**
 * KwikBridge LMS — Database Migration Runner
 * 
 * Reads the SQL migration file and executes it against Supabase.
 * Run: node supabase/run_migration.js
 * 
 * Prerequisites: The Supabase project must be accessible and the
 * anon key must have permission to create tables (or use the
 * Supabase Dashboard SQL Editor to run the migration manually).
 * 
 * RECOMMENDED: Copy the SQL from supabase/migrations/001_normalise_schema.sql
 * and paste it into the Supabase Dashboard → SQL Editor → Run.
 * This ensures proper permissions and error handling.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://yioqaluxgqxsifclydmd.supabase.co";
// Use service_role key for DDL operations (replace with actual key)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.log(`
═══════════════════════════════════════════════════════════════
  KwikBridge LMS — Database Migration
═══════════════════════════════════════════════════════════════

  To run this migration automatically, set the service role key:

    SUPABASE_SERVICE_KEY=your_key node supabase/run_migration.js

  RECOMMENDED APPROACH:
  Copy the SQL file and run it in the Supabase Dashboard:

    1. Open: ${SUPABASE_URL}/project/default/sql
    2. Paste contents of: supabase/migrations/001_normalise_schema.sql
    3. Click "Run"

  The migration creates 12 tables:
    customers, products, applications, loans, documents,
    collections, audit_trail, alerts, provisions, comms,
    statutory_reports, settings

  Each table has:
    - Proper column types (TEXT, NUMERIC, INTEGER, BIGINT, BOOLEAN, JSONB)
    - CHECK constraints for status/enum fields
    - Foreign key references (cust_id → customers, loan_id → loans, etc.)
    - Indexes on frequently queried columns
    - RLS enabled with permissive policies (hardening is FI-3)

═══════════════════════════════════════════════════════════════
`);
  process.exit(0);
}

async function runMigration() {
  const sqlFile = path.join(__dirname, 'migrations/001_normalise_schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log("Running migration against Supabase...");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (response.ok) {
    console.log("✓ Migration completed successfully");
  } else {
    const err = await response.text();
    console.log("Migration via RPC failed — use Supabase Dashboard SQL Editor instead.");
    console.log("Error:", err);
  }
}

runMigration().catch(console.error);
