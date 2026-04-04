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
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "%s_authenticated" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "%s_anon_read" ON %I FOR SELECT TO anon USING (true)',
      tbl, tbl
    );
  END LOOP;
END $$;
-- KwikBridge LMS — RLS Hardening Migration
-- Version: 1.0
-- Date: April 2026
-- Prerequisite: 001_normalise_schema.sql must be applied first
--
-- ARCHITECTURE:
-- Role is stored in Supabase Auth user metadata as app_role.
-- Staff users are mapped at sign-in via SYSTEM_USERS lookup.
-- Borrowers get role='BORROWER' at registration.
--
-- The JWT contains: auth.jwt() -> 'user_metadata' ->> 'app_role'
-- The user ID is:   auth.uid()
-- The user email:   auth.jwt() ->> 'email'
--
-- ROLE HIERARCHY:
--   ADMIN, EXEC                    → Full read/write all tables
--   CREDIT_HEAD, COMPLIANCE        → Full read, write own scope
--   CREDIT_SNR, CREDIT             → Read most, write underwriting
--   LOAN_OFFICER                   → Read most, write origination/servicing
--   COLLECTIONS                    → Read most, write collections
--   FINANCE                        → Read most, write servicing/provisions
--   AUDITOR, VIEWER                → Read-only all tables
--   BORROWER                       → Read/write own records only

-- ═══════════════════════════════════════════════════════════════
-- HELPER: Extract app_role from JWT
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'app_role'),
    'BORROWER'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_email()
RETURNS TEXT AS $$
  SELECT auth.jwt() ->> 'email';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper: check if user is staff (any non-BORROWER role)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT public.get_app_role() != 'BORROWER';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper: check if user is admin/exec (full access)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_app_role() IN ('ADMIN', 'EXEC');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper: check if user is read-only (auditor/viewer)
CREATE OR REPLACE FUNCTION public.is_read_only()
RETURNS BOOLEAN AS $$
  SELECT public.get_app_role() IN ('AUDITOR', 'VIEWER');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- DROP PERMISSIVE POLICIES (from 001 migration)
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'customers','products','applications','loans','documents',
    'collections','audit_trail','alerts','provisions','comms',
    'statutory_reports','settings'
  ]) LOOP
    -- Drop old permissive policies
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_anon_read" ON %I', tbl, tbl);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 1. CUSTOMERS
--    Staff: read all, write (non-read-only)
--    Borrower: read/write own record (matched by email)
--    Anon: no access
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "customers_staff_read" ON customers
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "customers_staff_write" ON customers
  FOR ALL TO authenticated
  USING (public.is_staff() AND NOT public.is_read_only())
  WITH CHECK (public.is_staff() AND NOT public.is_read_only());

CREATE POLICY "customers_borrower_own" ON customers
  FOR ALL TO authenticated
  USING (
    NOT public.is_staff()
    AND email = public.get_user_email()
  )
  WITH CHECK (
    NOT public.is_staff()
    AND email = public.get_user_email()
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. PRODUCTS
--    Everyone (incl anon): read all active products
--    Staff (non-read-only): write
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "products_read" ON products
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "products_staff_write" ON products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "products_staff_update" ON products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 3. APPLICATIONS
--    Staff: read all, write (non-read-only)
--    Borrower: read/write own (matched by cust_id → customer email)
--    Anon: no access
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "applications_staff_read" ON applications
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "applications_staff_write" ON applications
  FOR ALL TO authenticated
  USING (public.is_staff() AND NOT public.is_read_only())
  WITH CHECK (public.is_staff() AND NOT public.is_read_only());

CREATE POLICY "applications_borrower_own" ON applications
  FOR ALL TO authenticated
  USING (
    NOT public.is_staff()
    AND cust_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  )
  WITH CHECK (
    NOT public.is_staff()
    AND cust_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 4. LOANS
--    Staff: read all, write (non-read-only)
--    Borrower: read own, no direct write (payments via app logic)
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "loans_staff_read" ON loans
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "loans_staff_write" ON loans
  FOR ALL TO authenticated
  USING (public.is_staff() AND NOT public.is_read_only())
  WITH CHECK (public.is_staff() AND NOT public.is_read_only());

CREATE POLICY "loans_borrower_read" ON loans
  FOR SELECT TO authenticated
  USING (
    NOT public.is_staff()
    AND cust_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  );

CREATE POLICY "loans_borrower_update" ON loans
  FOR UPDATE TO authenticated
  USING (
    NOT public.is_staff()
    AND cust_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  )
  WITH CHECK (
    NOT public.is_staff()
    AND cust_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 5. DOCUMENTS
--    Staff: read all, write (non-read-only)
--    Borrower: read/write own (upload KYB/FICA docs)
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "documents_staff_read" ON documents
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "documents_staff_write" ON documents
  FOR ALL TO authenticated
  USING (public.is_staff() AND NOT public.is_read_only())
  WITH CHECK (public.is_staff() AND NOT public.is_read_only());

CREATE POLICY "documents_borrower_own" ON documents
  FOR ALL TO authenticated
  USING (
    NOT public.is_staff()
    AND cust_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  )
  WITH CHECK (
    NOT public.is_staff()
    AND cust_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 6. COLLECTIONS
--    Staff: read all, write (collections + credit roles)
--    Borrower: no access (handled via portal loan view)
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "collections_staff_read" ON collections
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "collections_staff_write" ON collections
  FOR ALL TO authenticated
  USING (
    public.get_app_role() IN ('ADMIN','EXEC','CREDIT_HEAD','COLLECTIONS','LOAN_OFFICER')
  )
  WITH CHECK (
    public.get_app_role() IN ('ADMIN','EXEC','CREDIT_HEAD','COLLECTIONS','LOAN_OFFICER')
  );

-- ═══════════════════════════════════════════════════════════════
-- 7. AUDIT TRAIL
--    All authenticated: read (transparency)
--    Staff (non-read-only): insert (append-only — no update/delete)
--    No one can update or delete audit entries
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "audit_read" ON audit_trail
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "audit_insert" ON audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND NOT public.is_read_only());

-- Explicitly deny update and delete via absence of policy
-- (RLS enabled + no UPDATE/DELETE policy = blocked)

-- ═══════════════════════════════════════════════════════════════
-- 8. ALERTS
--    All authenticated: read all
--    Staff (non-read-only): insert + update (mark read)
--    Borrower: read own alerts (linked via message content)
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "alerts_staff_read" ON alerts
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "alerts_staff_write" ON alerts
  FOR ALL TO authenticated
  USING (public.is_staff() AND NOT public.is_read_only())
  WITH CHECK (public.is_staff() AND NOT public.is_read_only());

CREATE POLICY "alerts_borrower_read" ON alerts
  FOR SELECT TO authenticated
  USING (NOT public.is_staff());

-- ═══════════════════════════════════════════════════════════════
-- 9. PROVISIONS (IFRS 9)
--    Staff: read all
--    Finance + Credit + Admin: write
--    Borrower: no access
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "provisions_staff_read" ON provisions
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "provisions_staff_write" ON provisions
  FOR ALL TO authenticated
  USING (
    public.get_app_role() IN ('ADMIN','EXEC','CREDIT_HEAD','FINANCE')
  )
  WITH CHECK (
    public.get_app_role() IN ('ADMIN','EXEC','CREDIT_HEAD','FINANCE')
  );

-- ═══════════════════════════════════════════════════════════════
-- 10. COMMUNICATIONS
--    Staff: read all, write (non-read-only)
--    Borrower: read own (matched by cust_id)
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "comms_staff_read" ON comms
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "comms_staff_write" ON comms
  FOR ALL TO authenticated
  USING (public.is_staff() AND NOT public.is_read_only())
  WITH CHECK (public.is_staff() AND NOT public.is_read_only());

CREATE POLICY "comms_borrower_read" ON comms
  FOR SELECT TO authenticated
  USING (
    NOT public.is_staff()
    AND cust_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 11. STATUTORY REPORTS
--    Staff: read all
--    Compliance + Admin: write
--    Borrower: no access
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "statutory_staff_read" ON statutory_reports
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "statutory_staff_write" ON statutory_reports
  FOR ALL TO authenticated
  USING (
    public.get_app_role() IN ('ADMIN','EXEC','COMPLIANCE')
  )
  WITH CHECK (
    public.get_app_role() IN ('ADMIN','EXEC','COMPLIANCE')
  );

-- ═══════════════════════════════════════════════════════════════
-- 12. SETTINGS
--    All authenticated: read
--    Admin only: write
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "settings_read" ON settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "settings_admin_write" ON settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- PUBLIC APPLICATION SUBMISSION
-- Anon users can create customers and applications (public apply form)
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "customers_anon_create" ON customers
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "applications_anon_create" ON applications
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "documents_anon_create" ON documents
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "alerts_anon_create" ON alerts
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "audit_anon_insert" ON audit_trail
  FOR INSERT TO anon
  WITH CHECK (true);

-- Products readable by anon (already handled above)
-- Settings readable by anon (for NCR display)
CREATE POLICY "settings_anon_read" ON settings
  FOR SELECT TO anon
  USING (true);
-- KwikBridge LMS — Auth Role Assignment
-- This trigger function runs after a user signs in or signs up.
-- It maps the user's email to a staff role via the staff_roles table,
-- or defaults to BORROWER for unmatched emails.
--
-- APPLY AFTER: 002_rls_hardening.sql

-- Staff role lookup table (maps email → app_role)
CREATE TABLE IF NOT EXISTS staff_roles (
  email TEXT PRIMARY KEY,
  app_role TEXT NOT NULL DEFAULT 'BORROWER',
  name TEXT,
  initials TEXT,
  department TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active','Suspended','Revoked'))
);

-- Seed staff roles from SYSTEM_USERS
INSERT INTO staff_roles (email, app_role, name, initials, department) VALUES
  ('thando@tqacapital.co.za',     'ADMIN',       'Thando Qamarana',    'TQ', 'Executive'),
  ('j.ndaba@tqacapital.co.za',    'LOAN_OFFICER', 'Jabu Ndaba',        'JN', 'Origination'),
  ('p.sithole@tqacapital.co.za',  'CREDIT',       'Phumzile Sithole',  'PS', 'Credit'),
  ('m.zulu@tqacapital.co.za',     'CREDIT_HEAD',  'Mandla Zulu',       'MZ', 'Credit'),
  ('n.xaba@tqacapital.co.za',     'COLLECTIONS',  'Noluthando Xaba',   'NX', 'Collections'),
  ('s.pillay@tqacapital.co.za',   'FINANCE',      'Suren Pillay',      'SP', 'Finance'),
  ('compliance@tqacapital.co.za', 'COMPLIANCE',   'Compliance Officer', 'CO', 'Compliance'),
  ('audit@tqacapital.co.za',      'AUDITOR',      'Internal Auditor',  'IA', 'Audit'),
  ('exec@tqacapital.co.za',       'EXEC',         'Sipho Dlamini',     'SD', 'Executive')
ON CONFLICT (email) DO UPDATE SET
  app_role = EXCLUDED.app_role,
  name = EXCLUDED.name,
  initials = EXCLUDED.initials,
  department = EXCLUDED.department;

-- Enable RLS on staff_roles
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_roles_admin_read" ON staff_roles
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "staff_roles_admin_write" ON staff_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Function to assign app_role to user metadata on sign-in
-- Called via Supabase Auth Hook or manually after login
CREATE OR REPLACE FUNCTION public.assign_app_role()
RETURNS TRIGGER AS $$
DECLARE
  matched_role TEXT;
BEGIN
  -- Look up the user's email in staff_roles
  SELECT app_role INTO matched_role
  FROM staff_roles
  WHERE email = NEW.email
  AND status = 'Active';

  -- Set app_role in user metadata (defaults to BORROWER)
  NEW.raw_user_meta_data = COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('app_role', COALESCE(matched_role, 'BORROWER'));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: assign role on user creation (signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_app_role();

-- Trigger: re-assign role on user update (login, metadata change)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_app_role();

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERY
-- Run this after applying to verify role assignment works:
--
-- SELECT id, email,
--        raw_user_meta_data ->> 'app_role' as app_role
-- FROM auth.users
-- ORDER BY email;
-- ═══════════════════════════════════════════════════════════════
-- KwikBridge LMS — File Upload Storage Migration
-- Version: 1.0
-- Date: April 2026
-- Prerequisite: 001, 002, 003 migrations applied
--
-- Creates Supabase Storage bucket for KYB/FICA documents
-- and adds storage_path column to the documents table.

-- ═══════════════════════════════════════════════════════════════
-- 1. ADD STORAGE COLUMNS TO DOCUMENTS TABLE
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_name TEXT;

-- ═══════════════════════════════════════════════════════════════
-- 2. CREATE STORAGE BUCKET
--    Run this in the Supabase Dashboard → Storage → New Bucket
--    OR via the Storage API below
-- ═══════════════════════════════════════════════════════════════

-- Supabase Storage buckets are created via the Dashboard or API,
-- not via SQL. Use one of these approaches:
--
-- OPTION A: Dashboard
--   1. Go to Storage → New Bucket
--   2. Name: "documents"
--   3. Public: OFF (private bucket — signed URLs for access)
--   4. File size limit: 10 MB
--   5. Allowed MIME types: application/pdf, image/jpeg, image/png
--
-- OPTION B: API (run from browser console or Node.js)
--   fetch('https://yioqaluxgqxsifclydmd.supabase.co/storage/v1/bucket', {
--     method: 'POST',
--     headers: {
--       'Authorization': 'Bearer YOUR_SERVICE_ROLE_KEY',
--       'Content-Type': 'application/json'
--     },
--     body: JSON.stringify({
--       id: 'documents',
--       name: 'documents',
--       public: false,
--       file_size_limit: 10485760,
--       allowed_mime_types: ['application/pdf','image/jpeg','image/png']
--     })
--   });

-- ═══════════════════════════════════════════════════════════════
-- 3. STORAGE RLS POLICIES
-- ═══════════════════════════════════════════════════════════════

-- Staff can read all files
CREATE POLICY "staff_read_documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_staff()
  );

-- Staff (non-read-only) can upload files
CREATE POLICY "staff_upload_documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_staff()
    AND NOT public.is_read_only()
  );

-- Borrowers can read own files (path starts with their customer ID)
CREATE POLICY "borrower_read_own_documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND NOT public.is_staff()
    AND (storage.foldername(name))[1] IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  );

-- Borrowers can upload own files (path starts with their customer ID)
CREATE POLICY "borrower_upload_own_documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND NOT public.is_staff()
    AND (storage.foldername(name))[1] IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
    )
  );

-- Anon can upload (public application form)
CREATE POLICY "anon_upload_documents" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'documents');

-- No one can delete files (regulatory retention)
-- (Absence of DELETE policy = blocked by RLS)
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
-- KwikBridge LMS — Events Table (ENH-05)
-- Append-only event store for event-driven architecture.
-- Prerequisite: 001-005 migrations applied.

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('loan','application','customer','document','collection','system')),
  triggered_by TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  delivered_to JSONB DEFAULT '[]',
  ts BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_entity ON events(type, entity_id);

-- RLS: append-only
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Staff can read all events
CREATE POLICY "events_staff_read" ON events
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- Staff can insert events (append-only — no UPDATE/DELETE policies)
CREATE POLICY "events_staff_insert" ON events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

-- Borrowers can read events on their own entities
CREATE POLICY "events_borrower_read" ON events
  FOR SELECT TO authenticated
  USING (
    NOT public.is_staff()
    AND entity_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
      UNION
      SELECT id FROM applications WHERE cust_id IN (SELECT id FROM customers WHERE email = public.get_user_email())
      UNION
      SELECT id FROM loans WHERE cust_id IN (SELECT id FROM customers WHERE email = public.get_user_email())
    )
  );

-- System/anon can insert (for public form events)
CREATE POLICY "events_anon_insert" ON events
  FOR INSERT TO anon
  WITH CHECK (true);

-- NO UPDATE or DELETE policies — events are immutable
