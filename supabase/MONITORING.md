# KwikBridge LMS — Monitoring & Observability (FI-7)

## Overview

Three-layer monitoring: error tracking (Sentry), performance (Web Vitals),
and uptime (health check endpoint). All components work without configuration
in development (console logging) and activate with credentials in production.

## Architecture

```
┌───────────────────────────────────────────────────┐
│                   Browser                          │
│                                                    │
│  ErrorBoundary ──→ captureError() ──→ Sentry API  │
│                                                    │
│  Web Vitals ─────→ recordMetric() ──→ Console/API │
│                                                    │
│  Global handlers → window.onerror                  │
│                    window.onunhandledrejection      │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│              Supabase Edge Function                │
│                                                    │
│  /functions/v1/health-check                        │
│  ├── Database ping (settings table)                │
│  ├── Auth service ping                             │
│  ├── Storage service ping                          │
│  └── Returns: healthy / degraded / unhealthy       │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│            External Monitor                        │
│  UptimeRobot / Better Uptime / Vercel Analytics    │
│  Polls health-check every 5 minutes                │
│  Alerts on 503 or timeout                          │
└───────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `src/lib/monitoring.ts` | Error capture, performance metrics, Web Vitals |
| `src/components/shared/ErrorBoundary.tsx` | React error boundary with recovery |
| `supabase/functions/health-check/index.ts` | Uptime health check endpoint |

## Setup

### 1. Sentry (Error Tracking)

Create a Sentry project and add the DSN to your environment:

```bash
# .env or Vercel environment variables
VITE_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789
```

Without the DSN, errors log to console (development mode).

### 2. Health Check

Deploy the Edge Function:

```bash
supabase functions deploy health-check
```

URL: `https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/health-check`

Response:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 3600,
  "timestamp": "2026-04-04T12:00:00.000Z",
  "checks": {
    "database": { "status": "healthy", "latency": 45 },
    "auth":     { "status": "healthy", "latency": 32 },
    "storage":  { "status": "healthy", "latency": 28 }
  }
}
```

### 3. External Uptime Monitor

Configure UptimeRobot or Better Uptime:
- URL: health-check endpoint
- Interval: 5 minutes
- Alert on: HTTP 503 or timeout > 10s
- Notify: ops@tqacapital.co.za

### 4. Vercel Analytics

Built-in — enable in Vercel Dashboard → Project → Analytics.
Tracks page views, Web Vitals, and deployment performance.

## Usage in Code

### App Startup
```typescript
import { installGlobalHandlers, collectWebVitals, setUserContext } from "./lib/monitoring";

// In App root:
installGlobalHandlers();  // catch unhandled errors
collectWebVitals();       // LCP, FID, CLS

// After auth:
setUserContext(currentUser.id, currentUser.role);
```

### Error Boundary (wraps zones)
```tsx
import { ErrorBoundary } from "./components/shared/ErrorBoundary";

<ErrorBoundary component="StaffLayout">
  <StaffLayout>{children}</StaffLayout>
</ErrorBoundary>
```

### Manual Error Capture
```typescript
import { captureError } from "./lib/monitoring";

try {
  await riskyOperation();
} catch (err) {
  captureError(err, { component: "Loans", action: "disburseLoan" });
}
```

### Async Measurement
```typescript
import { measureAsync } from "./lib/monitoring";

const data = await measureAsync("supabase_load", () => sbLoadAll());
// Logs: [Perf] supabase_load: 245ms
```

### Health Check
```typescript
import { getHealthStatus } from "./lib/monitoring";

console.log(getHealthStatus());
// { version, environment, sentryConfigured, errorQueueSize, metricsCollected, uptime }
```

## Graceful Degradation

| Scenario | Behaviour |
|----------|-----------|
| No Sentry DSN | Errors logged to console |
| Sentry API down | Errors queued, retried on next flush |
| No Web Vitals support | Silently skipped |
| Health check timeout | Returns 503 with partial results |
| No PerformanceObserver | Metrics collection disabled |
