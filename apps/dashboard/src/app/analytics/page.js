import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'Analytics — WA GTM Engine',
  description: 'Performance analytics and reporting.',
};

export default async function AnalyticsPage() {
  return (
    <div className="app-layout">
      <Sidebar activePath="/analytics" />
      <main className="main-content">
        <div className="page-container">
          
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h1 className="text-secondary" style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Analytics & Demographics
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Deep dive into campaign performance.
            </p>
          </div>

          <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📊</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Advanced Analytics Coming Soon</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
              In the future, this page will host detailed charts for time-of-day delivery success, open rates, and demographic breakdowns. See the Mission Control Dashboard for current high-level metrics.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
