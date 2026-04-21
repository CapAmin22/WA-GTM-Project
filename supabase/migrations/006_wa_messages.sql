-- ============================================================
-- Migration 006: wa_messages table for the Inbox feature
-- Stores every inbound + outbound WhatsApp message so the
-- dashboard can show full conversation threads and allow replies.
--
-- Apply via Supabase Dashboard → SQL Editor (copy-paste and run)
-- OR via: node apply-migration.js (if SUPABASE_DB_URL is set)
-- ============================================================

CREATE TABLE IF NOT EXISTS wa_messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id      UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
  wa_message_id   TEXT,
  remote_jid      TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,
  from_me         BOOLEAN NOT NULL DEFAULT false,
  body            TEXT,
  message_type    TEXT NOT NULL DEFAULT 'text',
  status          TEXT NOT NULL DEFAULT 'received'
                  CHECK (status IN ('pending','sent','delivered','read','received','failed')),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wa_messages_wa_id_unique UNIQUE (wa_message_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation
  ON wa_messages(account_id, contact_phone, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_wa_messages_recent
  ON wa_messages(account_id, timestamp DESC);

-- RLS
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wa_messages' AND policyname = 'wa_messages_select'
  ) THEN
    CREATE POLICY "wa_messages_select" ON wa_messages
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wa_messages' AND policyname = 'wa_messages_insert'
  ) THEN
    CREATE POLICY "wa_messages_insert" ON wa_messages
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wa_messages' AND policyname = 'wa_messages_update'
  ) THEN
    CREATE POLICY "wa_messages_update" ON wa_messages
      FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

-- Enable Realtime so the dashboard gets live message updates
ALTER PUBLICATION supabase_realtime ADD TABLE wa_messages;
