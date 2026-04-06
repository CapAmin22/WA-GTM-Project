import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export const metadata = {
  title: 'Segments — WA GTM Engine',
  description: 'Manage dynamic audience segments.',
};

export default async function SegmentsPage() {
  const supabase = await createClient();

  const { data: segments, error } = await supabase
    .from('contact_segments')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="app-layout">
      <Sidebar activePath="/segments" />
      <main className="main-content">
        <div className="page-container">
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
            <div>
              <h1 className="text-secondary" style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                Audience Segments
              </h1>
              <p style={{ color: 'var(--text-muted)' }}>
                Create dynamic groups of contacts based on tags and attributes.
              </p>
            </div>
            <button className="btn btn-primary" disabled>
              + Create Segment (Coming Soon)
            </button>
          </div>

          <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🏷️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Dynamic Segments Coming Soon</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
              Currently, you can target campaigns using Tags during Campaign creation. Full dynamic segment logic builder is under construction.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
