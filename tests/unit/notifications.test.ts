/**
 * Unit tests for notification template resolution.
 *
 * The notifications module composes regulated customer-facing
 * communication. Template content must include the NCR registration
 * (NCRCP22396) and accurate variable interpolation. Bugs in template
 * variable substitution can leak placeholder text to customers.
 *
 * Tests focus on the pure template resolution path
 * (`getTemplatePreview`), not the SMTP/SMS delivery, since those
 * touch external services.
 */

import { describe, it, expect } from 'vitest';
import { getTemplatePreview, NOTIFICATION_TEMPLATES } from '../../src/lib/notifications';

// ═══ getTemplatePreview ═══

describe('getTemplatePreview', () => {
  it('renders subject, email body, and SMS body', () => {
    const result = getTemplatePreview('application_submitted', {
      appId: 'A-001',
      name: 'John Smith',
      amount: 'R500,000',
      product: 'Working Capital',
    });
    expect(result.subject).toContain('A-001');
    expect(result.emailBody).toContain('John Smith');
    expect(result.emailBody).toContain('R500,000');
    expect(result.smsBody).toContain('A-001');
  });

  it('substitutes variables in all three slots (subject/email/sms)', () => {
    const result = getTemplatePreview('application_submitted', {
      appId: 'A-VARS',
      name: 'Test User',
      amount: 'R100k',
      product: 'WC',
    });
    expect(result.subject.includes('A-VARS')).toBe(true);
    expect(result.emailBody.includes('A-VARS')).toBe(true);
    expect(result.smsBody.includes('A-VARS')).toBe(true);
  });

  it('treats missing variables as empty strings (no [object Object])', () => {
    const result = getTemplatePreview('application_submitted', {});
    // Should not contain "undefined" or "[object Object]" in output
    expect(result.subject).not.toMatch(/undefined|object Object/);
    expect(result.emailBody).not.toMatch(/undefined|object Object/);
    expect(result.smsBody).not.toMatch(/undefined|object Object/);
  });

  it('coerces number variables to strings', () => {
    const result = getTemplatePreview('application_submitted', {
      appId: 'A-NUM',
      name: 'X',
      amount: 250000,
      product: 'P',
    });
    expect(result.emailBody).toContain('250000');
  });

  it('email body is longer than SMS body (different length budgets)', () => {
    const result = getTemplatePreview('application_submitted', {
      appId: 'A-001',
      name: 'Long Name Person',
      amount: 'R500,000',
      product: 'Working Capital Plus',
    });
    expect(result.emailBody.length).toBeGreaterThan(result.smsBody.length);
  });

  it('includes NCR registration in regulated emails', () => {
    const result = getTemplatePreview('application_submitted', {
      appId: 'A-001',
      name: 'X',
      amount: 'R1M',
      product: 'P',
    });
    // The application_submitted template includes NCRCP22396
    expect(result.emailBody).toContain('NCRCP22396');
  });

  it('handles each known template type without crashing', () => {
    const templates = [
      'application_submitted',
      'application_qa_passed',
      'application_qa_failed',
      'application_approved',
      'application_declined',
      'loan_booked',
      'loan_disbursed',
      'payment_received',
      'payment_due_reminder',
      'payment_missed',
      'ptp_reminder',
      'ptp_confirmed',
      'document_requested',
      'document_verified',
      'collection_notice',
      'restructure_approved',
      'welcome_borrower',
    ] as const;

    for (const tpl of templates) {
      const result = getTemplatePreview(tpl, {
        appId: 'A-1',
        loanId: 'L-1',
        custId: 'C-1',
        name: 'Test',
        amount: 'R1000',
        product: 'P',
        date: '2026-05-05',
        issues: 'sample issue',
        documents: 'doc list',
        reason: 'sample reason',
      });
      expect(result.subject).toBeTruthy();
      expect(result.emailBody).toBeTruthy();
      expect(result.smsBody).toBeTruthy();
    }
  });

  it('SMS body fits within reasonable single-segment + chained budgets', () => {
    const result = getTemplatePreview('payment_due_reminder', {
      appId: 'A-1',
      loanId: 'L-1',
      name: 'Test',
      amount: 'R5000',
      date: '2026-05-10',
    });
    // SMS chained max ≈ 1530 chars (10 segments). Most templates should
    // be far smaller. We just ensure they're not absurdly long.
    expect(result.smsBody.length).toBeLessThan(1530);
  });
});

// ═══ NOTIFICATION_TEMPLATES catalogue ═══

describe('NOTIFICATION_TEMPLATES catalogue', () => {
  it('lists all template entries with key/label/channel', () => {
    expect(NOTIFICATION_TEMPLATES.length).toBeGreaterThan(10);
    for (const entry of NOTIFICATION_TEMPLATES) {
      expect(entry.key).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(['email', 'sms', 'both']).toContain(entry.channel);
    }
  });

  it('includes the lifecycle templates that emit publishes events for', () => {
    const keys = NOTIFICATION_TEMPLATES.map((t) => t.key);
    expect(keys).toContain('application_submitted');
    expect(keys).toContain('application_approved');
    expect(keys).toContain('application_declined');
    expect(keys).toContain('loan_disbursed');
    expect(keys).toContain('payment_missed');
    expect(keys).toContain('ptp_confirmed');
  });

  it('declined notification uses email-only channel (sensitive news)', () => {
    const declined = NOTIFICATION_TEMPLATES.find((t) => t.key === 'application_declined');
    expect(declined?.channel).toBe('email');
  });

  it('payment due reminder uses SMS (time-sensitive)', () => {
    const reminder = NOTIFICATION_TEMPLATES.find((t) => t.key === 'payment_due_reminder');
    expect(reminder?.channel).toBe('sms');
  });

  it('every template key in the catalogue resolves to actual content', () => {
    for (const entry of NOTIFICATION_TEMPLATES) {
      const result = getTemplatePreview(entry.key as any, { appId: 'A', name: 'X', amount: 'R1' });
      expect(result.subject).toBeTruthy();
      expect(result.emailBody).toBeTruthy();
      expect(result.smsBody).toBeTruthy();
    }
  });
});
