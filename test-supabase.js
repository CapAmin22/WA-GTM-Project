import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load env from apps/worker/.env
dotenv.config({ path: path.join(__dirname, 'apps', 'worker', '.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Testing connection to:', supabaseUrl)

if (!supabaseUrl || supabaseUrl.includes('your-project')) {
  console.error('❌ Error: SUPABASE_URL is not configured correctly in apps/worker/.env')
  process.exit(1)
}

if (!supabaseServiceKey || supabaseServiceKey.includes('your-service-role-key')) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is not configured correctly in apps/worker/.env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testConnection() {
  try {
    const { data, error } = await supabase.from('wa_accounts').select('count', { count: 'exact', head: true })
    
    if (error) {
      console.error('❌ Supabase Connection Error:', error.message)
      if (error.message.includes('FetchError') || error.message.includes('ENOTFOUND')) {
        console.log('💡 Tip: Your URL seems incorrect or you have no internet.')
      }
    } else {
      console.log('✅ Supabase Connected Successfully!')
      console.log('📊 Table "wa_accounts" is accessible.')
    }
  } catch (err) {
    console.error('💥 Unexpected Error:', err.message)
  }
}

testConnection()
