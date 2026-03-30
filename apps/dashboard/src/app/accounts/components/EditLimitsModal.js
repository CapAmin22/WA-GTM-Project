'use client';

import { useState } from 'react';

export default function EditLimitsModal({ account, onClose }) {
  const [displayName, setDisplayName] = useState(account.display_name);
  const [dailyLimit, setDailyLimit] = useState(account.daily_limit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/v1/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          daily_limit: parseInt(dailyLimit, 10),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update');
        setLoading(false);
        return;
      }

      onClose();
    } catch (err) {
      setError('Network error: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Account</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
        }}>
          <div className="form-group">
            <label className="form-label" htmlFor="edit-name">Display Name</label>
            <input
              id="edit-name"
              className="form-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-limit">Daily Message Limit</label>
            <input
              id="edit-limit"
              className="form-input"
              type="number"
              min="1"
              max="10000"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
            />
          </div>

          {/* Current phone (read-only) */}
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
          }}>
            Phone: <span style={{ fontFamily: 'monospace' }}>{account.phone_number}</span>
          </div>

          {error && (
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-banned)',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
