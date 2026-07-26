// iHYPE Seeds — swipe discovery
// Swipe right = hype · left = skip · up = save
const HeartIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;

const SEEDS = [
  { artist: 'Nyla', track: 'Goldenrod', tags: ['r&b', 'neo-soul'], hype: 318, city: 'Los Angeles', g: ['#22e5d4', '#7c5cff'], show: { artist: 'Nyla', event: 'Basement Tapes: Late Set', date: 'Sat Jun 21 · 11:00 PM', price: 15, tint: '#22e5d4', id: 's3' } },
  { artist: 'Wax Tropic', track: 'Heatwave', tags: ['synth-pop', 'disco'], hype: 642, city: 'Oakland', g: ['#b983ff', '#ff3e9a'], show: { artist: 'Wax Tropic', event: 'Zebulon', date: 'Sat Jun 21 · 8:30 PM', price: 22, tint: '#b983ff', id: 's2' } },
  { artist: 'Midnight Echo', track: 'Carousel', tags: ['dream-pop', 'shoegaze'], hype: 1284, city: 'Los Angeles', g: ['#ff5029', '#ff3e9a'], show: { artist: 'Midnight Echo', event: 'Live at The Echo', date: 'Fri Jun 20 · 9:00 PM', price: 18, tint: '#ff5029', id: 's1' } },
  { artist: 'Sunroom', track: 'Paper Cup', tags: ['indie', 'lo-fi'], hype: 877, city: 'San Diego', g: ['#ffb84a', '#ff5029'], show: { artist: 'Sunroom', event: 'Album Release', date: 'Sun Jun 22 · 7:00 PM', price: 20, tint: '#ffb84a', id: 's4' } },
  { artist: 'Cold Harbor', track: 'Tidewater', tags: ['post-punk'], hype: 205, city: 'Long Beach', g: ['#39d8df', '#22e5d4'] },
];

function SeedsScreen({ onIdxChange }) {
  const ordered = React.useMemo(() => {
    const g = (() => { try { return JSON.parse(localStorage.getItem('ihype_onboarded_v2') || '{}').genres || []; } catch (e) { return []; } })();
    if (!g.length) return SEEDS;
    return [...SEEDS].sort((a, b) => (b.tags || []).some(t => g.includes(t)) - (a.tags || []).some(t => g.includes(t)));
  }, []);

  const [idx, setIdx] = React.useState(() => parseInt(localStorage.getItem('ihype_seeds_idx') || '0', 10));
  const [drag, setDrag] = React.useState({ x: 0, y: 0, active: false });
  const [flash, setFlash] = React.useState(null);
  const [saved, setSaved] = React.useState(0);
  const [hyped, setHyped] = React.useState(0);
  const [burst, setBurst] = React.useState(0);
  const start = React.useRef(null);

  React.useEffect(() => {
    if (!document.getElementById('ihype-burst-css')) {
      const s = document.createElement('style'); s.id = 'ihype-burst-css';
      s.textContent = '@keyframes ihype-ring{0%{transform:translate(-50%,-50%) scale(.35);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}} @keyframes cardShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(s);
    }
  }, []);

  // Expose for persistence
  React.useEffect(() => { window._seedsSetIdx = setIdx; }, []);
  React.useEffect(() => { onIdxChange && onIdxChange(idx); }, [idx]);

  const card = ordered[idx % ordered.length];
  const next = ordered[(idx + 1) % ordered.length];

  function decideLabel(x, y) {
    if (y < -90) return 'save';
    if (x > 90) return 'hype';
    if (x < -90) return 'skip';
    return null;
  }

  function onDown(e) {
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    setDrag({ x, y, active: true });
    setFlash(decideLabel(x, y));
  }
  function onUp() {
    if (!start.current) return;
    const decision = decideLabel(drag.x, drag.y);
    start.current = null;
    if (decision) commit(decision);
    else { setDrag({ x: 0, y: 0, active: false }); setFlash(null); }
  }

  function commit(decision) {
    if (decision === 'hype') {
      const bridge = window.IHYPE_HYPE_BRIDGE;
      if (bridge && !bridge.canSpend()) {
        bridge.onEmpty && bridge.onEmpty();
        setDrag({ x: 0, y: 0, active: false }); setFlash(null); return;
      }
    }
    const off = decision === 'hype' ? { x: 600, y: 40 } : decision === 'skip' ? { x: -600, y: 40 } : { x: 0, y: -700 };
    setDrag({ ...off, active: false });
    if (decision === 'hype') {
      setHyped(h => h + 1);
      setBurst(b => b + 1);
      window.mHaptic && window.mHaptic();
      navigator.vibrate && navigator.vibrate([30, 10, 20]);
      window.IHYPE_HYPE_BRIDGE && window.IHYPE_HYPE_BRIDGE.spend && window.IHYPE_HYPE_BRIDGE.spend();
      if (card.show) {
        const m = card.show;
        setTimeout(() => window.dispatchEvent(new CustomEvent('ihype-seed-match', { detail: m })), 360);
      }
    }
    if (decision === 'save') {
      setSaved(s => s + 1);
      navigator.vibrate && navigator.vibrate(15);
    }
    setTimeout(() => { setIdx(i => i + 1); setDrag({ x: 0, y: 0, active: false }); setFlash(null); }, 240);
  }

  const rot = drag.x / 18;
  const [hinted, setHinted] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setHinted(true), 1800); return () => clearTimeout(t); }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1.1rem 0.75rem' }}>
        <span style={{ fontFamily:'var(--f-d)', fontWeight:900, letterSpacing:'-.04em', fontSize:'1rem', color:'var(--ink)' }}>iHYPE</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22e5d4" strokeWidth="2" strokeLinecap="round"><path d="M7 20h10M10 20c0-7 4-9 6-11M10 20c0-6-2-8-4-10"/></svg> Seeds
        </span>
        <button aria-label="Saved" style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <HeartIcon />
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, margin: '0 1.1rem' }}>
        <SeedCard card={next} style={{ transform: 'scale(0.94) translateY(10px)', opacity: 0.6 }} />
        {burst > 0 && <div key={burst} style={{ position: 'absolute', top: '50%', left: '50%', width: 180, height: 180, borderRadius: '50%', border: '2.5px solid var(--accent)', pointerEvents: 'none', zIndex: 20, animation: 'ihype-ring .6s cubic-bezier(.2,.8,.3,1) forwards', boxShadow: '0 0 24px rgba(255,80,41,.35)' }} />}
        {!hinted && !drag.active && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 0 32px', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', gap: 28, background: 'rgba(10,8,5,.72)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '10px 20px', border: '1px solid rgba(255,255,255,.1)' }}>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.04em', color: 'var(--ink-3)' }}>← skip</span>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.04em', color: '#22e5d4' }}>↑ save</span>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.04em', color: 'var(--accent)' }}>hype →</span>
            </div>
          </div>
        )}
        <SeedCard card={card} flash={flash} shimmer={!hinted && !drag.active}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
          style={{ transform: `translate(${drag.x}px,${drag.y}px) rotate(${rot}deg)`, transition: drag.active ? 'none' : 'transform .24s cubic-bezier(.4,0,.2,1)', cursor: 'grab', touchAction: 'none' }} />
      </div>

      <div style={{ overflow:'hidden', marginBottom:6, flexShrink:0 }}>
        <div style={{ display:'flex', gap:16, fontFamily:'var(--f-m)', fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--ink-3)', whiteSpace:'nowrap', animation:'marquee 18s linear infinite' }}>
          {[...Array(2)].map((_,ri) => <React.Fragment key={ri}>{['🔥 MIDNIGHT ECHO','↑ GOLDENROD — NYLA','● LIVE AT THE ECHO TONIGHT','🎟 WAX TROPIC SAT','↑ CAROUSEL #1 LA'].map(t => <span key={t} style={{marginRight:32}}>{t}</span>)}</React.Fragment>)}
          <style>{'@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}'}</style>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, padding: '1rem 0 0.5rem' }}>
        <CircleBtn icon="x" sub="skip" color="var(--ink-3)" onClick={() => commit('skip')} />
        <CircleBtn icon="arrowUp" sub="save" color="#22e5d4" onClick={() => commit('save')} />
        <CircleBtn icon="flame" sub="hype" color="var(--accent)" big onClick={() => commit('hype')} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '0.25rem 0 0.9rem', fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>
        <span><b style={{ color: 'var(--accent)' }}>{hyped}</b> hyped</span>
        <span><b style={{ color: '#22e5d4' }}>{saved}</b> saved</span>
      </div>
    </div>
  );
}

function SeedCard({ card, flash, style, shimmer, ...rest }) {
  return (
    <div {...rest} style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden', border: '1px solid var(--line-2)', boxShadow: '0 8px 32px rgba(0,0,0,.4)', background: `linear-gradient(160deg,${card.g[0]},${card.g[1]})`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', userSelect: 'none', ...style }}>
      {shimmer && <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg,transparent 40%,rgba(255,255,255,.18) 50%,transparent 60%)', backgroundSize:'200% 100%', animation:'cardShimmer 1.6s ease-in-out infinite', zIndex:5, pointerEvents:'none', borderRadius:24 }} />}
      {flash && (
        <div style={{ position: 'absolute', top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
          <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '.04em', textTransform: 'uppercase', padding: '0.4rem 1rem', borderRadius: 12, color: '#fff', border: '2px solid #fff', background: flash === 'hype' ? 'rgba(255,80,41,.35)' : flash === 'save' ? 'rgba(34,229,212,.35)' : 'rgba(0,0,0,.35)' }}>
            {flash === 'hype' ? 'Hype' : flash === 'save' ? 'Save' : 'Skip'}
          </span>
        </div>
      )}
      <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,0,0,.32)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', color: '#fff', border: '1px solid rgba(255,255,255,.4)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><polygon points="6,3 20,12 6,21"/></svg>
      </div>
      <div style={{ padding: '1.25rem', background: 'linear-gradient(to top,rgba(0,0,0,.55),transparent)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {card.tags.map(t => (
            <span key={t} style={{ fontFamily: 'var(--f-m)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#fff', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, padding: '3px 9px' }}>{t}</span>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.03em', color: '#fff', lineHeight: 1 }}>{card.track}</div>
        <div style={{ fontFamily: 'var(--f-b)', fontSize: 15, color: 'rgba(255,255,255,.92)', marginTop: 4 }}>{card.artist} · {card.city}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--f-m)', fontSize: 11, color: 'rgba(255,255,255,.8)', marginTop: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M12 2c1 3-1 5-3 6 1-3.5 0-5.5-1-6.5C8 5 7 7 8 9 6 7.5 6 5 7 4 5 6 4 10 6.5 12.5 7 13 7 15 8 16a4 4 0 1 0 8 0c0-4-2-6-4-14z"/></svg> {card.hype.toLocaleString()} hype · 0:30 preview
        </div>
      </div>
    </div>
  );
}

function CircleBtn({ icon, sub, color, big, onClick }) {
  const s = big ? 64 : 52;
  const [pr, setPr] = React.useState(false);
  return (
    <button onPointerDown={() => setPr(true)} onPointerUp={() => { setPr(false); onClick && onClick(); }} onPointerLeave={() => setPr(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer' }}>
      <span style={{ width: s, height: s, borderRadius: '50%', display: 'grid', placeItems: 'center', color: big ? '#fff' : color, background: big ? 'var(--accent)' : 'var(--bg-3)', border: `1px solid ${big ? 'transparent' : 'var(--line-2)'}`, boxShadow: big ? `0 4px ${pr?'30px':'20px'} rgba(255,80,41,${pr?.55:.35})` : 'none', transform: pr ? 'scale(.88)' : 'scale(1)', transition: 'transform .1s ease, box-shadow .1s ease' }}>
        {icon === 'flame' && <svg width={big?26:20} height={big?26:20} viewBox="0 0 24 24" fill={big?'#fff':color}><path d="M12 2c1 3-1 5-3 6 1-3.5 0-5.5-1-6.5C8 5 7 7 8 9 6 7.5 6 5 7 4 5 6 4 10 6.5 12.5 7 13 7 15 8 16a4 4 0 1 0 8 0c0-4-2-6-4-14z"/></svg>}
        {icon === 'x' && <svg width={big?26:20} height={big?26:20} viewBox="0 0 24 24" fill="none" stroke={big?'#fff':color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
        {icon === 'arrowUp' && <svg width={big?26:20} height={big?26:20} viewBox="0 0 24 24" fill="none" stroke={big?'#fff':color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/></svg>}
      </span>
      <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{sub}</span>
    </button>
  );
}

window.SeedsScreen = SeedsScreen;
