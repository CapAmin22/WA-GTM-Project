-- =============================================================================
-- FIX_COUNTERS.sql
-- Run this in the Supabase SQL Editor for project vihvqnuqhrhkfmfleqfv
-- Purpose: Recalculate all inflated/incorrect counters from send_logs source of truth
-- =============================================================================

-- 1. Reset messages_sent_today on wa_accounts to 0
--    (will naturally re-accumulate from today's sends via worker)
UPDATE wa_accounts
SET messages_sent_today = 0
WHERE is_archived = false;

-- 2. Recalculate campaigns.sent_count and failed_count from send_logs
UPDATE campaigns c
SET
  sent_count = COALESCE(
    (SELECT COUNT(*) FROM send_logs sl WHERE sl.campaign_id = c.id AND sl.status = 'sent'), 0
  ),
  failed_count = COALESCE(
    (SELECT COUNT(*) FROM send_logs sl WHERE sl.campaign_id = c.id AND sl.status = 'failed'), 0
  );

-- 3. Fix campaign status:
--    - If all queue items are sent/failed → mark completed
--    - If has some sent/processing items → mark active
--    - If has pending items but 0 sent → keep scheduled/active
UPDATE campaigns c
SET status = 'completed'
WHERE c.status IN ('active', 'scheduled')
  AND NOT EXISTS (
    SELECT 1 FROM message_queue mq
    WHERE mq.campaign_id = c.id AND mq.status IN ('pending', 'processing')
  )
  AND c.total_recipients > 0
  AND (c.sent_count + c.failed_count) >= c.total_recipients;

-- 4. Fix orphaned 'processing' items stuck from crashed workers → back to pending
UPDATE message_queue
SET status = 'pending'
WHERE status = 'processing';

-- 5. Update safe system_config defaults (matches error_reference.md resolution)
INSERT INTO system_config (key, value, description) VALUES
  ('global_send_enabled',         'true',    'Master kill switch for all sending'),
  ('daily_total_limit',           '150',     'Max messages per day across all accounts'),
  ('per_account_limit',           '40',      'Max messages per account per day'),
  ('jitter_min',                  '0.7',     'Minimum delay multiplier (base=15s → ~10.5s)'),
  ('jitter_max',                  '2.0',     'Maximum delay multiplier (base=15s → ~30s)'),
  ('presence_composing_min_sec',  '4',       'Min typing indicator duration'),
  ('presence_composing_max_sec',  '9',       'Max typing indicator duration'),
  ('presence_read_probability',   '0.3',     'Probability of sending read receipts'),
  ('presence_offline_min_sec',    '5',       'Min offline break duration'),
  ('presence_offline_max_sec',    '15',      'Max offline break duration'),
  ('auto_cooldown_on_rate_limit', 'true',    'Pause account on WhatsApp rate limit'),
  ('email_alerts_enabled',        'false',   'Send email alerts on critical events'),
  ('alert_on_ban',                'true',    'Alert when account is banned'),
  ('alert_on_logout',             'true',    'Alert when account logs out')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. Verify results
SELECT 'wa_accounts' as tbl, id, display_name, messages_sent_today FROM wa_accounts;
SELECT 'campaigns' as tbl, id, name, status, sent_count, failed_count, total_recipients FROM campaigns;
SELECT 'message_queue stuck' as check, COUNT(*) FROM message_queue WHERE status = 'processing';
SELECT 'system_config' as tbl, key, value FROM system_config ORDER BY key;
