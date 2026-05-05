/**
 * KwikBridge LMS — Webhooks Edge Function
 *
 * Outbound webhooks for funder integration (TD-16).
 *
 * Design:
 *   1. Events emit to webhook_events table (durable queue)
 *   2. This function processes pending events with retry + backoff
 *   3. HMAC-signed payloads for funder verification
 *   4. Failed deliveries retry with exponential backoff (5min, 25min, 2h, 12h)
 *   5. Dead-letter after 4 failed attempts
 *
 * Deploy: supabase functions deploy webhooks
 * Schedule: pg_cron every minute
 *
 * Webhook subscription model:
 *   webhook_subscriptions table: { id, funder_id, url, secret, event_types, active }
 *   webhook_events table: { id, subscription_id, event_type, payload, status, attempts, next_retry_at }
 *
 * Event types:
 *   loan.disbursed, loan.repaid, loan.in_arrears, loan.written_off,
 *   application.submitted, application.approved, application.declined,
 *   covenant.breach, eod.completed
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface WebhookSubscription {
  id: string;
  funder_id: string;
  url: string;
  secret: string;
  event_types: string[];
  active: boolean;
}

interface WebhookEvent {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed" | "dead_letter";
  attempts: number;
  next_retry_at: number;
  last_error?: string;
}

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const sb = (table: string) => `${SUPABASE_URL}/rest/v1/${table}`;

// Backoff schedule (milliseconds)
const BACKOFF_SCHEDULE = [
  5 * 60_000,       // 5 minutes
  25 * 60_000,      // 25 minutes
  2 * 60 * 60_000,  // 2 hours
  12 * 60 * 60_000, // 12 hours
];

const MAX_ATTEMPTS = 4;

async function hmacSign(secret: string, payload: string): Promise<string> {
  // HMAC-SHA256 of payload with secret as key (industry standard)
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deliverWebhook(
  event: WebhookEvent,
  subscription: WebhookSubscription
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payload = JSON.stringify({
    id: event.id,
    type: event.event_type,
    timestamp: new Date().toISOString(),
    data: event.payload,
  });

  const signature = await hmacSign(subscription.secret, payload);

  try {
    const r = await fetch(subscription.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-KwikBridge-Signature": `sha256=${signature}`,
        "X-KwikBridge-Event": event.event_type,
        "X-KwikBridge-Delivery-Id": event.id,
        "User-Agent": "KwikBridge-Webhooks/1.0",
      },
      body: payload,
      // 10 second timeout via AbortController
      signal: AbortSignal.timeout(10_000),
    });

    if (r.status >= 200 && r.status < 300) {
      return { success: true, statusCode: r.status };
    }
    return {
      success: false,
      statusCode: r.status,
      error: `Subscriber returned HTTP ${r.status}`,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || String(e),
    };
  }
}

async function processEvents(): Promise<{ processed: number; delivered: number; failed: number }> {
  const now = Date.now();

  // Fetch pending events with subscription details
  const r = await fetch(
    `${sb("webhook_events")}?status=eq.pending&next_retry_at=lte.${now}&limit=50`,
    { headers }
  );
  if (!r.ok) {
    console.error("[webhooks] Failed to fetch events:", await r.text());
    return { processed: 0, delivered: 0, failed: 0 };
  }
  const events: WebhookEvent[] = await r.json();

  let delivered = 0;
  let failed = 0;

  for (const event of events) {
    // Fetch subscription
    const subRes = await fetch(
      `${sb("webhook_subscriptions")}?id=eq.${event.subscription_id}&active=eq.true&limit=1`,
      { headers }
    );
    const subs: WebhookSubscription[] = subRes.ok ? await subRes.json() : [];
    const subscription = subs[0];

    if (!subscription) {
      // Subscription removed — mark event as failed
      await fetch(`${sb("webhook_events")}?id=eq.${event.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: "failed",
          last_error: "Subscription not found or inactive",
        }),
      });
      failed += 1;
      continue;
    }

    const result = await deliverWebhook(event, subscription);

    if (result.success) {
      await fetch(`${sb("webhook_events")}?id=eq.${event.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: "delivered",
          attempts: event.attempts + 1,
          delivered_at: new Date().toISOString(),
        }),
      });
      delivered += 1;
    } else {
      const newAttempts = event.attempts + 1;
      const isDead = newAttempts >= MAX_ATTEMPTS;
      const backoff = BACKOFF_SCHEDULE[Math.min(newAttempts - 1, BACKOFF_SCHEDULE.length - 1)];

      await fetch(`${sb("webhook_events")}?id=eq.${event.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: isDead ? "dead_letter" : "pending",
          attempts: newAttempts,
          next_retry_at: isDead ? null : Date.now() + backoff,
          last_error: result.error || `HTTP ${result.statusCode}`,
        }),
      });
      failed += 1;
    }
  }

  return { processed: events.length, delivered, failed };
}

serve(async (req: Request) => {
  // Webhook function can be triggered by:
  //  - pg_cron (every minute)
  //  - Manual admin call
  //  - Inbound webhook receipt (signature verification)

  if (req.method === "GET") {
    // Health check
    return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);

  if (url.pathname.endsWith("/process")) {
    // Triggered by cron — process pending webhook events
    try {
      const result = await processEvents();
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("[webhooks] Process failed:", e);
      return new Response(JSON.stringify({ error: e?.message || String(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({
      service: "KwikBridge Webhooks",
      endpoints: {
        "GET /": "Health check",
        "POST /process": "Process pending webhook events (cron)",
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
