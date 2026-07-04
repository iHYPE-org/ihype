'use client';

import { useState } from 'react';

export function PayoutFanView({
  priceCents,
  artistPct,
  venuePct,
  promoterPct,
}: {
  priceCents: number;
  artistPct: number;
  venuePct: number;
  promoterPct: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const artistShare = Math.round(priceCents * artistPct / 100);
  const venueShare = Math.round(priceCents * venuePct / 100);
  const promoterShare = Math.round(priceCents * promoterPct / 100);

  return (
    <div className="payout-card" style={{ background: 'var(--bg-2, #0e0b08)', border: '1px solid var(--line, rgba(255,255,255,.08))', borderRadius: 18, padding: '1.5rem', marginBottom: '1.25rem' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink, #f0ebe5)' }}
        type="button"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem' }}>What each fan sees</span>
        </div>
        <svg style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 150ms' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.75" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {expanded && (
        <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line, rgba(255,255,255,.08))', background: 'var(--bg-3, #0a0805)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-2, #9e9080)', lineHeight: 1.6, marginBottom: 10 }}>
            Every fan who bought a ticket sees this same breakdown. Their receipt shows:
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }}>Your {fmt(priceCents)}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-2, #9e9080)', lineHeight: 1.5 }}>{fmt(artistShare)} artist · {fmt(venueShare)} venue · {fmt(promoterShare)} promoter · $0 iHYPE</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }}>iHYPE fee</span>
              <span style={{ fontSize: '0.78rem', color: '#22e5d4', lineHeight: 1.5 }}>$0.00 — locked in our charter. Forever.</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }}>Paid out</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-2, #9e9080)', lineHeight: 1.5 }}>Automatically. Same night.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
