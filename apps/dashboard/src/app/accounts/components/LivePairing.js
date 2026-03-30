'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Live Pairing component — shows QR code or "Waiting for Worker" state.
 * Subscribes to realtime updates on this specific account.
 */
export default function LivePairing({ account }) {
  const [qrValue, setQrValue] = useState(account.pairing_qr);
  const [status, setStatus] = useState(account.status);

  useEffect(() => {
    setQrValue(account.pairing_qr);
    setStatus(account.status);
  }, [account.pairing_qr, account.status]);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to updates on this specific account
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
          Make sure the worker process is running on the VPS
        </span>
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
