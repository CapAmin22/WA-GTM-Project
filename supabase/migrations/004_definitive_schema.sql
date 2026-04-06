-- ============================================
-- WA GTM DEFINITIVE SCHEMA v3.0
-- Applies Sections 6, 7, 8, 9, 10 of the Specification.
-- IMPORTANT: Run this entire script in Supabase SQL Editor.
-- ============================================

-- Drop existing tables to enforce the Definitive Schema exactly (cascade drops foreign keys)
DROP TABLE IF EXISTS send_logs CASCADE;
DROP TABLE IF EXISTS message_queue CASCADE;
DROP TABLE IF EXISTS baileys_sessions CASCADE;
DROP TABLE IF EXISTS baileys_keys CASCADE;
DROP TABLE IF EXISTS wa_campaign_runs CASCADE;
DROP TABLE IF EXISTS wa_campaigns CASCADE;
DROP TABLE IF EXISTS wa_contacts CASCADE;
-- Keeping wa_accounts table structure mostly intact but recreating to match spec exactly
DROP TABLE IF EXISTS wa_accounts CASCADE;

DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS message_templates CASCADE;
DROP TABLE IF EXISTS ab_variants CASCADE;
DROP TABLE IF EXISTS ab_experiments CASCADE;
DROP TABLE IF EXISTS contact_segments CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS blacklist CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- ----------------------------------------------------
-- Table 1: wa_accounts
-- ----------------------------------------------------
CREATE TABLE wa_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pairing' 
        CHECK (status IN ('active','cooldown','banned','pairing','disconnected')),
    messages_sent_today INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER NOT NULL DEFAULT 125,
    last_message_at TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ,
    connection_status VARCHAR(20) NOT NULL DEFAULT 'disconnected' 
        CHECK (connection_status IN ('connected','disconnected','reconnecting')),
    last_connected_at TIMESTAMPTZ,
    session_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: We intentionally stripped out `pairing_qr` from 004, but if dashboard still expects it, 
-- we will add it back down below so things don't break immediately. But for strict spec matching:
ALTER TABLE wa_accounts ADD COLUMN pairing_qr TEXT;
ALTER TABLE wa_accounts ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------
-- Table 5: message_templates
-- ----------------------------------------------------
CREATE TABLE message_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general' 
        CHECK (category IN ('general','promotional','transactional','follow_up','greeting','custom')),
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    preview_text TEXT,
    usage_count INTEGER NOT NULL DEFAULT 0,
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_delivered INTEGER NOT NULL DEFAULT 0,
    total_replied INTEGER NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------
-- Table 6: ab_experiments
-- ----------------------------------------------------
CREATE TABLE ab_experiments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    hypothesis TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft','running','completed','cancelled')),
    winner_variant_id UUID,
    auto_select_winner BOOLEAN NOT NULL DEFAULT true,
    confidence_threshold FLOAT NOT NULL DEFAULT 0.95 
        CHECK (confidence_threshold BETWEEN 0.8 AND 0.99),
    min_sample_per_variant INTEGER NOT NULL DEFAULT 50,
    primary_metric VARCHAR(30) NOT NULL DEFAULT 'delivery_rate' 
        CHECK (primary_metric IN ('delivery_rate','reply_rate')),
    traffic_split JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------
-- Table 7: ab_variants
-- ----------------------------------------------------
CREATE TABLE ab_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
    variant_label VARCHAR(10) NOT NULL,
    template_id UUID NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
    send_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    is_winner BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ab_experiments ADD CONSTRAINT fk_experiments_winner FOREIGN KEY (winner_variant_id) REFERENCES ab_variants(id) ON DELETE SET NULL;

-- ----------------------------------------------------
-- Table 9: contact_segments
-- ----------------------------------------------------
CREATE TABLE contact_segments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    filter_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    contact_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------
-- Table 4: campaigns
-- ----------------------------------------------------
CREATE TABLE campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft','scheduled','active','paused','completed','cancelled')),
    template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    ab_experiment_id UUID REFERENCES ab_experiments(id) ON DELETE SET NULL,
    segment_id UUID REFERENCES contact_segments(id) ON DELETE SET NULL,
    send_window_start INTEGER NOT NULL DEFAULT 10 CHECK (send_window_start BETWEEN 0 AND 23),
    send_window_end INTEGER NOT NULL DEFAULT 22 CHECK (send_window_end BETWEEN 0 AND 23),
    daily_limit INTEGER NOT NULL DEFAULT 500,
    per_account_limit INTEGER NOT NULL DEFAULT 125,
    jitter_min FLOAT NOT NULL DEFAULT 0.8,
    jitter_max FLOAT NOT NULL DEFAULT 1.2,
    presence_min_sec INTEGER NOT NULL DEFAULT 4,
    presence_max_sec INTEGER NOT NULL DEFAULT 9,
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    scheduled_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------
-- Table 2: message_queue
-- ----------------------------------------------------
CREATE TABLE message_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    recipient_name VARCHAR(100),
    message_template TEXT NOT NULL,
    message_body TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending','processing','sent','failed','cancelled')),
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES ab_variants(id) ON DELETE SET NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------
-- Table 3: send_logs
-- ----------------------------------------------------
CREATE TABLE send_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_item_id UUID NOT NULL REFERENCES message_queue(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES ab_variants(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent','failed')),
    error_message TEXT,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------
-- Table 8: contacts
-- ----------------------------------------------------
CREATE TABLE contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100),
    email VARCHAR(200),
    company VARCHAR(200),
    tags TEXT[] NOT NULL DEFAULT '{}',
    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    source VARCHAR(50) NOT NULL DEFAULT 'csv_import' 
        CHECK (source IN ('csv_import','manual','api','webhook')),
    is_blacklisted BOOLEAN NOT NULL DEFAULT false,
    last_contacted_at TIMESTAMPTZ,
    total_messages_sent INTEGER NOT NULL DEFAULT 0,
    total_replies INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------
-- Table 10: blacklist
-- ----------------------------------------------------
CREATE TABLE blacklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    reason TEXT,
    added_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------
-- Table 11: system_config
-- ----------------------------------------------------
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by VARCHAR(100)
);

-- ============================================
-- Indexes (Section 8)
-- ============================================
CREATE INDEX idx_queue_pending_scheduled ON message_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_queue_campaign ON message_queue(campaign_id, status);
CREATE INDEX idx_queue_account ON message_queue(assigned_account_id) WHERE assigned_account_id IS NOT NULL;
CREATE INDEX idx_queue_variant ON message_queue(variant_id) WHERE variant_id IS NOT NULL;

CREATE INDEX idx_logs_created ON send_logs(created_at DESC);
CREATE INDEX idx_logs_account ON send_logs(account_id, created_at DESC);
CREATE INDEX idx_logs_campaign ON send_logs(campaign_id, created_at DESC) WHERE campaign_id IS NOT NULL;

CREATE INDEX idx_accounts_status ON wa_accounts(status);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_blacklist_phone ON blacklist(phone);
CREATE INDEX idx_templates_active ON message_templates(is_archived, created_at DESC) WHERE is_archived = false;

-- ============================================
-- Functions & Triggers (Section 9)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wa_accounts_updated_at BEFORE UPDATE ON wa_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_segments_updated_at BEFORE UPDATE ON contact_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION daily_reset() RETURNS void AS $$
BEGIN
    UPDATE wa_accounts SET messages_sent_today = 0;
    UPDATE wa_accounts SET status = 'active' WHERE status = 'cooldown' AND cooldown_until < now();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Seed Data (Section 10)
-- ============================================
INSERT INTO system_config (key, value, description) VALUES 
('global_send_enabled', 'true', 'Master kill switch. false = all sending paused.'),
('send_window_start', '10', 'Hour (0-23) when sending begins.'),
('send_window_end', '22', 'Hour (0-23) when sending stops.'),
('send_timezone', '"Asia/Kolkata"', 'IANA timezone for window calculation.'),
('daily_total_limit', '500', 'Max messages per day across all accounts.'),
('per_account_limit', '125', 'Max messages per account per day.'),
('jitter_min', '0.8', 'Min jitter multiplier for delay calculation.'),
('jitter_max', '1.2', 'Max jitter multiplier for delay calculation.'),
('presence_composing_min_sec', '4', 'Min seconds to show typing indicator.'),
('presence_composing_max_sec', '9', 'Max seconds to show typing indicator.'),
('presence_read_probability', '0.3', 'Probability of reading incoming msgs (0.0-1.0).'),
('presence_offline_min_sec', '5', 'Min seconds before going offline after send.'),
('presence_offline_max_sec', '15', 'Max seconds before going offline after send.'),
('max_retry_attempts', '3', 'Max send retries before marking failed.'),
('cooldown_duration_minutes', '30', 'How long an account cools down.'),
('auto_cooldown_on_rate_limit', 'true', 'Auto-pause account on rate limit.'),
('discord_webhook_url', 'null', 'Discord webhook URL for alerts.'),
('email_alerts_enabled', 'false', 'Toggle email alerts.'),
('smtp_host', 'null', 'SMTP server hostname.'),
('smtp_port', '587', 'SMTP port.'),
('smtp_user', 'null', 'SMTP username.'),
('smtp_pass', 'null', 'SMTP password.'),
('alert_email_to', 'null', 'Email address for alerts.'),
('alert_on_ban', 'true', 'Alert when account banned.'),
('alert_on_logout', 'true', 'Alert when account logged out.'),
('alert_on_daily_miss', 'true', 'Alert if daily target not met by 9 PM.');

-- Add Passionbits explicitly since it drops the table
INSERT INTO wa_accounts (phone_number, display_name, status, connection_status) VALUES 
('+918329556730', 'Passionbits', 'active', 'disconnected');

-- ============================================
-- Enable Realtime
-- ============================================
BEGIN;
  -- safely drop publication if exists, recreate.
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE send_logs, wa_accounts, message_queue, system_config, ab_variants, campaigns;
