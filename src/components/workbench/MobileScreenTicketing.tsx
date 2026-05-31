'use client';

import React, { useState } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T, WMPill, WMChip, WMViewHead, IWasThereButton } from './MobilePrimitives';

// ─── Screen: Ticketing ───────────────────────────────────────
export function MobileScreenTicketing({ data, onHypersSheet, onRadioTab }: {
  data: WorkbenchData;
  onHypersSheet?: (showId: string) => void;
  onRadioTab?: () => void;
}) {
  const [subTab, setSubTab] = useState(0);
  const subTabs = ['Upcoming', 'My Tickets', 'Past', 'Sell'];
  const [resendState, setResendState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [transferSheetOrderId, setTransferSheetOrderId] = React.useState<string | null>(null);
  const [transferEmail, setTransferEmail] = React.useState('');
  const [transferState, setTransferState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const handleResend = async () => {
    setResendState('loading');
    try {
      const res = await fetch('/api/tickets/resend-confirmation', { method: 'POST' });
      setResendState(res.ok ? 'done' : 'error');
      setTimeout(() => setResendState('idle'), 3000);
    } catch { setResendState('error'); setTimeout(() => setResendState('idle'), 3000); }
  };

  const handleTransfer = async (orderId: string) => {
    if (!transferEmail.trim()) return;
    setTransferState('loading');
    try {
      const res = await fetch(`/api/tickets/${orderId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: transferEmail }),
      });
      if (res.ok) {
        setTransferState('done');
        setTimeout(() => { setTransferSheetOrderId(null); setTransferState('idle'); setTransferEmail(''); }, 2000);
      } else {
        setTransferState('error');
      }
    } catch { setTransferState('error'); }
  };

  return (
    <>
      <WMViewHead
        eyebrow="LIVE EVENTS · SERIALIZED · ON-PLATFORM RESALE"
        title="Ticketing"
        sub="Buy. Reassign anytime. 45/45/10 — artist, venue, promoter — every time."
        actions={<><WMChip>⌕ Search</WMChip><WMChip>⌖ Near Chicago ▾</WMChip></>}
      />

      <div style={{ padding: '0 18px' }}>
        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 2, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {subTabs.map((t, i) => (
            <button key={t} onClick={() => setSubTab(i)} style={{
              padding: '7px 12px', borderRadius: 6, fontFamily: T.fm, fontSize: 12, fontWeight: 600,
              letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
              background: i === subTab ? T.bg3 : 'transparent', color: i === subTab ? T.ink : T.ink3, border: 'none',
            }}>{t}</button>
          ))}
        </div>

        {/* Event cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {data.shows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 18px', color: T.ink3, fontFamily: T.fb, fontSize: 14, background: T.bg2, borderRadius: 12, border: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🎟️</div>
              No tickets yet —{' '}
              <button onClick={onRadioTab} style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontFamily: T.fb, fontSize: 14, padding: 0, textDecoration: 'underline' }}>
                find shows near you in Radio →
              </button>
            </div>
          )}
          {data.shows.map((e, i) => {
            const pct = e.capacity > 0 ? (e.sold / e.capacity) * 100 : 0;
            const isHot = pct > 85 || e.status === 'TONIGHT';
            return (
              <div key={e.id} style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ height: 110, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg,${data.tracks[i % data.tracks.length]?.color ?? T.accent},${T.bg4})` }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 40%,rgba(0,0,0,.8) 100%)' }} />
                  <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
                    <WMPill tone={e.status === 'TONIGHT' ? 'live' : e.status === 'NEAR SOLD' ? 'pink' : 'soft'}>
                      {e.status === 'TONIGHT' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />}
                      {e.status}
                    </WMPill>
                  </div>
                  <button onClick={() => onHypersSheet?.(e.id)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, fontFamily: T.fm, fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', padding: '4px 9px', borderRadius: 99, border: 'none', cursor: 'pointer' }}>
                    ♥ {e.hype}
                  </button>
                  <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 2, color: '#fff' }}>
                    <h3 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 20, letterSpacing: '-.025em', margin: 0 }}>{e.name}</h3>
                    <p style={{ fontFamily: T.fm, fontSize: 12, color: 'rgba(255,255,255,.78)', letterSpacing: '.1em', margin: '3px 0 0', textTransform: 'uppercase' }}>{e.venue} · CHICAGO</p>
                  </div>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: T.fm, fontSize: 13, color: T.ink, fontWeight: 600, letterSpacing: '.06em' }}>{e.date} · {e.time}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>{e.sold}/{e.capacity} sold</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <a href={`/api/shows/${e.id}/qr`} target="_blank" rel="noreferrer" style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, textDecoration: 'none', padding: '5px 8px', borderRadius: 6, border: `1px solid ${T.line2}`, letterSpacing: '.06em' }}>QR</a>
                    <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, letterSpacing: '-.025em', color: T.ink }}>${e.price}</div>
                    <button style={{
                      padding: '7px 14px', borderRadius: 7, fontFamily: T.fm, fontSize: 12, fontWeight: 700,
                      letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', color: T.bg,
                      background: isHot ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.ink,
                    }}>Buy</button>
                  </div>
                </div>
                <div style={{ width: '100%', height: 4, background: T.bg, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${T.accent},${T.pink})`, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* My tickets */}
        <div style={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 15, color: T.ink, margin: 0 }}>My Tickets</h2>
            <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em' }}>{data.tickets.length} active</span>
          </div>
          {data.tickets.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontFamily: T.fb, fontSize: 13, color: T.ink3 }}>
              No tickets yet.
            </div>
          )}
          {data.tickets.map((tk, i, arr) => {
            const isWait = tk.status === 'WAITLIST';
            return (
              <div key={tk.id} style={{
                display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 12, alignItems: 'center',
                padding: '12px 16px', borderBottom: i === arr.length - 1 ? 'none' : `1px dashed ${T.line}`,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 6, border: `1px dashed ${isWait ? T.amber : T.line2}`,
                  background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 34, height: 34, opacity: isWait ? .3 : .7, background: `linear-gradient(90deg,${T.ink} 1px,transparent 1px) 0 0/5px 5px, linear-gradient(0deg,${T.ink} 1px,transparent 1px) 0 0/5px 5px` }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{tk.showName}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>{tk.date}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', marginTop: 3 }}>{tk.code}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, fontWeight: 600, letterSpacing: '.08em' }}>{tk.seat}</span>
                  <WMPill tone={isWait ? 'amber' : 'teal'}>{tk.status}</WMPill>
                  {tk.showId && <IWasThereButton showId={tk.showId} />}
                  {tk.id && (
                    <button
                      onClick={() => setTransferSheetOrderId(tk.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontFamily: T.fm, fontSize: 11, padding: 0, fontWeight: 700 }}
                    >
                      Transfer →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Resend confirmation */}
        <button
          onClick={handleResend}
          disabled={resendState === 'loading'}
          style={{ width: '100%', marginBottom: 12, padding: '10px 0', borderRadius: 8, border: `1px solid ${T.line2}`, background: 'transparent', color: resendState === 'done' ? T.teal : T.ink2, fontFamily: T.fm, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {resendState === 'idle' && 'Resend ticket confirmation email'}
          {resendState === 'loading' && 'Sending…'}
          {resendState === 'done' && '✓ Email sent!'}
          {resendState === 'error' && 'Failed — try again'}
        </button>
      </div>

      {/* Transfer sheet */}
      {transferSheetOrderId && (
        <>
          <div onClick={() => setTransferSheetOrderId(null)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Transfer ticket</div>
            {transferState === 'done' ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.teal, fontFamily: T.fb }}>Ticket transferred!</div>
            ) : (
              <>
                <input
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  placeholder="Recipient email address"
                  style={{ width: '100%', background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, color: T.ink, fontFamily: T.fb, fontSize: 14, padding: '10px 12px', marginBottom: 12, boxSizing: 'border-box', outline: 'none' }}
                />
                <button
                  onClick={() => handleTransfer(transferSheetOrderId)}
                  disabled={transferState === 'loading' || !transferEmail.trim()}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: transferEmail.trim() ? `linear-gradient(135deg,${T.accent},${T.pink})` : T.bg4, color: transferEmail.trim() ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 800, fontSize: 15, cursor: transferEmail.trim() ? 'pointer' : 'default' }}
                >
                  {transferState === 'loading' ? 'Transferring…' : transferState === 'error' ? 'Failed — retry' : 'Transfer'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
