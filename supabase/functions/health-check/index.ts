// KwikBridge LMS — Health Check Edge Function
// Returns system health status for uptime monitoring.
// Deploy: supabase functions deploy health-check
//
// Used by external monitors (UptimeRobot, Better Uptime, etc.)
// URL: https://yioqaluxgqxsifclydmd.supabase.co/functions/v1/health-check

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const START_TIME = Date.now();

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey",
      },
    });
  }

  const checks: Record<string, { status: string; latency?: number }> = {};

  // 1. Database connectivity
  try {
    const start = performance.now();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.1&select=id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    checks.database = {
      status: r.ok ? "healthy" : "degraded",
      latency: Math.round(performance.now() - start),
    };
  } catch {
    checks.database = { status: "down" };
  }

  // 2. Auth service
  try {
    const start = performance.now();
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_KEY },
    });
    checks.auth = {
      status: r.ok ? "healthy" : "degraded",
      latency: Math.round(performance.now() - start),
    };
  } catch {
    checks.auth = { status: "down" };
  }

  // 3. Storage service
  try {
    const start = performance.now();
    const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    checks.storage = {
      status: r.ok ? "healthy" : "degraded",
      latency: Math.round(performance.now() - start),
    };
  } catch {
    checks.storage = { status: "down" };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");
  const anyDown = Object.values(checks).some((c) => c.status === "down");

  const health = {
    status: anyDown ? "unhealthy" : allHealthy ? "healthy" : "degraded",
    version: "2.0.0",
    uptime: Math.round((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  };

  return new Response(JSON.stringify(health, null, 2), {
    status: anyDown ? 503 : 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
