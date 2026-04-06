import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import SettingsClient from './components/SettingsClient';

export const metadata = {
  title: 'Settings — WA GTM Engine',
  description: 'Manage system configurations and stealth engine parameters.',
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: configRows, error } = await supabase
    .from('system_config')
    .select('*');

  // Convert array of {key, value} to a flat object
  const initialConfig = {};
  if (configRows) {
    configRows.forEach(row => {
      initialConfig[row.key] = row.value;
    });
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/settings" />
      <main className="main-content">
        <div className="page-container">
          <SettingsClient
            initialConfig={initialConfig}
            fetchError={error?.message}
          />
        </div>
      </main>
    </div>
  );
}
