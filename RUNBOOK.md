# KwikBridge LMS — Production Operations Runbook

## On-Call Responsibilities

The on-call engineer monitors Sentry, UptimeRobot, and Supabase logs.
Response times:
- **P1 (system down, money at risk):** 15 minutes
- **P2 (feature broken, no money risk):** 4 hours
- **P3 (cosmetic, isolated):** Next business day

## Common Incidents

### "I can't log in" / Auth errors
1. Check Supabase Dashboard → Authentication → Logs
2. Check if email confirmations are required and SMTP is working
3. Verify `VITE_SUPABASE_ANON_KEY` matches the Supabase project
4. Test Staff Admin dev access — if that works, it's an Auth config issue not data

### "Disbursement failed"
**This is P1.** Money may have moved without record.
1. Check Sentry for the error trace
2. Check Supabase audit_trail for the disbursement attempt
3. Check the Edge Function logs (Supabase Dashboard → Edge Functions)
4. Reconcile against the bank statement before retrying
5. If money moved without DB record: manual reconciliation required, do NOT retry

### "Dashboard slow / timing out"
1. Check Vercel Analytics for response time spikes
2. Check Supabase Dashboard → Database → Query Performance
3. Most common cause: unindexed query on large table
4. Quick fix: add index on the slow column
5. Long-term fix: pagination for the affected list

### "Borrower can see another borrower's data"
**This is P0 (data breach).**
1. Immediately disable the affected borrower's session
2. Audit the RLS policy on the affected table
3. Verify the borrower's account was created correctly
4. POPIA breach notification: Information Officer must be notified within 72h
5. Do NOT discuss publicly until breach analysis complete

## Backup & Recovery

### Daily Automated
- Supabase: PITR (Point-in-Time Recovery) — last 7 days
- Vercel: deploy history — last 100 deployments
- Both are managed by their respective providers

### Recovery Procedure (Untested — needs first-time runbook test)
```
1. Supabase Dashboard → Database → Backups → Restore Point
2. Choose timestamp before incident
3. Restore creates new project (does not overwrite)
4. Update Vercel env vars to point at restored project
5. Verify data integrity (spot-check 5 customers, 5 loans)
6. Switch DNS / promote new project
```

### Recovery Time Objectives
- RTO (Recovery Time): 2 hours from decision to restore
- RPO (Recovery Point): 24 hours (last automated backup)

These targets are aspirational until first DR test is performed.
**TODO:** Schedule first DR test within 30 days.

## Capacity Limits (current)

- Supabase free tier: 500MB DB, 1GB bandwidth/mo, 2GB storage
- Vercel free tier: 100GB bandwidth/mo, 10s function timeout
- **Trigger to upgrade:** approaching 70% of any limit

## Compliance Logs

NCR statutory requirements:
- Annual NCR return: due 30 June each year
- NCR Form 39: quarterly (March, June, September, December)
- These are tracked in the Statutory Reporting module

POPIA requirements:
- Information Officer registration: required, Thando Qamarana
- Data subject access requests: respond within 30 days
- Breach notification: within 72 hours of detection

FICA requirements:
- KYC records retention: 5 years from end of relationship
- Suspicious transaction reports: within 15 days of detection
- Sanctions screening: at onboarding + ongoing
