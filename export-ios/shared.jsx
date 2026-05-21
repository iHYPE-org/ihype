// Shared tokens + primitives for iHYPE improvement mockups
// Mirrors the live Workbench design system

const T = {
  bg:'#0a0805', bg2:'#100d09', bg3:'#1a1612', bg4:'#221c16',
  ink:'#f0ebe5', ink2:'#9e9080', ink3:'#5a5048', ink4:'#3a342e',
  line:'rgba(255,255,255,.06)', line2:'rgba(255,255,255,.14)',
  accent:'#ff5029',
  // role colors
  fan:'#b983ff', artist:'#ff5029', venue:'#22e5d4', promoter:'#ff3e9a',
  // utility
  warn:'#ffb84a', blue:'#7fb3ff',
  fd:"'Syne',sans-serif", fb:"'DM Sans',sans-serif", fm:"'JetBrains Mono',monospace", fs:"'Instrument Serif',serif",
};

// ─── Inline SVG icons ────────────────────────────────────────────
const I = {
  bolt:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  heart:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/></svg>,
  play:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M6 4l14 8L6 20z"/></svg>,
  search:(s=14,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={c} strokeWidth="1.6"/><path d="M20 20l-3.5-3.5" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></svg>,
  arrow:(s=12,c='currentColor',d='right')=>{
    const r={right:0,down:90,left:180,up:270}[d]||0;
    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{transform:`rotate(${r}deg)`}}><path d="M5 12h14m-5-6l6 6-6 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  },
  check:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>,
  pin:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" stroke={c} strokeWidth="1.5"/><circle cx="12" cy="10" r="2.5" stroke={c} strokeWidth="1.5"/></svg>,
  qr:(s=14,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="6" height="6" stroke={c} strokeWidth="1.6"/><rect x="15" y="3" width="6" height="6" stroke={c} strokeWidth="1.6"/><rect x="3" y="15" width="6" height="6" stroke={c} strokeWidth="1.6"/><path d="M14 14h3v3h-3zm5 0h2v2h-2zm-5 5h3v2h-3zm5 0h2v2h-2zm-5 3h2v-1m3 1v-2" stroke={c} strokeWidth="1.4"/></svg>,
  vote:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M4 11l4 4 12-12" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V8" stroke={c} strokeWidth="1.6"/></svg>,
  trending:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 17l6-6 4 4 8-9M17 6h4v4" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  calendar:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke={c} strokeWidth="1.6"/><path d="M3 10h18M8 3v4M16 3v4" stroke={c} strokeWidth="1.6"/></svg>,
  share:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke={c} strokeWidth="1.6"/><circle cx="6" cy="12" r="3" stroke={c} strokeWidth="1.6"/><circle cx="18" cy="19" r="3" stroke={c} strokeWidth="1.6"/><path d="M9 11l6-4M9 14l6 3" stroke={c} strokeWidth="1.6"/></svg>,
  verified:(s=12,c='currentColor')=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2l2.5 2.5L18 4l1 3.5L22 9l-1.5 3 1.5 3-3 1.5-1 3.5-3.5-.5L12 22l-2.5-2.5L6 20l-1-3.5L2 15l1.5-3L2 9l3-1.5L6 4l3.5.5L12 2z" stroke={c} strokeWidth="1.4"/><path d="M8 12l3 3 5-6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// ─── Generic frame chrome for fixed-size mockups ─────────────────
function Frame({ children, w, h, label, sub, accent = T.accent, dense }) {
  return (
    <div style={{ width: w, height: h, background: T.bg, color: T.ink, fontFamily: T.fb, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {label && (
        <div style={{ position:'absolute', top:0, left:0, right:0, padding:'10px 16px', fontFamily:T.fm, fontSize:10, letterSpacing:'.16em', textTransform:'uppercase', color:T.ink3, borderBottom:`1px solid ${T.line}`, display:'flex', alignItems:'center', gap:8, background:`${accent}08`, zIndex:5 }}>
          <span style={{ width:6, height:6, borderRadius:99, background:accent }} />
          {label} {sub && <span style={{ color:T.ink4, letterSpacing:'.04em', textTransform:'none', marginLeft:'auto', fontSize:10 }}>{sub}</span>}
        </div>
      )}
      <div style={{ flex:1, paddingTop:label?34:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Desktop Workbench shell (top bar, rail, content) ────────────
function WBShell({ role, roleColor, userName, children, rail = 'home' }) {
  const RAIL_ITEMS = [
    { k:'home',     label:'Home' },
    { k:'discover', label:'Seeds' },
    { k:'charts',   label:'Charts' },
    { k:'shows',    label:'Shows' },
    { k:'gov',      label:'Govern' },
    { k:'settings', label:'Settings' },
  ];
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
      {/* Top bar */}
      <div style={{ height:42, borderBottom:`1px solid ${T.line}`, background:T.bg2, display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0 }}>
        <div style={{ fontFamily:T.fd, fontWeight:800, letterSpacing:'-.02em', fontSize:16 }}>iHYPE</div>
        <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.14em', color:T.ink3, padding:'3px 8px', border:`1px solid ${roleColor}40`, borderRadius:4, color:roleColor }}>{role.toUpperCase()}</div>
        <div style={{ flex:1, position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, height:26, padding:'0 12px', background:T.bg3, border:`1px solid ${T.line}`, borderRadius:6, fontFamily:T.fm, fontSize:11, color:T.ink3, maxWidth:340, margin:'0 auto' }}>
            {I.search(12, T.ink3)} Search artists, shows, venues
            <span style={{ marginLeft:'auto', fontSize:9, color:T.ink4 }}>⌘K</span>
          </div>
        </div>
        <div style={{ width:24, height:24, borderRadius:99, background:roleColor, color:T.bg, fontFamily:T.fd, fontWeight:800, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>{userName.split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
      </div>
      <div style={{ flex:1, display:'flex', minHeight:0 }}>
        {/* Rail */}
        <div style={{ width:88, borderRight:`1px solid ${T.line}`, background:T.bg2, padding:'14px 0', display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
          {RAIL_ITEMS.map(it => (
            <div key={it.k} style={{ padding:'10px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:5, color: it.k===rail ? T.ink : T.ink3, background: it.k===rail ? T.bg3 : 'transparent', borderLeft: `2px solid ${it.k===rail ? roleColor : 'transparent'}` }}>
              <div style={{ width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {it.k==='home' && I.bolt(14, 'currentColor')}
                {it.k==='discover' && I.heart(14, 'currentColor')}
                {it.k==='charts' && I.trending(14, 'currentColor')}
                {it.k==='shows' && I.calendar(14, 'currentColor')}
                {it.k==='gov' && I.vote(14, 'currentColor')}
                {it.k==='settings' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" stroke="currentColor" strokeWidth="1.4"/></svg>}
              </div>
              <div style={{ fontFamily:T.fm, fontSize:8, letterSpacing:'.12em', textTransform:'uppercase' }}>{it.label}</div>
            </div>
          ))}
        </div>
        {/* Content */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Common building blocks ──────────────────────────────────────
function Eyebrow({ children, c = T.ink3 }) {
  return <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.18em', color:c, textTransform:'uppercase' }}>{children}</div>;
}
function Stat({ l, v, d, c = T.accent, big }) {
  return (
    <div style={{ padding:'14px 16px', border:`1px solid ${T.line}`, borderRadius:10, background:T.bg2 }}>
      <Eyebrow>{l}</Eyebrow>
      <div style={{ fontFamily:T.fd, fontWeight:700, fontSize: big?38:26, letterSpacing:'-.015em', marginTop:8 }}>{v}</div>
      {d && <div style={{ fontFamily:T.fm, fontSize:10, color:c, marginTop:6 }}>{d}</div>}
    </div>
  );
}
function Panel({ title, link, meta, children, style }) {
  return (
    <section style={{ border:`1px solid ${T.line}`, borderRadius:10, background:T.bg2, overflow:'hidden', ...style }}>
      {title && (
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.line}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:14, letterSpacing:'-.005em' }}>{title}</div>
          {link && <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink2, letterSpacing:'.1em', textTransform:'uppercase' }}>{link}</div>}
          {meta && <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, letterSpacing:'.04em' }}>{meta}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
function Btn({ children, accent = T.accent, ghost, sm }) {
  return (
    <button style={{
      padding: sm ? '6px 12px' : '9px 16px',
      background: ghost ? 'transparent' : accent,
      color: ghost ? T.ink : T.bg,
      border: ghost ? `1px solid ${T.line2}` : 'none',
      borderRadius: 6,
      fontFamily: T.fm, fontSize: sm?10:12, fontWeight:600, letterSpacing:'.04em',
      display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer',
    }}>{children}</button>
  );
}
function Sparkbar({ data, w = 180, h = 40, c = T.accent }) {
  const max = Math.max(...data);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${data.length*4} ${h}`} preserveAspectRatio="none" style={{ display:'block' }}>
      {data.map((v, i) => {
        const bh = (v / max) * (h - 4);
        return <rect key={i} x={i*4} y={h - bh} width={3} height={bh} fill={c} opacity={0.4 + (v/max)*0.6} />;
      })}
    </svg>
  );
}

// ─── Pre-made placeholder "album art" (no SVG drawing of imagery)
function AlbumArt({ c = T.accent, size = 72, label }) {
  return (
    <div style={{ width:size, height:size, borderRadius:6, background:`linear-gradient(135deg, ${c}, ${c}66 60%, ${c}30)`, position:'relative', overflow:'hidden', flexShrink:0 }}>
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 60%), radial-gradient(circle at 75% 80%, rgba(0,0,0,.3), transparent 60%)` }}/>
      {label && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end', padding:6, fontFamily:T.fd, fontWeight:800, fontSize:size>120?20:11, lineHeight:1, color:'rgba(255,255,255,.85)', textShadow:'0 1px 4px rgba(0,0,0,.4)' }}>{label}</div>}
    </div>
  );
}

Object.assign(window, { T, I, Frame, WBShell, Eyebrow, Stat, Panel, Btn, Sparkbar, AlbumArt });
