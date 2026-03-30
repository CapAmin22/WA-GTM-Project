import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client for browser-side usage (Next.js components).
 * Uses NEXT_PUBLIC_ env vars.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Create a Supabase client for server-side usage (API routes, Worker).
 * Accepts explicit URL and key params (supports service_role key).
 * @param {string} supabaseUrl
 * @param {string} supabaseKey
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createServerSupabaseClient(supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing supabaseUrl or supabaseKey arguments');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
