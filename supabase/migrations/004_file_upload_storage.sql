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
