'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function TemplateEditor({ initialData = null }) {
  const isEditing = !!initialData;
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || 'marketing');
  const [body, setBody] = useState(initialData?.body || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const supabase = createClient();

  const handleSave = async () => {
    if (!name || !body) {
      setError('Name and Body are required.');
      return;
    }
    
    setIsSaving(true);
    setError(null);

    const payload = {
      name,
      category,
      body,
    };

    let result;
    if (isEditing) {
      result = await supabase.from('message_templates').update(payload).eq('id', initialData.id);
    } else {
      result = await supabase.from('message_templates').insert(payload);
    }

    setIsSaving(false);

    if (result.error) {
      setError(result.error.message);
    } else {
      router.push('/templates');
      router.refresh();
    }
  };

  // Simple local Spintax preview
  const getPreview = () => {
    if (!body) return '';
    const spintaxRegex = /{([^{}]+)}/g;
    return body.replace(spintaxRegex, (match, p1) => {
      const options = p1.split('|');
      return options[0]; // Always show first option for preview
    });
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-8)' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
        {isEditing ? 'Edit Template' : 'Create New Template'}
      </h2>

      {error && <div style={{ color: 'red', marginBottom: 'var(--space-4)' }}>{error}</div>}

      <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
        <label>Template Name</label>
        <input 
          type="text" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          style={{ width: '100%', padding: 'var(--space-3)' }} 
          placeholder="e.g. Welcome Message V1" 
        />
      </div>

      <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
        <label>Category</label>
        <select 
          value={category} 
          onChange={e => setCategory(e.target.value)}
          style={{ width: '100%', padding: 'var(--space-3)' }}
        >
          <option value="marketing">Marketing</option>
          <option value="transactional">Transactional</option>
          <option value="utility">Utility</option>
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
        <label>Message Content (Supports Spintax)</label>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
          Use Spintax to randomize words and avoid bans. Format: <code>{`{Hi|Hello|Hey,}`}</code>
        </p>
        <textarea 
          value={body} 
          onChange={e => setBody(e.target.value)} 
          rows={8}
          style={{ width: '100%', padding: 'var(--space-3)', fontFamily: 'monospace' }} 
          placeholder=" {Hi|Hello|Hey,} our new sale is {live|starting now|happening}! Get {20%|30%} off." 
        />
      </div>

      <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: 'var(--space-4)', borderRadius: '8px', marginBottom: 'var(--space-8)' }}>
        <h4 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Preview (Variant A):</h4>
        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
          {getPreview() || 'Type to see preview...'}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
        <button className="btn btn-ghost" onClick={() => router.push('/templates')} disabled={isSaving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}
