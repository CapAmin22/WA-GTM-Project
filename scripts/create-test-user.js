
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from apps/worker/.env which has the service role key
dotenv.config({ path: path.resolve(process.cwd(), 'apps/worker/.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in apps/worker/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestAdmin() {
  const email = 'admin@test.com';
  const password = 'Password@123';
  
  console.log(`🚀 Creating test admin user: ${email}...`);
  
  // 1. Create the user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Test Admin' },
    app_metadata: { role: 'super_admin' } // Directly set the role in app_metadata
  });

  if (error) {
    if (error.message.includes('already registered')) {
        console.log('✅ User already exists. Attempting to update role just in case...');
        
        // Find user by email
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
            console.error('❌ Failed to list users:', listError.message);
            return;
        }
        
        const user = users.users.find(u => u.email === email);
        if (user) {
            const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
                app_metadata: { role: 'super_admin' }
            });
            if (updateError) {
                console.error('❌ Failed to update user role:', updateError.message);
            } else {
                console.log('✅ User role updated to super_admin.');
            }
        }
    } else {
        console.error('❌ Failed to create user:', error.message);
    }
    return;
  }

  console.log('✅ Test admin user created successfully!');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log(`🆔 ID: ${data.user.id}`);
}

createTestAdmin();
