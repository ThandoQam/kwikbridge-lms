/**
 * Production observability — structured logging, error reporting, metrics.
 *
 * Adapter pattern: replace console.* across the app with these functions.
 * In production: routes to Sentry (errors) and PostHog (events).
 * In dev: logs to console with structured format.
 *
 * Designed to be drop-in replacement for console.log/error/warn.
 */

import { config, isProduction } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

// Lazy-load Sentry only if DSN configured (saves ~80KB on bundle)
let sentryInitialized = false;
let sentryRef: any = null;

const initSentry = async (): Promise<void> => {
  if (sentryInitialized || !config.sentry.dsn) return;

  try {
    // Dynamic import — only loads if Sentry DSN configured
    // @ts-ignore — optional dependency, may not be installed
    const Sentry = await import(/* @vite-ignore */ '@sentry/react' as any).catch(() => null);
    if (!Sentry) return;

    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.sentry.environment,
      release: config.app.version,
      tracesSampleRate: isProduction() ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.0, // No session replay (PII risk)
      replaysOnErrorSampleRate: 0.1,
      beforeSend: (event: any) => {
        // PII scrubbing — strip ID numbers, phone numbers from events
        if (event.request?.data) {
          event.request.data = scrubPII(event.request.data);
        }
        if (event.extra) {
          event.extra = scrubPII(event.extra);
        }
        return event;
      },
    });

    sentryRef = Sentry;
    sentryInitialized = true;
  } catch (e) {
    // Sentry init failed — fall back to console
    console.warn('[Observability] Sentry init failed:', e);
  }
};

// PII scrubber — removes SA ID numbers, phone numbers, emails from log payloads
const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b\d{13}\b/g, '[ID_REDACTED]'], // SA 13-digit ID
  [/\b0\d{9}\b/g, '[PHONE_REDACTED]'], // SA phone numbers
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]'],
];

const scrubPII = (obj: unknown): unknown => {
  if (typeof obj === 'string') {
    let result = obj;
    for (const [pattern, replacement] of PII_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }
  if (Array.isArray(obj)) {
    return obj.map(scrubPII);
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // Skip known PII fields entirely
      if (['idNum', 'id_num', 'password', 'token', 'access_token'].includes(k)) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = scrubPII(v);
      }
    }
    return result;
  }
  return obj;
};

// Structured log formatter
const fmt = (level: LogLevel, message: string, context?: LogContext): string => {
  const ts = new Date().toISOString();
  const ctx = context ? ` ${JSON.stringify(scrubPII(context))}` : '';
  return `[${ts}] [${level.toUpperCase()}] ${message}${ctx}`;
};

export const log = {
  debug(message: string, context?: LogContext): void {
    if (isProduction()) return; // No debug logs in prod
    console.log(fmt('debug', message, context));
  },

  info(message: string, context?: LogContext): void {
    console.log(fmt('info', message, context));
    if (sentryRef) {
      sentryRef.addBreadcrumb({
        category: 'app',
        message,
        level: 'info',
        data: context ? (scrubPII(context) as any) : undefined,
      });
    }
  },

  warn(message: string, context?: LogContext): void {
    console.warn(fmt('warn', message, context));
    if (sentryRef) {
      sentryRef.captureMessage(message, {
        level: 'warning',
        extra: context as any,
      });
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    console.error(fmt('error', message, context), error);
    if (sentryRef) {
      if (error instanceof Error) {
        sentryRef.captureException(error, { extra: { message, ...context } as any });
      } else {
        sentryRef.captureMessage(message, {
          level: 'error',
          extra: { error: String(error), ...context } as any,
        });
      }
    }
  },
};

// Event tracking (PostHog) — for product analytics, NOT for errors
export const track = (event: string, properties?: LogContext): void => {
  if (!isProduction()) return;
  const ph = (window as any).posthog;
  if (ph) {
    ph.capture(event, properties);
  }
};

// User identification (call after login) — properties are scrubbed
export const identify = (userId: string, traits?: LogContext): void => {
  if (sentryRef) {
    sentryRef.setUser({ id: userId });
  }
  const ph = (window as any).posthog;
  if (ph && isProduction()) {
    ph.identify(userId, scrubPII(traits || {}) as any);
  }
};

// Clear identity on logout
export const clearIdentity = (): void => {
  if (sentryRef) {
    sentryRef.setUser(null);
  }
  const ph = (window as any).posthog;
  if (ph) {
    ph.reset();
  }
};

// Health check timer — measure operation latency
export const timing = async <T>(
  name: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    log.info(`Operation completed: ${name}`, { ...context, duration_ms: duration });
    track(`operation.${name}`, { ...context, duration_ms: duration, success: true });
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    log.error(`Operation failed: ${name}`, error, { ...context, duration_ms: duration });
    track(`operation.${name}`, { ...context, duration_ms: duration, success: false });
    throw error;
  }
};

// Initialize observability stack — call once at app startup
export const initObservability = async (): Promise<void> => {
  await initSentry();
  log.info('Observability initialized', {
    sentry: sentryInitialized,
    environment: config.app.env,
    version: config.app.version,
  });
};
