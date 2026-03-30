-- ============================================
-- WA GTM Project — Row Level Security Policies
-- Run AFTER 001_core_schema.sql
-- ============================================

-- Enable RLS on all tables
ALTER TABLE wa_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE baileys_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE baileys_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper: Extract user role from JWT
-- ============================================
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'viewer'
  );
$$ LANGUAGE SQL STABLE;

-- ============================================
-- wa_accounts policies
-- ============================================

-- SELECT: All authenticated users can view non-archived accounts
CREATE POLICY "accounts_select" ON wa_accounts
    FOR SELECT TO authenticated
    USING (
        auth.user_role() IN ('super_admin', 'admin', 'operator', 'viewer')
        AND is_archived = false
    );

-- INSERT: Admin+ can add new accounts
CREATE POLICY "accounts_insert" ON wa_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.user_role() IN ('super_admin', 'admin')
    );

-- UPDATE: Admin+ can update accounts (edit limits, status changes)
CREATE POLICY "accounts_update" ON wa_accounts
    FOR UPDATE TO authenticated
    USING (
        auth.user_role() IN ('super_admin', 'admin')
    )
    WITH CHECK (
        auth.user_role() IN ('super_admin', 'admin')
    );

-- ============================================
-- baileys_sessions policies
-- Worker uses service_role key (bypasses RLS).
-- No policies needed for authenticated users.
-- ============================================

-- Allow service_role full access (default behavior, no policy needed)
-- Block anon/authenticated from direct access
CREATE POLICY "sessions_deny_all" ON baileys_sessions
    FOR ALL TO authenticated
    USING (false);

-- ============================================
-- baileys_keys policies
-- Same as sessions — worker only via service_role
-- ============================================
CREATE POLICY "keys_deny_all" ON baileys_keys
    FOR ALL TO authenticated
    USING (false);

-- ============================================
-- send_logs policies
-- ============================================

-- SELECT: All authenticated users can read logs
CREATE POLICY "logs_select" ON send_logs
    FOR SELECT TO authenticated
    USING (true);

-- INSERT: Operator+ can create log entries
CREATE POLICY "logs_insert" ON send_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.user_role() IN ('super_admin', 'admin', 'operator')
    );

-- ============================================
-- Super Admin creation helper
-- Run this ONCE to set up initial admin user:
-- 
-- 1. First, create a user via Supabase Dashboard → Authentication → Users → Add User
--    (email: admin@yourdomain.com, password: your-secure-password)
--
-- 2. Then run this SQL, replacing <USER_UUID> with the user's ID:
-- 
-- UPDATE auth.users 
-- SET raw_app_meta_data = raw_app_meta_data || '{"role": "super_admin"}'::jsonb
-- WHERE id = '<USER_UUID>';
-- ============================================
