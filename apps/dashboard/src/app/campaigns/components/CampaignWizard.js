'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function CampaignWizard() {
  const [step, setStep] = useState(1);
  const router = useRouter();
  const supabase = createClient();

  // Campaign State
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  
  // Audience State
  const [audienceType, setAudienceType] = useState('all'); // all, segment, tag
  const [selectedSegment, setSelectedSegment] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  
  // Message State
  const [templateId, setTemplateId] = useState('');
  
  // AB State
  const [enableAB, setEnableAB] = useState(false);
  const [experimentId, setExperimentId] = useState('');
  
  // Schedule / Stealth State
  const [config, setConfig] = useState({
    send_window_start: 10,
    send_window_end: 22,
    daily_limit: 500,
    per_account_limit: 125,
    jitter_min: 0.8,
    jitter_max: 1.2,
    presence_min_sec: 4,
    presence_max_sec: 9
  });

  // DB Data
  const [templates, setTemplates] = useState([]);
  const [segments, setSegments] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [contactsCount, setContactsCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      const [tmplRes, segRes, expRes, cntRes, cfgRes] = await Promise.all([
        supabase.from('message_templates').select('id, name, body').eq('is_archived', false),
        supabase.from('contact_segments').select('id, name, contact_count'),
        supabase.from('ab_experiments').select('id, name').eq('status', 'draft'),
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('system_config').select('*')
      ]);

      if (tmplRes.data) setTemplates(tmplRes.data);
      if (segRes.data) setSegments(segRes.data);
      if (expRes.data) setExperiments(expRes.data);
      if (cntRes.count) setContactsCount(cntRes.count);
      
      if (cfgRes.data) {
        const defaults = {};
        cfgRes.data.forEach(r => defaults[r.key] = r.value);
        setConfig(prev => ({ ...prev, ...defaults }));
      }
    }
    loadData();
  }, [supabase]);

  const handleNext = () => setStep(s => Math.min(7, s + 1));
  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const handleLaunch = async () => {
    // 1. Create Campaign
    const campaignData = {
        name,
        description: desc,
        status: 'active', // Skip draft state for simplicity in wizard
        template_id: enableAB ? null : (templateId || null),
        ab_experiment_id: enableAB ? (experimentId || null) : null,
        segment_id: audienceType === 'segment' ? selectedSegment : null,
        scheduled_date: date || new Date().toISOString().split('T')[0],
        send_window_start: config.send_window_start,
        send_window_end: config.send_window_end,
        daily_limit: config.daily_limit,
        per_account_limit: config.per_account_limit,
        jitter_min: config.jitter_min,
        jitter_max: config.jitter_max,
        presence_min_sec: config.presence_composing_min_sec || 4,
        presence_max_sec: config.presence_composing_max_sec || 9,
    };

    const { data: campaign, error } = await supabase.from('campaigns').insert(campaignData).select().single();
    
    if (error) {
        alert('Failed to save campaign: ' + error.message);
        return;
    }

    // 2. Fetch Audience
    let query = supabase.from('contacts').select('id, phone, name');
    if (audienceType === 'tag' && selectedTag) {
        query = query.contains('tags', [selectedTag]);
    }
    // Note: Complex segment logic would go here in backend, doing simple tag fetch for now
    
    const { data: audience } = await query;

    if (audience && audience.length > 0) {
        // 3. Queue Messages
        const queueRows = audience.map(c => ({
            campaign_id: campaign.id,
            recipient_phone: c.phone,
            recipient_name: c.name,
            message_template: enableAB ? 'A/B Test Processing' : (templates.find(t => t.id === templateId)?.body || 'No template'),
            status: 'pending'
        }));
        
        await supabase.from('message_queue').insert(queueRows);
        await supabase.from('campaigns').update({ total_recipients: audience.length }).eq('id', campaign.id);
    }
    
    if (enableAB && experimentId) {
        await supabase.from('ab_experiments').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', experimentId);
    }

    router.push('/campaigns');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Wizard Header / Progress */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Deploy Campaign</h1>
            <div style={{ display: 'flex', marginTop: 'var(--space-4)', gap: '4px' }}>
                {[1,2,3,4,5,6,7].map(i => (
                    <div key={i} style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: i <= step ? 'var(--status-active)' : 'rgba(255,255,255,0.1)' }} />
                ))}
            </div>
            <div style={{ marginTop: 'var(--space-2)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Step {step} of 7: {
                    [null, 'Basics', 'Audience', 'Message', 'A/B Test', 'Schedule', 'Stealth', 'Review'][step]
                }
            </div>
        </div>

        <div className="card" style={{ minHeight: '400px', position: 'relative', paddingBottom: '80px' }}>
            
            {/* Step 1: Basics */}
            {step === 1 && (
                <div>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-6)' }}>Campaign Basics</h2>
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label>Campaign Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Black Friday Promo" style={{ width: '100%', padding: 'var(--space-3)' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label>Description (Optional)</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ width: '100%', padding: 'var(--space-3)' }} />
                    </div>
                    <div className="form-group">
                        <label>Scheduled Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: 'var(--space-3)' }} />
                    </div>
                </div>
            )}

            {/* Step 2: Audience */}
            {step === 2 && (
                <div>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-6)' }}>Select Audience</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', border: '1px solid ' + (audienceType === 'all' ? 'var(--status-active)' : 'rgba(255,255,255,0.1)'), borderRadius: '8px', cursor: 'pointer' }}>
                            <input type="radio" checked={audienceType === 'all'} onChange={() => setAudienceType('all')} />
                            <div>
                                <div style={{ fontWeight: 600 }}>All Contacts</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Send to entire database ({contactsCount} records)</div>
                            </div>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', border: '1px solid ' + (audienceType === 'segment' ? 'var(--status-active)' : 'rgba(255,255,255,0.1)'), borderRadius: '8px', cursor: 'pointer' }}>
                            <input type="radio" checked={audienceType === 'segment'} onChange={() => setAudienceType('segment')} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>Saved Segment</div>
                                {audienceType === 'segment' && (
                                    <select value={selectedSegment} onChange={e => setSelectedSegment(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                        <option value="">Select a segment...</option>
                                        {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.contact_count})</option>)}
                                    </select>
                                )}
                            </div>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', border: '1px solid ' + (audienceType === 'tag' ? 'var(--status-active)' : 'rgba(255,255,255,0.1)'), borderRadius: '8px', cursor: 'pointer' }}>
                            <input type="radio" checked={audienceType === 'tag'} onChange={() => setAudienceType('tag')} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>Specific Tag</div>
                                {audienceType === 'tag' && (
                                    <input type="text" value={selectedTag} onChange={e => setSelectedTag(e.target.value)} placeholder="e.g. VIP" style={{ width: '100%', padding: 'var(--space-2)', marginTop: 'var(--space-2)' }} />
                                )}
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {/* Step 3: Message */}
            {step === 3 && (
                <div>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-6)' }}>Choose Content</h2>
                    <div className="form-group">
                        <label>Select Saved Template</label>
                        <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ width: '100%', padding: 'var(--space-3)' }} disabled={enableAB}>
                            <option value="">Select a template...</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    {templateId && !enableAB && (
                        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', backgroundColor: '#DCF8C6', color: '#303030', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                            {templates.find(t => t.id === templateId)?.body}
                        </div>
                    )}
                </div>
            )}

            {/* Step 4: A/B Testing */}
            {step === 4 && (
                <div>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-6)' }}>A/B Testing Lab (Optional)</h2>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                        <input type="checkbox" checked={enableAB} onChange={e => setEnableAB(e.target.checked)} />
                        <span>Enable A/B Testing for this campaign</span>
                    </label>
                    
                    {enableAB && (
                        <div className="form-group">
                            <label>Select Draft Experiment</label>
                            <select value={experimentId} onChange={e => setExperimentId(e.target.value)} style={{ width: '100%', padding: 'var(--space-3)' }}>
                                <option value="">Select an experiment...</option>
                                {experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                            <p style={{ marginTop: 'var(--space-2)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                Note: Selecting an experiment overrides the template selected in Step 3. The dispatcher will randomly assign variants based on the experiment configuration.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Step 5 & 6 & 7: Streamlined for standard configuration */}
            {step === 5 && (
                 <div>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-6)' }}>Time Bounds</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label>Send Window Start (Hour)</label>
                            <input type="number" min="0" max="23" value={config.send_window_start} onChange={e => setConfig({...config, send_window_start: e.target.value})} style={{ width: '100%', padding: 'var(--space-3)' }} />
                        </div>
                        <div className="form-group">
                            <label>Send Window End (Hour)</label>
                            <input type="number" min="0" max="23" value={config.send_window_end} onChange={e => setConfig({...config, send_window_end: e.target.value})} style={{ width: '100%', padding: 'var(--space-3)' }} />
                        </div>
                    </div>
                </div>
            )}
            
            {step === 6 && (
                 <div>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-6)' }}>Anti-Ban Stealth Override</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label>Jitter Min</label>
                            <input type="number" step="0.1" value={config.jitter_min} onChange={e => setConfig({...config, jitter_min: e.target.value})} style={{ width: '100%', padding: 'var(--space-3)' }} />
                        </div>
                        <div className="form-group">
                            <label>Jitter Max</label>
                            <input type="number" step="0.1" value={config.jitter_max} onChange={e => setConfig({...config, jitter_max: e.target.value})} style={{ width: '100%', padding: 'var(--space-3)' }} />
                        </div>
                    </div>
                </div>
            )}

            {step === 7 && (
                <div>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-6)' }}>Review & Launch</h2>
                    <div style={{ padding: 'var(--space-4)', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <h3 style={{ fontWeight: 600, color: 'var(--status-active)', marginBottom: 'var(--space-4)' }}>{name || 'Unnamed Campaign'}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', fontSize: '0.875rem' }}>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Target Audience: </span> 
                                {audienceType.toUpperCase()} {audienceType === 'tag' ? `[${selectedTag}]` : ''}
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>A/B Enabled: </span> 
                                {enableAB ? 'Yes' : 'No'}
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Send Window: </span> 
                                {config.send_window_start}:00 - {config.send_window_end}:00
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Footer */}
            <div style={{ position: 'absolute', bottom: 'var(--space-6)', left: 'var(--space-6)', right: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-6)' }}>
                <button className="btn btn-ghost" onClick={handleBack} disabled={step === 1}>Back</button>
                
                {step < 7 ? (
                    <button className="btn btn-primary" onClick={handleNext}>Continue</button>
                ) : (
                    <button className="btn btn-primary" onClick={handleLaunch}>🚀 Launch Campaign</button>
                )}
            </div>

        </div>
    </div>
  );
}
