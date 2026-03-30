'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Custom hook to get the current authenticated user and their role.
 * @returns {{ user: object | null, role: string, loading: boolean }}
 */
export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function getUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        setUser(currentUser);
        setRole(currentUser.app_metadata?.role || 'viewer');
      }
      setLoading(false);
    }

    getUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          setRole(session.user.app_metadata?.role || 'viewer');
        } else {
          setUser(null);
          setRole('viewer');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, role, loading };
}
