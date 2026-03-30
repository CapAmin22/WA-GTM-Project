import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';

// ============================================
// Client Manager — Dynamic WhatsApp Account Scaling
// ============================================

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
    /** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
    this.channel = null;
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
      .subscribe((status) => {
        this.logger.info(`Realtime subscription status: ${status}`);
      });
  }

  /**
   * Gracefully stop all sockets and unsubscribe from Realtime.
   */
  async stop() {
    this.logger.info('Stopping all WhatsApp sockets...');

    // Unsubscribe from Realtime
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    // Terminate all sockets
    const promises = [];
    for (const [accountId] of this.sockets) {
      promises.push(this.terminateSocket(accountId));
    }
    await Promise.allSettled(promises);

    this.logger.info('All sockets stopped');
  }

  // ============================================
  // Socket Management
  // ============================================

  /**
   * Initialize a Baileys WebSocket for a single WhatsApp account.
   * - Uses file-based auth state (stored in ./auth_info_<accountId>/)
   * - Pushes QR codes to Supabase for the Dashboard to render
   * - Handles connection lifecycle (open, close, reconnect)
   *
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
      // Use file-based auth state (simpler than DB-backed for now)
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
        printQRInTerminal: false, // We push QR to DB instead
        logger: pino({ level: 'silent' }),
        browser: ['WA GTM Engine', 'Chrome', '22.0'],
        generateHighQualityLinkPreview: false,
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

          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.warn(
            `${tag} Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`
          );

          // Remove from active sockets
          this.sockets.delete(accountId);

          if (shouldReconnect) {
            // Reconnect with exponential backoff
            const delay = Math.min(5000 * Math.pow(2, 0), 30000);
            this.logger.info(`${tag} Reconnecting in ${delay / 1000}s...`);

            await this.supabase
              .from('wa_accounts')
              .update({ connection_status: 'connecting' })
              .eq('id', accountId);

            setTimeout(async () => {
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
            // Logged out — mark as disconnected
            this.logger.warn(`${tag} Logged out. Not reconnecting.`);
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

      // ---- Message Handler (log incoming messages if needed) ----
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

    await this.supabase
      .from('wa_accounts')
      .update({ connection_status: 'disconnected' })
      .eq('id', accountId);
  }

  // ============================================
  // Realtime Event Handlers
  // ============================================

  /**
   * Handle INSERT event: New account added from Dashboard.
   * Immediately spin up a Baileys socket for it.
   */
  async handleAccountInsert(payload) {
    const account = payload.new;
    this.logger.info(
      `🆕 New account detected: ${account.display_name} (${account.phone_number})`
    );

    if (!account.is_archived) {
      await this.initSocket(account);
    }
  }

  /**
   * Handle UPDATE event: Account modified from Dashboard.
   * - If archived → terminate socket
   * - If status changed to 'pairing' → re-init socket (re-pair flow)
   */
  async handleAccountUpdate(payload) {
    const account = payload.new;
    const old = payload.old;

    // Account archived (deleted from UI)
    if (account.is_archived) {
      this.logger.info(
        `🗑️ Account archived: ${account.display_name}. Terminating socket.`
      );
      await this.terminateSocket(account.id);
      return;
    }

    // Re-pair triggered: status changed to 'pairing'
    if (account.status === 'pairing' && old?.status !== 'pairing') {
      this.logger.info(
        `🔄 Re-pair triggered for: ${account.display_name}. Re-initializing socket.`
      );
      await this.initSocket(account);
      return;
    }
  }
}
