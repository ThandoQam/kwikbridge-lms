// KwikBridge LMS — Error Tracking & Monitoring
// Lightweight Sentry-compatible error boundary and reporter.
// Configure SENTRY_DSN in environment to enable live reporting.

const SENTRY_DSN = import.meta.env?.VITE_SENTRY_DSN || "";
const APP_VERSION = "2.0.0";
const ENVIRONMENT = import.meta.env?.MODE || "production";

// ═══ Error Reporter ═══

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  userRole?: string;
  extra?: Record<string, any>;
}

interface ErrorEvent {
  message: string;
  stack?: string;
  timestamp: string;
  environment: string;
  version: string;
  context: ErrorContext;
  url: string;
  userAgent: string;
}

const errorQueue: ErrorEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function createErrorEvent(error: Error | string, context: ErrorContext = {}): ErrorEvent {
  const err = typeof error === "string" ? new Error(error) : error;
  return {
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    environment: ENVIRONMENT,
    version: APP_VERSION,
    context,
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}

function flushErrors() {
  if (errorQueue.length === 0) return;
  if (!SENTRY_DSN) {
    // No DSN — log to console in dev
    errorQueue.forEach((e) => console.error("[Monitor]", e.message, e.context));
    errorQueue.length = 0;
    return;
  }

  const events = [...errorQueue];
  errorQueue.length = 0;

  // Send to Sentry via their envelope API
  const sentryUrl = SENTRY_DSN.replace(
    /^https:\/\/([^@]+)@([^/]+)\/(.+)$/,
    "https://$2/api/$3/envelope/"
  );
  const sentryKey = SENTRY_DSN.match(/https:\/\/([^@]+)@/)?.[1] || "";

  events.forEach((event) => {
    const envelope = [
      JSON.stringify({ dsn: SENTRY_DSN, sent_at: event.timestamp }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({
        event_id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        timestamp: event.timestamp,
        platform: "javascript",
        level: "error",
        environment: event.environment,
        release: `kwikbridge-lms@${event.version}`,
        message: { formatted: event.message },
        exception: event.stack
          ? {
              values: [
                {
                  type: "Error",
                  value: event.message,
                  stacktrace: { frames: parseStack(event.stack) },
                },
              ],
            }
          : undefined,
        tags: {
          component: event.context.component,
          action: event.context.action,
          userRole: event.context.userRole,
        },
        user: event.context.userId ? { id: event.context.userId } : undefined,
        request: { url: event.url, headers: { "User-Agent": event.userAgent } },
        extra: event.context.extra,
      }),
    ].join("\n");

    fetch(sentryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_key=${sentryKey}, sentry_version=7`,
      },
      body: envelope,
    }).catch(() => {});
  });
}

function parseStack(stack: string) {
  return stack
    .split("\n")
    .slice(1)
    .map((line) => {
      const match = line.match(/at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          filename: match[2],
          lineno: parseInt(match[3]),
          colno: parseInt(match[4]),
        };
      }
      return { function: line.trim(), filename: "unknown", lineno: 0, colno: 0 };
    })
    .reverse();
}

// ═══ Public API ═══

/**
 * Report an error to the monitoring system.
 * Batches errors and flushes every 5 seconds.
 */
export function captureError(error: Error | string, context: ErrorContext = {}) {
  errorQueue.push(createErrorEvent(error, context));

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushErrors();
      flushTimer = null;
    }, 5000);
  }
}

/**
 * Report a non-error event (breadcrumb) for debugging context.
 */
export function captureMessage(message: string, context: ErrorContext = {}) {
  if (ENVIRONMENT === "development") {
    console.log("[Monitor]", message, context);
  }
}

/**
 * Set user context for all subsequent error reports.
 */
let currentUserContext: Partial<ErrorContext> = {};

export function setUserContext(userId: string, userRole: string) {
  currentUserContext = { userId, userRole };
}

/**
 * Wrap a function with automatic error capture.
 */
export function withErrorCapture<T extends (...args: any[]) => any>(
  fn: T,
  context: ErrorContext = {}
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((err: Error) => {
          captureError(err, { ...currentUserContext, ...context });
          throw err;
        });
      }
      return result;
    } catch (err: any) {
      captureError(err, { ...currentUserContext, ...context });
      throw err;
    }
  }) as T;
}

// ═══ Global Error Handlers ═══

/**
 * Install global error handlers. Call once at app startup.
 */
export function installGlobalHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    captureError(event.error || event.message, {
      ...currentUserContext,
      component: "window",
      action: "uncaught",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    captureError(
      event.reason instanceof Error ? event.reason : String(event.reason),
      { ...currentUserContext, component: "promise", action: "unhandled" }
    );
  });
}

// ═══ Performance Monitoring ═══

interface PerfMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
}

const perfMetrics: PerfMetric[] = [];

/**
 * Record a performance metric.
 */
export function recordMetric(name: string, value: number, unit = "ms") {
  perfMetrics.push({
    name,
    value,
    unit,
    timestamp: new Date().toISOString(),
  });

  if (ENVIRONMENT === "development") {
    console.log(`[Perf] ${name}: ${value}${unit}`);
  }
}

/**
 * Measure the duration of an async operation.
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    recordMetric(name, Math.round(performance.now() - start));
    return result;
  } catch (err) {
    recordMetric(`${name}_error`, Math.round(performance.now() - start));
    throw err;
  }
}

/**
 * Collect Web Vitals if available.
 */
export function collectWebVitals() {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

  try {
    // LCP (Largest Contentful Paint)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as any;
      if (last) recordMetric("lcp", Math.round(last.startTime));
    }).observe({ type: "largest-contentful-paint", buffered: true });

    // FID (First Input Delay)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        recordMetric("fid", Math.round(entry.processingStart - entry.startTime));
      });
    }).observe({ type: "first-input", buffered: true });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) clsValue += entry.value;
      });
      recordMetric("cls", Math.round(clsValue * 1000) / 1000, "");
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    // Performance observer not supported
  }
}

// ═══ Health Check ═══

export function getHealthStatus() {
  return {
    version: APP_VERSION,
    environment: ENVIRONMENT,
    sentryConfigured: !!SENTRY_DSN,
    errorQueueSize: errorQueue.length,
    metricsCollected: perfMetrics.length,
    lastMetrics: perfMetrics.slice(-5),
    uptime: typeof performance !== "undefined" ? Math.round(performance.now() / 1000) : 0,
  };
}
