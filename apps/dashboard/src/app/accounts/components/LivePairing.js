'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { QRCodeSVG } from 'qrcode.react';

/** Fallback polling interval if Realtime is slow (ms) */
const POLL_INTERVAL_MS = 5000;
/** How long before showing the "Retry" button (ms) */
const RETRY_THRESHOLD_MS = 15000;

/**
 * Live Pairing component — shows QR code or "Waiting for Worker" state.
 * Uses Realtime for instant updates with a polling fallback.
 */
export default function LivePairing({ account }) {
  const [qrValue, setQrValue] = useState(account.pairing_qr);
  const [status, setStatus] = useState(account.status);
  const [waitingTooLong, setWaitingTooLong] = useState(false);

  // Sync props
  useEffect(() => {
    setQrValue(account.pairing_qr);
    setStatus(account.status);
  }, [account.pairing_qr, account.status]);

  // Fallback polling — re-fetch account if Realtime is slow
  const pollAccount = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('wa_accounts')
      .select('pairing_qr, status')
      .eq('id', account.id)
      .single();

    if (data) {
      if (data.pairing_qr && data.pairing_qr !== qrValue) {
        setQrValue(data.pairing_qr);
      }
      if (data.status !== status) {
        setStatus(data.status);
      }
    }
  }, [account.id, qrValue, status]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`pairing_${account.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wa_accounts',
          filter: `id=eq.${account.id}`,
        },
        (payload) => {
          setQrValue(payload.new.pairing_qr);
          setStatus(payload.new.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account.id]);

  // Fallback poll timer (only when waiting for QR)
  useEffect(() => {
    if (status !== 'pairing' || qrValue) return;

    const pollTimer = setInterval(pollAccount, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimer);
  }, [status, qrValue, pollAccount]);

  // "Waiting too long" timer
  useEffect(() => {
    if (status !== 'pairing' || qrValue) {
      setWaitingTooLong(false);
      return;
    }

    const timeout = setTimeout(() => setWaitingTooLong(true), RETRY_THRESHOLD_MS);
    return () => clearTimeout(timeout);
  }, [status, qrValue]);

  // Account connected — no QR needed
  if (status !== 'pairing') {
    return null;
  }

  // Waiting for worker to generate QR
  if (!qrValue) {
    return (
      <div className="qr-waiting">
        <div className="spinner spinner-lg" />
        <span>Waiting for Worker to generate QR code...</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Make sure the worker process is running
        </span>
        {waitingTooLong && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={pollAccount}
            style={{ marginTop: 'var(--space-2)' }}
          >
            🔄 Check Again
          </button>
        )}
      </div>
    );
  }

  // QR Code available — render it
  return (
    <div className="qr-container">
      <QRCodeSVG
        value={qrValue}
        size={200}
        bgColor="#ffffff"
        fgColor="#000000"
        level="M"
        style={{ borderRadius: '8px' }}
      />
      <p style={{
        color: '#333',
        fontSize: '0.8125rem',
        fontWeight: 500,
        textAlign: 'center',
      }}>
        Scan with WhatsApp → Linked Devices
      </p>
    </div>
  );
}
