// iHYPE Shell — Onboarding · Media Player · Bottom Tabs · Mobile Shell · Desktop Shell

const OB_KEY = 'ihype_onboarded_v2';
const OB_CITIES = ['Los Angeles', 'New York', 'Chicago', 'Austin', 'Nashville', 'Portland', 'Seattle'];
const OB_GENRES = ['dream-pop', 'shoegaze', 'lo-fi', 'r&b', 'jazz', 'hip-hop', 'punk', 'electronic', 'folk', 'indie-rock'];
const OB_ROLES = [
  { id: 'fan', label: 'Fan', icon: '🎶', desc: 'Discover events, hype artists, earn on referrals.' },
  { id: 'dj', label: 'DJ', icon: '📻', desc: 'Build your crate, host radio shows, earn promoter cuts.' },
  { id: 'artist', label: 'Artist', icon: '🎸', desc: 'Sell tickets direct. Keep 70%. No agents, no fees.' },
  { id: 'venue', label: 'Venue', icon: '🏟', desc: 'Book from the demand radar. 20% guaranteed.' },
];

function getPrefs() { try { return JSON.parse(localStorage.getItem(OB_KEY)); } catch (e) { return null; } }

function BetaGate({ onPass }) {
  const [code, setCode] = React.useState('');
  const [err, setErr] = React.useState(false);
  const CODES = ['IHYPE', 'HYPE2026', 'BETA', 'LISTEN'];
  const submit = () => {
    if (CODES.includes(code.trim().toUpperCase())) { localStorage.setItem('ihype_beta_ok', '1'); window.track && window.track('beta_gate_pass'); onPass(); }
    else { setErr(true); setTimeout(() => setErr(false), 1600); }
  };
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', textAlign: 'center', background: 'var(--bg)' }}>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 900, fontSize: '2.4rem', letterSpacing: '-.04em', color: 'var(--accent)' }}>iHYPE</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: '.66rem', letterSpacing: '.22em', textTransform: 'uppercase', color: '#ffb84a', marginTop: 6 }}>Closed Beta · Invite Only</div>
      <p style={{ fontFamily: 'var(--f-b)', fontSize: '.86rem', color: 'var(--ink-2)', marginTop: 18, lineHeight: 1.5, maxWidth: 280 }}>Enter your invite code to get early access to live shows, ticketing, and the radio studio.</p>
      <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="INVITE CODE" style={{ marginTop: 22, width: '100%', maxWidth: 260, padding: '13px 16px', borderRadius: 12, border: `1px solid ${err ? '#ff5029' : 'var(--line)'}`, background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--f-m)', fontSize: '.95rem', letterSpacing: '.14em', textAlign: 'center', textTransform: 'uppercase', outline: 'none', boxSizing: 'border-box' }} />
      {err && <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: '#ff5029', marginTop: 8 }}>Invalid code — try IHYPE</div>}
      <button onClick={submit} style={{ marginTop: 14, width: '100%', maxWidth: 260, padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.92rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,80,41,.3)' }}>Enter iHYPE</button>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: '.66rem', color: 'var(--ink-3)', marginTop: 18 }}>No code? <span style={{ color: '#ffb84a', cursor: 'pointer' }} onClick={() => { setCode('IHYPE'); }}>Use demo code</span></div>
    </div>
  );
}

function MeshBlob({ x, y, color, size, dur }) {
  return <div style={{ position:'absolute', left:x, top:y, width:size, height:size, borderRadius:'50%', background:color, filter:'blur(60px)', opacity:.35, animation:`meshMove ${dur} ease-in-out infinite alternate`, pointerEvents:'none' }} />;
}

function Onboarding({ onDone }) {
  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState(null);
  const [city, setCity] = React.useState('');
  const [genres, setGenres] = React.useState([]);
  const next = () => setStep(s => s + 1);
  const quickStart = () => {
    const data = { role: 'fan', city: 'Los Angeles', genres: ['dream-pop', 'lo-fi', 'electronic'] };
    localStorage.setItem(OB_KEY, JSON.stringify(data));
    window.IHYPE_USER_PREFS = data;
    window.track && window.track('onboarding_skip');
    onDone();
  };
  const finish = () => {
    const data = { role, city, genres };
    localStorage.setItem(OB_KEY, JSON.stringify(data));
    window.IHYPE_USER_PREFS = data;
    onDone();
  };
  const prog = [0.25, 0.5, 0.75, 1][step];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', padding: '1.5rem 1.25rem 1.25rem', position:'relative', overflow:'hidden' }}>
      <style>{'@keyframes meshMove{0%{transform:translate(0,0) scale(1)}100%{transform:translate(30px,20px) scale(1.15)}}'}</style>
      <MeshBlob x="-10%" y="-5%" color="#ff5029" size="55%" dur="4s" />
      <MeshBlob x="60%" y="20%" color="#b983ff" size="45%" dur="5.5s" />
      <MeshBlob x="10%" y="65%" color="#22e5d4" size="40%" dur="3.8s" />
      <div style={{ height: 3, borderRadius: 999, background: 'var(--bg-3)', marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: (prog * 100) + '%', background: 'var(--accent)', borderRadius: 999, transition: 'width .4s ease' }} />
      </div>
      {step === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', marginBottom: 6 }}>Who are you?</div>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>Pick your role. You can add more later.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {OB_ROLES.map(r => {
              const on = role === r.id;
              return (
                <div key={r.id} onClick={() => setRole(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.08)' : 'var(--bg-2)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{r.icon}</span>
                  <div><div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.95rem' }}>{r.label}</div><div style={{ fontFamily: 'var(--f-b)', fontSize: '.78rem', color: 'var(--ink-3)', marginTop: 2 }}>{r.desc}</div></div>
                  {on && <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'grid', placeItems: 'center' }}><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="1.5,6 4.5,9.5 10.5,2.5" /></svg></div>}
                </div>
              );
            })}
          </div>
          <button onClick={next} disabled={!role} style={{ marginTop: 20, width: '100%', padding: '13px', borderRadius: 999, background: role ? 'var(--accent)' : 'var(--bg-3)', color: role ? '#fff' : 'var(--ink-3)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.95rem', border: 'none', cursor: role ? 'pointer' : 'default' }}>Continue →</button>
          <button onClick={quickStart} style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 999, background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.78rem', border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}>Skip — explore the demo →</button>
        </div>
      )}
      {step === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', marginBottom: 16 }}>Your scene?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, alignContent: 'start' }}>
            {OB_CITIES.map(c => {
              const on = city === c;
              return <button key={c} onClick={() => setCity(c)} style={{ padding: '11px 10px', borderRadius: 12, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.08)' : 'var(--bg-2)', color: on ? 'var(--accent)' : 'var(--ink)', fontFamily: 'var(--f-b)', fontWeight: on ? 700 : 500, fontSize: '.85rem', cursor: 'pointer', textAlign: 'left' }}>{c}</button>;
            })}
          </div>
          <button onClick={next} disabled={!city} style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 999, background: city ? 'var(--accent)' : 'var(--bg-3)', color: city ? '#fff' : 'var(--ink-3)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.95rem', border: 'none', cursor: city ? 'pointer' : 'default' }}>Continue →</button>
        </div>
      )}
      {step === 2 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', marginBottom: 6 }}>What moves you?</div>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>Pick 3+ to personalize Seeds and events.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1, alignContent: 'start' }}>
            {OB_GENRES.map(g => {
              const on = genres.includes(g);
              return <button key={g} onClick={() => setGenres(gs => on ? gs.filter(x => x !== g) : [...gs, g])} style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.1)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: '.8rem', fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{g}</button>;
            })}
          </div>
          <button onClick={finish} disabled={genres.length < 3} style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 999, background: genres.length >= 3 ? 'var(--accent)' : 'var(--bg-3)', color: genres.length >= 3 ? '#fff' : 'var(--ink-3)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.95rem', border: 'none', cursor: genres.length >= 3 ? 'pointer' : 'default' }}>
            {genres.length < 3 ? `Pick ${3 - genres.length} more` : "Let's go →"}
          </button>
          <p style={{ textAlign:'center', fontFamily:'var(--f-m)', fontSize:'.62rem', color:'var(--ink-3)', lineHeight:1.6, marginTop:10 }}>By continuing you agree to our <a href="https://ihype.app/terms" target="_blank" style={{color:'var(--ink-2)'}}>Terms</a> &amp; <a href="https://ihype.app/privacy" target="_blank" style={{color:'var(--ink-2)'}}>Privacy Policy</a>.</p>
        </div>
      )}
    </div>
  );
}

function NotifCenter({ open, onClose, role }) {
  if (!open) return null;
  const D = window.IHYPE_DATA;
  const notifs = (D.notifications[role] || D.notifications.fan);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '0 0 24px 24px', padding: '1rem 1.15rem 1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,.5)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem' }}>Notifications</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {notifs.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 12, padding: '.85rem 0', borderBottom: '1px solid var(--line-2)' }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: n.unread ? 'rgba(255,80,41,.12)' : 'var(--bg-3)', display: 'grid', placeItems: 'center', fontSize: 16 }}>
              {{ ticket: '🎟', dollar: '💸', flame: '🔥', sprout: '🌱', radio: '📻', arrowUp: '📈', check: '✓', user: '👤' }[n.icon] || '•'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--f-b)', fontWeight: 700, fontSize: '.85rem', lineHeight: 1.3 }}>{n.title}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', color: 'var(--ink-3)' }}>{n.when}</div>
              {n.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
            </div>
          </div>
        ))}
        <button onClick={onClose} style={{ width: '100%', marginTop: 12, padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer' }}>Mark all as read</button>
      </div>
    </div>
  );
}

function Waveform({ playing, tint }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:2, height:20, flexShrink:0 }}>
      <style>{'@keyframes wv{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}'}</style>
      {['.4s','.2s','.55s','.3s','.45s'].map((d,i) => (
        <div key={i} style={{ width:3, height:'100%', borderRadius:2, background: tint||'var(--accent)', transformOrigin:'bottom', transform: playing?undefined:'scaleY(.25)', animation: playing?`wv ${[.7,.5,.8,.6,.75][i]}s ${d} ease-in-out infinite`:undefined, transition:'transform .3s' }} />
      ))}
    </div>
  );
}

function MediaPlayerBar({ track, playing, onToggle, onExpand }) {
  if (!track) return null;
  const tint = track.tint || 'var(--accent)';
  return (
    <div onClick={onExpand} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: `linear-gradient(90deg,${tint}18,rgba(14,11,8,.92))`, backdropFilter: 'blur(16px)', borderBottom: `1px solid ${tint}22`, cursor: 'pointer', flexShrink: 0, boxShadow:`0 2px 20px ${tint}18` }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg,${track.tint}cc,${track.tint}33)`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.t}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', color: 'var(--ink-3)' }}>{track.a}</div>
      </div>
      <Waveform playing={playing} tint={tint} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={e => { e.stopPropagation(); }} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="19,20 9,12 19,4" /><line x1="5" y1="4" x2="5" y2="20" /></svg>
        </button>
        <button onClick={e => { e.stopPropagation(); onToggle(); }} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          {playing
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>}
        </button>
        <button onClick={e => { e.stopPropagation(); }} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5,4 15,12 5,20" /><line x1="19" y1="4" x2="19" y2="20" /></svg>
        </button>
      </div>
    </div>
  );
}

function ExpandedPlayer({ track, playing, onToggle, onClose }) {
  const [progress, setProgress] = React.useState(38);
  if (!track) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: '2rem 1.5rem 1.5rem' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, alignSelf: 'center', marginBottom: 24 }}>⌄</button>
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 24, background: `linear-gradient(135deg,${track.tint}cc,${track.tint}22)`, marginBottom: 28 }} />
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-.03em' }}>{track.t}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.88rem', color: 'var(--ink-3)', marginTop: 4 }}>{track.a}</div>
      </div>
      <div style={{ marginBottom: 6, position: 'relative', height: 36, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', width: '100%', height: 3, borderRadius: 999, background: 'var(--bg-4)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: progress + '%', background: 'var(--accent)', borderRadius: 999 }} />
        </div>
        <input type="range" min={0} max={100} value={progress} onChange={e => setProgress(+e.target.value)} style={{ position: 'absolute', width: '100%', opacity: 0, cursor: 'pointer', height: 36 }} />
        <div style={{ position: 'absolute', left: progress + '%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg)', pointerEvents: 'none' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
        <span style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)' }}>1:{String(Math.round(progress * .42)).padStart(2, '0')}</span>
        <span style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)' }}>3:42</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
        <button style={{ background: 'none', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', padding: 0 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="19,20 9,12 19,4" /><line x1="5" y1="4" x2="5" y2="20" /></svg>
        </button>
        <button onClick={onToggle} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          {playing
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>}
        </button>
        <button style={{ background: 'none', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', padding: 0 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5,4 15,12 5,20" /><line x1="19" y1="4" x2="19" y2="20" /></svg>
        </button>
      </div>
    </div>
  );
}

// Beta advisory banner
const BETA_KEY = 'ihype_beta_dismissed_v1';
function BetaBanner() {
  const [dismissed, setDismissed] = React.useState(() => !!localStorage.getItem(BETA_KEY));
  const [expanded, setExpanded] = React.useState(false);
  if (dismissed) return null;
  return (
    <div style={{ flexShrink: 0, padding: '6px 12px 0' }}>
      <div style={{ borderRadius: 12, background: 'rgba(255,184,74,.08)', border: '1px solid rgba(255,184,74,.22)', overflow: 'hidden' }}>
        <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffb84a', flexShrink: 0, boxShadow: '0 0 6px #ffb84a' }} />
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#ffb84a', flex: 1 }}>Beta 0.1.0-beta.5 · Work in progress</span>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'rgba(255,184,74,.5)', marginRight: 4 }}>{expanded ? '▲' : '▼'}</span>
          <button onClick={e => { e.stopPropagation(); localStorage.setItem(BETA_KEY, '1'); setDismissed(true); }} style={{ background: 'none', border: 'none', color: 'rgba(255,184,74,.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
        {expanded && (
          <div style={{ padding: '0 10px 10px', borderTop: '1px solid rgba(255,184,74,.12)' }}>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: '.78rem', color: 'rgba(240,235,229,.65)', lineHeight: 1.6, margin: '8px 0 10px' }}>
              This is a beta build. Features may be incomplete or change. Ticket purchases are simulated — no real money moves.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.openIHYPEChangelog && window.openIHYPEChangelog()} style={{ flex: 1, padding: '6px', borderRadius: 8, border: '1px solid rgba(255,184,74,.2)', background: 'transparent', color: '#ffb84a', fontFamily: 'var(--f-m)', fontSize: '.68rem', cursor: 'pointer', letterSpacing: '.06em' }}>What's new</button>
              <button onClick={() => window.openIHYPEHelp && window.openIHYPEHelp()} style={{ flex: 1, padding: '6px', borderRadius: 8, border: '1px solid rgba(255,184,74,.2)', background: 'transparent', color: '#ffb84a', fontFamily: 'var(--f-m)', fontSize: '.68rem', cursor: 'pointer', letterSpacing: '.06em' }}>Help & FAQ</button>
              <button onClick={() => { localStorage.setItem(BETA_KEY, '1'); setDismissed(true); }} style={{ flex: 1, padding: '6px', borderRadius: 8, border: 'none', background: 'rgba(255,184,74,.12)', color: '#ffb84a', fontFamily: 'var(--f-m)', fontSize: '.68rem', cursor: 'pointer', letterSpacing: '.06em', fontWeight: 700 }}>Got it ✓</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Error boundary
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  render() {
    if (this.state.err) return (
      <div style={{ padding:'2rem', display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center' }}>
        <div style={{ fontSize:32 }}>⚠️</div>
        <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1rem' }}>Something went wrong</div>
        <div style={{ fontFamily:'var(--f-b)', fontSize:'.82rem', color:'var(--ink-3)', maxWidth:'28ch', lineHeight:1.6 }}>{String(this.state.err.message || this.state.err)}</div>
        <button onClick={() => this.setState({ err: null })} style={{ padding:'9px 22px', borderRadius:999, background:'var(--accent)', color:'#fff', border:'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.85rem', cursor:'pointer' }}>Retry</button>
      </div>
    );
    return this.props.children;
  }
}
ErrorBoundary.getDerivedStateFromError = e => ({ err: e });


function BottomTabs({ active, onTab, playing }) {
  const [pressed, setPressed] = React.useState(null);
  const tabs = [
    { id: 'listen', label: 'Listen', icon: (c, sz) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg> },
    { id: 'events', label: 'Events', icon: (c, sz) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" /></svg> },
    { id: 'pages', label: 'Pages', icon: (c, sz) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg> },
  ];
  return (
    <div style={{ display: 'flex', borderTop: '1px solid var(--line)', background: 'var(--bg-2)', paddingBottom: 22, paddingTop: 6, flexShrink: 0 }}>
      {tabs.map(t => {
        const on = t.id === active;
        const isPressed = pressed === t.id;
        const color = on ? 'var(--accent)' : isPressed ? 'var(--accent)' : 'var(--ink-3)';
        return (
          <button
            key={t.id}
            onPointerDown={() => setPressed(t.id)}
            onPointerUp={() => { setPressed(null); onTab(t.id); }}
            onPointerLeave={() => setPressed(null)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: '10px 0 5px', background: 'none', border: 'none', cursor: 'pointer',
              color, position: 'relative',
              transform: isPressed ? 'scale(.92)' : 'scale(1)',
              transition: 'transform .1s ease',
            }}>
            {/* neon glow pill when active */}
            {on && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 36, height: 3, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 10px 2px var(--accent)', opacity: .9 }} />}
            {/* pressed flash */}
            {isPressed && <span style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'rgba(255,80,41,.1)', pointerEvents: 'none' }} />}
            {t.id === 'listen' && playing && <span style={{ position: 'absolute', top: 8, right: 'calc(50% - 16px)', width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-2)', boxShadow: '0 0 6px var(--accent)' }} />}
            {t.icon(color, 26)}
            <span style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: on ? 700 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Register window globals; returns cleanup fn
const regGlobals = map => { Object.entries(map).forEach(([k,v]) => { window[k]=v; }); return () => Object.keys(map).forEach(k => delete window[k]); };

const WEEK_KEY = () => { const d = new Date(); const s = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-W' + Math.ceil(((d - s) / 86400000 + s.getDay() + 1) / 7); };
const getHypesLeft = () => { try { const b = JSON.parse(localStorage.getItem('ihype_hype_budget') || '{}'); return b.week === WEEK_KEY() ? (typeof b.left === 'number' ? b.left : 3) : 3; } catch (e) { return 3; } };

function MobileShellV2() {
  const prefs = getPrefs();
  const [betaOk, setBetaOk] = React.useState(!!localStorage.getItem('ihype_beta_ok'));
  const [onboarded, setOnboarded] = React.useState(!!prefs);
  const [tab, setTab] = React.useState('listen');
  const [playerExpanded, setPlayerExpanded] = React.useState(false);
  const [playing, setPlaying] = React.useState(true);
  const [nowPlaying, setNowPlaying] = React.useState({ t: 'Carousel', a: 'Midnight Echo', tint: '#ff5029' });
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifsRead, setNotifsRead] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [changelogOpen, setChangelogOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [tourOpen, setTourOpen] = React.useState(false);
  const [radioOpen, setRadioOpen] = React.useState(false);
  const [analyticsOpen, setAnalyticsOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [liveEvent, setLiveEvent] = React.useState(null);
  const [postShowRating, setPostShowRating] = React.useState(null);
  const [postPurchase, setPostPurchase] = React.useState(false);
  const [notifPrimer, setNotifPrimer] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [hypesLeft, setHypesLeft] = React.useState(getHypesLeft);
  const hypesLeftRef = React.useRef(3);
  React.useEffect(() => { hypesLeftRef.current = hypesLeft; }, [hypesLeft]);
  const [seedMatch, setSeedMatch] = React.useState(null);
  const [artistProfile, setArtistProfile] = React.useState(null);
  const openArtist = a => { setArtistProfile(a); history.pushState({ ihype: 'artist' }, ''); };
  const closeArtist = () => setArtistProfile(null);
  React.useEffect(() => {
    const onPop = () => { setArtistProfile(p => p ? null : p); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [ticketQR, setTicketQR] = React.useState(null);
  const [memoryCard, setMemoryCard] = React.useState(null);
  const [playlistCreate, setPlaylistCreate] = React.useState(false);
  const [friendActivity, setFriendActivity] = React.useState(false);
  const [radioCreatorOpen, setRadioCreatorOpen] = React.useState(false);
  const [radioCreatorCrate, setRadioCreatorCrate] = React.useState([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [earningsOpen, setEarningsOpen] = React.useState(false);
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => localStorage.getItem('ihype_theme') !== 'light');
  const [offline, setOffline] = React.useState(!navigator.onLine);
  React.useEffect(() => {
    const on = () => setOffline(false); const off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  React.useEffect(() => {
    const r = document.documentElement;
    if (darkMode) { r.classList.remove('light-mode'); localStorage.setItem('ihype_theme','dark'); }
    else { r.classList.add('light-mode'); localStorage.setItem('ihype_theme','light'); }
  }, [darkMode]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2600); };
  const role = (prefs || {}).role || 'fan';

  React.useEffect(() => {
    const _smHandler = e => setSeedMatch(e.detail);
    window.addEventListener('ihype-seed-match', _smHandler);
    const cleanup = regGlobals({
      setIHYPENowPlaying: t => { setNowPlaying(t); setPlaying(true); },
      openIHYPESettings: () => setSettingsOpen(true),
      openIHYPEChangelog: () => setChangelogOpen(true),
      openIHYPEHelp: () => setHelpOpen(true),
      openIHYPETransfer: () => setTransferOpen(true),
      openIHYPERequest: () => setRequestOpen(true),
      openIHYPEPostShow: s => setPostShowRating(s),
      openIHYPETourCreator: () => setTourOpen(true),
      openIHYPERadioScheduler: () => setRadioOpen(true),
      openIHYPERadioCreator: (crate) => { setRadioCreatorCrate(crate || []); setRadioCreatorOpen(true); },
      openIHYPEAnalytics: () => setAnalyticsOpen(true),
      openIHYPEInvite: () => setInviteOpen(true),
      openIHYPELiveEvent: ev => setLiveEvent(ev),
      triggerPostPurchase: () => { setPostPurchase(true); if (!localStorage.getItem('ihype_notif_primer_seen')) setTimeout(() => setNotifPrimer(true), 3200); },
      IHYPE_HYPE_BRIDGE: { canSpend: () => hypesLeftRef.current > 0, spend: () => { const n = Math.max(0, hypesLeftRef.current - 1); setHypesLeft(n); localStorage.setItem('ihype_hype_budget', JSON.stringify({ week: WEEK_KEY(), left: n })); }, onEmpty: () => showToast('0 hypes left — resets Monday') },
      openIHYPEArtistProfile: a => openArtist(a),
      openIHYPETicketQR: t => setTicketQR(t),
      openIHYPEMemoryCard: s => setMemoryCard(s),
      openIHYPEPlaylistCreate: () => setPlaylistCreate(true),
      openIHYPEFriendActivity: () => setFriendActivity(true),
      openIHYPESearch: () => setSearchOpen(true),
      openIHYPEEarnings: () => setEarningsOpen(true),
      openIHYPELiveShow: ev => setLiveEvent(ev),
      haptic: (pattern) => navigator.vibrate && navigator.vibrate(pattern || 15),
      toggleIHYPETheme: () => setDarkMode(d => !d),
      setIHYPETab: t => setTab(t),
      closeIHYPESheets: () => { setSettingsOpen(false); setChangelogOpen(false); setHelpOpen(false); setInviteOpen(false); setAnalyticsOpen(false); setTourOpen(false); setRadioOpen(false); setRequestOpen(false); setLiveEvent(null); setPostShowRating(null); setPostPurchase(false); setTransferOpen(false); setArtistProfile(null); setTicketQR(null); setMemoryCard(null); setPlaylistCreate(false); setFriendActivity(false); setRadioCreatorOpen(false); setSearchOpen(false); setEarningsOpen(false); setPayoutOpen(false); setSeedMatch(null); },
    });
    return () => { cleanup(); window.removeEventListener('ihype-seed-match', _smHandler); };
  }, []);

  if (!betaOk) return <BetaGate onPass={() => setBetaOk(true)} />;
  if (!onboarded) return <Onboarding onDone={() => setOnboarded(true)} />;

  // Resolve sheet components from window (set by Sheets.jsx)
  const SS = window.SettingsSheet; const CS = window.ChangelogSheet; const HS = window.HelpSheet;
  const TFS = window.TicketTransferSheet; const RS = window.RequestSheet;
  const TCS = window.TourCreatorSheet; const RDS = window.RadioSchedulerSheet;
  const AAS = window.ArtistAnalyticsSheet; const IS = window.InviteSheet;
  const LEO = window.LiveEventOverlay; const LSO = window.LiveShowOverlay;
  const GS = window.GlobalSearch; const ES = window.EarningsSheet; const PYS = window.PayoutSheet; const PSR = window.PostShowRating;
  const PPM = window.PostPurchaseMoment; const NP = window.NotifPrimer;
  const FW = window.FeedbackWidget;
  const APS = window.ArtistProfileSheet; const SMS = window.SeedMatchSheet;
  const TQRS = window.TicketQRSheet; const PMC = window.PostShowMemoryCard;
  const PCS = window.PlaylistCreateSheet; const FAS = window.FriendActivitySheet;

  const LT = window.ListenTab; const ET = window.EventsTab; const PT = window.PagesTab;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--bg-2)', cursor: 'default' }}>
          {[0,1,2].map(i => <span key={i} style={{ fontSize: 11, opacity: i < hypesLeft ? 1 : .15, transition: 'opacity .35s' }}>🔥</span>)}
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.6rem', color: 'var(--ink-3)', marginLeft: 4, letterSpacing: '.05em' }}>/wk</span>
        </div>
        <button onClick={() => setSearchOpen(true)} style={{ background:'none', border:'none', color:'var(--ink-3)', cursor:'pointer', padding:4, display:'grid', placeItems:'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </button>
        <button onClick={() => { setNotifOpen(true); setNotifsRead(true); }} style={{ position: 'relative', background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          {!notifsRead && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-2)' }} />}
        </button>
      </div>
      <BetaBanner />
      <MediaPlayerBar track={nowPlaying} playing={playing} onToggle={() => setPlaying(p => !p)} onExpand={() => setPlayerExpanded(true)} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'listen' && LT && <ErrorBoundary><LT onToast={showToast} /></ErrorBoundary>}
        {tab === 'events' && ET && <ErrorBoundary><ET onToast={showToast} /></ErrorBoundary>}
        {tab === 'pages' && PT && <ErrorBoundary><PT onToast={showToast} /></ErrorBoundary>}
      </div>
      <BottomTabs active={tab} onTab={setTab} playing={playing} />
      {playerExpanded && <ExpandedPlayer track={nowPlaying} playing={playing} onToggle={() => setPlaying(p => !p)} onClose={() => setPlayerExpanded(false)} />}
      <NotifCenter open={notifOpen} onClose={() => setNotifOpen(false)} role={role} />
      {SS && <SS open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
      {CS && <CS open={changelogOpen} onClose={() => setChangelogOpen(false)} />}
      {HS && <HS open={helpOpen} onClose={() => setHelpOpen(false)} />}
      {TFS && <TFS open={transferOpen} onClose={() => setTransferOpen(false)} />}
      {RS && <RS open={requestOpen} onClose={() => setRequestOpen(false)} />}
      {TCS && <TCS open={tourOpen} onClose={() => setTourOpen(false)} />}
      {RDS && <RDS open={radioOpen} onClose={() => setRadioOpen(false)} />}
      {AAS && <AAS open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />}
      {IS && <IS open={inviteOpen} onClose={() => setInviteOpen(false)} onToast={showToast} />}
      {LEO && liveEvent && <LEO event={liveEvent} onClose={() => setLiveEvent(null)} />}
      {PSR && <PSR show={postShowRating} onClose={() => setPostShowRating(null)} />}
      {FW && <FW onToast={showToast} />}
      {NP && <NP show={notifPrimer} onAllow={() => { setNotifPrimer(false); localStorage.setItem('ihype_notif_primer_seen', '1'); showToast('Notifications on ✓'); }} onSkip={() => { setNotifPrimer(false); localStorage.setItem('ihype_notif_primer_seen', '1'); }} />}
      {PPM && <PPM show={postPurchase} onClose={() => { setPostPurchase(false); setTab('events'); }} />}
      {APS && <APS artist={artistProfile} onClose={() => setArtistProfile(null)} onBuy={s => { setArtistProfile(null); }} />}
      {SMS && seedMatch && <SMS match={seedMatch} onClose={() => setSeedMatch(null)} onBuy={() => setSeedMatch(null)} />}
      {TQRS && <TQRS ticket={ticketQR} onClose={() => setTicketQR(null)} />}
      {PMC && <PMC show={memoryCard} onClose={() => setMemoryCard(null)} />}
      {PCS && <PCS open={playlistCreate} onClose={() => setPlaylistCreate(false)} onCreated={() => {}} />}
      {FAS && <FAS open={friendActivity} onClose={() => setFriendActivity(false)} />}
      {radioCreatorOpen && window.RadioShowCreator && React.createElement(window.RadioShowCreator, { initialCrate: radioCreatorCrate, onClose: () => setRadioCreatorOpen(false), onToast: showToast })}
      {GS && <GS open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {ES && <ES open={earningsOpen} onClose={() => setEarningsOpen(false)} onPayout={() => { setEarningsOpen(false); setPayoutOpen(true); }} />}
      {PYS && <PYS open={payoutOpen} amount={17.82} onClose={() => setPayoutOpen(false)} onToast={showToast} />}
      {LSO && liveEvent && <LSO event={liveEvent} onClose={() => setLiveEvent(null)} />}
      {offline && <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:200, background:'#1a1000', borderBottom:'1px solid #ffb84a44', padding:'8px 16px', fontFamily:'var(--f-m)', fontSize:'.72rem', color:'#ffb84a', display:'flex', alignItems:'center', gap:8 }}><span style={{ width:7,height:7,borderRadius:'50%',background:'#ffb84a',flexShrink:0 }}/>Offline — showing cached content</div>}
      {toast && <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 18px', fontFamily: 'var(--f-m)', fontSize: '.82rem', color: 'var(--ink)', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 100 }}>{toast}</div>}
    </div>
  );
}

function DesktopShell() {
  const prefs = getPrefs();
  const [betaOk, setBetaOk] = React.useState(!!localStorage.getItem('ihype_beta_ok'));
  const [onboarded, setOnboarded] = React.useState(!!prefs);
  const [tab, setTab] = React.useState('listen');
  const [playing, setPlaying] = React.useState(true);
  const [nowPlaying, setNowPlaying] = React.useState({ t: 'Carousel', a: 'Midnight Echo', tint: '#ff5029' });
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [changelogOpen, setChangelogOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [analyticsOpen, setAnalyticsOpen] = React.useState(false);
  const [tourOpen, setTourOpen] = React.useState(false);
  const [radioOpen, setRadioOpen] = React.useState(false);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [liveEvent, setLiveEvent] = React.useState(null);
  const [postShowRating, setPostShowRating] = React.useState(null);
  const [postPurchase, setPostPurchase] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [artistProfile, setArtistProfile] = React.useState(null);
  const [ticketQR, setTicketQR] = React.useState(null);
  const [memoryCard, setMemoryCard] = React.useState(null);
  const [playlistCreate, setPlaylistCreate] = React.useState(false);
  const [friendActivity, setFriendActivity] = React.useState(false);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2600); };
  const role = (prefs || {}).role || 'fan';

  React.useEffect(() => {
    const handler = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'l' || e.key === 'L') setTab('listen');
      else if (e.key === 'e' || e.key === 'E') setTab('events');
      else if (e.key === 'p' || e.key === 'P') setTab('pages');
      else if (e.key === '/' ) { e.preventDefault(); window.openIHYPESearch && window.openIHYPESearch(); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying(pl => !pl); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  React.useEffect(() => regGlobals({
    setIHYPENowPlaying: t => { setNowPlaying(t); setPlaying(true); },
    openIHYPESettings: () => setSettingsOpen(true),
    openIHYPEChangelog: () => setChangelogOpen(true),
    openIHYPEHelp: () => setHelpOpen(true),
    openIHYPEInvite: () => setInviteOpen(true),
    openIHYPEAnalytics: () => setAnalyticsOpen(true),
    openIHYPETourCreator: () => setTourOpen(true),
    openIHYPERadioScheduler: () => setRadioOpen(true),
    openIHYPERequest: () => setRequestOpen(true),
    openIHYPELiveEvent: ev => setLiveEvent(ev),
    openIHYPEPostShow: s => setPostShowRating(s),
    openIHYPETransfer: () => setTransferOpen(true),
    triggerPostPurchase: () => setPostPurchase(true),
    openIHYPEArtistProfile: a => setArtistProfile(a),
    openIHYPETicketQR: t => setTicketQR(t),
    openIHYPEMemoryCard: s => setMemoryCard(s),
    openIHYPEPlaylistCreate: () => setPlaylistCreate(true),
    openIHYPEFriendActivity: () => setFriendActivity(true),
    setIHYPETab: t => setTab(t),
  }), []);

  if (!betaOk) return <BetaGate onPass={() => setBetaOk(true)} />;
  if (!onboarded) return <Onboarding onDone={() => setOnboarded(true)} />;

  const SS = window.SettingsSheet; const CS = window.ChangelogSheet; const HS = window.HelpSheet;
  const IS = window.InviteSheet; const AAS = window.ArtistAnalyticsSheet;
  const TCS = window.TourCreatorSheet; const RDS = window.RadioSchedulerSheet;
  const RS = window.RequestSheet; const LEO = window.LiveEventOverlay;
  const PSR = window.PostShowRating; const PPM = window.PostPurchaseMoment;
  const TFS = window.TicketTransferSheet;
  const APS = window.ArtistProfileSheet;
  const TQRS = window.TicketQRSheet; const PMC = window.PostShowMemoryCard;
  const PCS = window.PlaylistCreateSheet; const FAS = window.FriendActivitySheet;
  const LT = window.ListenTab; const ET = window.EventsTab; const PT = window.PagesTab;

  const navItems = [
    { id: 'listen', label: 'Listen', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg> },
    { id: 'events', label: 'Events', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" /></svg> },
    { id: 'pages', label: 'Pages', svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', padding: '1.25rem 1rem 1rem' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 900, fontSize: '1.3rem', letterSpacing: '-.04em', marginBottom: '1.5rem', color: 'var(--ink)' }}>iHYPE</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {navItems.map(n => {
              const on = tab === n.id;
              return (
                <button key={n.id} onClick={() => setTab(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: on ? 'rgba(255,80,41,.1)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-2)', fontFamily: 'var(--f-b)', fontWeight: on ? 700 : 500, fontSize: '.9rem', cursor: 'pointer', textAlign: 'left' }}>
                  {n.svg}{n.label}
                </button>
              );
            })}
          </nav>
          <button onClick={() => window.openIHYPESearch && window.openIHYPESearch()} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, border:'none', background:'transparent', color:'var(--ink-2)', fontFamily:'var(--f-b)', fontWeight:500, fontSize:'.9rem', cursor:'pointer', textAlign:'left', width:'100%', marginTop:4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Search
          </button>
          <div style={{ padding: '12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-2)', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#ff5029,#ff3e9a)', flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.85rem' }}>Robin Vega</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)' }}>@robinv · {role}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[['$16.20', 'Earned', 'var(--accent)'], ['14', 'Hyped', '#22e5d4']].map(([v, l, c]) => (
                <div key={l} style={{ padding: '8px', borderRadius: 8, background: 'var(--bg-3)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem', color: c }}>{v}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: '.6rem', color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setSettingsOpen(true)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.78rem', cursor: 'pointer' }}>Settings</button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {tab === 'listen' && LT && <ErrorBoundary><LT onToast={showToast} /></ErrorBoundary>}
          {tab === 'events' && ET && <ErrorBoundary><ET onToast={showToast} /></ErrorBoundary>}
          {tab === 'pages' && PT && <ErrorBoundary><PT onToast={showToast} /></ErrorBoundary>}
        </div>
      </div>
      {/* Bottom player bar */}
      <BetaBanner />
      <div style={{ borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        <MediaPlayerBar track={nowPlaying} playing={playing} onToggle={() => setPlaying(p => !p)} onExpand={() => {}} />
      </div>
      {/* Sheets */}
      {SS && <SS open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
      {CS && <CS open={changelogOpen} onClose={() => setChangelogOpen(false)} />}
      {HS && <HS open={helpOpen} onClose={() => setHelpOpen(false)} />}
      {IS && <IS open={inviteOpen} onClose={() => setInviteOpen(false)} onToast={showToast} />}
      {AAS && <AAS open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />}
      {TCS && <TCS open={tourOpen} onClose={() => setTourOpen(false)} />}
      {RDS && <RDS open={radioOpen} onClose={() => setRadioOpen(false)} />}
      {RS && <RS open={requestOpen} onClose={() => setRequestOpen(false)} />}
      {TFS && <TFS open={transferOpen} onClose={() => setTransferOpen(false)} />}
      {LEO && liveEvent && <LEO event={liveEvent} onClose={() => setLiveEvent(null)} />}
      {PSR && <PSR show={postShowRating} onClose={() => setPostShowRating(null)} />}
      {PPM && <PPM show={postPurchase} onClose={() => { setPostPurchase(false); setTab('events'); }} />}
      {APS && <APS artist={artistProfile} onClose={() => setArtistProfile(null)} onBuy={() => setArtistProfile(null)} />}
      {TQRS && <TQRS ticket={ticketQR} onClose={() => setTicketQR(null)} />}
      {PMC && <PMC show={memoryCard} onClose={() => setMemoryCard(null)} />}
      {PCS && <PCS open={playlistCreate} onClose={() => setPlaylistCreate(false)} onCreated={() => {}} />}
      {FAS && <FAS open={friendActivity} onClose={() => setFriendActivity(false)} />}
      {radioCreatorOpen && window.RadioShowCreator && React.createElement(window.RadioShowCreator, { initialCrate: radioCreatorCrate, onClose: () => setRadioCreatorOpen(false), onToast: showToast })}
      {GS && <GS open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {ES && <ES open={earningsOpen} onClose={() => setEarningsOpen(false)} onPayout={() => { setEarningsOpen(false); setPayoutOpen(true); }} />}
      {PYS && <PYS open={payoutOpen} amount={17.82} onClose={() => setPayoutOpen(false)} onToast={showToast} />}
      {LSO && liveEvent && <LSO event={liveEvent} onClose={() => setLiveEvent(null)} />}
      {offline && <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:200, background:'#1a1000', borderBottom:'1px solid #ffb84a44', padding:'8px 16px', fontFamily:'var(--f-m)', fontSize:'.72rem', color:'#ffb84a', display:'flex', alignItems:'center', gap:8 }}><span style={{ width:7,height:7,borderRadius:'50%',background:'#ffb84a',flexShrink:0 }}/>Offline — showing cached content</div>}
      {toast && <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 18px', fontFamily: 'var(--f-m)', fontSize: '.82rem', color: 'var(--ink)', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 100 }}>{toast}</div>}
    </div>
  );
}

Object.assign(window, { MobileShellV2, DesktopShell, Onboarding });
