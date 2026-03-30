'use client';

import { useState, useRef, useEffect } from 'react';

export default function AccountMenu({ account, userRole, onEditLimits }) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const menuRef = useRef(null);

  const isSuperAdmin = userRole === 'super_admin';

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRePair = async () => {
    if (!confirm('Re-pair this account? The current session will be cleared and a new QR code will be generated.')) return;
    
    setActionLoading('re-pair');
    try {
      const res = await fetch(`/api/v1/accounts/${account.id}/re-pair`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to re-pair');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setActionLoading('');
      setIsOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${account.display_name}" (${account.phone_number})? This action will archive the account and disconnect the WhatsApp session.`)) return;

    setActionLoading('delete');
    try {
      const res = await fetch(`/api/v1/accounts/${account.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setActionLoading('');
      setIsOpen(false);
    }
  };

  return (
    <div className="dropdown-container" ref={menuRef}>
      <button
        className="btn btn-ghost"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Account actions"
        id={`menu-btn-${account.id}`}
      >
        ⋮
      </button>

      {isOpen && (
        <div className="dropdown-menu" id={`menu-${account.id}`}>
          {/* Edit Limits — Available to Admin+ */}
          <button
            className="dropdown-item"
            onClick={() => {
              onEditLimits();
              setIsOpen(false);
            }}
          >
            ✏️ Edit Limits
          </button>

          {/* Re-Pair — Super Admin only */}
          {isSuperAdmin && (
            <>
              <div className="dropdown-separator" />
              <button
                className="dropdown-item"
                onClick={handleRePair}
                disabled={actionLoading === 're-pair'}
              >
                {actionLoading === 're-pair' ? (
                  <>
                    <span className="spinner" style={{
                      width: '14px', height: '14px', borderWidth: '2px'
                    }} />
                    Re-pairing...
                  </>
                ) : (
                  '🔄 Re-Pair'
                )}
              </button>

              {/* Delete — Super Admin only, red */}
              <button
                className="dropdown-item dropdown-item-danger"
                onClick={handleDelete}
                disabled={actionLoading === 'delete'}
              >
                {actionLoading === 'delete' ? (
                  <>
                    <span className="spinner" style={{
                      width: '14px', height: '14px', borderWidth: '2px',
                      borderTopColor: 'var(--status-banned)'
                    }} />
                    Deleting...
                  </>
                ) : (
                  '🗑️ Delete'
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
