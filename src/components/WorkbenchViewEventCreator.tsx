'use client';

import React, { useState } from 'react';
import { IcBolt } from '@/components/WorkbenchShell';

// ── View: Event creator ────────────────────────────────────────
export function ViewEventCreator() {
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [doorsTime, setDoorsTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const previewDate = date && startTime
    ? new Date(`${date}T${startTime}`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Date · Time';
  const previewPrice = price && Number(price) > 0 ? `$${Number(price).toFixed(2)}` : 'Free';
  const previewCap = capacity ? `0 / ${capacity} capacity` : '0 / — capacity';

  async function handleSubmit() {
    if (!name.trim()) { setErrMsg('Event name is required.'); return; }
    if (!date) { setErrMsg('Date is required.'); return; }
    setErrMsg('');
    setStatus('loading');
    try {
      const startsAt = startTime ? new Date(`${date}T${startTime}`).toISOString() : new Date(`${date}T20:00`).toISOString();
      const body: Record<string, unknown> = {
        title: name.trim(),
        description: desc.trim() || undefined,
        startsAt,
        isTicketed: Number(price) > 0,
        ticketPriceCents: Number(price) > 0 ? Math.round(Number(price) * 100) : 0,
        ticketCapacity: capacity ? Number(capacity) : 200,
        status: 'SCHEDULED',
      };
      const res = await fetch('/api/shows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setStatus('success');
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  const field: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--wb-bg-3)', border: '1px solid var(--wb-line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink)', outline: 'none', boxSizing: 'border-box' as const };
  const lbl: React.CSSProperties = { fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.12em', color: 'var(--wb-ink-3)', marginBottom: 6, display: 'block' };
  const grp: React.CSSProperties = { display: 'flex', flexDirection: 'column' as const };

  if (status === 'success') return (
    <div className="wb-view-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>🎉</div>
      <h2 className="wb-page-title" style={{ fontSize: 28 }}>{name}</h2>
      <p className="wb-page-sub">Your event is live. Fans can now find and ticket it.</p>
      <button className="wb-btn-prime" onClick={() => { setStatus('idle'); setName(''); setVenue(''); setDate(''); setStartTime(''); setPrice(''); setCapacity(''); setDesc(''); }}>
        Create another event
      </button>
    </div>
  );

  return (
    <div className="wb-view-pad">
      <div className="wb-eyebrow" style={{ color: '#ff5029' }}>● CREATE · YOUR SCENE · NO PLATFORM FEE</div>
      <h1 className="wb-page-title">Create an event</h1>
      <p className="wb-page-sub">Publish a show, set your ticket price, and sell directly to fans. iHYPE takes nothing.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start', marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="wb-panel">
            <div className="wb-panel-head"><div className="wb-panel-title">Event details</div></div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={grp}><label style={lbl}>EVENT NAME</label><input style={field} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maya Reyes — Halflight Release Show" /></div>
              <div style={grp}><label style={lbl}>VENUE</label><input style={field} value={venue} onChange={e => setVenue(e.target.value)} placeholder="Empty Bottle, Chicago IL" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={grp}><label style={lbl}>DATE</label><input type="date" style={field} value={date} onChange={e => setDate(e.target.value)} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={grp}><label style={lbl}>DOORS</label><input type="time" style={field} value={doorsTime} onChange={e => setDoorsTime(e.target.value)} /></div>
                  <div style={grp}><label style={lbl}>START</label><input type="time" style={field} value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={grp}><label style={lbl}>TICKET PRICE ($)</label><input type="number" min="0" style={field} value={price} onChange={e => setPrice(e.target.value)} placeholder="0 = free" /></div>
                <div style={grp}><label style={lbl}>CAPACITY</label><input type="number" min="1" style={field} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="200" /></div>
              </div>
              <div style={grp}><label style={lbl}>DESCRIPTION</label><textarea rows={4} style={{ ...field, resize: 'vertical' as const }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What should fans know? Vibe, lineup notes, age restriction, parking…" /></div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="wb-panel" style={{ padding: '18px 16px' }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--wb-ink-3)', marginBottom: 12 }}>PREVIEW</div>
            <div style={{ aspectRatio: '16/9', borderRadius: 8, background: 'linear-gradient(135deg, var(--wb-accent), #ff3e9a80)', marginBottom: 14 }} />
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: 'var(--wb-ink)' }}>{name || 'Your event name'}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-3)', marginTop: 4 }}>{venue || 'Venue'} · {previewDate}</div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--wb-line)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--wb-ink-2)' }}>{previewCap}</span>
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16, color: 'var(--wb-ink)' }}>{previewPrice}</span>
            </div>
          </div>
          {errMsg && <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#ff5029', padding: '8px 12px', border: '1px solid rgba(255,80,41,.3)', borderRadius: 6 }}>{errMsg}</div>}
          <button type="button" onClick={handleSubmit} disabled={status === 'loading'} className="wb-btn-prime" style={{ width: '100%', padding: '12px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: status === 'loading' ? 0.6 : 1 }}>
            <IcBolt s={13} /> {status === 'loading' ? 'Publishing…' : 'Publish event →'}
          </button>
          <p style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink-3)', textAlign: 'center', lineHeight: 1.6 }}>
            iHYPE takes 0% of ticket revenue. Fans pay face value, you keep everything.
          </p>
        </div>
      </div>
    </div>
  );
}
