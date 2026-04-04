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
