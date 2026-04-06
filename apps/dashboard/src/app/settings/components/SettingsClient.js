'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SettingsClient({ initialConfig, fetchError }) {
  const [config, setConfig] = useState(initialConfig || {});
  const [saveStatus, setSaveStatus] = useState('');
  const timeoutRef = useRef(null);
  const supabase = createClient();

  useEffect(() => {
    // Optionally subscribe to realtime changes to update UI if changed elsewhere
    const channel = supabase.channel('system_config_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_config' }, 
        (payload) => {
          setConfig(prev => ({
            ...prev,
            [payload.new.key]: payload.new.value
          }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    
    // Debounce save to database
    setSaveStatus('Saving...');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('system_config')
        .update({ value })
        .eq('key', key);
        
      if (error) {
        setSaveStatus(`Error saving ${key}`);
      } else {
        setSaveStatus('All changes saved.');
        setTimeout(() => setSaveStatus(''), 2000);
      }
    }, 800);
  };

  if (fetchError) {
    return <div style={{ color: 'red' }}>Error loading settings: {fetchError}</div>;
  }

  const renderToggle = (key, label, desc) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{desc}</div>
      </div>
      <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
        <input 
          type="checkbox" 
          checked={config[key] === true || config[key] === 'true'} 
          onChange={(e) => handleChange(key, e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }} 
        />
        <span className="slider" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: (config[key] === true || config[key] === 'true') ? 'var(--status-active)' : '#ccc', borderRadius: '20px', transition: '.4s' }} />
      </label>
    </div>
  );

  const renderInput = (key, label, desc, type="number", min, max) => (
    <div style={{ padding: 'var(--space-4) 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <input 
          type={type}
          min={min} max={max}
          value={config[key] || ''}
          onChange={(e) => {
            let val = type === 'number' ? Number(e.target.value) : e.target.value;
            handleChange(key, val);
          }}
          style={{ width: type === 'number' ? '80px' : '200px', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white' }}
        />
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{desc}</div>
      {type === 'range' && (
        <input 
          type="range" min={min} max={max} step="0.1"
          value={config[key] || 0}
          onChange={(e) => handleChange(key, Number(e.target.value))}
          style={{ width: '100%', marginTop: '8px' }}
        />
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 className="text-secondary" style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            System Configuration
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Manage core engine settings, limits, and stealth parameters.
          </p>
        </div>
        {saveStatus && <div style={{ fontSize: '0.875rem', color: 'var(--status-active)' }}>{saveStatus}</div>}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, paddingBottom: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>General Operations</h2>
        {renderToggle('global_send_enabled', 'Master Send Toggle', 'Master kill switch. Turn off to immediately pause all outgoing messages across all accounts.')}
        {renderInput('send_window_start', 'Send Window Start (Hour)', 'Hour (0-23) when sending begins.')}
        {renderInput('send_window_end', 'Send Window End (Hour)', 'Hour (0-23) when sending stops.')}
        {renderInput('daily_total_limit', 'Daily Total Volume', 'Maximum messages to send per day across all accounts combined.')}
        {renderInput('per_account_limit', 'Per-Account Daily Limit', 'Maximum messages a single account can send per day.')}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, paddingBottom: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Stealth Engine (Anti-Ban)</h2>
        {renderInput('jitter_min', 'Delay Jitter Min', 'Minimum delay multiplier between messages. (e.g. 0.8 = 80% of base delay)', 'range', 0.1, 1.0)}
        {renderInput('jitter_max', 'Delay Jitter Max', 'Maximum delay multiplier between messages. (e.g. 1.2 = 120% of base delay)', 'range', 1.0, 2.0)}
        {renderInput('presence_composing_min_sec', 'Min Typing Duration (s)', 'Minimum seconds to show "typing..." before sending.')}
        {renderInput('presence_composing_max_sec', 'Max Typing Duration (s)', 'Maximum seconds to show "typing..." before sending.')}
        {renderInput('presence_offline_min_sec', 'Min Offline Delay (s)', 'Seconds to wait before going offline after sending.')}
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, paddingBottom: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Alerts & Notifications</h2>
        {renderToggle('alert_on_ban', 'Alert on Account Banned', 'Notify via webhook if an account is banned.')}
        {renderToggle('alert_on_logout', 'Alert on Unauthorized Logout', 'Notify if WhatsApp forces a device logout.')}
        {renderInput('discord_webhook_url', 'Discord Webhook URL', 'URL to send critical system alerts to Discord.', 'text')}
      </div>
    </div>
  );
}
