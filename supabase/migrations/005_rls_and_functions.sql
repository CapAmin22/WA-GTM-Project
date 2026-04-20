-- ============================================
-- WA GTM Migration 005 — RLS Policies + Helper Functions
-- Run this in Supabase SQL Editor:
--   Project: rdobracgfbuqzboldhxj
--   URL: https://supabase.com/dashboard/project/rdobracgfbuqzboldhxj/sql
-- ============================================

-- ============================================
-- 1. Enable RLS on all tables (migration 004 skipped this)
-- ============================================
ALTER TABLE message_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_experiments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_variants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_segments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns                ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_queue            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist                ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config            ENABLE ROW LEVEL SECURITY;

-- wa_accounts RLS was already set in migration 002, leave it.
-- send_logs RLS was already set in migration 002, leave it.

-- ============================================
-- 2. RLS Policies — message_templates
-- ============================================
CREATE POLICY "templates_select" ON message_templates
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "templates_insert" ON message_templates
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "templates_update" ON message_templates
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "templates_delete" ON message_templates
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 3. RLS Policies — ab_experiments
-- ============================================
CREATE POLICY "experiments_select" ON ab_experiments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "experiments_insert" ON ab_experiments
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "experiments_update" ON ab_experiments
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "experiments_delete" ON ab_experiments
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 4. RLS Policies — ab_variants
-- ============================================
CREATE POLICY "variants_select" ON ab_variants
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "variants_insert" ON ab_variants
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "variants_update" ON ab_variants
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "variants_delete" ON ab_variants
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 5. RLS Policies — contact_segments
-- ============================================
CREATE POLICY "segments_select" ON contact_segments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "segments_insert" ON contact_segments
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "segments_update" ON contact_segments
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "segments_delete" ON contact_segments
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 6. RLS Policies — campaigns
-- ============================================
CREATE POLICY "campaigns_select" ON campaigns
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "campaigns_insert" ON campaigns
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "campaigns_update" ON campaigns
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "campaigns_delete" ON campaigns
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 7. RLS Policies — message_queue
--    Dashboard needs to read/write; worker uses service_role (bypasses RLS)
-- ============================================
CREATE POLICY "queue_select" ON message_queue
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "queue_insert" ON message_queue
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "queue_update" ON message_queue
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "queue_delete" ON message_queue
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 8. RLS Policies — contacts
-- ============================================
CREATE POLICY "contacts_select" ON contacts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "contacts_insert" ON contacts
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "contacts_update" ON contacts
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "contacts_delete" ON contacts
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 9. RLS Policies — blacklist
-- ============================================
CREATE POLICY "blacklist_select" ON blacklist
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "blacklist_insert" ON blacklist
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "blacklist_delete" ON blacklist
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 10. RLS Policies — system_config
--     All authenticated users can read; any authenticated user can update
--     (tighten to admin role later if needed)
-- ============================================
CREATE POLICY "config_select" ON system_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "config_insert" ON system_config
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "config_update" ON system_config
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 11. Helper Function — increment_messages_sent_today
--     Called by worker after each successful send.
-- ============================================
CREATE OR REPLACE FUNCTION increment_messages_sent_today(p_account_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE wa_accounts
    SET
        messages_sent_today = messages_sent_today + 1,
        last_message_at = now()
    WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. Helper Function — increment_campaign_sent
--     Atomically increments campaigns.sent_count
-- ============================================
CREATE OR REPLACE FUNCTION increment_campaign_sent(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns
    SET sent_count = sent_count + 1
    WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. Helper Function — increment_campaign_failed
--     Atomically increments campaigns.failed_count
-- ============================================
CREATE OR REPLACE FUNCTION increment_campaign_failed(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns
    SET failed_count = failed_count + 1
    WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 14. Grant execute on functions to service_role (worker)
-- ============================================
GRANT EXECUTE ON FUNCTION increment_messages_sent_today(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION increment_campaign_sent(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION increment_campaign_failed(UUID) TO service_role;
