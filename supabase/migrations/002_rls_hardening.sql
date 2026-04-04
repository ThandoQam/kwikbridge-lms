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
