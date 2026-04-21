-- =============================================================================
-- FULL_RESET.sql  — Run this in Supabase SQL Editor (project vihvqnuqhrhkfmfleqfv)
--
-- PURPOSE: Wipe all testing/corrupted data so you can run a real campaign
--          from a clean slate.
--
-- KEEPS:   contacts, message_templates, wa_accounts, system_config
-- DELETES: campaigns, message_queue, send_logs, ab variant counters
-- =============================================================================

-- 1. Wipe all test send logs (source of all corrupted analytics)
DELETE FROM send_logs;

-- 2. Wipe entire message queue (test/corrupted items)
DELETE FROM message_queue;

-- 3. Wipe all test campaigns
DELETE FROM campaigns;

-- 4. Reset per-account send counters
UPDATE wa_accounts
SET messages_sent_today = 0,
    last_message_at = NULL
WHERE is_archived = false;

-- 5. Reset A/B variant counters (experiments structure kept, only counts cleared)
UPDATE ab_variants
SET send_count = 0, delivered_count = 0, reply_count = 0, fail_count = 0;

-- 6. Reset contact reply counters
UPDATE contacts SET total_replies = 0;

-- 7. Apply correct safe system_config defaults
INSERT INTO system_config (key, value, description) VALUES
  ('global_send_enabled',         'true',   'Master kill switch'),
  ('daily_total_limit',           '150',    'Max messages/day across all accounts'),
  ('per_account_limit',           '40',     'Max messages/day per account'),
  ('jitter_min',                  '0.7',    'Min delay multiplier (15s × 0.7 = ~10s)'),
  ('jitter_max',                  '2.0',    'Max delay multiplier (15s × 2.0 = ~30s)'),
  ('presence_composing_min_sec',  '4',      'Min typing duration (sec)'),
  ('presence_composing_max_sec',  '9',      'Max typing duration (sec)'),
  ('presence_read_probability',   '0.3',    'Probability of read receipts'),
  ('presence_offline_min_sec',    '5',      'Min offline break (sec)'),
  ('presence_offline_max_sec',    '15',     'Max offline break (sec)'),
  ('auto_cooldown_on_rate_limit', 'true',   'Auto-pause on rate limit'),
  ('email_alerts_enabled',        'false',  'Email alerts on events'),
  ('alert_on_ban',                'true',   'Alert on ban'),
  ('alert_on_logout',             'true',   'Alert on logout')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- =============================================================================
-- Verify clean state (these should all be 0 except contacts/templates/accounts)
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM campaigns)          AS campaigns,
  (SELECT COUNT(*) FROM message_queue)      AS message_queue,
  (SELECT COUNT(*) FROM send_logs)          AS send_logs,
  (SELECT COUNT(*) FROM contacts)           AS contacts_kept,
  (SELECT COUNT(*) FROM message_templates WHERE is_archived = false) AS templates_kept,
  (SELECT COUNT(*) FROM wa_accounts WHERE is_archived = false)       AS accounts_kept;
