// KwikBridge LMS — Notification Service
// Handles email and SMS delivery via Supabase Edge Functions.
// Falls back to comms record creation if delivery fails.

import { SUPABASE_URL, SUPABASE_KEY } from "./supabase";

// ═══ Notification Types ═══

export type NotificationChannel = "email" | "sms" | "both";

export interface NotificationRequest {
  to: string;               // email address or phone number
  toName: string;            // recipient display name
  channel: NotificationChannel;
  template: NotificationTemplate;
  variables: Record<string, string | number>;
  custId?: string;
  appId?: string;
  loanId?: string;
}

export interface NotificationResult {
  success: boolean;
  emailSent?: boolean;
  smsSent?: boolean;
  error?: string;
  commsRecord?: any;
}

// ═══ Templates ═══

export type NotificationTemplate =
  | "application_submitted"
  | "application_qa_passed"
  | "application_qa_failed"
  | "application_approved"
  | "application_declined"
  | "loan_booked"
  | "loan_disbursed"
  | "payment_received"
  | "payment_due_reminder"
  | "payment_missed"
  | "ptp_reminder"
  | "ptp_confirmed"
  | "document_requested"
  | "document_verified"
  | "collection_notice"
  | "restructure_approved"
  | "welcome_borrower";

interface TemplateContent {
  subject: string;
  emailBody: string;
  smsBody: string;
}

function resolveTemplate(
  template: NotificationTemplate,
  vars: Record<string, string | number>
): TemplateContent {
  const v = (key: string) => String(vars[key] || "");
  const templates: Record<NotificationTemplate, TemplateContent> = {

    application_submitted: {
      subject: `Application ${v("appId")} Received`,
      emailBody: `Dear ${v("name")},\n\nThank you for submitting your financing application (${v("appId")}) for ${v("amount")}.\n\nYour application is now being reviewed by our team. You can track progress at any time via the KwikBridge Borrower Portal.\n\nApplication Reference: ${v("appId")}\nProduct: ${v("product")}\nAmount: ${v("amount")}\n\nWe aim to process applications within 5 business days.\n\nKind regards,\nTQA Capital (Pty) Ltd\nNCRCP22396`,
      smsBody: `TQA Capital: Application ${v("appId")} received for ${v("amount")}. Track at portal.kwikbridge.co.za. Ref: ${v("appId")}`,
    },

    application_qa_passed: {
      subject: `Application ${v("appId")} — QA Approved`,
      emailBody: `Dear ${v("name")},\n\nYour application ${v("appId")} has passed our quality assurance review and has been submitted for credit assessment.\n\nYou will be notified of the outcome once the assessment is complete.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Application ${v("appId")} passed QA review. Now under credit assessment. Ref: ${v("appId")}`,
    },

    application_qa_failed: {
      subject: `Application ${v("appId")} — Additional Information Required`,
      emailBody: `Dear ${v("name")},\n\nYour application ${v("appId")} requires additional information before it can proceed:\n\n${v("issues")}\n\nPlease log into the Borrower Portal to upload the required documents.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Application ${v("appId")} needs additional documents. Please check the Borrower Portal. Ref: ${v("appId")}`,
    },

    application_approved: {
      subject: `Congratulations — Application ${v("appId")} Approved`,
      emailBody: `Dear ${v("name")},\n\nWe are pleased to inform you that your financing application has been approved.\n\nApplication: ${v("appId")}\nApproved Amount: ${v("amount")}\nTerm: ${v("term")} months\nInterest Rate: ${v("rate")}% p.a.\n\nYour loan agreement will be sent for electronic signature shortly.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Your application ${v("appId")} is APPROVED for ${v("amount")}. Check your email for next steps. Ref: ${v("appId")}`,
    },

    application_declined: {
      subject: `Application ${v("appId")} — Decision Notification`,
      emailBody: `Dear ${v("name")},\n\nAfter careful review, we regret to inform you that your application ${v("appId")} has not been approved at this time.\n\nReason: ${v("reason")}\n\nYou may reapply after addressing the above. For questions, contact us at support@tqacapital.co.za.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Application ${v("appId")} update available. Please check your email for details. Ref: ${v("appId")}`,
    },

    loan_booked: {
      subject: `Loan ${v("loanId")} — Agreement Ready`,
      emailBody: `Dear ${v("name")},\n\nYour loan ${v("loanId")} has been booked. The loan agreement is now available for electronic signature in the Borrower Portal.\n\nLoan Amount: ${v("amount")}\nMonthly Payment: ${v("monthlyPmt")}\nFirst Payment Due: ${v("firstDue")}\n\nPlease sign at your earliest convenience to proceed to disbursement.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Loan ${v("loanId")} booked. Sign agreement in Borrower Portal to receive funds. Ref: ${v("loanId")}`,
    },

    loan_disbursed: {
      subject: `Loan ${v("loanId")} — Funds Disbursed`,
      emailBody: `Dear ${v("name")},\n\nFunds of ${v("amount")} have been disbursed to your verified bank account for loan ${v("loanId")}.\n\nYour first repayment of ${v("monthlyPmt")} is due on ${v("firstDue")}.\n\nYou can view your repayment schedule in the Borrower Portal.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: ${v("amount")} disbursed for loan ${v("loanId")}. First payment ${v("monthlyPmt")} due ${v("firstDue")}. Ref: ${v("loanId")}`,
    },

    payment_received: {
      subject: `Payment Received — Loan ${v("loanId")}`,
      emailBody: `Dear ${v("name")},\n\nWe confirm receipt of your payment of ${v("amount")} for loan ${v("loanId")}.\n\nPrincipal: ${v("principal")}\nInterest: ${v("interest")}\nOutstanding Balance: ${v("balance")}\n\nThank you for your payment.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Payment of ${v("amount")} received for loan ${v("loanId")}. Balance: ${v("balance")}. Thank you.`,
    },

    payment_due_reminder: {
      subject: `Payment Reminder — Loan ${v("loanId")}`,
      emailBody: `Dear ${v("name")},\n\nThis is a friendly reminder that your payment of ${v("amount")} for loan ${v("loanId")} is due on ${v("dueDate")}.\n\nPlease ensure funds are available for the scheduled debit order.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Payment of ${v("amount")} due ${v("dueDate")} for loan ${v("loanId")}. Please ensure funds are available.`,
    },

    payment_missed: {
      subject: `Missed Payment — Loan ${v("loanId")}`,
      emailBody: `Dear ${v("name")},\n\nWe notice that the payment of ${v("amount")} for loan ${v("loanId")} due on ${v("dueDate")} has not been received.\n\nPlease make payment as soon as possible to avoid arrears. If you are experiencing financial difficulty, contact us to discuss options.\n\nTelephone: 043 XXX XXXX\nEmail: collections@tqacapital.co.za\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Payment of ${v("amount")} for loan ${v("loanId")} is overdue. Contact us on 043 XXX XXXX to arrange payment.`,
    },

    ptp_reminder: {
      subject: `Promise to Pay Reminder — Loan ${v("loanId")}`,
      emailBody: `Dear ${v("name")},\n\nThis is a reminder of your promise to pay ${v("amount")} for loan ${v("loanId")} on ${v("ptpDate")}.\n\nPlease ensure the payment is made as agreed.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Reminder – PTP of ${v("amount")} for loan ${v("loanId")} due ${v("ptpDate")}. Please ensure payment.`,
    },

    ptp_confirmed: {
      subject: `Promise to Pay Confirmed — Loan ${v("loanId")}`,
      emailBody: `Dear ${v("name")},\n\nWe confirm your promise to pay ${v("amount")} for loan ${v("loanId")} on ${v("ptpDate")}.\n\nPlease ensure funds are available on the agreed date.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: PTP confirmed – ${v("amount")} for loan ${v("loanId")} on ${v("ptpDate")}. Ref: ${v("loanId")}`,
    },

    document_requested: {
      subject: `Document Required — ${v("docType")}`,
      emailBody: `Dear ${v("name")},\n\nWe require the following document for your application ${v("appId")}:\n\n${v("docType")}\n\nPlease upload this via the Borrower Portal at your earliest convenience.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: ${v("docType")} required for application ${v("appId")}. Upload via Borrower Portal.`,
    },

    document_verified: {
      subject: `Document Verified — ${v("docType")}`,
      emailBody: `Dear ${v("name")},\n\nYour ${v("docType")} has been verified for application ${v("appId")}.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: ${v("docType")} verified for application ${v("appId")}.`,
    },

    collection_notice: {
      subject: `Collections Notice — Loan ${v("loanId")}`,
      emailBody: `Dear ${v("name")},\n\nYour loan ${v("loanId")} is ${v("dpd")} days past due with an outstanding balance of ${v("balance")}.\n\nPlease contact our collections department to discuss payment arrangements:\n\nTelephone: 043 XXX XXXX\nEmail: collections@tqacapital.co.za\n\nFailure to respond may result in further action in accordance with the National Credit Act.\n\nKind regards,\nTQA Capital\nNCRCP22396`,
      smsBody: `TQA Capital: Loan ${v("loanId")} is ${v("dpd")} days overdue. Balance: ${v("balance")}. Contact 043 XXX XXXX urgently.`,
    },

    restructure_approved: {
      subject: `Debt Restructure Approved — Loan ${v("loanId")}`,
      emailBody: `Dear ${v("name")},\n\nYour request for debt restructuring on loan ${v("loanId")} has been approved.\n\nNew Terms:\n${v("newTerms")}\n\nPlease sign the amended agreement in the Borrower Portal.\n\nKind regards,\nTQA Capital`,
      smsBody: `TQA Capital: Restructure approved for loan ${v("loanId")}. Check email for new terms. Ref: ${v("loanId")}`,
    },

    welcome_borrower: {
      subject: "Welcome to KwikBridge — TQA Capital",
      emailBody: `Dear ${v("name")},\n\nWelcome to the KwikBridge Borrower Portal.\n\nYour account has been created and you can now:\n• Track your applications\n• View your loan details\n• Upload required documents\n• Make payments\n\nLog in at: portal.kwikbridge.co.za\n\nKind regards,\nTQA Capital (Pty) Ltd\nRegistered Credit Provider NCRCP22396`,
      smsBody: `TQA Capital: Welcome to KwikBridge. Your Borrower Portal is ready at portal.kwikbridge.co.za.`,
    },
  };

  return templates[template] || {
    subject: `KwikBridge Notification`,
    emailBody: `Dear ${v("name")},\n\n${v("message")}\n\nKind regards,\nTQA Capital`,
    smsBody: `TQA Capital: ${v("message")}`,
  };
}

// ═══ Delivery via Supabase Edge Function ═══

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`;

async function deliverEmail(
  to: string,
  subject: string,
  body: string,
  token?: string
): Promise<boolean> {
  try {
    const response = await fetch(`${EDGE_FUNCTION_URL}/send-email`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token || SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, subject, body }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function deliverSms(
  to: string,
  body: string,
  token?: string
): Promise<boolean> {
  try {
    const response = await fetch(`${EDGE_FUNCTION_URL}/send-sms`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token || SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, body }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ═══ Main Send Function ═══

/**
 * Send a notification via email, SMS, or both.
 * Always creates a comms record regardless of delivery success.
 *
 * @returns NotificationResult with delivery status and comms record
 */
export async function sendNotification(
  request: NotificationRequest,
  senderName: string,
  token?: string
): Promise<NotificationResult> {
  const content = resolveTemplate(request.template, request.variables);

  let emailSent = false;
  let smsSent = false;

  // Attempt email delivery
  if (request.channel === "email" || request.channel === "both") {
    emailSent = await deliverEmail(request.to, content.subject, content.emailBody, token);
  }

  // Attempt SMS delivery
  if (request.channel === "sms" || request.channel === "both") {
    const phone = request.variables.phone as string;
    if (phone) {
      smsSent = await deliverSms(phone, content.smsBody, token);
    }
  }

  // Build comms record (always created, even if delivery fails)
  const commsRecord = {
    custId: request.custId || "",
    type: request.channel === "sms" ? "SMS" as const : "Email" as const,
    direction: "Outbound" as const,
    subject: content.subject,
    body: request.channel === "sms" ? content.smsBody : content.emailBody,
    sentBy: senderName,
    sentAt: Date.now(),
    // Extended fields for tracking
    template: request.template,
    emailDelivered: emailSent,
    smsDelivered: smsSent,
    recipientEmail: request.to,
    recipientPhone: request.variables.phone || "",
    appId: request.appId,
    loanId: request.loanId,
  };

  return {
    success: emailSent || smsSent,
    emailSent,
    smsSent,
    commsRecord,
  };
}

// ═══ Convenience Functions ═══

export function getTemplatePreview(
  template: NotificationTemplate,
  variables: Record<string, string | number>
): { subject: string; emailBody: string; smsBody: string } {
  return resolveTemplate(template, variables);
}

export const NOTIFICATION_TEMPLATES = [
  { key: "application_submitted", label: "Application Submitted", channel: "both" },
  { key: "application_qa_passed", label: "QA Approved", channel: "email" },
  { key: "application_qa_failed", label: "QA Failed — Docs Required", channel: "both" },
  { key: "application_approved", label: "Application Approved", channel: "both" },
  { key: "application_declined", label: "Application Declined", channel: "email" },
  { key: "loan_booked", label: "Loan Booked", channel: "both" },
  { key: "loan_disbursed", label: "Funds Disbursed", channel: "both" },
  { key: "payment_received", label: "Payment Received", channel: "email" },
  { key: "payment_due_reminder", label: "Payment Due (3 days)", channel: "sms" },
  { key: "payment_missed", label: "Payment Missed", channel: "both" },
  { key: "ptp_reminder", label: "PTP Reminder (1 day)", channel: "sms" },
  { key: "ptp_confirmed", label: "PTP Confirmed", channel: "both" },
  { key: "document_requested", label: "Document Requested", channel: "email" },
  { key: "document_verified", label: "Document Verified", channel: "email" },
  { key: "collection_notice", label: "Collections Notice", channel: "both" },
  { key: "restructure_approved", label: "Restructure Approved", channel: "both" },
  { key: "welcome_borrower", label: "Welcome Borrower", channel: "email" },
] as const;
