-- KwikBridge LMS — Events Table (ENH-05)
-- Append-only event store for event-driven architecture.
-- Prerequisite: 001-005 migrations applied.

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('loan','application','customer','document','collection','system')),
  triggered_by TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  delivered_to JSONB DEFAULT '[]',
  ts BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_entity ON events(type, entity_id);

-- RLS: append-only
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Staff can read all events
CREATE POLICY "events_staff_read" ON events
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- Staff can insert events (append-only — no UPDATE/DELETE policies)
CREATE POLICY "events_staff_insert" ON events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

-- Borrowers can read events on their own entities
CREATE POLICY "events_borrower_read" ON events
  FOR SELECT TO authenticated
  USING (
    NOT public.is_staff()
    AND entity_id IN (
      SELECT id FROM customers WHERE email = public.get_user_email()
      UNION
      SELECT id FROM applications WHERE cust_id IN (SELECT id FROM customers WHERE email = public.get_user_email())
      UNION
      SELECT id FROM loans WHERE cust_id IN (SELECT id FROM customers WHERE email = public.get_user_email())
    )
  );

-- System/anon can insert (for public form events)
CREATE POLICY "events_anon_insert" ON events
  FOR INSERT TO anon
  WITH CHECK (true);

-- NO UPDATE or DELETE policies — events are immutable
