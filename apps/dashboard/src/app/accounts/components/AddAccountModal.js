'use client';

import { useState } from 'react';

export default function AddAccountModal({ onClose }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dailyLimit, setDailyLimit] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic E.164 validation
    const cleanPhone = phoneNumber.replace(/\s/g, '');
    if (!/^\+?[1-9]\d{6,14}$/.test(cleanPhone)) {
      setError('Invalid phone number format. Use E.164 format (e.g., +919876543210)');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`,
          display_name: displayName || 'Unnamed',
          daily_limit: parseInt(dailyLimit, 10) || 200,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add account');
        setLoading(false);
        return;
      }

      // Success — close modal (the new account will appear via Realtime)
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
          <h2>Add WhatsApp Number</h2>
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
            <label className="form-label" htmlFor="add-phone">Phone Number</label>
            <input
              id="add-phone"
              className="form-input"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+919876543210"
              required
              autoFocus
            />
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}>
              Include country code (e.g., +91 for India, +1 for US)
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-name">Display Name</label>
            <input
              id="add-name"
              className="form-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sales Line 1"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-limit">Daily Message Limit</label>
            <input
              id="add-limit"
              className="form-input"
              type="number"
              min="1"
              max="10000"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
            />
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}>
              Recommended: 200 for new numbers, up to 1000 for warmed accounts
            </span>
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
              {loading ? (
                <>
                  <span className="spinner" style={{
                    width: '16px', height: '16px', borderWidth: '2px',
                    borderTopColor: 'var(--text-inverse)',
                  }} />
                  Adding...
                </>
              ) : (
                'Add Number'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
