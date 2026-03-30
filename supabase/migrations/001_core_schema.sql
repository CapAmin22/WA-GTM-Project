-- ============================================
-- WA GTM Project — Core Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- ============================================
-- 1. wa_accounts — WhatsApp number registry
-- ============================================
CREATE TABLE IF NOT EXISTS wa_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT 'Unnamed',
    daily_limit INTEGER NOT NULL DEFAULT 200,
    status TEXT NOT NULL DEFAULT 'pairing' 
        CHECK (status IN ('pairing', 'active', 'disconnected', 'banned')),
    connection_status TEXT DEFAULT 'disconnected'
        CHECK (connection_status IN ('connected', 'disconnected', 'connecting')),
    pairing_qr TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    session_data JSONB,
    messages_sent_today INTEGER NOT NULL DEFAULT 0,
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: Only query active (non-archived) accounts
CREATE INDEX IF NOT EXISTS idx_accounts_active ON wa_accounts(status) WHERE is_archived = false;

-- Index: Fast lookup by phone number
CREATE INDEX IF NOT EXISTS idx_accounts_phone ON wa_accounts(phone_number);

-- ============================================
-- 2. baileys_sessions — Stores Baileys creds
-- ============================================
CREATE TABLE IF NOT EXISTS baileys_sessions (
    id TEXT PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_account ON baileys_sessions(account_id);

-- ============================================
-- 3. baileys_keys — Signal protocol keys
-- ============================================
CREATE TABLE IF NOT EXISTS baileys_keys (
    id TEXT PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
    key_type TEXT NOT NULL,
    key_id TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_keys_account_type ON baileys_keys(account_id, key_type);

-- ============================================
-- 4. send_logs — Message delivery log
-- ============================================
CREATE TABLE IF NOT EXISTS send_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES wa_accounts(id),
    recipient_phone TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text'
        CHECK (message_type IN ('text', 'image', 'document', 'template')),
    message_content TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_account ON send_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_logs_status ON send_logs(status);

-- ============================================
-- 5. Auto-update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wa_accounts_updated_at
    BEFORE UPDATE ON wa_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_baileys_sessions_updated_at
    BEFORE UPDATE ON baileys_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_baileys_keys_updated_at
    BEFORE UPDATE ON baileys_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Enable Realtime for wa_accounts
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE wa_accounts;
