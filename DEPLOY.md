# KwikBridge LMS — Manual Deployment Guide

Since the Supabase CLI can't be used from this environment (network restrictions),
here are two methods to deploy everything.

---

## METHOD A: Supabase CLI (Recommended)

Run these commands from your local machine in the `kwikbridge-lms` directory:

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase

# 2. Login
supabase login

# 3. Link to project
supabase link --project-ref yioqaluxgqxsifclydmd

# 4. Run all migrations
supabase db push

# 5. Deploy Edge Functions
supabase functions deploy health-check --no-verify-jwt
supabase functions deploy eod-batch --no-verify-jwt
supabase functions deploy api --no-verify-jwt
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy send-sms --no-verify-jwt

# 6. Create storage bucket
supabase storage create documents

# 7. Set secrets
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set FROM_EMAIL=noreply@tqacapital.co.za
```

---

## METHOD B: Supabase Dashboard (No CLI needed)

### Step 1: Run SQL Migrations

1. Go to https://supabase.com/dashboard/project/yioqaluxgqxsifclydmd/sql
2. Open the file `supabase/ALL_MIGRATIONS.sql` (980 lines)
3. Paste the entire contents into the SQL Editor
4. Click **Run**

If you prefer to run them individually:
- Run `001_normalise_schema.sql` first
- Then `002_rls_hardening.sql`
- Then `003_auth_role_assignment.sql`
- Then `004_file_upload_storage.sql`
- Then `005_eod_batch.sql`
- Then `006_events_table.sql`

### Step 2: Deploy Edge Functions

1. Go to https://supabase.com/dashboard/project/yioqaluxgqxsifclydmd/functions
2. Click **Deploy a new function**
3. For each function, create it with the same name as the directory:
   - `health-check` → paste contents of `supabase/functions/health-check/index.ts`
   - `eod-batch` → paste contents of `supabase/functions/eod-batch/index.ts`
   - `api` → paste contents of `supabase/functions/api/index.ts`
   - `send-email` → paste contents of `supabase/functions/send-email/index.ts`
   - `send-sms` → paste contents of `supabase/functions/send-sms/index.ts`
4. Disable JWT verification for `health-check` (public endpoint)

### Step 3: Create Storage Bucket

1. Go to https://supabase.com/dashboard/project/yioqaluxgqxsifclydmd/storage
2. Click **New Bucket**
3. Name: `documents`
4. Public: **OFF** (private)
5. File size limit: 10MB
6. Allowed MIME types: `application/pdf, image/jpeg, image/png`

### Step 4: Set Edge Function Secrets

1. Go to https://supabase.com/dashboard/project/yioqaluxgqxsifclydmd/settings/vault
2. Add these secrets:
   - `RESEND_API_KEY` — from resend.com (for email)
   - `TWILIO_ACCOUNT_SID` — from twilio.com (for SMS)
   - `TWILIO_AUTH_TOKEN` — Twilio auth
   - `TWILIO_FROM_NUMBER` — e.g. +27XXXXXXXXX
   - `FROM_EMAIL` — e.g. noreply@tqacapital.co.za

### Step 5: Schedule EOD Batch (pg_cron)

1. Go to https://supabase.com/dashboard/project/yioqaluxgqxsifclydmd/database/extensions
2. Enable the `pg_cron` extension
3. Go to SQL Editor and run:

```sql
SELECT cron.schedule(
  'eod-batch-nightly',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/eod-batch',
    body := '{}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    )
  );
  $$
);
```

---

## Verification

After deployment, test these endpoints:

```bash
# Health check (should return {"status":"healthy",...})
curl https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/health-check

# API products (should return product list)
curl https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/api/products

# Portfolio summary (requires auth token)
curl https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/api/portfolio/summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
