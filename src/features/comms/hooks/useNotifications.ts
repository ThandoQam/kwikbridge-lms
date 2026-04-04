// @ts-nocheck
// KwikBridge LMS — Notification Hook
// Wraps sendNotification with data context integration.
// Creates comms record + audit entry alongside delivery attempt.

import { sendNotification, getTemplatePreview } from "../../lib/notifications";
import type { NotificationTemplate, NotificationChannel } from "../../lib/notifications";

/**
 * Send a notification and save the comms + audit records.
 *
 * @param template   - Template key (application_submitted, loan_disbursed, etc.)
 * @param channel    - "email", "sms", or "both"
 * @param variables  - Template variables (name, amount, appId, etc.)
 * @param context    - { to, toName, custId, appId?, loanId?, senderName, token? }
 * @param dataDeps   - { data, save, comms, audit, uid, addAudit }
 */
export async function triggerNotification(
  template: NotificationTemplate,
  channel: NotificationChannel,
  variables: Record<string, string | number>,
  context: {
    to: string;
    toName: string;
    custId: string;
    appId?: string;
    loanId?: string;
    senderName: string;
    token?: string;
  },
  dataDeps: {
    data: any;
    save: (d: any) => void;
    comms: any[];
    audit: any[];
    uid: () => string;
    addAudit: (...args: any[]) => any;
  }
) {
  const { data, save, comms, audit, uid, addAudit } = dataDeps;

  // 1. Send notification (attempts email/SMS delivery)
  const result = await sendNotification(
    {
      to: context.to,
      toName: context.toName,
      channel,
      template,
      variables,
      custId: context.custId,
      appId: context.appId,
      loanId: context.loanId,
    },
    context.senderName,
    context.token
  );

  // 2. Save comms record + audit entry
  const commsRecord = {
    id: uid(),
    ...result.commsRecord,
  };

  const auditEntry = addAudit(
    "Notification Sent",
    context.appId || context.loanId || context.custId,
    context.senderName,
    `${channel.toUpperCase()} to ${context.toName}: ${result.commsRecord?.subject || template}` +
    (result.emailSent ? " [email delivered]" : "") +
    (result.smsSent ? " [sms delivered]" : "") +
    (!result.success ? " [delivery pending]" : ""),
    "Communication"
  );

  save({
    ...data,
    comms: [...comms, commsRecord],
    audit: [...audit, auditEntry],
  });

  return result;
}

/**
 * Preview a notification template without sending.
 */
export function previewNotification(
  template: NotificationTemplate,
  variables: Record<string, string | number>
) {
  return getTemplatePreview(template, variables);
}

export type { NotificationTemplate, NotificationChannel };
