'use client';

import React, { useState, memo } from 'react';
import { IcBolt } from '@/components/WorkbenchShell';

// ── View: Radio studio ─────────────────────────────────────────
export const ViewRadioStudio = memo(function ViewRadioStudio() {
  const [showName, setShowName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [desc, setDesc] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const field: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink)', outline: 'none', boxSizing: 'border-box' as const };
  const lbl: React.CSSProperties = { fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: 'var(--wb-ink-3)', marginBottom: 6, display: 'block' };
  const grp: React.CSSProperties = { display: 'flex', flexDirection: 'column' as const };

  async function handleSubmit() {
    if (!showName.trim()) { setErrMsg('Show name is required.'); return; }
    setErrMsg('');
    setSubmitStatus('loading');
    await new Promise(r => setTimeout(r, 600));
    setSubmitStatus('success');
  }

  function handleReset() {
    setSubmitStatus('idle');
    setShowName(''); setSchedule(''); setDesc('');
  }

  if (submitStatus === 'success') return (
    <div className="wb-view-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>📻</div>
      <h2 className="wb-page-title" style={{ fontSize: 28 }}>{showName || 'Your show'}</h2>
      <p className="wb-page-sub">Your show is scheduled. Fans can find it in the Radio tab.</p>
      <button className="wb-btn-prime" onClick={handleReset}>Create another</button>
    </div>
  );

  return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: '#ff3e9a' }}>● RADIO STUDIO · ALL ROLES CAN BROADCAST</div>
      <h1 className="wb-page-title">Create a show</h1>
      <p className="wb-page-sub">Launch a live or prerecorded radio show. Anyone can curate music, tell people what they love, and share it with the scene. Radio shows are free community programming, not a payout product.</p>

      {(
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
          <div className="wb-panel">
            <div className="wb-panel-head"><div className="wb-panel-title">Show details</div></div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={grp}><label style={lbl}>SHOW NAME</label><input style={field} value={showName} onChange={e => setShowName(e.target.value)} placeholder="e.g. Late Night with Maya" /></div>
              <div style={grp}><label style={lbl}>BROADCAST SCHEDULE</label><input style={field} value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="e.g. Fridays 10pm CT" /></div>
              <div style={grp}><label style={lbl}>DESCRIPTION</label><textarea rows={4} style={{ ...field, resize: 'vertical' as const }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's the vibe? Genre, format, guests…" /></div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="wb-panel" style={{ padding: '18px 16px' }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--wb-ink-3)', marginBottom: 12 }}>PREVIEW</div>
              <div style={{ aspectRatio: '1', borderRadius: 8, background: 'linear-gradient(135deg, #ff3e9a, #b983ff80)', marginBottom: 14, maxHeight: 120 }} />
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--wb-ink)' }}>{showName || 'Your show name'}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', marginTop: 4 }}>{schedule || 'Schedule TBD'}</div>
            </div>
            <div className="wb-panel" style={{ padding: '18px 16px', display: 'grid', gap: 14 }}>
              <div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--wb-ink)' }}>Community curation</div>
                <p style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', lineHeight: 1.6, margin: '8px 0 0' }}>
                  Build a playlist-style show, spotlight artists, or host a live listening room. These broadcasts help music travel through real people.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  ['Curate', 'Add the songs and artists you want others to hear.'],
                  ['Share', 'Send listeners to the Radio tab or your public show archive.'],
                  ['Refer tickets separately', 'Referral payouts only apply when someone buys a ticket to a ticketed show with your referral code.']
                ].map(([label, copy]) => (
                  <div key={label} style={{ padding: '10px 12px', border: '1px solid var(--wb-line-2)', borderRadius: 8, background: 'var(--wb-bg-3)' }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: '#ff3e9a', marginBottom: 4 }}>{label.toUpperCase()}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)', lineHeight: 1.55 }}>{copy}</div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleSubmit} className="wb-btn-prime" style={{ width: '100%', justifyContent: 'center' }}>
                Schedule &amp; publish →
              </button>
            </div>
            {errMsg && <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff5029', padding: '8px 12px', border: '1px solid rgba(255,80,41,.3)', borderRadius: 6 }}>{errMsg}</div>}
          </div>
        </div>
      )}

    </div>
  );
});
