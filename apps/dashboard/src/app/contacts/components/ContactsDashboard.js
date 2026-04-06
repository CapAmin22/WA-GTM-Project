'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import CsvUploadModal from './CsvUploadModal';

export default function ContactsDashboard() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('wa_contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error) {
      setContacts(data || []);
    }
    setLoading(false);
  }

  return (
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
            WhatsApp Audience
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Upload CSVs and manage your broadcast lists.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowUploadModal(true)}
        >
          + Upload CSV
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div className="stat-value">{contacts.length}</div>
          <div className="stat-label">Total Contacts</div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
            <tr>
              <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Phone Number</th>
              <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Full Name</th>
              <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Tags</th>
              <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Last Update</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No contacts found. Upload a CSV to get started.
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: 'var(--space-4)', fontFamily: 'monospace' }}>{contact.phone_number}</td>
                  <td style={{ padding: 'var(--space-4)' }}>{contact.full_name || '—'}</td>
                  <td style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {contact.tags?.map((tag) => (
                        <span key={tag} className="status-badge" style={{ fontSize: '0.625rem', padding: '2px 6px' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {new Date(contact.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showUploadModal && (
        <CsvUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchContacts();
          }}
        />
      )}
    </div>
  );
}
