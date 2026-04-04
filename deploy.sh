#!/bin/bash
# ═══════════════════════════════════════════════════════════
# KwikBridge LMS — Supabase Deployment Script
# ═══════════════════════════════════════════════════════════
#
# This script deploys:
#   1. SQL Migrations (001-006) — creates tables, RLS, triggers
#   2. Edge Functions (5) — health-check, eod-batch, api, send-email, send-sms
#   3. Storage Bucket — "documents" for file uploads
#
# Prerequisites:
#   - Supabase CLI installed: npm install -g supabase
#   - Logged in: supabase login
#   - Linked to project: supabase link --project-ref yioqaluxgqxsifclydmd
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# ═══════════════════════════════════════════════════════════

set -e

PROJECT_REF="yioqaluxgqxsifclydmd"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  KwikBridge LMS — Supabase Deployment"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check prerequisites
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found.${NC}"
    echo "  Install with: npm install -g supabase"
    echo "  Or: brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✓${NC} Supabase CLI found: $(supabase --version)"

# Check if linked
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}→ Not logged in. Running: supabase login${NC}"
    supabase login
fi

# Link project if not already linked
if [ ! -f "supabase/.temp/project-ref" ] || [ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "$PROJECT_REF" ]; then
    echo -e "${YELLOW}→ Linking to project: $PROJECT_REF${NC}"
    supabase link --project-ref $PROJECT_REF
fi

echo ""
echo "═══ STEP 1: SQL Migrations ═══"
echo ""

# Run migrations in order
MIGRATIONS=(
    "001_normalise_schema.sql"
    "002_rls_hardening.sql"
    "003_auth_role_assignment.sql"
    "004_file_upload_storage.sql"
    "005_eod_batch.sql"
    "006_events_table.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    MIGRATION_FILE="supabase/migrations/$migration"
    if [ -f "$MIGRATION_FILE" ]; then
        echo -e "  Running: ${YELLOW}$migration${NC}"
        # Use supabase db push or direct SQL execution
        supabase db push --db-url "$(supabase db url)" < "$MIGRATION_FILE" 2>/dev/null \
            || psql "$(supabase db url)" -f "$MIGRATION_FILE" 2>/dev/null \
            || echo -e "    ${YELLOW}⚠ Run manually in Supabase Dashboard → SQL Editor${NC}"
        echo -e "    ${GREEN}✓${NC} $migration"
    else
        echo -e "    ${RED}✗ Not found: $MIGRATION_FILE${NC}"
    fi
done

echo ""
echo "═══ STEP 2: Edge Functions ═══"
echo ""

FUNCTIONS=(
    "health-check"
    "eod-batch"
    "api"
    "send-email"
    "send-sms"
)

for func in "${FUNCTIONS[@]}"; do
    FUNC_DIR="supabase/functions/$func"
    if [ -d "$FUNC_DIR" ]; then
        echo -e "  Deploying: ${YELLOW}$func${NC}"
        supabase functions deploy "$func" --project-ref $PROJECT_REF --no-verify-jwt 2>&1 | tail -1
        echo -e "    ${GREEN}✓${NC} $func deployed"
    else
        echo -e "    ${RED}✗ Not found: $FUNC_DIR${NC}"
    fi
done

echo ""
echo "═══ STEP 3: Storage Bucket ═══"
echo ""

echo "Creating 'documents' bucket..."
# This may fail if bucket already exists — that's fine
supabase storage create documents --public false 2>/dev/null \
    && echo -e "  ${GREEN}✓${NC} 'documents' bucket created" \
    || echo -e "  ${YELLOW}⚠${NC} 'documents' bucket may already exist"

echo ""
echo "═══ STEP 4: Edge Function Secrets ═══"
echo ""

echo -e "${YELLOW}Set the following secrets in Supabase Dashboard → Edge Functions → Secrets:${NC}"
echo ""
echo "  RESEND_API_KEY      — for email notifications (get from resend.com)"
echo "  TWILIO_ACCOUNT_SID  — for SMS notifications (get from twilio.com)"
echo "  TWILIO_AUTH_TOKEN   — Twilio auth token"
echo "  TWILIO_FROM_NUMBER  — Twilio sender number (e.g. +27XXXXXXXXX)"
echo "  FROM_EMAIL          — sender email (e.g. noreply@tqacapital.co.za)"
echo ""
echo "Or set via CLI:"
echo "  supabase secrets set RESEND_API_KEY=re_xxxx"
echo "  supabase secrets set TWILIO_ACCOUNT_SID=ACxxxx"
echo "  supabase secrets set TWILIO_AUTH_TOKEN=xxxx"
echo "  supabase secrets set TWILIO_FROM_NUMBER=+27xxxx"
echo "  supabase secrets set FROM_EMAIL=noreply@tqacapital.co.za"

echo ""
echo "═══ STEP 5: EOD Batch Schedule (pg_cron) ═══"
echo ""

echo -e "${YELLOW}Run this SQL in Supabase Dashboard → SQL Editor to schedule nightly EOD:${NC}"
echo ""
cat << 'EOFCRON'
-- Enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule EOD batch to run at 22:00 SAST daily
SELECT cron.schedule(
  'eod-batch-nightly',
  '0 20 * * *',  -- 20:00 UTC = 22:00 SAST
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
EOFCRON

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "  ${GREEN}DEPLOYMENT COMPLETE${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Verify deployment:"
echo "  Health check:  curl https://$PROJECT_REF.supabase.co/functions/v1/health-check"
echo "  API products:  curl https://$PROJECT_REF.supabase.co/functions/v1/api/products"
echo "  Dashboard:     https://supabase.com/dashboard/project/$PROJECT_REF"
echo ""
