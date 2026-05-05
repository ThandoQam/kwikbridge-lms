-- KwikBridge LMS — Scheduled Jobs Migration
-- Version: 1.0
-- Sets up pg_cron schedules for EOD batch + webhook delivery
--
-- PRE-REQUISITE: Enable pg_cron extension in Supabase Dashboard:
--   Database → Extensions → pg_cron → Enable
-- Then run this migration.
--
-- Service role key must be available as Postgres setting:
--   Dashboard → Database → Custom Settings → Add:
--     name: app.settings.service_role_key
--     value: <your service role key>
--
-- VERIFICATION:
--   SELECT * FROM cron.job;       -- list scheduled jobs
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--   SELECT cron.unschedule('job-name');  -- remove a job

-- ─── Schedule EOD batch — daily at 22:00 SAST ───
-- (UTC 20:00 because SAST is UTC+2)
SELECT cron.schedule(
  'kb-eod-batch',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    'https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/eod-batch',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- ─── Schedule webhook delivery — every minute ───
SELECT cron.schedule(
  'kb-webhooks-process',
  '* * * * *',
  $$
  SELECT net.http_post(
    'https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/webhooks/process',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);

-- ─── Schedule statutory deadline check — daily at 06:00 SAST ───
-- Sends alerts for upcoming NCR Form 39, annual returns, etc.
SELECT cron.schedule(
  'kb-statutory-check',
  '0 4 * * *',
  $$
  -- Insert alert when statutory report is due in 7 days
  INSERT INTO alerts (id, type, severity, title, msg, ts)
  SELECT 
    gen_random_uuid()::text,
    'Statutory',
    'warning',
    'Report Due Soon: ' || name,
    name || ' is due on ' || due_date || '. Status: ' || status,
    EXTRACT(EPOCH FROM NOW()) * 1000
  FROM statutory_reports
  WHERE status != 'Submitted'
    AND due_date::date BETWEEN (NOW()::date) AND (NOW()::date + INTERVAL '7 days')
    AND NOT EXISTS (
      SELECT 1 FROM alerts a 
      WHERE a.title = 'Report Due Soon: ' || statutory_reports.name 
        AND a.ts > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000
    );
  $$
);

-- ─── Schedule cleanup of old audit entries (>3 years) ───
-- Required by FICA: keep 5 years, NCA: keep 3 years for non-active loans
-- Conservative: keep all audit for active loans, archive others after 3 years
SELECT cron.schedule(
  'kb-audit-archive',
  '0 2 1 * *',  -- 1st of each month at 02:00 UTC
  $$
  -- For now, just count what would be archived (don't delete)
  -- Full archival requires a separate audit_archive table
  INSERT INTO audit_trail (id, action, entity, user_name, detail, ts, category)
  SELECT 
    gen_random_uuid()::text,
    'Audit Archive Scan',
    'system',
    'pg_cron',
    'Audit entries > 3 years old: ' || COUNT(*)::text,
    EXTRACT(EPOCH FROM NOW()) * 1000,
    'System'
  FROM audit_trail
  WHERE ts < EXTRACT(EPOCH FROM NOW() - INTERVAL '3 years') * 1000;
  $$
);

-- Verification query (run manually after migration)
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
