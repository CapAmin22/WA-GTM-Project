import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs/promises';
import path from 'path';

// ============================================
// Client Manager — Dynamic WhatsApp Account Scaling
// Production-grade with exponential backoff, max retries,
// Realtime reconnect, and proper disconnect handling.
// ============================================

/** Maximum reconnect attempts before giving up */
const MAX_RETRIES = 5;
/** Base delay for exponential backoff (ms) */
const BASE_DELAY_MS = 3000;
/** Max delay cap (ms) */
const MAX_DELAY_MS = 60000;
/** Realtime resubscribe delay (ms) */
const REALTIME_RECONNECT_DELAY_MS = 5000;
/** Polling fallback interval (ms) — backup for when Realtime fails */
const POLL_FALLBACK_INTERVAL_MS = 30000;
/** Interval for checking queued campaign messages (ms) */
const CAMPAIGN_CHECK_INTERVAL_MS = 10000;
/** Delay between individual messages in a campaign (ms) to avoid bans */
const MESSAGE_DELAY_BASE_MS = 5000;

/**
 * Status codes that should NOT trigger reconnection.
 * 401 = Logged out
 * 440 = Connection replaced (another device took over)
 * 515 = Restart required (QR expired without scan)
 */
const NON_RECONNECTABLE_CODES = [
  DisconnectReason.loggedOut,    // 401
  440,                           // Connection replaced
];

export class ClientManager {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase
   * @param {import('pino').Logger} logger
   */
  constructor(supabase, logger) {
    this.supabase = supabase;
    this.logger = logger;
    /** @type {Map<string, object>} Maps account ID → { sock, cleanup } */
    this.sockets = new Map();
    /** @type {Map<string, number>} Maps account ID → retry count */
    this.retryCounts = new Map();
    /** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
    this.channel = null;
    /** @type {NodeJS.Timeout | null} */
    this.pollTimer = null;
    /** @type {boolean} Whether the manager is running */
    this.isRunning = false;
    /** @type {object} System configuration fetched from DB */
    this.systemConfig = {};
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Start the client manager:
   * 1. Fetch all active (non-archived) accounts
   * 2. Initialize Baileys socket for each
   * 3. Subscribe to Realtime for dynamic scaling
   */
  async start() {
    this.isRunning = true;

    // Load initial config
    await this._loadSystemConfig();

    // 1. Fetch existing accounts
    const { data: accounts, error } = await this.supabase
      .from('wa_accounts')
      .select('*')
      .eq('is_archived', false);

    if (error) {
      throw new Error(`Failed to fetch accounts: ${error.message}`);
    }

    this.logger.info(`Found ${accounts?.length || 0} active accounts`);

    // 2. Initialize sockets for each account
    if (accounts && accounts.length > 0) {
      for (const acc of accounts) {
        try {
          await this.initSocket(acc);
        } catch (err) {
          this.logger.error({ err, accountId: acc.id }, `Failed to init socket for ${acc.display_name}`);
        }
      }
    }

    // 3. Subscribe to Realtime for dynamic scaling
    this._subscribeRealtime();

    // 4. Start polling fallback (backup)
    this._startPolling();

    // 5. Start campaign runner
    this._startCampaignRunner();
  }

  /**
   * Subscribe to Supabase Realtime for INSERT/UPDATE events.
   * Auto-reconnects on timeout or close.
   */
  _subscribeRealtime() {
    if (!this.isRunning) return;

    // Clean up existing channel if any
    if (this.channel) {
      this.supabase.removeChannel(this.channel).catch(() => {});
      this.channel = null;
    }

    this.channel = this.supabase
      .channel('wa_accounts_manager')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_accounts' },
        (payload) => this.handleAccountInsert(payload)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_accounts' },
        (payload) => this.handleAccountUpdate(payload)
      )
      .subscribe((status, err) => {
        this.logger.info(`Realtime subscription status: ${status}`);

        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          this.logger.warn(`Realtime ${status}. Resubscribing in ${REALTIME_RECONNECT_DELAY_MS / 1000}s...`);
          setTimeout(() => this._subscribeRealtime(), REALTIME_RECONNECT_DELAY_MS);
        }

        if (status === 'CLOSED' && this.isRunning) {
          this.logger.warn('Realtime channel closed unexpectedly. Resubscribing...');
          setTimeout(() => this._subscribeRealtime(), REALTIME_RECONNECT_DELAY_MS);
        }

        if (err) {
          this.logger.error({ err }, 'Realtime subscription error');
        }
      });
  }

  /**
   * Gracefully stop all sockets and unsubscribe from Realtime.
   */
  async stop() {
    this.isRunning = false;
    this.logger.info('Stopping all WhatsApp sockets...');

    // Unsubscribe from Realtime
    if (this.channel) {
      await this.supabase.removeChannel(this.channel).catch(() => {});
      this.channel = null;
    }

    // Stop polling
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Stop campaign runner
    if (this.campaignTimer) {
        clearInterval(this.campaignTimer);
        this.campaignTimer = null;
    }

    // Terminate all sockets
    const promises = [];
    for (const [accountId] of this.sockets) {
      promises.push(this.terminateSocket(accountId));
    }
    await Promise.allSettled(promises);

    // Clear retry counts
    this.retryCounts.clear();

    this.logger.info('All sockets stopped');
  }

  // ============================================
  // Socket Management
  // ============================================

  /**
   * Initialize a Baileys WebSocket for a single WhatsApp account.
   * @param {object} account - The wa_accounts row
   */
  async initSocket(account) {
    const accountId = account.id;
    const tag = `[${account.display_name}/${account.phone_number}]`;

    // Terminate existing socket if any
    if (this.sockets.has(accountId)) {
      await this.terminateSocket(accountId);
    }

    this.logger.info(`${tag} Initializing WhatsApp socket...`);

    // Update status to connecting
    await this.supabase
      .from('wa_accounts')
      .update({ connection_status: 'connecting' })
      .eq('id', accountId);

    try {
      // Use file-based auth state
      const authDir = `./auth_info_${accountId}`;
      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      // Get latest Baileys version
      const { version } = await fetchLatestBaileysVersion();

      // Create WhatsApp socket
      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['WA GTM Engine', 'Chrome', '22.0'],
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 30000,
        retryRequestDelayMs: 2000,
      });

      // ---- Connection Update Handler ----
      sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        // Push QR code to Supabase → Dashboard renders it
        if (qr) {
          this.logger.info(`${tag} QR code generated, pushing to database`);
          await this.supabase
            .from('wa_accounts')
            .update({ pairing_qr: qr })
            .eq('id', accountId);
        }

        // Connection opened successfully
        if (connection === 'open') {
          this.logger.info(`${tag} ✅ Connected to WhatsApp!`);
          // Reset retry count on successful connection
          this.retryCounts.set(accountId, 0);
          await this.supabase
            .from('wa_accounts')
            .update({
              pairing_qr: null,
              status: 'active',
              connection_status: 'connected',
              last_connected_at: new Date().toISOString(),
            })
            .eq('id', accountId);
        }

        // Connection closed
        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error instanceof Boom)
            ? lastDisconnect.error.output.statusCode
            : 500;

          const isNonReconnectable = NON_RECONNECTABLE_CODES.includes(statusCode);
          const currentRetries = this.retryCounts.get(accountId) || 0;
          const shouldReconnect = !isNonReconnectable && currentRetries < MAX_RETRIES && this.isRunning;

          this.logger.warn(
            `${tag} Connection closed. Status: ${statusCode}. Retries: ${currentRetries}/${MAX_RETRIES}. Reconnect: ${shouldReconnect}`
          );

          // Remove from active sockets
          this.sockets.delete(accountId);

          if (shouldReconnect) {
            // Exponential backoff: 3s, 6s, 12s, 24s, 48s (capped at 60s)
            const retryCount = currentRetries + 1;
            this.retryCounts.set(accountId, retryCount);
            const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount - 1), MAX_DELAY_MS);

            this.logger.info(`${tag} Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${retryCount}/${MAX_RETRIES})...`);

            await this.supabase
              .from('wa_accounts')
              .update({ connection_status: 'connecting' })
              .eq('id', accountId);

            setTimeout(async () => {
              if (!this.isRunning) return;

              // Re-fetch account to check if it's been archived
              const { data: current } = await this.supabase
                .from('wa_accounts')
                .select('*')
                .eq('id', accountId)
                .eq('is_archived', false)
                .single();

              if (current) {
                await this.initSocket(current);
              }
            }, delay);
          } else {
            // Give up — mark as disconnected
            const reason = isNonReconnectable
              ? `Non-reconnectable status (${statusCode})`
              : `Max retries (${MAX_RETRIES}) exceeded`;
            this.logger.warn(`${tag} ${reason}. Not reconnecting.`);

            this.retryCounts.delete(accountId);

            await this.supabase
              .from('wa_accounts')
              .update({
                status: statusCode === DisconnectReason.loggedOut ? 'disconnected' : 'disconnected',
                connection_status: 'disconnected',
                pairing_qr: null,
              })
              .eq('id', accountId);
          }
        }
      });

      // ---- Save Credentials on Update ----
      sock.ev.on('creds.update', saveCreds);

      // ---- Message Handler ----
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
          for (const msg of messages) {
            if (!msg.key.fromMe) {
              this.logger.debug(
                `${tag} Received message from ${msg.key.remoteJid}`
              );
            }
          }
        }
      });

      // Store the socket reference
      this.sockets.set(accountId, { sock, saveCreds });
      this.logger.info(`${tag} Socket initialized (total active: ${this.sockets.size})`);
    } catch (err) {
      this.logger.error({ err }, `${tag} Failed to initialize socket`);
      await this.supabase
        .from('wa_accounts')
        .update({
          status: 'disconnected',
          connection_status: 'disconnected',
        })
        .eq('id', accountId);
    }
  }

  /**
   * Gracefully terminate a Baileys socket for a specific account.
   * @param {string} accountId
   */
  async terminateSocket(accountId) {
    const entry = this.sockets.get(accountId);
    if (!entry) return;

    this.logger.info(`Terminating socket for account ${accountId}`);

    try {
      entry.sock.end();
    } catch {
      // Socket might already be closed
    }

    this.sockets.delete(accountId);
    this.retryCounts.delete(accountId);

    await this.supabase
      .from('wa_accounts')
      .update({ connection_status: 'disconnected' })
      .eq('id', accountId);
  }

  /**
   * Clear auth files for a specific account (used on re-pair).
   * @param {string} accountId
   */
  async clearAuthFiles(accountId) {
    const authDir = path.resolve(`./auth_info_${accountId}`);
    try {
      await fs.rm(authDir, { recursive: true, force: true });
      this.logger.info(`Cleared auth files: ${authDir}`);
    } catch {
      // Directory may not exist
    }
  }

  // ============================================
  // Campaign Runner
  // ============================================

  /**
   * Start the campaign message dispatcher.
   * Periodically checks for queued messages in `campaign_messages` and sends
   * them through the appropriate connected Baileys socket.
   */
  _startCampaignRunner() {
    if (!this.isRunning) return;

    this.campaignTimer = setInterval(async () => {
      try {
        // Fetch queued messages
        const { data: messages, error } = await this.supabase
          .from('campaign_messages')
          .select('*, wa_accounts!inner(id, phone_number, display_name)')
          .eq('status', 'queued')
          .order('created_at', { ascending: true })
          .limit(10);

        if (error) {
          this.logger.debug({ error: error.message }, 'Campaign runner: no messages or table not ready');
          return;
        }

        if (!messages || messages.length === 0) return;

        this.logger.info(`Campaign runner: Processing ${messages.length} queued message(s)`);

        for (const msg of messages) {
          const accountId = msg.account_id;
          const socketEntry = this.sockets.get(accountId);

          if (!socketEntry) {
            this.logger.warn(`Campaign runner: No active socket for account ${accountId}, skipping`);
            // Mark as failed — no socket available
            await this.supabase
              .from('campaign_messages')
              .update({ status: 'failed', error_message: 'No active WhatsApp socket' })
              .eq('id', msg.id);
            continue;
          }

          try {
            // Format the JID (add @s.whatsapp.net if not present)
            const jid = msg.recipient_phone.includes('@')
              ? msg.recipient_phone
              : `${msg.recipient_phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

            // Parse Spintax before sending
            const finalMessageBody = this._parseSpintax(msg.message_body);
            
            // Send the message
            await socketEntry.sock.sendMessage(jid, { text: finalMessageBody });

            // Mark as sent
            await this.supabase
              .from('campaign_messages')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
              })
              .eq('id', msg.id);

            // Update daily counter
            await this.supabase.rpc('increment_messages_sent_today', {
              p_account_id: accountId,
            });

            this.logger.info(`Campaign runner: Sent message ${msg.id} via account ${accountId}`);

            // Calculate delay based on system_config
            const baseDelay = MESSAGE_DELAY_BASE_MS;
            const jitterMin = this.systemConfig.jitter_min || 0.8;
            const jitterMax = this.systemConfig.jitter_max || 1.2;
            const delay = baseDelay * (Math.random() * (jitterMax - jitterMin) + jitterMin);

            // Rate-limit: wait between messages to avoid bans
            await new Promise((r) => setTimeout(r, delay));
          } catch (sendErr) {
            this.logger.error({ err: sendErr }, `Campaign runner: Failed to send message ${msg.id}`);
            await this.supabase
              .from('campaign_messages')
              .update({
                status: 'failed',
                error_message: sendErr.message || 'Send failed',
              })
              .eq('id', msg.id);
          }
        }
      } catch (err) {
        this.logger.error({ err }, 'Campaign runner: Unexpected error');
      }
    }, CAMPAIGN_CHECK_INTERVAL_MS);
  }

  // ============================================
  // Dynamic Scaling (Realtime + Polling)
  // ============================================

  /**
   * Start polling fallback — periodically checks Supabase for changes.
   * This ensures reliability if Realtime subscriptions time out.
   */
  _startPolling() {
    if (!this.isRunning) return;

    this.pollTimer = setInterval(async () => {
      this.logger.debug('Polling database for account updates (fallback)...');
      
      // Update system config
      await this._loadSystemConfig();
      
      try {
        const { data: accounts, error } = await this.supabase
          .from('wa_accounts')
          .select('*')
          .eq('is_archived', false);

        if (error) throw error;

        // Sync local sockets with DB state
        const dbIds = new Set(accounts.map((a) => a.id));

        // 1. Remove sockets for accounts no longer in DB (or recently archived)
        for (const accountId of this.sockets.keys()) {
          if (!dbIds.has(accountId)) {
            this.logger.info(`Polling: Account ${accountId} no longer active. Terminating.`);
            await this.terminateSocket(accountId);
          }
        }

        // 2. Init or Update sockets for active accounts
        for (const account of accounts) {
          const socketEntry = this.sockets.get(account.id);
          await this.syncAccount(account, socketEntry);
        }
      } catch (err) {
        this.logger.error({ err }, 'Polling failed');
      }
    }, POLL_FALLBACK_INTERVAL_MS);
  }

  /**
   * Sync a single account's database state with its local socket.
   * @param {object} account - The wa_accounts row
   * @param {object} socketEntry - The existing socket map entry (optional)
   */
  async syncAccount(account, socketEntry) {
    // case A: New account added (not in our map)
    if (!socketEntry) {
      this.logger.info(`Sync: New account detected: ${account.display_name}`);
      this.retryCounts.set(account.id, 0);
      await this.initSocket(account);
      return;
    }

    // Case B: Re-pair triggered (status changed to pairing)
    // socketEntry is an object with { sock, saveCreds }, we check DB 'status'
    // Note: We only re-init if the DB status is 'pairing' BUT the local socket
    // might still be 'active' or 'disconnected' from previously.
    // However, the worker sets connection_status, not 'status'.
    // We rely on the DB 'status' as the intent signal.
    if (account.status === 'pairing' && account.connection_status === 'disconnected' && !account.pairing_qr) {
      // This is a subtle check: if status is 'pairing' but we aren't currently
      // showing a QR and aren't connected, it means we should probably re-init.
      // But specifically handle the "Re-pair" click which sets status='pairing'
      // and pairing_qr=null.
      this.logger.info(`Sync: Re-pair signal for ${account.display_name}`);
      await this.clearAuthFiles(account.id);
      this.retryCounts.set(account.id, 0);
      await this.initSocket(account);
    }
  }

  /**
   * Handle INSERT event: New account added from Dashboard.
   */
  async handleAccountInsert(payload) {
    const account = payload.new;
    this.logger.info(`🆕 Realtime: New account: ${account.display_name}`);
    await this.syncAccount(account, null);
  }

  /**
   * Handle UPDATE event: Account modified from Dashboard.
   */
  async handleAccountUpdate(payload) {
    const account = payload.new;

    // Account archived
    if (account.is_archived) {
      this.logger.info(`🗑️ Realtime: Account archived: ${account.display_name}`);
      await this.terminateSocket(account.id);
      await this.clearAuthFiles(account.id);
      return;
    }

    // Sync other updates
    await this.syncAccount(account, this.sockets.get(account.id));
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Load system configuration from DB.
   */
  async _loadSystemConfig() {
    try {
      const { data, error } = await this.supabase.from('system_config').select('*');
      if (error) throw error;
      
      const config = {};
      data.forEach(r => {
        let val = r.value;
        if (r.key.includes('limit') || r.key.includes('sec') || r.key.includes('jitter')) {
            val = Number(val);
        } else if (val === 'true') {
            val = true;
        } else if (val === 'false') {
            val = false;
        }
        config[r.key] = val;
      });
      
      this.systemConfig = config;
      this.logger.debug('System config loaded/refreshed.');
    } catch (err) {
      this.logger.error({ err }, 'Failed to load system config');
    }
  }

  /**
   * Parses Spintax formatted strings like "Hi {John|Mary}, {how are you|how do you do}?"
   */
  _parseSpintax(text) {
    if (!text) return '';
    const spintaxRegex = /{([^{}]+)}/g;
    return text.replace(spintaxRegex, (match, p1) => {
      const options = p1.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
  }
}
