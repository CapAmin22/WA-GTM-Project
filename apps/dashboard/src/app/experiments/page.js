import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'A/B Labs — WA GTM Engine',
  description: 'Manage A/B testing variations.',
};

export default async function ExperimentsPage() {
  return (
    <div className="app-layout">
      <Sidebar activePath="/experiments" />
      <main className="main-content">
        <div className="page-container">
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h1 className="text-secondary" style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              A/B Labs
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Experiment with different variations to maximize delivery and engagement.
            </p>
          </div>
          <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🧪</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>A/B Labs Coming Soon</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
              We are building advanced split-testing capabilities. In the meantime, use Template Spintax to randomize your messaging.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
