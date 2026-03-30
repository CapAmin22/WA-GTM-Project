/** Account status enum */
export const ACCOUNT_STATUS = Object.freeze({
  PAIRING: 'pairing',
  ACTIVE: 'active',
  DISCONNECTED: 'disconnected',
  BANNED: 'banned',
});

/** Connection status enum */
export const CONNECTION_STATUS = Object.freeze({
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
});

/** User role enum (hierarchical: super_admin > admin > operator > viewer) */
export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
});

/** Role hierarchy for permission checks */
export const ROLE_HIERARCHY = Object.freeze({
  super_admin: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
});

/** Default daily message limit for new accounts */
export const DEFAULT_DAILY_LIMIT = 200;

/** Realtime channel name for account management */
export const REALTIME_CHANNEL_ACCOUNTS = 'wa_accounts_manager';

/** Supabase table names */
export const TABLES = Object.freeze({
  WA_ACCOUNTS: 'wa_accounts',
  BAILEYS_SESSIONS: 'baileys_sessions',
  BAILEYS_KEYS: 'baileys_keys',
  SEND_LOGS: 'send_logs',
});

/**
 * Check if a role has sufficient permissions
 * @param {string} userRole - The user's current role
 * @param {string} requiredRole - The minimum role required
 * @returns {boolean}
 */
export function hasPermission(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}
