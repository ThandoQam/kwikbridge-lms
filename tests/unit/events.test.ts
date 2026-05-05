/**
 * Unit tests for the event bus.
 *
 * The event bus is the backbone of decoupled processing — when
 * applications get approved, loans disbursed, payments missed, etc.,
 * the event bus delivers the signal to handlers (audit logger,
 * notifications, webhooks). A bug here causes silent data loss:
 * audit gaps, missed customer SMS, undelivered webhooks.
 *
 * Tests focus on synchronous handler execution, error isolation,
 * and event factory consistency. Webhook delivery is mocked because
 * it touches fetch().
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  eventBus,
  createEvent,
  emit,
  EVENT_NOTIFICATION_MAP,
  createAuditHandler,
} from '../../src/lib/events';

// ═══ createEvent ═══

describe('createEvent', () => {
  it('returns a fully-formed event', () => {
    const event = createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001', { amount: 500_000 });
    expect(event.type).toBe('LOAN_CREATED');
    expect(event.entityId).toBe('L-001');
    expect(event.entityType).toBe('loan');
    expect(event.triggeredBy).toBe('U001');
    expect(event.payload).toEqual({ amount: 500_000 });
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.id).toMatch(/^EVT-\d+-\d+$/);
  });

  it('generates unique IDs for sequential events', () => {
    const e1 = createEvent('LOAN_CREATED', 'L-1', 'loan', 'U001');
    const e2 = createEvent('LOAN_CREATED', 'L-2', 'loan', 'U001');
    expect(e1.id).not.toBe(e2.id);
  });

  it('payload defaults to empty object', () => {
    const event = createEvent('PAYMENT_RECEIVED', 'L-001', 'loan', 'U001');
    expect(event.payload).toEqual({});
  });

  it('captures timestamp at creation', () => {
    const before = Date.now();
    const event = createEvent('CUSTOMER_CREATED', 'C-001', 'customer', 'U001');
    const after = Date.now();
    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
  });
});

// ═══ EventBus subscription + publish ═══

describe('EventBus', () => {
  beforeEach(() => {
    eventBus.clearLog();
    eventBus.setWebhooks([]); // disable webhook delivery
    eventBus.setPersistFn(async () => {}); // no-op persistence
  });

  it('publishes events to subscribers matching the type', async () => {
    const received: any[] = [];
    const unsub = eventBus.subscribe('test-handler', ['LOAN_CREATED'], (e) => {
      received.push(e);
    });

    await eventBus.publish(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001'));
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('LOAN_CREATED');

    unsub();
  });

  it('does not deliver to non-matching subscribers', async () => {
    const received: any[] = [];
    const unsub = eventBus.subscribe('test-handler', ['PAYMENT_RECEIVED'], (e) => {
      received.push(e);
    });

    await eventBus.publish(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001'));
    expect(received).toHaveLength(0);

    unsub();
  });

  it('wildcard handler receives all events', async () => {
    const received: any[] = [];
    const unsub = eventBus.subscribe('wildcard', '*', (e) => {
      received.push(e.type);
    });

    await eventBus.publish(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001'));
    await eventBus.publish(createEvent('PAYMENT_RECEIVED', 'L-001', 'loan', 'U001'));
    await eventBus.publish(createEvent('CUSTOMER_CREATED', 'C-001', 'customer', 'U001'));

    expect(received).toEqual(['LOAN_CREATED', 'PAYMENT_RECEIVED', 'CUSTOMER_CREATED']);
    unsub();
  });

  it('handlers run in priority order (lower runs first)', async () => {
    const order: string[] = [];
    const unsub1 = eventBus.subscribe('low-priority', ['LOAN_CREATED'], () => order.push('low'), 100);
    const unsub2 = eventBus.subscribe('high-priority', ['LOAN_CREATED'], () => order.push('high'), 1);

    await eventBus.publish(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001'));
    expect(order).toEqual(['high', 'low']);

    unsub1();
    unsub2();
  });

  it('failing handler does not stop other handlers', async () => {
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const successCalls: string[] = [];

    const unsubFail = eventBus.subscribe('fail-handler', ['LOAN_CREATED'], () => {
      throw new Error('boom');
    });
    const unsubOk = eventBus.subscribe('ok-handler', ['LOAN_CREATED'], () => {
      successCalls.push('ran');
    });

    await eventBus.publish(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001'));
    expect(successCalls).toEqual(['ran']);
    expect(consoleErrSpy).toHaveBeenCalled();

    unsubFail();
    unsubOk();
    consoleErrSpy.mockRestore();
  });

  it('records delivered handler IDs on the event', async () => {
    const unsub = eventBus.subscribe('handler-1', ['LOAN_CREATED'], () => {});
    const event = createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001');
    await eventBus.publish(event);
    expect(event.delivered).toContain('handler-1');
    unsub();
  });

  it('unsubscribe stops handler from receiving events', async () => {
    const received: any[] = [];
    const unsub = eventBus.subscribe('temp', ['LOAN_CREATED'], (e) => received.push(e));
    await eventBus.publish(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001'));
    unsub();
    await eventBus.publish(createEvent('LOAN_CREATED', 'L-002', 'loan', 'U001'));
    expect(received).toHaveLength(1);
  });

  it('logs all published events', async () => {
    eventBus.clearLog();
    await eventBus.publish(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001'));
    await eventBus.publish(createEvent('PAYMENT_RECEIVED', 'L-001', 'loan', 'U001'));
    const log = eventBus.getLog();
    expect(log.length).toBeGreaterThanOrEqual(2);
  });

  it('clearLog empties the event log', async () => {
    await eventBus.publish(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001'));
    expect(eventBus.getLog().length).toBeGreaterThan(0);
    eventBus.clearLog();
    expect(eventBus.getLog()).toEqual([]);
  });

  it('persistFn is called for each event (fire-and-forget)', async () => {
    const persisted: any[] = [];
    eventBus.setPersistFn(async (e) => {
      persisted.push(e.type);
    });

    await eventBus.publish(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001'));
    // persistFn is async / fire-and-forget — give it a tick to run
    await new Promise((r) => setTimeout(r, 10));
    expect(persisted).toContain('LOAN_CREATED');
  });
});

// ═══ emit convenience publishers ═══

describe('emit helpers', () => {
  beforeEach(() => {
    eventBus.clearLog();
    eventBus.setWebhooks([]);
    eventBus.setPersistFn(async () => {});
  });

  it('emit.applicationSubmitted publishes APPLICATION_SUBMITTED event', async () => {
    const received: any[] = [];
    const unsub = eventBus.subscribe('test', ['APPLICATION_SUBMITTED'], (e) => received.push(e));
    await emit.applicationSubmitted('A-001', 'U001', { amount: 100_000 });
    expect(received).toHaveLength(1);
    expect(received[0].entityId).toBe('A-001');
    expect(received[0].triggeredBy).toBe('U001');
    expect(received[0].payload.amount).toBe(100_000);
    unsub();
  });

  it('emit.loanDisbursed publishes LOAN_DISBURSED event with correct entity type', async () => {
    const received: any[] = [];
    const unsub = eventBus.subscribe('test', ['LOAN_DISBURSED'], (e) => received.push(e));
    await emit.loanDisbursed('L-001', 'U001');
    expect(received[0].entityType).toBe('loan');
    unsub();
  });

  it('emit.stageMigrated has triggeredBy=SYSTEM', async () => {
    const received: any[] = [];
    const unsub = eventBus.subscribe('test', ['STAGE_MIGRATED'], (e) => received.push(e));
    await emit.stageMigrated('L-001', { from: 1, to: 2 });
    expect(received[0].triggeredBy).toBe('SYSTEM');
    unsub();
  });

  it('emit.eodCompleted publishes with system entityType', async () => {
    const received: any[] = [];
    const unsub = eventBus.subscribe('test', ['EOD_COMPLETED'], (e) => received.push(e));
    await emit.eodCompleted({ loansProcessed: 100 });
    expect(received[0].entityType).toBe('system');
    expect(received[0].entityId).toBe('SYSTEM');
    unsub();
  });
});

// ═══ EVENT_NOTIFICATION_MAP ═══

describe('EVENT_NOTIFICATION_MAP', () => {
  it('maps key lifecycle events to notification templates', () => {
    expect(EVENT_NOTIFICATION_MAP.APPLICATION_SUBMITTED).toBeDefined();
    expect(EVENT_NOTIFICATION_MAP.APPLICATION_APPROVED).toBeDefined();
    expect(EVENT_NOTIFICATION_MAP.LOAN_DISBURSED).toBeDefined();
    expect(EVENT_NOTIFICATION_MAP.PAYMENT_RECEIVED).toBeDefined();
  });

  it('every entry specifies template and channel', () => {
    for (const [type, mapping] of Object.entries(EVENT_NOTIFICATION_MAP)) {
      expect(mapping.template).toBeDefined();
      expect(mapping.channel).toMatch(/^(email|sms|both)$/);
    }
  });

  it('declined applications notify by email only (no SMS for sensitive news)', () => {
    expect(EVENT_NOTIFICATION_MAP.APPLICATION_DECLINED.channel).toBe('email');
  });
});

// ═══ createAuditHandler ═══

describe('createAuditHandler', () => {
  it('creates an audit entry for known event types', () => {
    const auditCalls: any[] = [];
    const fakeAddAudit = (action: string, entity: string, user: string, details: string, category: string) => {
      auditCalls.push({ action, entity, user, details, category });
      return { id: 'A-1' } as any;
    };

    const handler = createAuditHandler(fakeAddAudit);
    handler(createEvent('LOAN_CREATED', 'L-001', 'loan', 'U001', { amount: 500_000 }));

    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0].action).toBe('Loan Booked');
    expect(auditCalls[0].category).toBe('Loans');
    expect(auditCalls[0].entity).toBe('L-001');
    expect(auditCalls[0].user).toBe('U001');
  });

  it('does not create audit for unmapped event types', () => {
    const auditCalls: any[] = [];
    const fakeAddAudit = (...args: any[]) => {
      auditCalls.push(args);
      return { id: 'A-1' } as any;
    };

    const handler = createAuditHandler(fakeAddAudit);
    // BEE_UPDATED is not in the actionMap
    handler(createEvent('BEE_UPDATED', 'C-001', 'customer', 'U001'));
    expect(auditCalls).toHaveLength(0);
  });

  it('serialises payload as JSON string truncated to 500 chars', () => {
    const auditCalls: any[] = [];
    const fakeAddAudit = (action: string, entity: string, user: string, details: string, category: string) => {
      auditCalls.push(details);
      return { id: 'A-1' } as any;
    };

    const handler = createAuditHandler(fakeAddAudit);
    const longPayload = { data: 'x'.repeat(1000) };
    handler(createEvent('PAYMENT_RECEIVED', 'L-001', 'loan', 'U001', longPayload));

    expect(auditCalls[0]).toBeDefined();
    expect(auditCalls[0].length).toBeLessThanOrEqual(500);
  });

  it('records appropriate category for each event', () => {
    const calls: Record<string, string> = {};
    const fakeAddAudit = (action: string, entity: string, user: string, details: string, category: string) => {
      calls[action] = category;
      return { id: 'A-1' } as any;
    };

    const handler = createAuditHandler(fakeAddAudit);
    handler(createEvent('PTP_CREATED', 'L-001', 'loan', 'U001'));
    handler(createEvent('STAGE_MIGRATED', 'L-001', 'loan', 'SYSTEM'));
    handler(createEvent('FICA_VERIFIED', 'C-001', 'customer', 'U001'));

    expect(calls['PTP Created']).toBe('Collections');
    expect(calls['Stage Migration']).toBe('Risk');
    expect(calls['FICA Verified']).toBe('Compliance');
  });
});
