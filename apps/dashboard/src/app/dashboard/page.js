import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export const metadata = {
  title: 'Overview — WA GTM Engine',
  description: 'High-level metrics for your WhatsApp campaigns.',
};

export default async function DashboardOverviewPage() {
  const supabase = await createClient();

  // Fetch metrics in parallel
  const [
    { count: totalContacts },
    { count: totalCampaigns },
    { data: queueStatus },
    { data: activeAccounts }
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
    supabase.from('campaign_messages').select('status'),
    supabase.from('wa_accounts').select('id').eq('connection_status', 'connected')
  ]);

  const sentCount = queueStatus?.filter(m => m.status === 'sent').length || 0;
  const failedCount = queueStatus?.filter(m => m.status === 'failed').length || 0;
  const deliveryRate = (sentCount + failedCount > 0) 
    ? ((sentCount / (sentCount + failedCount)) * 100).toFixed(1) 
    : 0;

  return (
    <div className="app-layout">
      <Sidebar activePath="/dashboard" />
      <main className="main-content">
        <div className="page-container">
          
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h1 className="text-secondary" style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Mission Control
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Overview of your WhatsApp GTM engine performance.
            </p>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
            
            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>Total Delivered</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--status-active)' }}>{sentCount}</div>
            </div>

            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>Delivery Rate</div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{deliveryRate}%</div>
            </div>

            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>Active Accounts</div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{activeAccounts?.length || 0}</div>
            </div>

            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>Audience Size</div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{totalContacts || 0}</div>
            </div>

          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repaet(2, 1fr)', gap: 'var(--space-6)' }}>
            <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🚀</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Ready to scale?</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
                You have {totalCampaigns || 0} active campaigns. Create a new one to reach your audience.
              </p>
              <Link href="/campaigns/new" className="btn btn-primary">
                Launch Campaign
              </Link>
            </div>
            
            <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📱</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Scale Infrastructure</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
                Connect more WhatsApp accounts to increase your daily sending volume automatically.
              </p>
              <Link href="/accounts" className="btn btn-secondary">
                Manage Accounts
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
