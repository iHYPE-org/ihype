'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ─── Icon ────────────────────────────────────────────────────────────────────

const ICON_PATHS: Record<string, string> = {
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  venue: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
};

function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.75 }: {
  name: string; size?: number; color?: string; strokeWidth?: number;
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || '' }}
    />
  );
}

// ─── Logo ────────────────────────────────────────────────────────────────────

function Logo({ gradient = false, size = 'md' }: { gradient?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const fs = size === 'lg' ? '2rem' : size === 'sm' ? '0.95rem' : '1.25rem';
  const accentStyle = gradient
    ? {
        background: 'linear-gradient(90deg,#ff4635,#ff3d87 35%,#7c5cff 68%,#39d8df)',
        WebkitBackgroundClip: 'text' as const,
        backgroundClip: 'text' as const,
        color: 'transparent',
      }
    : { color: 'var(--accent)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ fontFamily: 'var(--f-d)', fontWeight: 900, fontSize: fs, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>
        <span style={{ color: 'var(--ink)' }}>i</span>
        <span style={accentStyle}>HYPE</span>
      </span>
    </span>
  );
}

// ─── HypeButton ──────────────────────────────────────────────────────────────

function HypeButton({ initialCount = 0, initiallyHyped = false }: { initialCount?: number; initiallyHyped?: boolean }) {
  const [count, setCount] = useState(initialCount);
  const [hyped, setHyped] = useState(initiallyHyped);
  const [pop, setPop] = useState(false);
  function toggle() {
    const was = hyped;
    setHyped(!was);
    setCount(c => was ? Math.max(0, c - 1) : c + 1);
    if (!was) { setPop(true); setTimeout(() => setPop(false), 350); }
  }
  return (
    <button
      type="button" onClick={toggle} aria-pressed={hyped}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 1.25rem', minHeight: '2.6rem',
        borderRadius: 'var(--radius-pill)',
        border: hyped ? '1px solid transparent' : '1px solid var(--line-2)',
        background: hyped ? 'var(--accent)' : 'var(--hair-50)',
        color: hyped ? '#fff' : 'var(--ink)',
        fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: '0.9rem',
        cursor: 'pointer',
        transform: pop ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform .2s cubic-bezier(.34,1.56,.64,1), background .15s ease',
      }}
    >
      <Icon name={hyped ? 'check' : 'flame'} size={17} color={hyped ? '#fff' : 'var(--accent)'} strokeWidth={hyped ? 3 : 1.75} />
      {hyped ? 'Hyped' : 'Hype'} {count.toLocaleString()}
    </button>
  );
}

// ─── StatTile ────────────────────────────────────────────────────────────────

function StatTile({ value, label, color = 'var(--accent)' }: { value: string; label: string; color?: string }) {
  return (
    <div style={{
      padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--hair-100)',
      background: 'linear-gradient(135deg, var(--hair-40), transparent)',
      minWidth: 190,
    }}>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.03em', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7060', marginTop: 7 }}>{label}</div>
    </div>
  );
}

// ─── ListRow ─────────────────────────────────────────────────────────────────

function ListRow({ icon, iconTint = 'var(--accent)', title, subtitle }: {
  icon?: string; iconTint?: string; title: string; subtitle?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--hair-100)',
      background: 'linear-gradient(135deg, var(--hair-40), transparent)',
    }}>
      {icon && (
        <span style={{
          width: 42, height: 42, borderRadius: 'var(--radius-md)', flexShrink: 0,
          display: 'grid', placeItems: 'center', color: '#fff',
          background: `linear-gradient(135deg, ${iconTint}cc, ${iconTint}44)`,
        }}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--f-b)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ fontFamily: 'var(--f-m)', fontSize: '0.72rem', color: '#7a7060', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ─── SplitBar ────────────────────────────────────────────────────────────────

const SPLIT = [
  { key: 'artist', pct: 70, color: 'var(--role-artist)', label: 'Artist' },
  { key: 'venue', pct: 20, color: 'var(--role-venue)', label: 'Venue' },
  { key: 'promoter', pct: 10, color: 'var(--role-promoter)', label: 'Promoter' },
];

function SplitBar({ total }: { total?: number }) {
  const money = (pct: number) => `$${((total! * pct) / 100).toFixed(2)}`;
  return (
    <div>
      <div style={{ display: 'flex', width: '100%', height: 12, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
        {SPLIT.map(s => (
          <div key={s.key} style={{ width: `${s.pct}%`, background: s.color, opacity: 0.92 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', marginTop: 10 }}>
        {SPLIT.map(s => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--f-m)', fontSize: 13, color: '#9e9080' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
            {s.label}
            <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{total != null ? money(s.pct) : `${s.pct}%`}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── QRCode (visual placeholder) ─────────────────────────────────────────────

function qrMatrix(seed: string, n = 25): boolean[][] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rng = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const m: boolean[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => rng() > 0.5));
  const finder = (r0: number, c0: number) => {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const edge = i === 0 || i === 6 || j === 0 || j === 6;
      const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      m[r0 + i][c0 + j] = edge || core;
    }
    for (let k = -1; k <= 7; k++) {
      if (c0 + 7 < n && r0 + k >= 0 && r0 + k < n) m[r0 + k][c0 + 7] = false;
      if (r0 + 7 < n && c0 + k >= 0 && c0 + k < n) m[r0 + 7][c0 + k] = false;
      if (c0 - 1 >= 0 && r0 + k >= 0 && r0 + k < n) m[r0 + k][c0 - 1] = false;
      if (r0 - 1 >= 0 && c0 + k >= 0 && c0 + k < n) m[r0 - 1][c0 + k] = false;
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  return m;
}

function QRCode({ value = 'IHYPE', size = 176 }: { value?: string; size?: number }) {
  const m = React.useMemo(() => qrMatrix(value), [value]);
  const n = m.length, cell = size / n;
  return (
    <div style={{ background: '#fff', padding: 12, borderRadius: 'var(--radius-md)', lineHeight: 0 }}>
      <svg width={size} height={size} shapeRendering="crispEdges">
        {m.map((row, r) => row.map((on, c) => on
          ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#0a0805" />
          : null
        ))}
      </svg>
    </div>
  );
}

function QRPass({ artist, detail, admits = 1, serial = 'IH-0000-0000' }: {
  artist: string; detail?: string; admits?: number; serial?: string;
}) {
  return (
    <div style={{
      borderRadius: 'var(--radius-2xl)', overflow: 'hidden',
      border: '1px solid var(--line-2)',
      background: '#1a1612', maxWidth: 340, width: '100%',
      boxShadow: '0 32px 80px rgba(0,0,0,.5)',
    }}>
      <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, var(--accent), #ff3e9a)' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>
          iHYPE · admit {admits}
        </div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.5rem', color: '#fff', letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.1 }}>{artist}</div>
        {detail && <div style={{ fontFamily: 'var(--f-b)', fontSize: '0.85rem', color: 'rgba(255,255,255,.92)', marginTop: 4 }}>{detail}</div>}
      </div>
      <div style={{ position: 'relative', height: 0 }}>
        <span style={{ position: 'absolute', left: -10, top: -10, width: 20, height: 20, borderRadius: '50%', background: '#0a0805' }} />
        <span style={{ position: 'absolute', right: -10, top: -10, width: 20, height: 20, borderRadius: '50%', background: '#0a0805' }} />
      </div>
      <div style={{ padding: '1.75rem 1.5rem 1.5rem', display: 'grid', placeItems: 'center', gap: '1rem', borderTop: '2px dashed var(--hair-100)' }}>
        <QRCode value={serial} />
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '0.8rem', letterSpacing: '0.1em', color: '#9e9080' }}>{serial}</div>
        <div style={{ fontFamily: 'var(--f-b)', fontSize: '0.78rem', color: '#7a7060', textAlign: 'center' }}>Scan at the door · transferable · no app required</div>
      </div>
    </div>
  );
}

// ─── Shared slide-level helpers ───────────────────────────────────────────────

function Kick({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'var(--f-m)', fontSize: 17, letterSpacing: '.2em', textTransform: 'uppercase', color: '#ff5029' }}>{children}</div>;
}

function H({ children, size = 64, style }: { children: React.ReactNode; size?: number; style?: React.CSSProperties }) {
  return <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, letterSpacing: '-.04em', color: 'var(--ink)', lineHeight: .95, margin: 0, fontSize: size, ...style }}>{children}</h2>;
}

function Body({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontFamily: 'var(--f-b)', color: '#9e9080', lineHeight: 1.6, margin: 0, ...style }}>{children}</p>;
}

function StepCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 22, padding: 34,
      background: 'linear-gradient(135deg, var(--hair-40), transparent)',
      border: '1px solid var(--hair-100)', ...style,
    }}>
      {children}
    </div>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'var(--f-m)', fontSize: 15, letterSpacing: '.14em', color: '#7a7060' }}>{children}</div>;
}

// ─── Slides ───────────────────────────────────────────────────────────────────

const SLIDE_STYLE: React.CSSProperties = {
  width: 1280, height: 720,
  position: 'absolute', inset: 0,
  boxSizing: 'border-box', overflow: 'hidden',
  display: 'flex',
};

function Slide01Cover() {
  return (
    <section style={{ ...SLIDE_STYLE, background: '#0a0805', padding: 88, flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', filter: 'blur(120px)', top: -200, left: -120, background: 'radial-gradient(circle, rgba(255,80,41,.3), transparent 70%)' }} />
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', filter: 'blur(120px)', bottom: -240, right: -120, background: 'radial-gradient(circle, rgba(185,131,255,.22), transparent 70%)' }} />
      <div style={{ position: 'relative' }}><Logo size="lg" /></div>
      <div style={{ position: 'relative' }}>
        <Kick>Product walkthrough</Kick>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, letterSpacing: '-.04em', color: 'var(--ink)', lineHeight: .95, margin: '22px 0 0', fontSize: 92 }}>One loop.<br />Four roles.<br />Zero fees.</h1>
        <Body style={{ fontSize: 23, maxWidth: '60ch', marginTop: 26 }}>
          How a single hype turns into a booked show, a sold ticket, a paid artist, and a fan who got in early — with iHYPE taking nothing.
        </Body>
      </div>
    </section>
  );
}

function Slide02Problem() {
  return (
    <section style={{ ...SLIDE_STYLE, background: '#100d09', padding: 88, flexDirection: 'column', justifyContent: 'center' }}>
      <Kick>The status quo</Kick>
      <H size={60} style={{ maxWidth: '20ch', marginTop: 26 }}>The middle takes the most.</H>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginTop: 48 }}>
        <StepCard>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 52, letterSpacing: '-.04em', color: '#ff5029', lineHeight: .95 }}>27%</div>
          <Body style={{ marginTop: 10, fontSize: 17 }}>Ticketmaster fees on top of face value.</Body>
        </StepCard>
        <StepCard>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 52, letterSpacing: '-.04em', color: '#b983ff', lineHeight: .95 }}>$0.003</div>
          <Body style={{ marginTop: 10, fontSize: 17 }}>Spotify per stream to the artist.</Body>
        </StepCard>
        <StepCard>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 52, letterSpacing: '-.04em', color: '#22e5d4', lineHeight: .95 }}>0</div>
          <Body style={{ marginTop: 10, fontSize: 17 }}>Transparency into where your money goes.</Body>
        </StepCard>
      </div>
    </section>
  );
}

function Slide03Loop() {
  const roles = [
    { label: 'Fan hypes', color: '#b983ff' },
    { label: 'Venue sees demand', color: '#22e5d4' },
    { label: 'Artist accepts', color: '#ff5029' },
    { label: 'Fan buys', color: 'var(--ink)' },
    { label: 'Promoter earns', color: '#ffb84a' },
    { label: 'Everyone paid', color: '#22e5d4' },
  ];
  return (
    <section style={{ ...SLIDE_STYLE, background: '#0a0805', padding: '80px 88px', flexDirection: 'column', justifyContent: 'center' }}>
      <Kick>The iHYPE loop</Kick>
      <H size={54} style={{ marginTop: 24, marginBottom: 44 }}>Every role feeds the next.</H>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {roles.map((r, i) => (
          <React.Fragment key={r.label}>
            <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, color: r.color }}>{r.label}</span>
            {i < roles.length - 1 && <span style={{ color: '#7a7060', fontSize: 24 }}>→</span>}
          </React.Fragment>
        ))}
      </div>
      <Body style={{ fontSize: 20, marginTop: 40, maxWidth: '62ch' }}>
        The next slides walk one show through the whole loop — Midnight Echo at The Echo.
      </Body>
    </section>
  );
}

function Slide04Hype() {
  return (
    <section style={{ ...SLIDE_STYLE, background: '#0a0805', padding: 88, flexDirection: 'column', justifyContent: 'center' }}>
      <Num>01 / 06 · FAN</Num>
      <H size={64} style={{ marginTop: 18 }}>A fan hypes a track.</H>
      <Body style={{ fontSize: 21, maxWidth: '58ch', marginTop: 22 }}>
        In Seeds, swiping right on Midnight Echo spends one of five weekly hypes. Hype is scarce, so it&rsquo;s a real signal — not a free like.
      </Body>
      <div style={{ marginTop: 40, display: 'flex', gap: 14, alignItems: 'center' }}>
        <HypeButton initialCount={1284} initiallyHyped={true} />
        <Body style={{ fontSize: 18 }}>scarce by design · 5 per week</Body>
      </div>
    </section>
  );
}

function Slide05Demand() {
  return (
    <section style={{ ...SLIDE_STYLE, background: '#0a0805', padding: 88, flexDirection: 'column', justifyContent: 'center' }}>
      <Num>02 / 06 · VENUE</Num>
      <H size={64} style={{ marginTop: 18 }}>Demand radar lights up.</H>
      <Body style={{ fontSize: 21, maxWidth: '58ch', marginTop: 22 }}>
        Aggregated local hype tells The Echo who&rsquo;s about to pop — so they book the room before the rest of the city catches on.
      </Body>
      <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
        <StatTile value="+61%" label="Local hype, 30d" color="var(--role-venue)" />
        <StatTile value="#1" label="On the LA radar" color="var(--accent)" />
      </div>
    </section>
  );
}

function Slide06Booking() {
  return (
    <section style={{ ...SLIDE_STYLE, background: '#0a0805', padding: 88, flexDirection: 'column', justifyContent: 'center' }}>
      <Num>03 / 06 · ARTIST</Num>
      <H size={64} style={{ marginTop: 18 }}>The offer becomes a show.</H>
      <Body style={{ fontSize: 21, maxWidth: '58ch', marginTop: 22 }}>
        The venue sends a booking offer; it lands in the artist&rsquo;s inbox. One tap to accept turns it into a live, on-sale show.
      </Body>
      <div style={{ marginTop: 40, maxWidth: 560 }}>
        <ListRow icon="venue" iconTint="var(--role-venue)" title="The Echo — Fri Jun 27" subtitle="300 cap · $18 · offer accepted" />
      </div>
    </section>
  );
}

function Slide07Ticket() {
  return (
    <section style={{ ...SLIDE_STYLE, background: '#0a0805', padding: '80px 88px', flexDirection: 'row', alignItems: 'center', gap: 64 }}>
      <div style={{ flex: 1 }}>
        <Num>04 / 06 · FAN</Num>
        <H size={60} style={{ marginTop: 18 }}>A ticket, at face value.</H>
        <Body style={{ fontSize: 21, maxWidth: '46ch', marginTop: 22 }}>
          $18 is $18. Zero service fees. And every buyer can see exactly where their money goes — 70% artist, 20% venue, 10% promoter.
        </Body>
        <div style={{ marginTop: 34, maxWidth: 420 }}>
          <SplitBar total={18} />
        </div>
      </div>
      <QRPass artist="Midnight Echo" detail="The Echo · Fri Jun 27" admits={1} serial="IH-S1-4F2A91" />
    </section>
  );
}

function Slide08Referral() {
  return (
    <section style={{ ...SLIDE_STYLE, background: '#0a0805', padding: 88, flexDirection: 'column', justifyContent: 'center' }}>
      <Num>05 / 06 · PROMOTER</Num>
      <H size={64} style={{ marginTop: 18 }}>Sharing pays the fan back.</H>
      <Body style={{ fontSize: 21, maxWidth: '58ch', marginTop: 22 }}>
        Any fan who shares their link earns the 10% promoter cut on every ticket it sells. Fans become the marketing — and get paid for it.
      </Body>
      <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
        <StatTile value="$1.80" label="Per ticket referred" color="var(--role-fan)" />
        <StatTile value="0%" label="Skimmed by iHYPE" color="var(--success)" />
      </div>
    </section>
  );
}

function Slide09Payout() {
  return (
    <section style={{ ...SLIDE_STYLE, background: '#0a0805', padding: 88, flexDirection: 'column', justifyContent: 'center' }}>
      <Num>06 / 06 · EVERYONE</Num>
      <H size={60} style={{ marginTop: 18 }}>Paid out. Then the doors open.</H>
      <Body style={{ fontSize: 21, maxWidth: '60ch', marginTop: 22 }}>
        Payouts hit automatically — artist and fan see the same receipt. On the night, show-night mode checks fans in, counts live crowd hype, and surfaces the QR at the door.
      </Body>
      <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
        <StatTile value="$2,912" label="Artist 70%" color="var(--role-artist)" />
        <StatTile value="$832" label="Venue 20%" color="var(--role-venue)" />
        <StatTile value="$0" label="iHYPE fee" color="var(--success)" />
      </div>
    </section>
  );
}

function Slide10Surfaces() {
  const surfaces = [
    { title: 'Web', body: 'Marketing → role-aware home → shows → artist → radio' },
    { title: 'Mobile', body: 'Native iOS + Android app — Seeds, show-night, wallet' },
    { title: 'Studio', body: 'Creator workbench, demand radar, payout receipts' },
    { title: 'Ticketing', body: '0%-fee checkout → QR pass' },
    { title: 'Design system', body: '31 components, 112 tokens, 5 templates' },
    { title: 'Brand', body: 'Warm-dark, Syne display, the 70/20/10 promise' },
  ];
  return (
    <section style={{ ...SLIDE_STYLE, background: '#100d09', padding: 88, flexDirection: 'column', justifyContent: 'center' }}>
      <Kick>What ships today</Kick>
      <H size={54} style={{ marginTop: 26, marginBottom: 40 }}>Every surface, designed.</H>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {surfaces.map(s => (
          <StepCard key={s.title} style={{ padding: 26 }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.04em', color: 'var(--ink)', lineHeight: .95 }}>{s.title}</div>
            <Body style={{ fontSize: 16, marginTop: 8 }}>{s.body}</Body>
          </StepCard>
        ))}
      </div>
    </section>
  );
}

function Slide11Quote() {
  return (
    <section style={{ ...SLIDE_STYLE, background: 'linear-gradient(135deg,#ff5029,#ff3e9a 55%,#b983ff)', padding: 96, flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--f-s)', fontSize: 62, lineHeight: 1.18, color: '#fff', maxWidth: '24ch' }}>
        &ldquo;70% to the artist, 20% to the venue, 10% to whoever brought the fan. iHYPE takes nothing.&rdquo;
      </div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 18, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)', marginTop: 40 }}>
        Locked in the charter
      </div>
    </section>
  );
}

function Slide12Close() {
  return (
    <section style={{ ...SLIDE_STYLE, background: '#0a0805', padding: 88, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#ff5029,#ff3e9a,#b983ff)' }} />
      <Logo size="lg" gradient />
      <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, letterSpacing: '-.04em', color: 'var(--ink)', lineHeight: .95, margin: '32px 0 0', fontSize: 80 }}>
        For the scene,<br />not the algorithm.
      </h2>
      <Body style={{ fontSize: 22, marginTop: 24 }}>ihype.org</Body>
    </section>
  );
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

const SLIDES = [
  Slide01Cover, Slide02Problem, Slide03Loop, Slide04Hype, Slide05Demand,
  Slide06Booking, Slide07Ticket, Slide08Referral, Slide09Payout,
  Slide10Surfaces, Slide11Quote, Slide12Close,
];

export function WalkthroughDeck() {
  const [index, setIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const show = useCallback((n: number) => {
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, n)));
  }, []);

  useEffect(() => {
    function scale() {
      if (!stageRef.current) return;
      stageRef.current.style.transform = `scale(${Math.min(window.innerWidth / 1280, window.innerHeight / 720)})`;
    }
    scale();
    window.addEventListener('resize', scale);
    return () => window.removeEventListener('resize', scale);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') { show(index + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { show(index - 1); e.preventDefault(); }
      if (e.key === 'Escape') { /* no-op; just prevent defaults */ }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, show]);

  const CurrentSlide = SLIDES[index];

  return (
    <>
      <style>{`
        #wt-wrap { position: fixed; inset: 0; display: grid; place-items: center; overflow: hidden; z-index: 9999; background: #060504; }
        #wt-stage { width: 1280px; height: 720px; transform-origin: center; flex-shrink: 0; position: relative; }
        #wt-nav { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; z-index: 10000; }
        #wt-nav button { width: 40px; height: 40px; border-radius: 999px; border: 1px solid var(--hair-160); background: var(--line); color: var(--ink); font-size: 16px; cursor: pointer; display: grid; place-items: center; }
        #wt-nav button:hover { background: var(--hair-120); }
        #wt-count { font-family: var(--f-m); font-size: 13px; letter-spacing: .14em; color: #7a7060; min-width: 64px; text-align: center; }
        @media print {
          @page { size: 1280px 720px; margin: 0; }
          #wt-wrap { position: static; display: block; background: #060504; }
          #wt-stage { transform: none !important; width: 1280px; height: auto; }
          #wt-nav { display: none !important; }
        }
      `}</style>
      <div id="wt-wrap">
        <div id="wt-stage" ref={stageRef}>
          <CurrentSlide />
        </div>
        <div id="wt-nav">
          <button onClick={() => show(index - 1)} aria-label="Previous slide" disabled={index === 0} style={{ opacity: index === 0 ? 0.3 : 1 }}>←</button>
          <span id="wt-count">{index + 1} / {SLIDES.length}</span>
          <button onClick={() => show(index + 1)} aria-label="Next slide" disabled={index === SLIDES.length - 1} style={{ opacity: index === SLIDES.length - 1 ? 0.3 : 1 }}>→</button>
        </div>
      </div>
    </>
  );
}
