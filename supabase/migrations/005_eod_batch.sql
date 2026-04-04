-- KwikBridge LMS — EOD Batch Processing Migration
-- Adds columns for interest accrual tracking and EOD run history.
-- Prerequisite: 001-004 migrations applied.

-- Interest accrual tracking on loans
ALTER TABLE loans ADD COLUMN IF NOT EXISTS accrued_interest NUMERIC DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS interest_ledger JSONB DEFAULT '[]';
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_paid NUMERIC DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS last_pmt BIGINT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS last_pmt_amt NUMERIC DEFAULT 0;

-- EOD run history
CREATE TABLE IF NOT EXISTS eod_runs (
  id TEXT PRIMARY KEY,
  run_date BIGINT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  loans_processed INTEGER DEFAULT 0,
  interest_accrued NUMERIC DEFAULT 0,
  dpd_updated INTEGER DEFAULT 0,
  stage_migrations INTEGER DEFAULT 0,
  provisions_recalculated INTEGER DEFAULT 0,
  debit_orders_generated INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,
  ptps_broken INTEGER DEFAULT 0,
  escalations INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','failed','running')),
  triggered_by TEXT DEFAULT 'SYSTEM',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_eod_runs_date ON eod_runs(run_date DESC);

-- RLS for eod_runs
ALTER TABLE eod_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eod_runs_staff_read" ON eod_runs
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "eod_runs_system_write" ON eod_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Add method column to provisions if missing
ALTER TABLE provisions ADD COLUMN IF NOT EXISTS method TEXT;
