import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import CampaignWizard from '../components/CampaignWizard';

export const metadata = {
  title: 'New Campaign — WA GTM Engine',
  description: 'Deploy a new message campaign.',
};

export default function NewCampaignPage() {
  return (
    <div className="app-layout">
      <Sidebar activePath="/campaigns" />
      <main className="main-content">
        <div className="page-container">
          <CampaignWizard />
        </div>
      </main>
    </div>
  );
}
