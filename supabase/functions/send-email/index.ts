// KwikBridge LMS — Send Email Edge Function
// Delivers transactional emails via Resend API.
// Deploy: supabase functions deploy send-email
//
// Environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY  — API key from resend.com
//   FROM_EMAIL      — Sender address (e.g. noreply@tqacapital.co.za)
//   FROM_NAME       — Sender display name (e.g. TQA Capital)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@tqacapital.co.za";
const FROM_NAME = Deno.env.get("FROM_NAME") || "TQA Capital";

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
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      // Log but don't fail — allows testing without Resend configured
      console.log(`[EMAIL] Would send to ${to}: ${subject}`);
      return new Response(
        JSON.stringify({ success: true, message: "Email logged (no API key configured)" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Send via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        text: body,
        // HTML version with basic formatting
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px;">
          ${body.split("\n").map((line: string) =>
            line.trim() === "" ? "<br>" : `<p style="margin:0 0 8px;">${line}</p>`
          ).join("")}
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">
          <p style="font-size:11px;color:#999;">
            TQA Capital (Pty) Ltd | Registered Credit Provider NCRCP22396<br>
            East London, Nahoon Valley | www.tqacapital.co.za
          </p>
        </div>`,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("[EMAIL] Resend error:", err);
      return new Response(
        JSON.stringify({ success: false, error: err.message || "Email delivery failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log(`[EMAIL] Sent to ${to}: ${subject} (id: ${result.id})`);

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[EMAIL] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
