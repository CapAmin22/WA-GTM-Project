import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export const metadata = {
  title: 'Message Studio — WA GTM Engine',
  description: 'Manage and create Spintax message templates.',
};

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data: templates, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  return (
    <div className="app-layout">
      <Sidebar activePath="/templates" />
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
                Message Studio
              </h1>
              <p style={{ color: 'var(--text-muted)' }}>
                Create Spintax-aware templates with random variations to prevent bans.
              </p>
            </div>

            <Link href="/templates/new" className="btn btn-primary">
              + New Template
            </Link>
          </div>

          {/* List or Empty State */}
          {error && <div style={{ color: 'red' }}>Error loading templates: {error.message}</div>}
          
          {(!templates || templates.length === 0) && !error ? (
            <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📝</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>No Templates Yet</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
                Create your first message template to start sending personalized, dynamic campaigns.
              </p>
              <Link href="/templates/new" className="btn btn-primary">
                Create Template
              </Link>
            </div>
          ) : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: 'var(--space-3)', color: 'var(--text-muted)', fontWeight: 500 }}>Name</th>
                    <th style={{ padding: 'var(--space-3)', color: 'var(--text-muted)', fontWeight: 500 }}>Category</th>
                    <th style={{ padding: 'var(--space-3)', color: 'var(--text-muted)', fontWeight: 500 }}>Delivery Rate</th>
                    <th style={{ padding: 'var(--space-3)', color: 'var(--text-muted)', fontWeight: 500 }}>Total Sent</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(tmpl => (
                    <tr key={tmpl.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: 'var(--space-3)', fontWeight: 500 }}>{tmpl.name}</td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <span style={{ padding: '2px 8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '0.75rem' }}>
                          {tmpl.category}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        {tmpl.total_sent > 0 
                          ? ((tmpl.total_delivered / tmpl.total_sent) * 100).toFixed(1) + '%' 
                          : 'N/A'}
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>{tmpl.total_sent}</td>
                      <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                        <Link href={`/templates/${tmpl.id}/edit`} className="btn btn-secondary btn-sm">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
