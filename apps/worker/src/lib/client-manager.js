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
// Realtime reconnect, send_logs writing, and campaign counters.
// ============================================

/** Maximum reconnect attempts before giving up */
const MAX_RETRIES = 8;
/** Base delay for exponential backoff (ms) */
const BASE_DELAY_MS = 3000;
/** Max delay cap (ms) */
const MAX_DELAY_MS = 60000;
/** Realtime resubscribe base delay (ms) — doubles on each failure, capped at 60s */
const REALTIME_RECONNECT_BASE_MS = 5000;
/** Polling fallback interval (ms) */
const POLL_FALLBACK_INTERVAL_MS = 30000;
/** Interval for checking queued campaign messages (ms) */
const CAMPAIGN_CHECK_INTERVAL_MS = 12000;
/**
 * Base delay between individual messages (ms).
 * This is the MINIMUM safe gap. With jitter (0.7x–2.0x) applied on top,
 * actual delay ranges from ~10s to ~30s per message.
 * WhatsApp typically bans accounts sending > 1 msg every 8–10s sustained.
 */
const MESSAGE_DELAY_BASE_MS = 15000;
/** Max messages to process per campaign-runner tick */
const CAMPAIGN_BATCH_SIZE = 5;

/**
 * Status codes that should NOT trigger reconnection.
 * 401 = Logged out (session revoked from phone — must re-pair)
 */
const NON_RECONNECTABLE_CODES = [
  DisconnectReason.loggedOut, // 401
  // 440 (Connection replaced) is NOT here — it's transient when the previous
  // worker process is killed. We reconnect with extra back-off instead.
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
    /** @type {Map<string, NodeJS.Timeout>} Maps account ID → pending reconnect timer (so re-pair can cancel it) */
    this._reconnectTimers = new Map();
    /** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
    this.channel = null;
    /** Monotonic counter — incremented each time we (re)subscribe; lets stale callbacks self-abort */
    this._realtimeGen = 0;
    /** Current backoff delay for Realtime reconnects (ms) */
    this._realtimeBackoffMs = REALTIME_RECONNECT_BASE_MS;
    /** @type {NodeJS.Timeout | null} */
    this.pollTimer = null;
    /** @type {NodeJS.Timeout | null} */
    this.campaignTimer = null;
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

    // 5. Reset any orphaned 'processing' messages left over from a previous crashed worker
    //    They would never be retried otherwise.
    const { count: resetCount } = await this.supabase
      .from('message_queue')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .select('id', { count: 'exact' });
    if (resetCount > 0) {
      this.logger.warn(`Reset ${resetCount} orphaned 'processing' message(s) → 'pending'`);
    }

    // 5b. Daily counter reset — if an account's last_message_at was before today (midnight),
    //     reset messages_sent_today to 0 so the daily limit applies fresh each day.
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const { count: dailyResetCount } = await this.supabase
      .from('wa_accounts')
      .update({ messages_sent_today: 0 })
      .lt('last_message_at', todayMidnight.toISOString())
      .gt('messages_sent_today', 0)
      .select('id', { count: 'exact' });
    if (dailyResetCount > 0) {
      this.logger.info(`Daily reset: cleared messages_sent_today on ${dailyResetCount} account(s)`);
    }

    // 6. Start campaign runner
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

    const gen = ++this._realtimeGen;

    this.channel = this.supabase
      .channel(`wa_accounts_manager_${gen}`)
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
        // Ignore callbacks from stale/replaced subscriptions
        if (gen !== this._realtimeGen) return;

        if (status === 'SUBSCRIBED') {
          this.logger.info('Realtime subscription active');
          this._realtimeBackoffMs = REALTIME_RECONNECT_BASE_MS; // reset backoff on success
          return;
        }

        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || (status === 'CLOSED' && this.isRunning)) {
          const delay = this._realtimeBackoffMs;
          this._realtimeBackoffMs = Math.min(this._realtimeBackoffMs * 2, 60000);
          this.logger.warn(`Realtime ${status}. Polling covers sends. Resubscribing in ${delay / 1000}s...`);
          setTimeout(() => this._subscribeRealtime(), delay);
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
            .update({ pairing_qr: qr, status: 'pairing' })
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
            const retryCount = currentRetries + 1;
            this.retryCounts.set(accountId, retryCount);
            const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount - 1), MAX_DELAY_MS);

            this.logger.info(`${tag} Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${retryCount}/${MAX_RETRIES})...`);

            await this.supabase
              .from('wa_accounts')
              .update({ connection_status: 'reconnecting' })
              .eq('id', accountId);

            // Cancel any existing pending reconnect for this account before scheduling a new one
            if (this._reconnectTimers.has(accountId)) {
              clearTimeout(this._reconnectTimers.get(accountId));
            }
            const timer = setTimeout(async () => {
              this._reconnectTimers.delete(accountId);
              if (!this.isRunning) return;

              // Re-fetch account to check if it's been archived or re-paired
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
            this._reconnectTimers.set(accountId, timer);
          } else {
            // Give up — mark as disconnected
            const reason = isNonReconnectable
              ? `Non-reconnectable status (${statusCode})`
              : `Max retries (${MAX_RETRIES}) exceeded`;
            this.logger.warn(`${tag} ${reason}. Not reconnecting.`);

            this.retryCounts.delete(accountId);
            // Remove from active socket map so campaign runner doesn't try to use it
            this.sockets.delete(accountId);

            await this.supabase
              .from('wa_accounts')
              .update({
                status: 'disconnected',
                connection_status: 'disconnected',
                pairing_qr: null,
              })
              .eq('id', accountId);
          }
        }
      });

      // ---- Save Credentials on Update ----
      sock.ev.on('creds.update', saveCreds);

      // ---- Incoming Message Handler ----
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.key.remoteJid) continue;

          // Skip broadcast / status updates
          if (msg.key.remoteJid === 'status@broadcast') continue;

          const contactPhone = msg.key.remoteJid
            .replace('@s.whatsapp.net', '')
            .replace('@g.us', '');

          // Extract text body from any message type
          const body = this._extractMessageBody(msg);
          const msgType = msg.message ? Object.keys(msg.message)[0] || 'text' : 'text';
          const ts = new Date((Number(msg.messageTimestamp) || Date.now() / 1000) * 1000).toISOString();

          // Persist to wa_messages for the Inbox feature (non-fatal if table missing)
          try {
            await this.supabase.from('wa_messages').upsert({
              account_id: accountId,
              wa_message_id: msg.key.id,
              remote_jid: msg.key.remoteJid,
              contact_phone: contactPhone,
              from_me: msg.key.fromMe || false,
              body: body || null,
              message_type: msgType,
              status: msg.key.fromMe ? 'sent' : 'received',
              timestamp: ts,
            }, { onConflict: 'wa_message_id', ignoreDuplicates: true });
          } catch {
            // Table may not exist yet — non-fatal, run migration 006 to enable Inbox
          }

          // Only process inbound for reply tracking
          if (!msg.key.fromMe) {
            this.logger.debug(`${tag} Received message from ${contactPhone}`);

            try {
              const { error: rpcErr } = await this.supabase.rpc('increment_contact_reply', { p_phone: contactPhone });
              if (rpcErr) {
                this.supabase
                  .from('contacts')
                  .select('total_replies')
                  .eq('phone', contactPhone)
                  .single()
                  .then(({ data }) => {
                    if (data) {
                      this.supabase
                        .from('contacts')
                        .update({ total_replies: (data.total_replies || 0) + 1 })
                        .eq('phone', contactPhone);
                    }
                  });
              }
            } catch {
              // Non-fatal
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
    // Cancel any pending reconnect timer
    if (this._reconnectTimers.has(accountId)) {
      clearTimeout(this._reconnectTimers.get(accountId));
      this._reconnectTimers.delete(accountId);
    }

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
    // Cancel any pending reconnect so it doesn't reinit with stale/deleted auth
    if (this._reconnectTimers.has(accountId)) {
      clearTimeout(this._reconnectTimers.get(accountId));
      this._reconnectTimers.delete(accountId);
    }
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
   * Polls message_queue every 10s for pending messages and sends them
   * through the appropriate connected Baileys socket.
   */
  _startCampaignRunner() {
    if (!this.isRunning) return;

    this.campaignTimer = setInterval(async () => {
      // Check master kill switch
      if (this.systemConfig.global_send_enabled === false) {
        this.logger.debug('Campaign runner: global_send_enabled=false, skipping tick');
        return;
      }

      try {
        // Fetch pending messages that have an assigned account
        // Only pick up messages whose assigned account has an active socket
        const activeAccountIds = Array.from(this.sockets.keys());
        if (activeAccountIds.length === 0) {
          this.logger.debug('Campaign runner: no active sockets, skipping tick');
          return;
        }

        // Auto-assign any unassigned pending messages to available accounts (round-robin)
        const { data: unassigned } = await this.supabase
          .from('message_queue')
          .select('id')
          .eq('status', 'pending')
          .is('assigned_account_id', null)
          .lte('scheduled_for', new Date().toISOString())
          .limit(50);
        if (unassigned && unassigned.length > 0) {
          for (let i = 0; i < unassigned.length; i++) {
            const assignedId = activeAccountIds[i % activeAccountIds.length];
            await this.supabase
              .from('message_queue')
              .update({ assigned_account_id: assignedId })
              .eq('id', unassigned[i].id)
              .is('assigned_account_id', null); // guard against race
          }
          this.logger.info(`Campaign runner: Auto-assigned ${unassigned.length} unassigned message(s)`);
        }

        const { data: messages, error } = await this.supabase
          .from('message_queue')
          .select('*')
          .eq('status', 'pending')
          .in('assigned_account_id', activeAccountIds)
          .lte('scheduled_for', new Date().toISOString())
          .order('created_at', { ascending: true })
          .limit(CAMPAIGN_BATCH_SIZE);

        if (error) {
          this.logger.debug({ error: error.message }, 'Campaign runner: query error');
          return;
        }

        if (!messages || messages.length === 0) return;

        this.logger.info(`Campaign runner: Processing ${messages.length} queued message(s)`);

        for (const msg of messages) {
          if (!this.isRunning) break;

          const accountId = msg.assigned_account_id;
          const socketEntry = this.sockets.get(accountId);

          if (!socketEntry) {
            this.logger.warn(`Campaign runner: No active/healthy socket for account ${accountId}, skipping msg ${msg.id}`);
            continue;
          }

          // Claim the message with optimistic lock — VERIFY the claim succeeded
          const { data: lockData } = await this.supabase
            .from('message_queue')
            .update({ status: 'processing' })
            .eq('id', msg.id)
            .eq('status', 'pending')
            .select('id');

          if (!lockData || lockData.length === 0) {
            this.logger.debug(`Campaign runner: Message ${msg.id} already claimed by another process, skipping`);
            continue;
          }

          // Transition campaign from 'scheduled' → 'active' on first message pickup
          if (msg.campaign_id) {
            await this.supabase
              .from('campaigns')
              .update({ status: 'active' })
              .eq('id', msg.campaign_id)
              .eq('status', 'scheduled');
          }

          const sendStart = Date.now();

          try {
            // Format the JID
            const jid = msg.recipient_phone.includes('@')
              ? msg.recipient_phone
              : `${msg.recipient_phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

            // Resolve the final message body:
            // 1. Use message_body if already resolved (e.g., from direct API)
            // 2. Otherwise parse Spintax from message_template
            const rawBody = msg.message_body || msg.message_template || '';
            const finalBody = this._parseSpintax(rawBody);

            if (!finalBody) {
              throw new Error('Empty message body after Spintax resolution');
            }

            // Simulate composing presence (anti-ban: "typing..." indicator)
            const composingMin = this.systemConfig.presence_composing_min_sec || 4;
            const composingMax = this.systemConfig.presence_composing_max_sec || 9;
            const composingDuration = (composingMin + Math.random() * (composingMax - composingMin)) * 1000;

            try {
              await socketEntry.sock.sendPresenceUpdate('composing', jid);
              await new Promise((r) => setTimeout(r, composingDuration));
              await socketEntry.sock.sendPresenceUpdate('paused', jid);
            } catch {
              // Presence simulation is non-fatal
            }

            // Send the message
            const sentResult = await socketEntry.sock.sendMessage(jid, { text: finalBody });

            const latencyMs = Date.now() - sendStart;

            // Persist outbound message to wa_messages for Inbox feature (non-fatal)
            try {
              await this.supabase.from('wa_messages').upsert({
                account_id: accountId,
                wa_message_id: sentResult?.key?.id || null,
                remote_jid: jid,
                contact_phone: jid.replace('@s.whatsapp.net', '').replace('@g.us', ''),
                from_me: true,
                body: finalBody,
                message_type: 'text',
                status: 'sent',
                timestamp: new Date().toISOString(),
              }, { onConflict: 'wa_message_id', ignoreDuplicates: true });
            } catch {
              // Table may not exist yet — non-fatal, run migration 006 to enable Inbox
            }

            // Mark queue item as sent
            await this.supabase
              .from('message_queue')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                attempt_count: (msg.attempt_count || 0) + 1,
              })
              .eq('id', msg.id);

            // Write send_log
            await this.supabase.from('send_logs').insert({
              queue_item_id: msg.id,
              account_id: accountId,
              campaign_id: msg.campaign_id || null,
              variant_id: msg.variant_id || null,
              status: 'sent',
              latency_ms: latencyMs,
            });

            // Increment daily counter on account
            await this.supabase.rpc('increment_messages_sent_today', { p_account_id: accountId });

            // Increment campaign sent counter + check for completion
            if (msg.campaign_id) {
              const { error: rpcErr } = await this.supabase.rpc('increment_campaign_sent', { p_campaign_id: msg.campaign_id });
              if (rpcErr) this.logger.error({ err: rpcErr }, 'Failed to increment campaign sent counter');
              // Check if campaign is now complete (no more pending/processing items)
              const { count: remainingCount } = await this.supabase
                .from('message_queue')
                .select('id', { count: 'exact', head: true })
                .eq('campaign_id', msg.campaign_id)
                .in('status', ['pending', 'processing']);
              if (remainingCount === 0) {
                await this.supabase
                  .from('campaigns')
                  .update({ status: 'completed' })
                  .eq('id', msg.campaign_id)
                  .in('status', ['active', 'scheduled']);
                this.logger.info(`Campaign runner: Campaign ${msg.campaign_id} marked completed`);
              }
            }

            this.logger.info(`Campaign runner: ✅ Sent msg ${msg.id} via account ${accountId} (${latencyMs}ms)`);

            // Rate-limit jitter delay between messages
            const jitterMin = this.systemConfig.jitter_min || 0.7;
            const jitterMax = this.systemConfig.jitter_max || 2.0;
            const delay = MESSAGE_DELAY_BASE_MS * (Math.random() * (jitterMax - jitterMin) + jitterMin);

            // Randomly go "offline" after some messages to simulate human breaks (anti-ban)
            if (Math.random() < 0.15) {
              const offlineBreak = 30000 + Math.random() * 60000; // 30–90 second break
              this.logger.info(`Campaign runner: Taking a random ${(offlineBreak / 1000).toFixed(0)}s break (human simulation)`);
              try { await socketEntry.sock.sendPresenceUpdate('unavailable'); } catch {}
              await new Promise((r) => setTimeout(r, offlineBreak));
              try { await socketEntry.sock.sendPresenceUpdate('available'); } catch {}
            } else {
              await new Promise((r) => setTimeout(r, delay));
            }

          } catch (sendErr) {
            const latencyMs = Date.now() - sendStart;
            const newAttemptCount = (msg.attempt_count || 0) + 1;
            const maxAttempts = msg.max_attempts || 3;
            const exhausted = newAttemptCount >= maxAttempts;

            this.logger.error(
              { err: sendErr, msgId: msg.id, attempt: newAttemptCount },
              `Campaign runner: ❌ Failed to send message`
            );

            // Update queue item
            await this.supabase
              .from('message_queue')
              .update({
                status: exhausted ? 'failed' : 'pending',
                attempt_count: newAttemptCount,
                error_message: sendErr.message || 'Send failed',
              })
              .eq('id', msg.id);

            // Write failure log
            await this.supabase.from('send_logs').insert({
              queue_item_id: msg.id,
              account_id: accountId,
              campaign_id: msg.campaign_id || null,
              variant_id: msg.variant_id || null,
              status: 'failed',
              error_message: sendErr.message || 'Send failed',
              latency_ms: latencyMs,
            });

            // Increment campaign failed counter (only on final failure) + check for completion
            if (exhausted && msg.campaign_id) {
              const { error: rpcErr } = await this.supabase.rpc('increment_campaign_failed', { p_campaign_id: msg.campaign_id });
              if (rpcErr) this.logger.error({ err: rpcErr }, 'Failed to increment campaign failed counter');
              // Check if campaign is now complete
              const { count: remainingCount } = await this.supabase
                .from('message_queue')
                .select('id', { count: 'exact', head: true })
                .eq('campaign_id', msg.campaign_id)
                .in('status', ['pending', 'processing']);
              if (remainingCount === 0) {
                await this.supabase
                  .from('campaigns')
                  .update({ status: 'completed' })
                  .eq('id', msg.campaign_id)
                  .in('status', ['active', 'scheduled']);
              }
            }

            // If error is 'Connection Closed', the socket is likely dead — break loop
            if (sendErr.message?.includes('Connection Closed') || sendErr.message?.includes('Timed Out')) {
              this.logger.warn(`Campaign runner: Socket appears dead for ${accountId}, breaking batch to allow reconnect`);
              break;
            }

            // Small delay even on failure before next attempt
            await new Promise((r) => setTimeout(r, 3000));
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
   */
  _startPolling() {
    if (!this.isRunning) return;

    this.pollTimer = setInterval(async () => {
      this.logger.debug('Polling database for account updates (fallback)...');

      // Refresh system config
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
   */
  async syncAccount(account, socketEntry) {
    // Case A: New account (not in our map)
    if (!socketEntry) {
      this.logger.info(`Sync: New account detected: ${account.display_name}`);
      this.retryCounts.set(account.id, 0);
      await this.initSocket(account);
      return;
    }

    // Case B: Re-pair triggered (status changed to 'pairing')
    if (account.status === 'pairing' && account.connection_status === 'disconnected' && !account.pairing_qr) {
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
   * Keys are stored as JSONB values in system_config table.
   */
  async _loadSystemConfig() {
    try {
      const { data, error } = await this.supabase.from('system_config').select('*');
      if (error) throw error;

      const config = {};
      for (const row of data) {
        // JSONB values: strings come wrapped in quotes, numbers are plain
        let val = row.value;
        // If it's a JSON-encoded string like '"Asia/Kolkata"', parse it
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch { /* keep as string */ }
        }
        config[row.key] = val;
      }

      this.systemConfig = config;
      this.logger.debug('System config loaded/refreshed.');
    } catch (err) {
      this.logger.error({ err }, 'Failed to load system config');
    }
  }

  /**
   * Parses Spintax formatted strings: {opt1|opt2|opt3}
   * Also resolves [Variable] placeholders with a generic fallback.
   */
  _parseSpintax(text) {
    if (!text) return '';
    let result = text.replace(/{([^{}]+)}/g, (_match, group) => {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
    return result;
  }

  /**
   * Extracts a human-readable text body from any Baileys message object.
   * Handles text, extended text, images/videos (caption), documents, audio, stickers.
   */
  _extractMessageBody(msg) {
    const m = msg.message;
    if (!m) return null;
    return (
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      m.buttonsResponseMessage?.selectedDisplayText ||
      m.listResponseMessage?.title ||
      m.templateButtonReplyMessage?.selectedDisplayText ||
      (m.imageMessage   ? '[Image]'                                              : null) ||
      (m.videoMessage   ? '[Video]'                                              : null) ||
      (m.audioMessage   ? '[Voice message]'                                      : null) ||
      (m.documentMessage ? `[Document: ${m.documentMessage.fileName || 'file'}]` : null) ||
      (m.stickerMessage ? '[Sticker]'                                            : null) ||
      (m.locationMessage ? '[Location]'                                          : null) ||
      (m.contactMessage  ? `[Contact: ${m.contactMessage.displayName}]`          : null) ||
      null
    );
  }
}
