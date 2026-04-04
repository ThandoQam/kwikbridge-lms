// KwikBridge LMS — Send SMS Edge Function
// Delivers transactional SMS via Twilio API.
// Deploy: supabase functions deploy send-sms
//
// Environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
//   TWILIO_ACCOUNT_SID  — Twilio Account SID
//   TWILIO_AUTH_TOKEN    — Twilio Auth Token
//   TWILIO_FROM_NUMBER   — Twilio phone number (e.g. +27...)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER") || "";

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
      },
    });
  }

  try {
    const { to, body } = await req.json();

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Normalize SA phone number
    let phone = to.replace(/\s/g, "");
    if (phone.startsWith("0")) phone = "+27" + phone.slice(1);
    if (!phone.startsWith("+")) phone = "+" + phone;

    if (!TWILIO_SID || !TWILIO_TOKEN) {
      console.log(`[SMS] Would send to ${phone}: ${body.slice(0, 50)}...`);
      return new Response(
        JSON.stringify({ success: true, message: "SMS logged (no Twilio configured)" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Send via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);

    const formData = new URLSearchParams();
    formData.append("To", phone);
    formData.append("From", TWILIO_FROM);
    formData.append("Body", body);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("[SMS] Twilio error:", err);
      return new Response(
        JSON.stringify({ success: false, error: err.message || "SMS delivery failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log(`[SMS] Sent to ${phone}: ${result.sid}`);

    return new Response(
      JSON.stringify({ success: true, sid: result.sid }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SMS] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
