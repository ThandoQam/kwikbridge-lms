# KwikBridge LMS — Notification System (FI-5)

## Overview

Transactional email and SMS notifications triggered at key points in the
loan lifecycle. Notifications are delivered via Supabase Edge Functions
(Resend for email, Twilio for SMS) with fallback to comms record logging.

## Architecture

```
Trigger Point (e.g. decideLoan)
  ↓
triggerNotification(template, channel, variables, context)
  ↓
resolveTemplate() → subject, emailBody, smsBody
  ↓
  ├── deliverEmail() → Edge Function → Resend API → recipient inbox
  ├── deliverSms()   → Edge Function → Twilio API → recipient phone
  ↓
save({comms: [..., record], audit: [..., entry]})
  ↓
Database: comms table (with delivery status tracking)
```

## Files

| File | Purpose |
|------|---------|
| `src/lib/notifications.ts` | Notification service — 17 templates, delivery, preview |
| `src/features/comms/hooks/useNotifications.ts` | Hook for feature integration |
| `supabase/functions/send-email/index.ts` | Edge Function — Resend email delivery |
| `supabase/functions/send-sms/index.ts` | Edge Function — Twilio SMS delivery |

## 17 Notification Templates

| Template | Trigger | Channel | NCA Required |
|----------|---------|---------|-------------|
| `application_submitted` | Public form / staff app creation | Email + SMS | — |
| `application_qa_passed` | QA sign-off success | Email | — |
| `application_qa_failed` | QA sign-off failure | Email + SMS | — |
| `application_approved` | Credit decision: approve | Email + SMS | ✓ Pre-agreement |
| `application_declined` | Credit decision: decline | Email | ✓ Adverse action |
| `loan_booked` | Loan booking | Email + SMS | — |
| `loan_disbursed` | Fund disbursement | Email + SMS | ✓ Confirmation |
| `payment_received` | Payment recorded | Email | — |
| `payment_due_reminder` | 3 days before due date | SMS | — |
| `payment_missed` | 1 day after due date | Email + SMS | ✓ NCA s129 |
| `ptp_reminder` | 1 day before PTP date | SMS | — |
| `ptp_confirmed` | PTP created | Email + SMS | — |
| `document_requested` | Staff requests document | Email | — |
| `document_verified` | Staff verifies document | Email | — |
| `collection_notice` | Collection action | Email + SMS | ✓ NCA s129/s130 |
| `restructure_approved` | Restructuring approved | Email + SMS | — |
| `welcome_borrower` | Portal registration | Email | — |

## Deployment

### 1. Set Edge Function Secrets

In Supabase Dashboard → Edge Functions → Secrets:

```
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=noreply@tqacapital.co.za
FROM_NAME=TQA Capital
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+27xxxxxxxxx
```

### 2. Deploy Edge Functions

```bash
supabase functions deploy send-email
supabase functions deploy send-sms
```

### 3. Test

Without API keys configured, the Edge Functions log messages instead of sending.
This enables development and testing without live credentials.

## Usage in Features

### Automatic (in handler hooks)

```typescript
import { triggerNotification } from "../comms/hooks/useNotifications";

// Inside decideLoan handler:
if (decision === "Approved") {
  await triggerNotification(
    "application_approved", "both",
    { name: customer.name, appId: app.id, amount: fmt.cur(app.amount),
      term: app.term, rate: app.rate },
    { to: customer.email, toName: customer.name, custId: customer.id,
      appId: app.id, senderName: currentUser.name, token },
    { data, save, comms, audit, uid, addAudit }
  );
}
```

### Manual (staff sends from UI)

```typescript
import { triggerNotification } from "../comms/hooks/useNotifications";

// From sendNotification button in detail view:
await triggerNotification(
  "document_requested", "email",
  { name: customer.name, docType: "Tax Clearance", appId: app.id },
  { to: customer.email, toName: customer.name, custId: customer.id,
    appId: app.id, senderName: currentUser.name },
  { data, save, comms, audit, uid, addAudit }
);
```

### Preview (before sending)

```typescript
import { previewNotification } from "../comms/hooks/useNotifications";

const preview = previewNotification("application_approved", {
  name: "John Doe", appId: "APP-001", amount: "R500,000",
  term: 12, rate: 14.5
});
// preview.subject, preview.emailBody, preview.smsBody
```

## Graceful Degradation

The notification system is designed to degrade gracefully:

1. **No API keys**: Edge Functions log messages, return success
2. **Edge Function down**: `deliverEmail`/`deliverSms` catch errors, return false
3. **Delivery fails**: Comms record still created with `emailDelivered: false`
4. **No Edge Functions deployed**: `sendNotification` returns `success: false`
5. **All fails**: The comms record is always saved — manual follow-up possible

## NCA Compliance Notes

Certain notifications are required by the National Credit Act:
- **Pre-agreement disclosure** (s92): application_approved template
- **Adverse action notice** (s62): application_declined template
- **Section 129 notice**: payment_missed and collection_notice templates
- **Confirmation of disbursement**: loan_disbursed template

These templates include the NCR registration number (NCRCP22396) as required.
