import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { ClientManager } from './lib/client-manager.js';
import pino from 'pino';

// ============================================
// WA GTM Worker — Entry Point
// ============================================

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

// Validate environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.fatal('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

if (SUPABASE_SERVICE_ROLE_KEY === 'your-service-role-key-here') {
  logger.fatal('SUPABASE_SERVICE_ROLE_KEY is still the placeholder value. Update .env with your real service_role key from Supabase Dashboard → Settings → API');
  process.exit(1);
}

// Create Supabase client with service_role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Initialize Client Manager
const manager = new ClientManager(supabase, logger);

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  await manager.stop();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection');
});

// Start the worker
logger.info('🚀 WA GTM Worker starting...');
logger.info(`   Supabase URL: ${SUPABASE_URL}`);
logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);

manager
  .start()
  .then(() => {
    logger.info('✅ Worker is running and listening for account changes');
  })
  .catch((err) => {
    logger.fatal({ err }, '❌ Worker failed to start');
    process.exit(1);
  });
