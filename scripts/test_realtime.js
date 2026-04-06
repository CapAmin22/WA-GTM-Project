const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Subscribing to Realtime...');

const channel = supabase
  .channel('test_channel')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'wa_accounts' },
    (payload) => console.log('Change detected:', payload)
  )
  .subscribe((status, err) => {
    console.log('Subscription status:', status);
    if (err) console.error('Subscription error:', err);
  });

// Keep process alive for 30s
setTimeout(() => {
    console.log('Test finished.');
    process.exit(0);
}, 30000);
