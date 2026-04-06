const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAccount() {
  const phoneNumber = '+918329556730';
  const displayName = 'Passionbits';

  console.log(`Checking for account ${phoneNumber}...`);

  // Check if exists
  const { data: existing, error: fetchError } = await supabase
    .from('wa_accounts')
    .select('id, phone_number, display_name')
    .eq('phone_number', phoneNumber)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching account:', fetchError.message);
    return;
  }

  if (existing) {
    console.log('Account already exists:', existing.id, `(${existing.display_name})`);
    if (existing.display_name !== displayName) {
        console.log(`Updating name from ${existing.display_name} to ${displayName}...`);
        const { error: updateError } = await supabase
            .from('wa_accounts')
            .update({ display_name: displayName })
            .eq('id', existing.id);
        if (updateError) {
            console.error('Error updating name:', updateError.message);
        } else {
            console.log('Name updated successfully.');
        }
    }
    return;
  }

  console.log(`Adding account ${phoneNumber} as ${displayName}...`);
  const { data, error } = await supabase
    .from('wa_accounts')
    .insert({
      phone_number: phoneNumber,
      display_name: displayName,
      status: 'pairing',
      connection_status: 'disconnected'
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding account:', error.message);
  } else {
    console.log('Account added successfully:', data.id);
  }
}

addAccount();
