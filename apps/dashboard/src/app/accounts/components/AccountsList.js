'use client';

import { useState } from 'react';
import { useRealtimeAccounts } from '@/hooks/useRealtimeAccounts';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import AccountCard from './AccountCard';
import AddAccountModal from './AddAccountModal';

export default function AccountsList({ initialAccounts, fetchError }) {
  const accounts = useRealtimeAccounts(initialAccounts);
  const { user, role, loading: userLoading } = useCurrentUser();
  const [showAddModal, setShowAddModal] = useState(false);

  const canAddAccount = ['super_admin', 'admin'].includes(role);

  if (fetchError) {
    return (
      <div>
        <div className="page-header">
          <h1>WhatsApp Accounts</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Database Not Ready</div>
          <div className="empty-state-text">
            {fetchError.includes('does not exist')
              ? 'The wa_accounts table has not been created yet. Please run the SQL migration scripts in the Supabase SQL Editor.'
              : fetchError}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1>WhatsApp Accounts</h1>
        {canAddAccount && (
          <button
            id="btn-add-account"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <span>＋</span>
            Add Number
          </button>
        )}
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-8)',
        flexWrap: 'wrap',
      }}>
        <StatChip
          label="Total"
          value={accounts.length}
          color="var(--text-primary)"
        />
        <StatChip
          label="Active"
          value={accounts.filter((a) => a.status === 'active').length}
          color="var(--status-active)"
        />
        <StatChip
          label="Pairing"
          value={accounts.filter((a) => a.status === 'pairing').length}
          color="var(--status-pairing)"
        />
        <StatChip
          label="Disconnected"
          value={accounts.filter((a) => a.status === 'disconnected').length}
          color="var(--status-disconnected)"
        />
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📱</div>
          <div className="empty-state-title">No accounts yet</div>
          <div className="empty-state-text">
            Add your first WhatsApp number to get started. The worker will
            generate a QR code for you to scan.
          </div>
          {canAddAccount && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <span>＋</span>
              Add Your First Number
            </button>
          )}
        </div>
      ) : (
        <div className="grid-accounts">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              userRole={role}
            />
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      padding: 'var(--space-2) var(--space-4)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.8125rem',
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontWeight: 700,
        color,
        fontSize: '0.9375rem',
      }}>
        {value}
      </span>
    </div>
  );
}
