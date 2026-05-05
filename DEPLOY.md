# KwikBridge LMS — Deployment Guide

## Environments

| Environment | URL | Branch | Purpose |
|---|---|---|---|
| Production | kwikbridge-lms.vercel.app | `main` | Live system serving real customers |
| Staging | kwikbridge-staging.vercel.app | `staging` | Pre-prod testing with anonymized data |
| Preview | auto-generated | PR branches | Per-PR preview deployments |

## Initial Setup (One-Time)

### 1. Vercel Production Project
- Connect to GitHub repo, deploy from `main` branch
- Set environment variables in Vercel Dashboard → Settings → Environment Variables:
  - `VITE_SUPABASE_URL` (production)
  - `VITE_SUPABASE_ANON_KEY` (production)
  - `VITE_SENTRY_DSN` (production project)
  - `VITE_SENTRY_ENVIRONMENT=production`
  - `VITE_APP_ENV=production`
  - `VITE_APP_VERSION` (auto from package.json)

### 2. Vercel Staging Project (NEW — recommended)
- Create second Vercel project pointing at same GitHub repo
- Set production branch to `staging` (not main)
- Environment variables:
  - `VITE_SUPABASE_URL` (staging Supabase project)
  - `VITE_SUPABASE_ANON_KEY` (staging anon)
  - `VITE_SENTRY_ENVIRONMENT=staging`
  - `VITE_APP_ENV=staging`

### 3. Staging Supabase Project (NEW — recommended)
- Create separate Supabase project named `kwikbridge-staging`
- Run migrations: `supabase db push --linked`
- Seed with anonymized demo data (no real customer PII)
- Configure RLS identical to production

## Daily Workflow

```bash
# Develop on a feature branch
git checkout -b feat/my-feature
# ... commits ...
git push origin feat/my-feature
# → Opens preview deployment automatically

# When ready, merge to staging first
gh pr create --base staging
# → Deploys to staging.kwikbridge-lms.vercel.app

# Test on staging, then promote to production
git checkout main
git merge staging
git push origin main
# → Deploys to production
```

## Rollback Procedure

If a production deployment introduces a critical bug:

### Option 1: Vercel instant rollback (preferred)
```
Vercel Dashboard → Deployments → [previous good deployment] → Promote to Production
Time: ~30 seconds
```

### Option 2: Git revert
```bash
git revert <bad-commit-sha>
git push origin main
# Vercel auto-deploys the revert
Time: ~3 minutes
```

### Option 3: Force-deploy specific commit
```bash
git checkout <good-commit-sha>
git tag -f rollback-$(date +%Y%m%d-%H%M)
git push --force-with-lease
```

## Pre-Deployment Checklist

Before merging to `main`:
- [ ] All tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Integrity check passes (`npm run check`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] Lint warnings reviewed (`npm run lint`)
- [ ] Tested on staging environment
- [ ] CHANGELOG.md updated
- [ ] If schema changes: migration file in `supabase/migrations/`
- [ ] If env vars added: documented in `.env.example`

## Production Health Checks

Monitor these in real time:
- **Vercel Analytics:** Dashboard → Analytics (Core Web Vitals)
- **Supabase Dashboard:** Database → Logs (slow queries)
- **Sentry:** Issues view (error rate)
- **UptimeRobot:** External uptime monitoring

## Incident Response

1. Acknowledge alert (Sentry/UptimeRobot)
2. Determine impact (read Sentry breadcrumbs)
3. Decide: rollback or hotfix
4. If rollback: use Vercel instant rollback
5. If hotfix: branch from main, fix, test on staging, merge
6. Post-incident review within 48h: root cause + prevention
