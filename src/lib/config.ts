/**
 * Centralized configuration loader.
 * Reads from Vite environment variables (VITE_ prefix exposed to client).
 *
 * SECURITY: Never put service-role keys, private API keys, or any
 * server-side secrets in VITE_ variables — they are bundled into the client.
 *
 * Fallback values are provided to keep dev environments working without .env,
 * but production deployments MUST set these explicitly via Vercel env vars.
 */

interface Config {
  supabase: {
    url: string;
    anonKey: string;
  };
  sentry: {
    dsn: string | null;
    environment: string;
  };
  analytics: {
    posthogKey: string | null;
    posthogHost: string;
  };
  app: {
    env: 'development' | 'staging' | 'production';
    version: string;
  };
}

const env = (key: string, fallback = ''): string => {
  const value = (import.meta as any).env?.[key];
  return value ?? fallback;
};

// Fallback Supabase values — these are PUBLIC anon keys, safe to ship
// They exist so dev environments work without configuration
const FALLBACK_SUPABASE_URL = 'https://yioqaluxgqxsifclydmd.supabase.co';
const FALLBACK_SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpb3FhbHV4Z3F4c2lmY2x5ZG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDQwMTQsImV4cCI6MjA5MDcyMDAxNH0.PwccS7acx7syNvsDTV_rp6zNttk1gxrF_ObnwolHFH8';

export const config: Config = {
  supabase: {
    url: env('VITE_SUPABASE_URL', FALLBACK_SUPABASE_URL),
    anonKey: env('VITE_SUPABASE_ANON_KEY', FALLBACK_SUPABASE_ANON),
  },
  sentry: {
    dsn: env('VITE_SENTRY_DSN') || null,
    environment: env('VITE_SENTRY_ENVIRONMENT', 'production'),
  },
  analytics: {
    posthogKey: env('VITE_POSTHOG_KEY') || null,
    posthogHost: env('VITE_POSTHOG_HOST', 'https://app.posthog.com'),
  },
  app: {
    env: (env('VITE_APP_ENV', 'production') as Config['app']['env']),
    version: env('VITE_APP_VERSION', '2.1.0'),
  },
};

export const isProduction = (): boolean => config.app.env === 'production';
export const isStaging = (): boolean => config.app.env === 'staging';
export const isDev = (): boolean => config.app.env === 'development';
