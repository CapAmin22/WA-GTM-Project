'use client';

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';

let client = null;

export function createClient() {
  if (client) return client;

  client = createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return client;
}
