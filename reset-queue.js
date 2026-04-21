import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: 'apps/worker/.env' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetQueue() {
  const { data, error } = await supabase
    .from('message_queue')
    .update({ status: 'pending', attempt_count: 0, error_message: null, sent_at: null })
    .in('status', ['failed']);

  console.log('Reset queue:', error ? error : 'Success');
}

resetQueue();
