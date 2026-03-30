/**
 * @typedef {Object} WaAccount
 * @property {string} id - UUID primary key
 * @property {string} phone_number - E.164 format phone number
 * @property {string} display_name - Human-readable label
 * @property {number} daily_limit - Max messages per day
 * @property {'pairing' | 'active' | 'disconnected' | 'banned'} status
 * @property {'connected' | 'disconnected' | 'connecting'} connection_status
 * @property {string | null} pairing_qr - QR code string for live pairing
 * @property {boolean} is_archived - Soft delete flag
 * @property {Object | null} session_data - Baileys creds snapshot
 * @property {number} messages_sent_today
 * @property {string | null} last_connected_at - ISO timestamp
 * @property {string} created_at - ISO timestamp
 * @property {string} updated_at - ISO timestamp
 */

/**
 * @typedef {'super_admin' | 'admin' | 'operator' | 'viewer'} UserRole
 */

/**
 * @typedef {'pairing' | 'active' | 'disconnected' | 'banned'} AccountStatus
 */

/**
 * @typedef {'connected' | 'disconnected' | 'connecting'} ConnectionStatus
 */

/**
 * @typedef {Object} CreateAccountPayload
 * @property {string} phone_number
 * @property {string} [display_name]
 * @property {number} [daily_limit]
 */

/**
 * @typedef {Object} UpdateAccountPayload
 * @property {string} [display_name]
 * @property {number} [daily_limit]
 */

export {};
