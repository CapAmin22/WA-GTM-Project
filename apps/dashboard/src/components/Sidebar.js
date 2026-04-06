'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function Sidebar({ activePath }) {
  const router = useRouter();
  const { user, role } = useCurrentUser();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/accounts', label: 'Accounts', icon: '📱' },
    { path: '/contacts', label: 'Contacts', icon: '👥' },
    { path: '/segments', label: 'Segments', icon: '🏷️' },
    { path: '/templates', label: 'Templates', icon: '📝' },
    { path: '/campaigns', label: 'Campaigns', icon: '📤' },
    { path: '/experiments', label: 'A/B Labs', icon: '🧪' },
    { path: '/analytics', label: 'Analytics', icon: '📊' },
    { path: '/logs', label: 'Activity Log', icon: '📋' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">📱</div>
        <span className="sidebar-logo-text">WA GTM</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`sidebar-link ${activePath === item.path ? 'active' : ''}`}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
        }}>
          <div>
            <div style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '140px',
            }}>
              {user?.email || '...'}
            </div>
            <div style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {role.replace('_', ' ')}
            </div>
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleLogout}
          style={{ width: '100%' }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
