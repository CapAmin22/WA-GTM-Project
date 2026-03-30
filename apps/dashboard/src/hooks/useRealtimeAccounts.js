'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Custom hook to subscribe to real-time changes on wa_accounts.
 * Returns a live-updating array of accounts.
 * @param {Array} initialAccounts - Server-fetched accounts
 * @returns {Array} Live accounts array
 */
export function useRealtimeAccounts(initialAccounts = []) {
  const [accounts, setAccounts] = useState(initialAccounts);

  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('wa_accounts_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wa_accounts',
        },
        (payload) => {
          setAccounts((prev) => {
            // Avoid duplicates
            if (prev.some((a) => a.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wa_accounts',
        },
        (payload) => {
          setAccounts((prev) =>
            prev
              .map((a) => (a.id === payload.new.id ? payload.new : a))
              // Remove archived accounts from view
              .filter((a) => !a.is_archived)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'wa_accounts',
        },
        (payload) => {
          setAccounts((prev) => prev.filter((a) => a.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return accounts;
}
