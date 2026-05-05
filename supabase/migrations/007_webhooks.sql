-- KwikBridge LMS — Webhooks Migration
-- Version: 1.0
-- Adds webhook_subscriptions and webhook_events tables for funder integration.

-- ═══ webhook_subscriptions ═══
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  funder_id TEXT NOT NULL,
  funder_name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  event_types JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  created_by TEXT,
  last_delivered_at BIGINT,
  total_delivered INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_active ON webhook_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_funder ON webhook_subscriptions(funder_id);

-- ═══ webhook_events ═══
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  subscription_id TEXT REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'failed', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at BIGINT,
  last_error TEXT,
  delivered_at TIMESTAMP,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_pending ON webhook_events(status, next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_events_sub ON webhook_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);

-- ═══ Trigger: emit event to webhook_events when key tables change ═══
-- Example: emit loan.disbursed when loans.status changes to 'Active' from 'Booked'
CREATE OR REPLACE FUNCTION emit_loan_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type TEXT;
  sub RECORD;
BEGIN
  -- Determine event type from status transition
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'Booked' AND NEW.status = 'Active' THEN
      event_type := 'loan.disbursed';
    ELSIF OLD.status = 'Active' AND NEW.status = 'Settled' THEN
      event_type := 'loan.repaid';
    ELSIF OLD.status = 'Active' AND NEW.status = 'Written Off' THEN
      event_type := 'loan.written_off';
    ELSIF OLD.dpd <= 30 AND NEW.dpd > 30 THEN
      event_type := 'loan.in_arrears';
    ELSE
      RETURN NEW;
    END IF;

    -- Insert event for each subscription that wants this event type
    FOR sub IN
      SELECT id FROM webhook_subscriptions
      WHERE active = TRUE
        AND event_types @> to_jsonb(event_type)
    LOOP
      INSERT INTO webhook_events (subscription_id, event_type, payload, next_retry_at)
      VALUES (
        sub.id,
        event_type,
        jsonb_build_object(
          'loan_id', NEW.id,
          'cust_id', NEW.cust_id,
          'amount', NEW.amount,
          'balance', NEW.balance,
          'product', NEW.product,
          'status', NEW.status,
          'dpd', NEW.dpd
        ),
        EXTRACT(EPOCH FROM NOW()) * 1000
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS loan_event_emit ON loans;
CREATE TRIGGER loan_event_emit
  AFTER UPDATE ON loans
  FOR EACH ROW
  EXECUTE FUNCTION emit_loan_event();

-- ═══ RLS — only admins can manage subscriptions ═══
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_subs_admin" ON webhook_subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "webhook_events_admin" ON webhook_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Edge Function uses service role — bypasses RLS
