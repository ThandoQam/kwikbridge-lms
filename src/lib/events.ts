// KwikBridge LMS — Event Bus (ENH-05)
// Typed event system enabling decoupled, event-driven architecture.
// Matches Mambu's event-driven model.
//
// Events are:
//   1. Published synchronously (in-process) to registered handlers
//   2. Persisted to an events table for audit and replay
//   3. Optionally forwarded to webhook endpoints
//
// Design: append-only events, idempotent handlers, typed payloads

import type { AuditEntry, Alert } from "../types/index";

// ═══ Event Types ═══

export type EventType =
  | "LOAN_CREATED"
  | "LOAN_DISBURSED"
  | "LOAN_SETTLED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_MISSED"
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_APPROVED"
  | "APPLICATION_DECLINED"
  | "APPLICATION_WITHDRAWN"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_VERIFIED"
  | "DOCUMENT_REJECTED"
  | "STAGE_MIGRATED"
  | "PTP_CREATED"
  | "PTP_BROKEN"
  | "COLLECTION_ACTION"
  | "WRITE_OFF_PROPOSED"
  | "WRITE_OFF_APPROVED"
  | "EOD_COMPLETED"
  | "CUSTOMER_CREATED"
  | "CUSTOMER_UPDATED"
  | "FICA_VERIFIED"
  | "BEE_UPDATED";

export interface KBEvent {
  id: string;
  type: EventType;
  timestamp: number;
  entityId: string;
  entityType: "loan" | "application" | "customer" | "document" | "collection" | "system";
  triggeredBy: string;
  payload: Record<string, any>;
  delivered?: string[];          // handler IDs that processed this event
}

export type EventHandler = (event: KBEvent) => void;

interface HandlerRegistration {
  id: string;
  eventTypes: EventType[] | "*";
  handler: EventHandler;
  priority: number;              // lower = runs first
}

interface WebhookConfig {
  id: string;
  url: string;
  eventTypes: EventType[];
  secret: string;
  enabled: boolean;
}

// ═══ Event Bus Implementation ═══

class EventBus {
  private handlers: HandlerRegistration[] = [];
  private eventLog: KBEvent[] = [];
  private webhooks: WebhookConfig[] = [];
  private persistFn: ((event: KBEvent) => Promise<void>) | null = null;

  // Register a handler for specific event types
  subscribe(
    id: string,
    eventTypes: EventType[] | "*",
    handler: EventHandler,
    priority = 10
  ): () => void {
    this.handlers.push({ id, eventTypes, handler, priority });
    this.handlers.sort((a, b) => a.priority - b.priority);

    // Return unsubscribe function
    return () => {
      this.handlers = this.handlers.filter(h => h.id !== id);
    };
  }

  // Set persistence function (called for every event)
  setPersistFn(fn: (event: KBEvent) => Promise<void>) {
    this.persistFn = fn;
  }

  // Configure webhooks
  setWebhooks(configs: WebhookConfig[]) {
    this.webhooks = configs;
  }

  // Publish an event
  async publish(event: KBEvent): Promise<void> {
    // 1. Log locally
    this.eventLog.push(event);

    // 2. Run handlers synchronously
    const delivered: string[] = [];
    for (const reg of this.handlers) {
      if (reg.eventTypes === "*" || reg.eventTypes.includes(event.type)) {
        try {
          reg.handler(event);
          delivered.push(reg.id);
        } catch (err) {
          console.error(`[EventBus] Handler ${reg.id} failed for ${event.type}:`, err);
        }
      }
    }
    event.delivered = delivered;

    // 3. Persist (async, non-blocking)
    if (this.persistFn) {
      this.persistFn(event).catch(err =>
        console.error("[EventBus] Persist failed:", err)
      );
    }

    // 4. Webhooks (async, non-blocking)
    this.deliverWebhooks(event);
  }

  // Get event log (for debugging / testing)
  getLog(): KBEvent[] {
    return [...this.eventLog];
  }

  // Clear log (for testing)
  clearLog() {
    this.eventLog = [];
  }

  // Deliver to webhook endpoints
  private async deliverWebhooks(event: KBEvent) {
    const matching = this.webhooks.filter(
      w => w.enabled && w.eventTypes.includes(event.type)
    );

    for (const webhook of matching) {
      this.deliverWebhookWithRetry(webhook, event, 3).catch(() => {});
    }
  }

  private async deliverWebhookWithRetry(
    webhook: WebhookConfig,
    event: KBEvent,
    maxRetries: number,
    attempt = 1
  ): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        event: event.type,
        timestamp: new Date(event.timestamp).toISOString(),
        entityId: event.entityId,
        entityType: event.entityType,
        payload: event.payload,
      });

      // HMAC signature
      const signature = await computeHMAC(webhook.secret, payload);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-KwikBridge-Signature": signature,
          "X-KwikBridge-Event": event.type,
          "X-KwikBridge-Delivery": event.id,
        },
        body: payload,
      });

      if (response.ok) return true;

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
        return this.deliverWebhookWithRetry(webhook, event, maxRetries, attempt + 1);
      }

      console.error(`[Webhook] ${webhook.url} failed after ${maxRetries} attempts`);
      return false;
    } catch {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
        return this.deliverWebhookWithRetry(webhook, event, maxRetries, attempt + 1);
      }
      return false;
    }
  }
}

// ═══ HMAC Signature ═══

async function computeHMAC(secret: string, payload: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return "unsigned";
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "unsigned";
  }
}

// ═══ Singleton Instance ═══

export const eventBus = new EventBus();

// ═══ Event Factory Functions ═══

let _evtCounter = 0;

export function createEvent(
  type: EventType,
  entityId: string,
  entityType: KBEvent["entityType"],
  triggeredBy: string,
  payload: Record<string, any> = {}
): KBEvent {
  return {
    id: `EVT-${Date.now()}-${++_evtCounter}`,
    type,
    timestamp: Date.now(),
    entityId,
    entityType,
    triggeredBy,
    payload,
  };
}

// Convenience publishers
export const emit = {
  applicationSubmitted: (appId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("APPLICATION_SUBMITTED", appId, "application", by, payload)),

  applicationApproved: (appId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("APPLICATION_APPROVED", appId, "application", by, payload)),

  applicationDeclined: (appId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("APPLICATION_DECLINED", appId, "application", by, payload)),

  loanCreated: (loanId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("LOAN_CREATED", loanId, "loan", by, payload)),

  loanDisbursed: (loanId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("LOAN_DISBURSED", loanId, "loan", by, payload)),

  paymentReceived: (loanId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("PAYMENT_RECEIVED", loanId, "loan", by, payload)),

  paymentMissed: (loanId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("PAYMENT_MISSED", loanId, "loan", by, payload)),

  stageMigrated: (loanId: string, payload = {}) =>
    eventBus.publish(createEvent("STAGE_MIGRATED", loanId, "loan", "SYSTEM", payload)),

  documentUploaded: (docId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("DOCUMENT_UPLOADED", docId, "document", by, payload)),

  documentVerified: (docId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("DOCUMENT_VERIFIED", docId, "document", by, payload)),

  ptpCreated: (loanId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("PTP_CREATED", loanId, "loan", by, payload)),

  ptpBroken: (loanId: string, payload = {}) =>
    eventBus.publish(createEvent("PTP_BROKEN", loanId, "loan", "SYSTEM", payload)),

  eodCompleted: (payload = {}) =>
    eventBus.publish(createEvent("EOD_COMPLETED", "SYSTEM", "system", "SYSTEM", payload)),

  customerCreated: (custId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("CUSTOMER_CREATED", custId, "customer", by, payload)),

  ficaVerified: (custId: string, by: string, payload = {}) =>
    eventBus.publish(createEvent("FICA_VERIFIED", custId, "customer", by, payload)),
};

// ═══ Built-in Event Handlers ═══

// Notification mapping: event type → notification template + channel
export const EVENT_NOTIFICATION_MAP: Record<string, { template: string; channel: string }> = {
  APPLICATION_SUBMITTED: { template: "application_submitted", channel: "both" },
  APPLICATION_APPROVED: { template: "application_approved", channel: "both" },
  APPLICATION_DECLINED: { template: "application_declined", channel: "email" },
  LOAN_DISBURSED: { template: "loan_disbursed", channel: "both" },
  PAYMENT_RECEIVED: { template: "payment_received", channel: "email" },
  PAYMENT_MISSED: { template: "payment_missed", channel: "both" },
  PTP_CREATED: { template: "ptp_confirmed", channel: "both" },
  DOCUMENT_UPLOADED: { template: "document_requested", channel: "email" },
  DOCUMENT_VERIFIED: { template: "document_verified", channel: "email" },
};

// Audit handler: auto-creates audit entries from events
export function createAuditHandler(
  addAuditFn: (action: string, entity: string, user: string, details: string, category: string) => AuditEntry
): EventHandler {
  return (event: KBEvent) => {
    const actionMap: Record<string, { action: string; category: string }> = {
      APPLICATION_SUBMITTED: { action: "Application Submitted", category: "Origination" },
      APPLICATION_APPROVED: { action: "Application Approved", category: "Underwriting" },
      APPLICATION_DECLINED: { action: "Application Declined", category: "Underwriting" },
      LOAN_CREATED: { action: "Loan Booked", category: "Loans" },
      LOAN_DISBURSED: { action: "Loan Disbursed", category: "Loans" },
      LOAN_SETTLED: { action: "Loan Settled", category: "Loans" },
      PAYMENT_RECEIVED: { action: "Payment Received", category: "Servicing" },
      PAYMENT_MISSED: { action: "Payment Missed", category: "Collections" },
      STAGE_MIGRATED: { action: "Stage Migration", category: "Risk" },
      PTP_CREATED: { action: "PTP Created", category: "Collections" },
      PTP_BROKEN: { action: "PTP Broken", category: "Collections" },
      DOCUMENT_UPLOADED: { action: "Document Uploaded", category: "Documents" },
      DOCUMENT_VERIFIED: { action: "Document Verified", category: "Documents" },
      CUSTOMER_CREATED: { action: "Customer Created", category: "Customers" },
      FICA_VERIFIED: { action: "FICA Verified", category: "Compliance" },
      EOD_COMPLETED: { action: "EOD Batch Completed", category: "System" },
    };

    const mapping = actionMap[event.type];
    if (mapping) {
      addAuditFn(
        mapping.action,
        event.entityId,
        event.triggeredBy,
        JSON.stringify(event.payload).slice(0, 500),
        mapping.category
      );
    }
  };
}
