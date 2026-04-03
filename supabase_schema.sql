-- KwikBridge LMS Database Schema
-- Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  id_num TEXT,
  reg_num TEXT,
  industry TEXT,
  sector TEXT,
  revenue NUMERIC DEFAULT 0,
  employees INTEGER DEFAULT 0,
  years INTEGER DEFAULT 0,
  bee_level INTEGER DEFAULT 3,
  bee_status TEXT DEFAULT 'Pending Review',
  bee_expiry BIGINT,
  address TEXT,
  province TEXT DEFAULT 'Eastern Cape',
  fica_status TEXT DEFAULT 'Pending',
  fica_date BIGINT,
  risk_category TEXT DEFAULT 'Medium',
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 2. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  min_amount NUMERIC DEFAULT 100000,
  max_amount NUMERIC DEFAULT 5000000,
  min_term INTEGER DEFAULT 12,
  max_term INTEGER DEFAULT 60,
  base_rate NUMERIC DEFAULT 14.5,
  repayment_type TEXT DEFAULT 'Amortising',
  arrangement_fee NUMERIC DEFAULT 1.0,
  commitment_fee NUMERIC DEFAULT 0.5,
  grace_period INTEGER DEFAULT 0,
  max_ltv NUMERIC DEFAULT 80,
  min_dscr NUMERIC DEFAULT 1.25,
  eligible_bee JSONB DEFAULT '[1,2,3,4]',
  eligible_industries JSONB DEFAULT '["All"]',
  status TEXT DEFAULT 'Active',
  created_by TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 3. APPLICATIONS
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  cust_id TEXT REFERENCES customers(id),
  status TEXT DEFAULT 'Draft',
  product TEXT REFERENCES products(id),
  amount NUMERIC DEFAULT 0,
  term INTEGER DEFAULT 36,
  purpose TEXT,
  rate NUMERIC,
  risk_score INTEGER,
  dscr NUMERIC,
  current_ratio NUMERIC,
  debt_equity NUMERIC,
  social_score INTEGER,
  recommendation TEXT,
  approver TEXT,
  credit_memo TEXT,
  submitted BIGINT,
  decided BIGINT,
  conditions JSONB DEFAULT '[]',
  created_by TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  expires_at BIGINT,
  assigned_to TEXT,
  sanctions_flag BOOLEAN DEFAULT FALSE,
  sanctions_date BIGINT,
  withdrawn_at BIGINT,
  withdrawn_by TEXT,
  qa_signed_off BOOLEAN DEFAULT FALSE,
  qa_officer TEXT,
  qa_date BIGINT,
  qa_findings JSONB,
  workflow JSONB DEFAULT '{}'
);

-- 4. LOANS
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  app_id TEXT REFERENCES applications(id),
  cust_id TEXT REFERENCES customers(id),
  status TEXT DEFAULT 'Active',
  amount NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  rate NUMERIC DEFAULT 14.5,
  term INTEGER DEFAULT 36,
  monthly_pmt NUMERIC DEFAULT 0,
  disbursed BIGINT,
  next_due BIGINT,
  last_pmt BIGINT,
  last_pmt_amt NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,
  dpd INTEGER DEFAULT 0,
  stage INTEGER DEFAULT 1,
  payments JSONB DEFAULT '[]',
  covenants JSONB DEFAULT '[]',
  collateral JSONB DEFAULT '[]',
  booked_by TEXT,
  booked_at BIGINT,
  disbursed_by TEXT
);

-- 5. DOCUMENTS
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  cust_id TEXT REFERENCES customers(id),
  app_id TEXT,
  loan_id TEXT,
  name TEXT NOT NULL,
  category TEXT,
  type TEXT,
  required BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'Pending',
  uploaded_by TEXT,
  uploaded_at BIGINT,
  verified_by TEXT,
  verified_at BIGINT,
  expiry_date BIGINT,
  file_ref TEXT,
  notes TEXT
);

-- 6. COLLECTIONS
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  loan_id TEXT REFERENCES loans(id),
  cust_id TEXT REFERENCES customers(id),
  stage TEXT,
  dpd INTEGER DEFAULT 0,
  action TEXT,
  channel TEXT DEFAULT 'System',
  officer TEXT,
  notes TEXT,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  ptp_date BIGINT,
  ptp_amount NUMERIC,
  ptp_status TEXT,
  restructure JSONB,
  write_off BOOLEAN DEFAULT FALSE
);

-- 7. ALERTS
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  type TEXT,
  severity TEXT DEFAULT 'info',
  title TEXT,
  msg TEXT,
  loan_id TEXT,
  cust_id TEXT,
  read BOOLEAN DEFAULT FALSE,
  ts BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 8. AUDIT TRAIL
CREATE TABLE IF NOT EXISTS audit_trail (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT,
  "user" TEXT,
  detail TEXT,
  category TEXT,
  ts BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 9. PROVISIONS (IFRS 9)
CREATE TABLE IF NOT EXISTS provisions (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  loan_id TEXT REFERENCES loans(id),
  stage INTEGER DEFAULT 1,
  pd NUMERIC DEFAULT 0,
  lgd NUMERIC DEFAULT 0,
  ead NUMERIC DEFAULT 0,
  ecl NUMERIC DEFAULT 0,
  method TEXT DEFAULT 'ECL'
);

-- 10. COMMUNICATIONS
CREATE TABLE IF NOT EXISTS comms (
  id TEXT PRIMARY KEY,
  cust_id TEXT REFERENCES customers(id),
  loan_id TEXT,
  channel TEXT DEFAULT 'Email',
  direction TEXT DEFAULT 'Outbound',
  "from" TEXT,
  subject TEXT,
  body TEXT,
  ts BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  related_to TEXT,
  doc_type TEXT,
  type TEXT
);

-- 11. STATUTORY REPORTS
CREATE TABLE IF NOT EXISTS statutory_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  category TEXT,
  due_date TEXT,
  period TEXT,
  status TEXT DEFAULT 'Pending',
  submit_to TEXT,
  preparer TEXT,
  reviewer TEXT,
  submitted_date TEXT,
  notes TEXT
);

-- 12. SETTINGS (single-row config)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT DEFAULT 'ThandoQ and Associates (Pty) Ltd',
  ncr_reg TEXT DEFAULT 'NCRCP22396',
  ncr_expiry TEXT DEFAULT '31 July 2026',
  branch TEXT DEFAULT 'East London, Nahoon Valley',
  year_end TEXT,
  address TEXT,
  ncr_address TEXT,
  ncr_po TEXT,
  ncr_email_annual TEXT,
  ncr_email_form39 TEXT
);

-- Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms ENABLE ROW LEVEL SECURITY;
ALTER TABLE statutory_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon key (MVP — tighten with auth later)
CREATE POLICY "Allow all" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON collections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON audit_trail FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON provisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON comms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON statutory_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON settings FOR ALL USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_applications_cust ON applications(cust_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_loans_cust ON loans(cust_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_documents_cust ON documents(cust_id);
CREATE INDEX IF NOT EXISTS idx_documents_app ON documents(app_id);
CREATE INDEX IF NOT EXISTS idx_collections_loan ON collections(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_trail(entity);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_trail(ts);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);

-- Migration: Add designated group ownership fields to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS women_owned NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS youth_owned NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS disability_owned NUMERIC DEFAULT 0;
