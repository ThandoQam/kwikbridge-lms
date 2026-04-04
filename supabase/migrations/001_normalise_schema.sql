-- KwikBridge LMS — Database Normalisation Migration
-- Version: 1.0
-- Date: April 2026
-- Replaces: single kwikbridge_data key-value table
-- Creates: 12 relational tables with proper column types, indexes, and RLS

-- ═══════════════════════════════════════════════════════════════
-- 1. CUSTOMERS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  id_num TEXT,
  reg_num TEXT,
  industry TEXT,
  revenue NUMERIC DEFAULT 0,
  employees INTEGER DEFAULT 0,
  years INTEGER DEFAULT 0,
  address TEXT,
  province TEXT,
  fica_status TEXT DEFAULT 'Pending' CHECK (fica_status IN ('Pending','Verified','Failed','Expired')),
  fica_verified_at BIGINT,
  fica_verified_by TEXT,
  bee_status TEXT DEFAULT 'Pending Review',
  bee_level INTEGER DEFAULT 0,
  women_owned NUMERIC DEFAULT 0,
  youth_owned NUMERIC DEFAULT 0,
  disability_owned NUMERIC DEFAULT 0,
  social_score NUMERIC DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_fica ON customers(fica_status);
CREATE INDEX IF NOT EXISTS idx_customers_industry ON customers(industry);

-- ═══════════════════════════════════════════════════════════════
-- 2. PRODUCTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  ideal_for TEXT,
  min_amount NUMERIC NOT NULL DEFAULT 0,
  max_amount NUMERIC NOT NULL DEFAULT 0,
  min_term NUMERIC NOT NULL DEFAULT 0,
  max_term NUMERIC NOT NULL DEFAULT 0,
  base_rate NUMERIC NOT NULL DEFAULT 0,
  monthly_rate NUMERIC NOT NULL DEFAULT 0,
  repayment_type TEXT DEFAULT 'Amortising' CHECK (repayment_type IN ('Amortising','Bullet','Balloon','Seasonal')),
  arrangement_fee NUMERIC DEFAULT 0,
  commitment_fee NUMERIC DEFAULT 0,
  grace_period INTEGER DEFAULT 0,
  max_ltv NUMERIC DEFAULT 0,
  min_dscr NUMERIC DEFAULT 0,
  risk_class TEXT DEFAULT 'B' CHECK (risk_class IN ('A','B','C','D')),
  ecl NUMERIC DEFAULT 0,
  s1_pd NUMERIC DEFAULT 0,
  lgd NUMERIC DEFAULT 0,
  eligible_bee JSONB DEFAULT '[]',
  eligible_industries JSONB DEFAULT '[]',
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active','Suspended','Retired')),
  created_by TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 3. APPLICATIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  cust_id TEXT REFERENCES customers(id),
  product TEXT REFERENCES products(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  term INTEGER NOT NULL DEFAULT 0,
  rate NUMERIC DEFAULT 0,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Pre-Approval','Draft','Submitted','Underwriting','Approved','Declined','Booked','Withdrawn','Expired')),
  submitted BIGINT,
  decided BIGINT,
  approver TEXT,
  recommendation TEXT,
  expires_at BIGINT,
  qa_signed_off BOOLEAN DEFAULT FALSE,
  qa_officer TEXT,
  qa_date BIGINT,
  qa_findings JSONB,
  social_score NUMERIC DEFAULT 0,
  underwriting_workflow JSONB,
  sanctions_flag BOOLEAN DEFAULT FALSE,
  sanctions_date BIGINT,
  assigned_to TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_applications_cust ON applications(cust_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_product ON applications(product);

-- ═══════════════════════════════════════════════════════════════
-- 4. LOANS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  cust_id TEXT REFERENCES customers(id),
  app_id TEXT REFERENCES applications(id),
  product TEXT REFERENCES products(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  rate NUMERIC NOT NULL DEFAULT 0,
  term INTEGER NOT NULL DEFAULT 0,
  monthly_pmt NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked','Active','Settled','Written Off')),
  dpd INTEGER DEFAULT 0,
  stage INTEGER DEFAULT 1 CHECK (stage IN (1,2,3)),
  next_due BIGINT,
  disbursed BIGINT,
  disbursed_by TEXT,
  booked_by TEXT,
  booked_at BIGINT,
  arrangement_fee NUMERIC DEFAULT 0,
  commitment_fee NUMERIC DEFAULT 0,
  payments JSONB DEFAULT '[]',
  ptp_history JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_loans_cust ON loans(cust_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_dpd ON loans(dpd);
CREATE INDEX IF NOT EXISTS idx_loans_stage ON loans(stage);

-- ═══════════════════════════════════════════════════════════════
-- 5. DOCUMENTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  cust_id TEXT REFERENCES customers(id),
  app_id TEXT,
  name TEXT,
  type TEXT,
  category TEXT,
  doc_type TEXT,
  status TEXT DEFAULT 'Pending Review' CHECK (status IN ('Pending Review','Under Review','Verified','Rejected')),
  uploaded_at BIGINT,
  uploaded_by TEXT,
  reviewed_by TEXT,
  reviewed_at BIGINT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_cust ON documents(cust_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- ═══════════════════════════════════════════════════════════════
-- 6. COLLECTIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  loan_id TEXT REFERENCES loans(id),
  action TEXT,
  notes TEXT,
  officer TEXT,
  ts BIGINT,
  channel TEXT,
  ptp_date BIGINT,
  ptp_amount NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_collections_loan ON collections(loan_id);

-- ═══════════════════════════════════════════════════════════════
-- 7. AUDIT TRAIL
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_trail (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT,
  "user" TEXT,
  ts BIGINT NOT NULL,
  details TEXT,
  category TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_trail(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_trail(entity);

-- ═══════════════════════════════════════════════════════════════
-- 8. ALERTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  type TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','error')),
  title TEXT,
  msg TEXT,
  read BOOLEAN DEFAULT FALSE,
  ts BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);

-- ═══════════════════════════════════════════════════════════════
-- 9. PROVISIONS (IFRS 9)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provisions (
  id TEXT PRIMARY KEY,
  loan_id TEXT REFERENCES loans(id),
  stage INTEGER CHECK (stage IN (1,2,3)),
  pd NUMERIC DEFAULT 0,
  lgd NUMERIC DEFAULT 0,
  ead NUMERIC DEFAULT 0,
  ecl NUMERIC DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_provisions_loan ON provisions(loan_id);

-- ═══════════════════════════════════════════════════════════════
-- 10. COMMUNICATIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS comms (
  id TEXT PRIMARY KEY,
  cust_id TEXT REFERENCES customers(id),
  type TEXT CHECK (type IN ('Email','SMS','Phone','Letter','Meeting')),
  direction TEXT DEFAULT 'Outbound',
  subject TEXT,
  body TEXT,
  sent_by TEXT,
  sent_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_comms_cust ON comms(cust_id);

-- ═══════════════════════════════════════════════════════════════
-- 11. STATUTORY REPORTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS statutory_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  category TEXT,
  period TEXT,
  due_date TEXT,
  submit_to TEXT,
  status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Submitted')),
  preparer TEXT,
  reviewer TEXT,
  submitted_date TEXT,
  notes TEXT
);

-- ═══════════════════════════════════════════════════════════════
-- 12. SETTINGS (single-row config)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT DEFAULT 'TQA Capital (Pty) Ltd',
  ncr_reg TEXT DEFAULT 'NCRCP22396',
  ncr_expiry TEXT,
  branch TEXT DEFAULT 'East London, Nahoon Valley',
  year_end TEXT DEFAULT 'February',
  address TEXT,
  annual_review_date TEXT,
  form39_threshold NUMERIC DEFAULT 50000,
  total_facility NUMERIC DEFAULT 10000000,
  funding_capacity NUMERIC DEFAULT 20000000,
  ncr_email TEXT,
  ncr_email_form39 TEXT
);

-- Insert default settings row
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Enable on all tables, set initial permissive policy for authenticated users
-- Hardening (per-role RLS) is a separate future initiative (FI-3)
-- ═══════════════════════════════════════════════════════════════

DO $$ 
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'customers','products','applications','loans','documents',
    'collections','audit_trail','alerts','provisions','comms',
    'statutory_reports','settings'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated" ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_authenticated" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS "%s_anon_read" ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_anon_read" ON %I FOR SELECT TO anon USING (true)',
      tbl, tbl
    );
  END LOOP;
END $$;
