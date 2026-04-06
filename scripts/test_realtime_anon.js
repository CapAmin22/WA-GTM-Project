const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('Subscribing to Realtime (ANON)...');

const channel = supabase
  .channel('test_channel_anon')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'wa_accounts' },
    (payload) => console.log('Change detected:', payload)
  )
  .subscribe((status, err) => {
    console.log('Subscription status (ANON):', status);
    if (err) console.error('Subscription error (ANON):', err);
  });

setTimeout(() => {
    console.log('Test finished.');
    process.exit(0);
}, 30000);
