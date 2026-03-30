import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import AccountsList from './components/AccountsList';

export const metadata = {
  title: 'Accounts — WA GTM Engine',
  description: 'Manage your WhatsApp accounts, pair new numbers, and monitor connection status.',
};

export default async function AccountsPage() {
  const supabase = await createClient();

  // Fetch initial accounts server-side
  const { data: accounts, error } = await supabase
    .from('wa_accounts')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  return (
    <div className="app-layout">
      <Sidebar activePath="/accounts" />
      <main className="main-content">
        <div className="page-container">
          <AccountsList
            initialAccounts={accounts || []}
            fetchError={error?.message}
          />
        </div>
      </main>
    </div>
  );
}
