'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp } from './context';
import { IHYPE_DATA, lookupArtist } from '@/lib/data';
import { track } from '@/lib/analytics';

// Base overlay for bottom sheets
function SheetBase({ children, onClose, zIndex = 60 }: { children: React.ReactNode; onClose: () => void; zIndex?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-surface)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 18px' }} />
        {children}
      </div>
    </div>
  );
}

// Artist profile sheet
export function ArtistProfileSheet() {
  const { sheetData, closeSheet, openSheet, toast } = useApp();
  const [hyped, setHyped] = useState(false);
  if (!sheetData?.artist) return null;
  const a = lookupArtist(sheetData.artist);
  const show = IHYPE_DATA.shows.find(s => s.artist === a.name);
  return (
    <SheetBase onClose={closeSheet}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-.02em' }}>{a.name}</div>
        <button onClick={closeSheet} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      {/* Cover */}
      <div style={{ width: '100%', height: 160, borderRadius: 18, background: `linear-gradient(135deg,${IHYPE_DATA.shows.find(s => s.artist === a.name)?.tint || '#ff5029'}88,#0a0805)`, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: 14, left: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>{a.city}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {a.tags.map(t => <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: '.62rem', padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,.12)', color: 'rgba(240,235,229,.8)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t}</span>)}
          </div>
        </div>
      </div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[['Hypes', a.hype.toLocaleString(), 'var(--accent)'], ['Monthly', a.monthly, '#22e5d4'], ['Shows', show ? '1 near you' : 'No shows', '#b983ff']].map(([l, v, c]) => (
          <div key={l} style={{ padding: '10px 10px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-raised)', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', color: c }}>{v}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.6rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
      {/* Bio */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '.84rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>{a.bio}</p>
      {/* Tracks */}
      {a.tracks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Top tracks</div>
          {a.tracks.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.6rem 0', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ width: 28, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.86rem' }}>{t.t}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-3)', marginTop: 2 }}>{t.plays} plays · {t.len}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { setHyped(h => !h); if (!hyped) toast(`Hyped ${a.name} ✓`); track('hype_artist', { artist: a.name }); }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${hyped ? 'var(--accent)' : 'var(--line)'}`, background: hyped ? 'rgba(255,80,41,.1)' : 'transparent', color: hyped ? 'var(--accent)' : 'var(--ink-2)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>{hyped ? '🔥 Hyped' : 'Hype'}</button>
        <button style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>Follow</button>
        {show && <button onClick={() => openSheet('live-event', show)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>Get tickets</button>}
      </div>
    </SheetBase>
  );
}

// Live event overlay
export function LiveEventOverlay() {
  const { sheetData, closeSheet, toast } = useApp();
  const ev = sheetData;
  if (!ev) return null;
  const tint = ev.tint || '#ff5029';
  return (
    <SheetBase onClose={closeSheet} zIndex={75}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff3c3c', display: 'inline-block', boxShadow: '0 0 6px #ff3c3c' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#ff3c3c' }}>Live now</span>
        </div>
        <button onClick={closeSheet} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ width: '100%', height: 120, borderRadius: 16, background: `linear-gradient(135deg,${tint}88,#0a0805)`, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%,${tint}44,transparent 70%)` }} />
        <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem' }}>{ev.artist || ev.title}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'rgba(240,235,229,.7)' }}>{ev.venue} · {ev.city}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--line)', marginBottom: 16 }}>
        {[[(ev.hype || 1284).toLocaleString(), 'Hype count', tint], [ev.date || 'Tonight', 'Date', 'var(--ink-2)'], [`$${ev.price || 18}`, 'Per ticket', '#22e5d4']].map(([v, l, c]) => (
          <div key={l}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: c }}>{v}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.62rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      <button onClick={() => { toast('🎟 Ticket saved!'); track('live_event_purchase', { artist: ev.artist }); closeSheet(); }} style={{ width: '100%', padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,80,41,.3)' }}>Get ticket · ${ev.price || 18}</button>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-3)', textAlign: 'center', marginTop: 8 }}>+ $0.00 fees · 45% to artist</p>
    </SheetBase>
  );
}

// Settings sheet
export function SettingsSheet() {
  const { closeSheet, toast } = useApp();
  return (
    <SheetBase onClose={closeSheet}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>Settings</div>
        <button onClick={closeSheet} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      {[
        { label: 'Edit profile', icon: '👤' },
        { label: 'Notifications', icon: '🔔' },
        { label: 'Privacy', icon: '🔒' },
        { label: 'Payouts', icon: '💸' },
        { label: 'Invite friends', icon: '🎟' },
      ].map(item => (
        <div key={item.label} onClick={() => toast(`${item.label} — coming soon`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          <div style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.9rem' }}>{item.label}</div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      ))}
      <div style={{ marginTop: 16, padding: '10px', borderRadius: 12, background: 'rgba(255,184,74,.08)', border: '1px solid rgba(255,184,74,.2)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: '#ffb84a', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Beta 0.1.0-beta.5</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '.78rem', color: 'var(--ink-3)', lineHeight: 1.5 }}>Simulated purchases only. No real transactions in beta.</div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href="/register" style={{ display: 'block', padding: '11px', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.9rem', textAlign: 'center', textDecoration: 'none' }}>
          Create a real account →
        </Link>
        <Link href="/login" style={{ display: 'block', padding: '10px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: '.78rem', textAlign: 'center', textDecoration: 'none' }}>
          Log in
        </Link>
      </div>
    </SheetBase>
  );
}

// Earnings sheet
export function EarningsSheet() {
  const { closeSheet, openSheet } = useApp();
  const earnings = IHYPE_DATA.dj.earnings;
  return (
    <SheetBase onClose={closeSheet}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>Earnings</div>
        <button onClick={closeSheet} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[['Cleared', earnings.cleared, 'var(--accent)'], ['Pending', earnings.pending, '#22e5d4'], ['Rate', earnings.rate, '#b983ff'], ['Source', 'Referrals', 'var(--ink-2)']].map(([l, v, c]) => (
          <div key={l} style={{ padding: '12px', borderRadius: 13, border: '1px solid var(--line)', background: 'var(--bg-raised)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Recent activity</div>
      {[
        { desc: 'Referral — Midnight Echo ticket', amount: '+$4.20', when: '3h ago', color: 'var(--accent)' },
        { desc: 'Hype payout — week 24', amount: '+$12.00', when: '2d ago', color: '#22e5d4' },
        { desc: 'Promoter pool — The Echo Jun 20', amount: '+$6.60', when: '1w ago', color: '#b983ff' },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.75rem 0', borderBottom: '1px solid var(--line-2)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.84rem' }}>{r.desc}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--ink-3)', marginTop: 2 }}>{r.when}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', color: r.color }}>{r.amount}</div>
        </div>
      ))}
      <button onClick={() => openSheet('payout')} style={{ width: '100%', marginTop: 16, padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.92rem', cursor: 'pointer' }}>Cash out {earnings.cleared}</button>
    </SheetBase>
  );
}

// Payout sheet
export function PayoutSheet() {
  const { closeSheet, toast } = useApp();
  return (
    <SheetBase onClose={closeSheet}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>Cash out</div>
        <button onClick={closeSheet} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: '20px', borderRadius: 16, border: '1px solid rgba(34,229,212,.25)', background: 'rgba(34,229,212,.06)', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2.5rem', color: '#22e5d4', lineHeight: 1 }}>{IHYPE_DATA.dj.earnings.cleared}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--ink-3)', marginTop: 6, letterSpacing: '.08em', textTransform: 'uppercase' }}>Available to withdraw</div>
      </div>
      {['Apple Pay', 'Venmo', 'Bank transfer'].map((method, i) => (
        <div key={i} onClick={() => { toast(`${method} payout initiated — beta simulated`); closeSheet(); }} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-raised)', marginBottom: 8, cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-surface)', display: 'grid', placeItems: 'center', fontSize: 18 }}>{['', '💸', '🏦'][i]}</div>
          <div style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.9rem' }}>{method}</div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      ))}
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-3)', textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>Beta: payouts are simulated. Real banking pending nonprofit approval.</p>
    </SheetBase>
  );
}

// Post-purchase
export function PostPurchaseSheet() {
  const { closeSheet } = useApp();
  return (
    <SheetBase onClose={closeSheet}>
      <div style={{ textAlign: 'center', paddingTop: 12 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎟</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-.02em', marginBottom: 8 }}>You're in.</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '.86rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 24 }}>Ticket confirmed. 45% is already on its way to the artist. See you there.</div>
        <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', gap: 2, marginBottom: 20 }}>
          <div style={{ flex: 45, background: '#ff5029', borderRadius: '999px 0 0 999px' }} />
          <div style={{ flex: 45, background: '#22e5d4' }} />
          <div style={{ flex: 10, background: '#b983ff', borderRadius: '0 999px 999px 0' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--ink-3)', marginBottom: 6 }}>Artist · Venue · iHYPE</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--ink-3)', marginBottom: 24 }}>45% · 45% · 10%</div>
        <button onClick={closeSheet} style={{ width: '100%', padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer' }}>Done →</button>
      </div>
    </SheetBase>
  );
}

// Friend activity
export function FriendActivitySheet() {
  const { closeSheet } = useApp();
  const friends = [
    { name: 'Jordan M', action: 'Hyped Midnight Echo', when: '5m ago', tint: '#ff5029' },
    { name: 'Alex R', action: 'Bought ticket to Sunroom', when: '1h ago', tint: '#ffb84a' },
    { name: 'Sam K', action: 'Saved Cold Harbor', when: '2h ago', tint: '#5b8cff' },
    { name: 'Mia L', action: 'Started Late Set radio', when: '3h ago', tint: '#ff3e9a' },
  ];
  return (
    <SheetBase onClose={closeSheet}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>Friend activity</div>
        <button onClick={closeSheet} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      {friends.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.75rem 0', borderBottom: '1px solid var(--line-2)' }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: f.tint, flexShrink: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', fontSize: '.85rem' }}>{f.name[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.86rem' }}>{f.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--ink-3)', marginTop: 2 }}>{f.action}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: 'var(--ink-3)' }}>{f.when}</div>
        </div>
      ))}
    </SheetBase>
  );
}

// Playlist create
export function PlaylistCreateSheet() {
  const { closeSheet, toast } = useApp();
  const [name, setName] = useState('');
  return (
    <SheetBase onClose={closeSheet}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>New playlist</div>
        <button onClick={closeSheet} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Playlist name…" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink-1)', fontFamily: 'var(--font-body)', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
      <button onClick={() => { if (name.trim()) { toast(`Playlist "${name}" created`); closeSheet(); } }} disabled={!name.trim()} style={{ width: '100%', padding: '12px', borderRadius: 999, background: name.trim() ? 'var(--accent)' : 'var(--bg-raised)', color: name.trim() ? '#fff' : 'var(--ink-3)', border: 'none', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.92rem', cursor: name.trim() ? 'pointer' : 'default' }}>Create playlist →</button>
    </SheetBase>
  );
}

// Notifications sheet
export function NotificationsSheet() {
  const { closeSheet, markNotifsRead } = useApp();
  const notifs = IHYPE_DATA.notifications;
  const ICONS: Record<string, string> = { hype: '🔥', ticket: '🎟', referral: '💸', show: '🎤' };
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)' }} onClick={() => { markNotifsRead(); closeSheet(); }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'var(--bg-surface)', borderRadius: '0 0 24px 24px', padding: '1rem 1.15rem 1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,.5)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>Notifications</div>
          <button onClick={() => { markNotifsRead(); closeSheet(); }} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {notifs.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 12, padding: '.85rem 0', borderBottom: '1px solid var(--line-2)' }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'rgba(255,80,41,.12)', display: 'grid', placeItems: 'center', fontSize: 16 }}>{ICONS[n.type] || '•'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.85rem', lineHeight: 1.3 }}>{n.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.65rem', color: 'var(--ink-3)', flexShrink: 0 }}>{n.time}</div>
          </div>
        ))}
        <button onClick={() => { markNotifsRead(); closeSheet(); }} style={{ width: '100%', marginTop: 12, padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: '.82rem', cursor: 'pointer' }}>Mark all as read</button>
      </div>
    </div>
  );
}

// Global search sheet
export function GlobalSearchSheet() {
  const { closeSheet, openSheet } = useApp();
  const [q, setQ] = useState('');
  const pool = [
    ...IHYPE_DATA.seeds.map(s => ({ type: 'Artist', name: s.artist, sub: s.track, tint: s.tint })),
    ...IHYPE_DATA.shows.map(s => ({ type: 'Show', name: s.title, sub: s.venue, tint: s.tint })),
  ];
  const results = q ? pool.filter(r => (r.name + r.sub).toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)' }} onClick={closeSheet}>
      <div onClick={e => e.stopPropagation()} style={{ padding: '1rem 1.15rem', background: 'var(--bg-surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search iHYPE…" style={{ width: '100%', padding: '12px 36px 12px 40px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink-1)', fontFamily: 'var(--font-body)', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box' }} />
          {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 18 }}>×</button>}
        </div>
      </div>
      <div style={{ padding: '1rem 1.15rem', overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}>
        {!q && (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Recent searches</div>
            {IHYPE_DATA.searchRecents.map(r => (
              <div key={r} onClick={() => setQ(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.6rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3" /></svg>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '.88rem', color: 'var(--ink-2)' }}>{r}</span>
              </div>
            ))}
          </>
        )}
        {results.map((r, i) => (
          <div key={i} onClick={() => { if (r.type === 'Artist') { closeSheet(); setTimeout(() => openSheet('artist-profile', { artist: r.name }), 50); } }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.6rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: r.tint, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: '#fff', fontWeight: 700 }}>{r.type[0]}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.88rem' }}>{r.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>{r.type} · {r.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
