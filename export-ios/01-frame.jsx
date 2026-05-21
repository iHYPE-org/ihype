// PhoneFrame — iPhone 16 chrome around any screen content.
// Reuses IOSStatusBar from ios-frame.jsx so the status bar is consistent
// across every screen. Inner screens must NOT draw their own status bar.

const FRAME_W = 390;
const FRAME_H = 844;
const STATUS_H = 54; // reserved top padding for status bar / island

function PhoneFrame({ children, dark = true }) {
  return (
    <div style={{
      width: FRAME_W + 16, height: FRAME_H + 16,
      borderRadius: 56, background: '#0a0805',
      padding: 8, position: 'relative',
      boxShadow: 'inset 0 0 0 1.5px #2a2520, 0 36px 90px rgba(0,0,0,.5)',
    }}>
      <div style={{
        width: FRAME_W, height: FRAME_H, borderRadius: 48,
        overflow: 'hidden', position: 'relative',
        background: dark ? T.bg : '#fff',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Dynamic island */}
        <div style={{
          position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
          width: 122, height: 36, borderRadius: 22, background: '#000', zIndex: 50,
        }} />
        {/* Status bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, pointerEvents: 'none' }}>
          <IOSStatusBar dark={dark} />
        </div>
        {/* Content area */}
        <div style={{ flex: 1, paddingTop: STATUS_H, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
        {/* Home indicator */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          width: 134, height: 5, borderRadius: 100,
          background: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)',
          zIndex: 60, pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

// ─── iHYPE-specific tab bar ──────────────────────────────────────
function TabBar({ active = 'seeds' }) {
  const items = [
    { k: 'home',     label: 'Home',    icon: I.bolt },
    { k: 'seeds',    label: 'Seeds',   icon: I.heart },
    { k: 'charts',   label: 'Charts',  icon: I.trending },
    { k: 'shows',    label: 'Shows',   icon: I.calendar },
    { k: 'you',      label: 'You',     icon: (s,c)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.6"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={c} strokeWidth="1.6"/></svg> },
  ];
  return (
    <div style={{
      borderTop: `1px solid ${T.line}`,
      background: 'rgba(10,8,5,.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      padding: '8px 0 22px',
      display: 'flex', justifyContent: 'space-around',
      flexShrink: 0,
    }}>
      {items.map(it => {
        const c = it.k === active ? T.accent : T.ink3;
        return (
          <div key={it.k} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'4px 10px', color: c,
          }}>
            <div style={{ width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {it.icon(22, c)}
            </div>
            <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.1em', fontWeight:600 }}>{it.label.toUpperCase()}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Header used by most secondary screens ───────────────────────
function ScreenHeader({ title, eyebrow, accent = T.accent, right, big }) {
  return (
    <div style={{ padding:'4px 22px 14px', flexShrink:0 }}>
      {eyebrow && (
        <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.18em', color:accent, textTransform:'uppercase', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:5, height:5, borderRadius:99, background:accent }}/>
          {eyebrow}
        </div>
      )}
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12 }}>
        <h1 style={{
          fontFamily: T.fd, fontWeight: 800, letterSpacing:'-.025em',
          fontSize: big ? 34 : 26, margin: 0, lineHeight: 1, color: T.ink,
        }}>{title}</h1>
        {right}
      </div>
    </div>
  );
}

Object.assign(window, { PhoneFrame, TabBar, ScreenHeader, FRAME_W, FRAME_H, STATUS_H });
