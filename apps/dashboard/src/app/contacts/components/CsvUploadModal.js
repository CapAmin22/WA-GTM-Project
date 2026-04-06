'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function CsvUploadModal({ onClose }) {
  const [file, setFile] = useState(null);
  const [tag, setTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const router = useRouter();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      
      // Simple CSV Parse (Fallback to Papaparse if needed later)
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
      const headers = rows[0].map(h => h.toLowerCase());
      
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('number'));
      const nameIdx = headers.findIndex(h => h.includes('name'));
      const companyIdx = headers.findIndex(h => h.includes('company'));
      
      if (phoneIdx === -1) {
        setResult({ error: 'Could not find a "phone" or "number" column in the CSV.' });
        setIsUploading(false);
        return;
      }

      const contacts = [];
      const tags = tag ? [tag] : [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < headers.length) continue;
        
        let phone = row[phoneIdx];
        if (!phone) continue;
        
        // Normalize phone completely (remove spaces, dashes)
        phone = phone.replace(/[^0-9+]/g, '');
        if (!phone.startsWith('+')) phone = `+${phone}`;

        contacts.push({
          phone,
          name: nameIdx !== -1 ? row[nameIdx] : null,
          company: companyIdx !== -1 ? row[companyIdx] : null,
          tags,
          source: 'csv_import'
        });
      }

      const supabase = createClient();
      
      // Upsert in batches of 100
      let success = 0;
      let fails = 0;
      
      for (let i = 0; i < contacts.length; i += 100) {
        const batch = contacts.slice(i, i + 100);
        const { error } = await supabase
          .from('contacts')
          .upsert(batch, { onConflict: 'phone' });
          
        if (error) {
            fails += batch.length;
            console.error('Batch failed:', error);
        } else {
            success += batch.length;
        }
      }

      setResult({ success, fails });
      setIsUploading(false);
    };

    reader.readAsText(file);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: '500px', backgroundColor: '#1A1D20', border: '1px solid rgba(255,255,255,0.1)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'var(--space-3)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Upload CSV Contacts</h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
        </div>

        {!result ? (
            <div>
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', fontSize: '0.875rem' }}>
                    Your CSV must include a column named <strong>phone</strong> or <strong>number</strong>. Optional columns: <strong>name</strong>, <strong>company</strong>.
                </p>
                
                <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                    <label>Assign Tag (Optional)</label>
                    <input 
                        type="text" 
                        value={tag} 
                        onChange={e => setTag(e.target.value)} 
                        placeholder="e.g. lead_august_12" 
                        style={{ width: '100%', padding: 'var(--space-3)', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white' }} 
                    />
                </div>

                <div 
                    style={{ 
                        border: '2px dashed rgba(255,255,255,0.2)', 
                        padding: 'var(--space-8)', 
                        textAlign: 'center', 
                        borderRadius: '8px',
                        marginBottom: 'var(--space-6)',
                        cursor: 'pointer'
                    }}
                    onClick={() => document.getElementById('csv-upload').click()}
                >
                    <input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📄</div>
                    {file ? (
                        <div style={{ color: 'var(--status-active)', fontWeight: 600 }}>{file.name}</div>
                    ) : (
                        <div style={{ color: 'var(--text-muted)' }}>Click to select CSV file</div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleUpload} disabled={!file || isUploading}>
                        {isUploading ? 'Importing...' : 'Start Import'}
                    </button>
                </div>
            </div>
        ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                {result.error ? (
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>❌</div>
                        <h3 style={{ color: '#ef4444', marginBottom: 'var(--space-2)' }}>Import Error</h3>
                        <p style={{ color: 'var(--text-muted)' }}>{result.error}</p>
                    </div>
                ) : (
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>✅</div>
                        <h3 style={{ color: 'var(--status-active)', marginBottom: 'var(--space-2)' }}>Import Complete</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Successfully imported <strong>{result.success}</strong> contacts.</p>
                        {result.fails > 0 && <p style={{ color: '#ef4444' }}>Failed to import {result.fails} contacts.</p>}
                    </div>
                )}
                
                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: 'var(--space-6)' }} 
                  onClick={() => {
                      onClose();
                      router.refresh();
                  }}
                >
                    Close & Refresh
                </button>
            </div>
        )}

      </div>
    </div>
  );
}
