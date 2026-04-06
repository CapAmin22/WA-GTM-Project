'use client';

import { useState } from 'react';
import LivePairing from './LivePairing';
import AccountMenu from './AccountMenu';
import EditLimitsModal from './EditLimitsModal';

export default function AccountCard({ account, userRole }) {
  const [showEditModal, setShowEditModal] = useState(false);

  const statusClass = `status-${account.status}`;
  const canManage = ['super_admin', 'admin'].includes(userRole);

  // Calculate progress percentage for daily limit
  const progressPct = account.daily_limit > 0
    ? Math.min((account.messages_sent_today / account.daily_limit) * 100, 100)
    : 0;

  const progressClass = progressPct > 90 ? 'danger' : progressPct > 70 ? 'warning' : '';

  return (
    <div className="card animate-card-enter" id={`account-${account.id}`}>
      {/* Card Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-4)',
      }}>
        <div>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: 'var(--space-1)',
          }}>
            {account.display_name}
          </h3>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}>
            {account.phone_number}
          </p>
        </div>

        {canManage && (
          <AccountMenu
            account={account}
            userRole={userRole}
            onEditLimits={() => setShowEditModal(true)}
          />
        )}
      </div>

      {/* Status Badge */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <span className={`status-badge ${statusClass}`}>
          {account.status}
        </span>
      </div>

      {/* Live Pairing / QR Code */}
      {account.status === 'pairing' && (
        <LivePairing account={account} />
      )}

      {/* Stats Row */}
      {account.status !== 'pairing' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-2)',
        }}>
          {/* Messages Progress */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-1)',
            }}>
              <span>Messages Today</span>
              <span>
                {account.messages_sent_today} / {account.daily_limit}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-fill ${progressClass}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Last Connected */}
          {account.last_connected_at && (
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }} suppressHydrationWarning>
              Last connected: {new Date(account.last_connected_at).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditLimitsModal
          account={account}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
