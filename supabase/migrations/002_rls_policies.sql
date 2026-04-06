-- ============================================
-- WA GTM Project — Row Level Security Policies
-- ============================================

-- 1. Enable RLS on all tables
ALTER TABLE wa_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE baileys_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE baileys_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_logs ENABLE ROW LEVEL SECURITY;

-- 2. Helper: Extract user role from JWT (Moved to public schema)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role')::text,
    'viewer'
  );
$$ LANGUAGE SQL STABLE;

-- 3. wa_accounts policies
-- ============================================

-- SELECT: All authenticated users can view non-archived accounts
CREATE POLICY "accounts_select" ON wa_accounts
    FOR SELECT TO authenticated
    USING (
        public.user_role() IN ('super_admin', 'admin', 'operator', 'viewer')
        AND is_archived = false
    );

-- INSERT: Admin+ can add new accounts
CREATE POLICY "accounts_insert" ON wa_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_role() IN ('super_admin', 'admin')
    );

-- UPDATE: Admin+ can update accounts (edit limits, status changes)
CREATE POLICY "accounts_update" ON wa_accounts
    FOR UPDATE TO authenticated
    USING (
        public.user_role() IN ('super_admin', 'admin')
    )
    WITH CHECK (
        public.user_role() IN ('super_admin', 'admin')
    );

-- 4. baileys_sessions & keys policies
-- ============================================
-- Worker uses service_role key (bypasses RLS). 
-- Block anon/authenticated from direct access.

CREATE POLICY "sessions_deny_all" ON baileys_sessions
    FOR ALL TO authenticated
    USING (false);

CREATE POLICY "keys_deny_all" ON baileys_keys
    FOR ALL TO authenticated
    USING (false);

-- 5. send_logs policies
-- ============================================

-- SELECT: All authenticated users can read logs
CREATE POLICY "logs_select" ON send_logs
    FOR SELECT TO authenticated
    USING (true);

-- INSERT: Operator+ can create log entries
CREATE POLICY "logs_insert" ON send_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_role() IN ('super_admin', 'admin', 'operator')
    );