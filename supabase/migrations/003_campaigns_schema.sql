-- ============================================
-- WA GTM Project — Campaigns & Contacts Schema
-- ============================================

-- ============================================
-- 1. wa_contacts — Audience database
-- ============================================
CREATE TABLE IF NOT EXISTS wa_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,
    full_name TEXT,
    tags TEXT[], -- ['prospect', 'lead', 'july_bulk']
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON wa_contacts(phone_number);

-- ============================================
-- 2. wa_campaigns — Messaging campaigns (A/B testing supported)
-- ============================================
CREATE TABLE IF NOT EXISTS wa_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
    
    -- Audience
    target_tags TEXT[],
    total_recipients INTEGER NOT NULL DEFAULT 0,
    
    -- Content (A/B Testing)
    template_a TEXT NOT NULL,
    template_b TEXT, -- Optional, for A/B testing
    ab_split_pct INTEGER NOT NULL DEFAULT 100, -- % of audience to get template A
    
    -- Schedule
    scheduled_at TIMESTAMPTZ,
    
    -- Results
    sent_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    read_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. wa_campaign_runs — Individual message attempts
-- ============================================
CREATE TABLE IF NOT EXISTS wa_campaign_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
    account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL, -- The sender account
    contact_id UUID NOT NULL REFERENCES wa_contacts(id) ON DELETE CASCADE,
    
    template_version CHAR(1) NOT NULL DEFAULT 'A', -- 'A' or 'B'
    
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_campaign ON wa_campaign_runs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON wa_campaign_runs(status);

-- ============================================
-- 4. Triggers
-- ============================================
CREATE TRIGGER update_wa_contacts_updated_at
    BEFORE UPDATE ON wa_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wa_campaigns_updated_at
    BEFORE UPDATE ON wa_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE wa_campaigns, wa_campaign_runs;
