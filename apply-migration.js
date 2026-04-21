/**
 * apply-migration.js
 * Applies supabase/migrations/006_wa_messages.sql to the live DB.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres:PASSWORD@db.vihvqnuqhrhkfmfleqfv.supabase.co:5432/postgres" node apply-migration.js
 *
 * Find your PASSWORD at:
 *   Supabase Dashboard → Project Settings → Database → Connection String → Password
 *
 * If you don't want to use this script, just paste the contents of
 * supabase/migrations/006_wa_messages.sql into the Supabase SQL Editor:
 *   https://supabase.com/dashboard/project/vihvqnuqhrhkfmfleqfv/sql/new
 */

import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('\n❌  SUPABASE_DB_URL is not set.\n');
  console.error('Run with:');
  console.error('  SUPABASE_DB_URL="postgresql://postgres:YOUR_PASSWORD@db.vihvqnuqhrhkfmfleqfv.supabase.co:5432/postgres" node apply-migration.js\n');
  console.error('Find your password at: https://supabase.com/dashboard/project/vihvqnuqhrhkfmfleqfv/settings/database\n');
  console.error('OR paste the SQL from supabase/migrations/006_wa_messages.sql into:');
  console.error('  https://supabase.com/dashboard/project/vihvqnuqhrhkfmfleqfv/sql/new\n');
  process.exit(1);
}

const sql = readFileSync('./supabase/migrations/006_wa_messages.sql', 'utf8');

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('✅ Connected to database');
  await client.query(sql);
  console.log('✅ Migration 006_wa_messages applied successfully');
  console.log('   wa_messages table is ready — start the worker to begin capturing messages.');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
