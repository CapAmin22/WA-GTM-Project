import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: 'apps/worker/.env' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkData() {
  const { data: contacts } = await supabase.from('contacts').select('*');
  const { data: templates } = await supabase.from('message_templates').select('*');
  const { data: campaigns } = await supabase.from('campaigns').select('*');
  const { data: queue } = await supabase.from('message_queue').select('*');
  const { data: accounts } = await supabase.from('wa_accounts').select('*');

  console.log('Contacts:', JSON.stringify(contacts, null, 2));
  console.log('Templates:', JSON.stringify(templates, null, 2));
  console.log('Campaigns:', JSON.stringify(campaigns, null, 2));
  console.log('Queue:', JSON.stringify(queue, null, 2));
  console.log('Accounts:', JSON.stringify(accounts, null, 2));
}

checkData();
