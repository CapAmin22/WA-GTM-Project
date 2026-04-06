'use client';

import { useState } from 'react';
import CsvUploadModal from './CsvUploadModal';
import { useRouter } from 'next/navigation';

export default function ContactsClient({ initialContacts, totalCount, currentPage, error }) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 className="text-secondary" style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Contacts
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Manage your audience, segments, and blacklist.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary" onClick={() => router.push('/segments')}>
            Manage Segments
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Upload CSV
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ color: 'red' }}>Error loading contacts: {error}</div>
      ) : (
        <div className="card">
          <div style={{ paddingBottom: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>All Contacts ({totalCount})</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Page {currentPage}</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th style={{ padding: 'var(--space-3) 0', fontWeight: 500 }}>Phone</th>
                <th style={{ padding: 'var(--space-3) 0', fontWeight: 500 }}>Name</th>
                <th style={{ padding: 'var(--space-3) 0', fontWeight: 500 }}>Company</th>
                <th style={{ padding: 'var(--space-3) 0', fontWeight: 500 }}>Tags</th>
                <th style={{ padding: 'var(--space-3) 0', fontWeight: 500, textAlign: 'right' }}>Blacklisted</th>
              </tr>
            </thead>
            <tbody>
              {initialContacts.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: 'var(--space-8) 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No contacts found. Upload a CSV to get started!
                  </td>
                </tr>
              ) : (
                initialContacts.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: 'var(--space-3) 0', fontWeight: 600, color: 'var(--text-primary)' }}>{c.phone}</td>
                    <td style={{ padding: 'var(--space-3) 0' }}>{c.name || '--'}</td>
                    <td style={{ padding: 'var(--space-3) 0' }}>{c.company || '--'}</td>
                    <td style={{ padding: 'var(--space-3) 0' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {c.tags?.map(t => (
                          <span key={t} style={{ padding: '2px 8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '0.75rem' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) 0', textAlign: 'right' }}>
                      {c.is_blacklisted ? <span style={{ color: 'var(--status-disconnected)' }}>Yes</span> : <span style={{ color: 'var(--status-active)' }}>No</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <CsvUploadModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
