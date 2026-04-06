import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export const metadata = {
  title: 'Campaigns — WA GTM Engine',
  description: 'Manage your bulk messaging campaigns and A/B tests.',
};

export default async function CampaignsPage() {
  const supabase = await createClient();

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*, message_templates(name), contact_segments(name), ab_experiments(name)')
    .order('created_at', { ascending: false });

  return (
    <div className="app-layout">
      <Sidebar activePath="/campaigns" />
      <main className="main-content">
        <div className="page-container">
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-8)',
          }}>
            <div>
              <h1 className="text-secondary" style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                Messaging Campaigns
              </h1>
              <p style={{ color: 'var(--text-muted)' }}>
                Create automated broadcast campaigns and manage scheduling.
              </p>
            </div>

            <Link href="/campaigns/new" className="btn btn-primary">
              + New Campaign
            </Link>
          </div>

          {error && <div style={{ color: 'red', marginBottom: 'var(--space-4)' }}>Error loading campaigns: {error.message}</div>}

          {(!campaigns || campaigns.length === 0) && !error ? (
              <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🚀</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>No Campaigns Yet</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
                  Ready to scale? Create your first campaign to reach your audience with A/B variation testing.
                </p>
                <Link href="/campaigns/new" className="btn btn-primary">
                  Build Your First Campaign
                </Link>
              </div>
          ) : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: 'var(--space-3)' }}>Campaign Name</th>
                    <th style={{ padding: 'var(--space-3)' }}>Status</th>
                    <th style={{ padding: 'var(--space-3)' }}>Progress</th>
                    <th style={{ padding: 'var(--space-3)' }}>Delivery Rate</th>
                    <th style={{ padding: 'var(--space-3)' }}>Created</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(camp => {
                    const progress = camp.total_recipients > 0 ? ((camp.sent_count + camp.failed_count) / camp.total_recipients) * 100 : 0;
                    const delivery = camp.sent_count + camp.failed_count > 0 ? (camp.sent_count / (camp.sent_count + camp.failed_count)) * 100 : 0;
                    
                    return (
                    <tr key={camp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <div style={{ fontWeight: 600 }}>{camp.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {camp.message_templates?.name || camp.ab_experiments?.name || 'Manual Content'}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <span style={{ 
                            padding: '2px 8px', 
                            backgroundColor: camp.status === 'active' ? 'var(--status-active)' : (camp.status === 'paused' ? 'rgba(255,255,255,0.2)' : 'var(--status-connecting)'),
                            color: camp.status === 'active' ? 'black' : 'white',
                            borderRadius: '12px', 
                            fontSize: '0.75rem',
                            textTransform: 'capitalize'
                        }}>
                          {camp.status}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '100px', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--status-active)' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem' }}>{Math.round(progress)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        {delivery.toFixed(1)}%
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        {new Date(camp.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                        <Link href={`/campaigns/${camp.id}`} className="btn btn-secondary btn-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
