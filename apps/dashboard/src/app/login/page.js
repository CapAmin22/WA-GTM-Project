'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/accounts');
    router.refresh();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: 'var(--space-8)',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 'var(--space-10)',
        }}>
          <div className="sidebar-logo-icon" style={{
            width: '56px',
            height: '56px',
            fontSize: '1.5rem',
            marginBottom: 'var(--space-4)',
          }}>
            📱
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            WA GTM Engine
          </h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            marginTop: 'var(--space-2)',
          }}>
            Sign in to your dashboard
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
        }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
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

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 'var(--space-2)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{
                  width: '18px',
                  height: '18px',
                  borderWidth: '2px',
                  borderTopColor: 'var(--text-inverse)',
                }} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          marginTop: 'var(--space-8)',
        }}>
          WhatsApp GTM Engine v1.0 — Dynamic Account Scaling
        </p>
      </div>
    </div>
  );
}
