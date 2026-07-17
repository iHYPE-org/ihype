// MoreSheets.jsx — LiveShowMode, GlobalSearch, EarningsSheet, PayoutSheet

// ── Shared pill sheet wrapper ────────────────────────────────────────────────
function Sheet({ open, onClose, children, maxH='88%' }) {
  if (!open) return null;
  return (
    <div style={{ position:'absolute', inset:0, zIndex:82, background:'rgba(0,0,0,.6)', backdropFilter:'blur(8px)' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', bottom:0, left:0, right:0, background:'var(--bg-2)', borderRadius:'22px 22px 0 0', maxHeight:maxH, overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <div style={{ width:36, height:4, borderRadius:999, background:'var(--line)', margin:'12px auto 0', flexShrink:0 }} />
        {children}
      </div>
    </div>
  );
}
function SheetHead({ title, sub, onClose }) {
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'14px 18px 4px', flexShrink:0 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem' }}>{title}</div>
        {sub && <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)', marginTop:2 }}>{sub}</div>}
      </div>
      <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--ink-3)', cursor:'pointer', fontSize:22, lineHeight:1, padding:'0 2px' }}>×</button>
    </div>
  );
}

// ── 1. LIVE SHOW MODE OVERLAY ─────────────────────────────────────────────────
function LiveShowOverlay({ event, onClose }) {
  const [count, setCount] = React.useState(142);
  const [hyped, setHyped] = React.useState(false);
  const [pulse, setPulse] = React.useState(false);
  const [reactions, setReactions] = React.useState([]);
  const [reactionId, setReactionId] = React.useState(0);
  const tickRef = React.useRef(null);

  React.useEffect(() => {
    tickRef.current = setInterval(() => setCount(c => c + Math.floor(Math.random() * 3)), 4000);
    return () => clearInterval(tickRef.current);
  }, []);

  const addReaction = emoji => {
    const id = reactionId + 1; setReactionId(id);
    const x = 20 + Math.random() * 60;
    setReactions(r => [...r, { id, emoji, x }]);
    setTimeout(() => setReactions(r => r.filter(r2 => r2.id !== id)), 2200);
  };

  const doHype = () => {
    if (hyped) return;
    setHyped(true); setPulse(true);
    navigator.vibrate && navigator.vibrate([30, 20, 30]);
    addReaction('🔥');
    setTimeout(() => setPulse(false), 600);
  };

  if (!event) return null;
  const ev = event || { artist:'Midnight Echo', venue:'The Echo', city:'Los Angeles', tint:'#ff5029' };
  return (
    <div style={{ position:'absolute', inset:0, zIndex:95, background:`linear-gradient(180deg,${ev.tint||'#ff5029'}22 0%,var(--bg) 55%)`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Floating reactions */}
      {reactions.map(r => (
        <div key={r.id} style={{ position:'absolute', bottom:'30%', left:`${r.x}%`, fontSize:28, pointerEvents:'none', animation:'floatUp 2.2s ease-out forwards', zIndex:96 }}>{r.emoji}</div>
      ))}
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', padding:'14px 16px 0', gap:10, flexShrink:0 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--ink-3)', cursor:'pointer', fontSize:22 }}>←</button>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:999, background:'rgba(255,80,41,.12)', border:'1px solid rgba(255,80,41,.3)' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#ff5029', display:'inline-block', boxShadow:'0 0 8px #ff5029', animation:'blink 1s step-end infinite' }} />
          <span style={{ fontFamily:'var(--f-m)', fontSize:'.68rem', letterSpacing:'.12em', textTransform:'uppercase', color:'#ff5029' }}>Live</span>
        </div>
      </div>

      {/* Hero art */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem 1.5rem', gap:16 }}>
        <div style={{ width:160, height:160, borderRadius:32, background:`linear-gradient(135deg,${ev.tint||'#ff5029'},${ev.tint||'#ff5029'}44)`, display:'grid', placeItems:'center', fontSize:64, boxShadow:`0 0 60px ${ev.tint||'#ff5029'}55`, animation:pulse?'scaleUp .3s ease-out':'none' }}>🎵</div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:'var(--f-d)', fontWeight:900, fontSize:'1.6rem', letterSpacing:'-.04em', lineHeight:1.1 }}>{ev.artist}</div>
          <div style={{ fontFamily:'var(--f-m)', fontSize:'.82rem', color:'var(--ink-3)', marginTop:4 }}>{ev.venue} · {ev.city}</div>
        </div>
        {/* Listener count */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:999, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span style={{ fontFamily:'var(--f-m)', fontSize:'.78rem', color:'var(--ink-2)' }}>{count.toLocaleString()} listening</span>
        </div>
      </div>

      {/* Reaction strip */}
      <div style={{ display:'flex', gap:10, justifyContent:'center', padding:'0 1rem 12px', flexShrink:0 }}>
        {['🎵','💜','🎶','✨','👏'].map(e => (
          <button key={e} onClick={()=>addReaction(e)} style={{ width:44, height:44, borderRadius:'50%', border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)', fontSize:22, cursor:'pointer', display:'grid', placeItems:'center', transition:'transform .1s', active:{transform:'scale(.88)'} }}>{e}</button>
        ))}
      </div>

      {/* Hype button */}
      <div style={{ padding:'0 1.5rem 2rem', flexShrink:0 }}>
        <button onClick={doHype} style={{ width:'100%', padding:'16px', borderRadius:999, background:hyped?'rgba(255,80,41,.15)':'linear-gradient(90deg,#ff5029,#ff3e9a)', color:hyped?'#ff5029':'#fff', border:hyped?'1px solid rgba(255,80,41,.35)':'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem', cursor:'pointer', letterSpacing:'.02em', boxShadow:hyped?'none':'0 4px 28px rgba(255,80,41,.4)', transition:'all .3s' }}>
          {hyped ? '🔥 Hyped!' : '🔥 Hype Now'}
        </button>
      </div>

      <style>{`
        @keyframes floatUp { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-220px) scale(1.4);opacity:0} }
        @keyframes scaleUp { 0%{transform:scale(1)} 50%{transform:scale(1.12)} 100%{transform:scale(1)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  );
}

// ── 2. GLOBAL SEARCH ──────────────────────────────────────────────────────────
function GlobalSearch({ open, onClose }) {
  const [q, setQ] = React.useState('');
  const [history, setHistory] = React.useState(() => { try { return JSON.parse(localStorage.getItem('ihype_search_hist')||'[]'); } catch(e){return [];} });
  const D = window.IHYPE_DATA || {};
  const pool = [
    ...(D.shows||[]).map(s=>({ type:'Event', name:s.artist, sub:`${s.venue} · ${s.city}`, tint:s.tint||'#ff5029', icon:'🎟' })),
    ...(D.freeUseLibrary||[]).map(s=>({ type:'Track', name:s.t, sub:`${s.a} · ${s.genre}`, tint:s.tint||'#b983ff', icon:'🎵' })),
    ...(D.seeds||[]).map(s=>({ type:'Artist', name:s.artist, sub:s.venue||'', tint:s.tint||'#22e5d4', icon:'👤' })),
  ];
  const results = q.length > 1 ? pool.filter(r => (r.name+r.sub).toLowerCase().includes(q.toLowerCase())).slice(0,12) : [];
  const addHistory = term => {
    const next = [term, ...history.filter(x=>x!==term)].slice(0,6);
    setHistory(next); localStorage.setItem('ihype_search_hist', JSON.stringify(next));
  };
  const clear = () => { setHistory([]); localStorage.removeItem('ihype_search_hist'); };
  if (!open) return null;
  return (
    <div style={{ position:'absolute', inset:0, zIndex:88, background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      {/* Search bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 14px 10px', flexShrink:0, borderBottom:'1px solid var(--line)' }}>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--ink-3)', cursor:'pointer', fontSize:22, padding:0, lineHeight:1 }}>←</button>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.07)', borderRadius:12, padding:'9px 12px', border:'1px solid var(--line)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Artists, events, tracks…" style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--ink)', fontFamily:'var(--f-b)', fontSize:'.9rem' }} />
          {q && <button onClick={()=>setQ('')} style={{ background:'none', border:'none', color:'var(--ink-3)', cursor:'pointer', fontSize:16, padding:0, lineHeight:1 }}>×</button>}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'10px 14px 20px' }}>
        {/* Recent searches */}
        {!q && history.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ink-3)' }}>Recent</div>
              <button onClick={clear} style={{ background:'none', border:'none', color:'rgba(255,80,41,.5)', fontFamily:'var(--f-m)', fontSize:'.7rem', cursor:'pointer' }}>Clear</button>
            </div>
            {history.map(h => (
              <button key={h} onClick={()=>setQ(h)} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 0', background:'none', border:'none', borderBottom:'1px solid var(--line)', color:'var(--ink)', cursor:'pointer', textAlign:'left' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color:'var(--ink-3)', flexShrink:0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{ fontFamily:'var(--f-b)', fontSize:'.88rem' }}>{h}</span>
              </button>
            ))}
          </div>
        )}

        {/* Trending (shown when no query) */}
        {!q && (
          <div>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:10 }}>Trending</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {['dream-pop','lo-fi','midnight echo','shoegaze','dj caro','electronic'].map(t => (
                <button key={t} onClick={()=>setQ(t)} style={{ padding:'6px 13px', borderRadius:999, border:'1px solid var(--line)', background:'var(--bg-3)', color:'var(--ink-2)', fontFamily:'var(--f-m)', fontSize:'.78rem', cursor:'pointer' }}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {q.length > 1 && results.length === 0 && (
          <div style={{ textAlign:'center', padding:'3rem 1rem', color:'var(--ink-3)', fontFamily:'var(--f-b)', fontSize:'.85rem' }}>No results for "{q}"</div>
        )}
        {results.map((r,i) => (
          <button key={i} onClick={()=>{ addHistory(q); onClose(); }} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'10px 0', background:'none', border:'none', borderBottom:'1px solid rgba(255,255,255,.05)', cursor:'pointer', textAlign:'left' }}>
            <div style={{ width:40, height:40, borderRadius:10, background:`${r.tint}22`, border:`1px solid ${r.tint}44`, display:'grid', placeItems:'center', fontSize:18, flexShrink:0 }}>{r.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</div>
              <div style={{ fontFamily:'var(--f-m)', fontSize:'.7rem', color:'var(--ink-3)' }}>{r.type} · {r.sub}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color:'var(--ink-3)', flexShrink:0 }}><path d="m9 18 6-6-6-6"/></svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 3. EARNINGS DASHBOARD ─────────────────────────────────────────────────────
const EARNING_EVENTS = [
  { event:'Midnight Echo @ The Echo', date:'Jun 14', sold:8, cut:0.10, price:22, status:'cleared' },
  { event:'Nyla @ Zebulon',           date:'Jun 8',  sold:3, cut:0.08, price:18, status:'cleared' },
  { event:'Wax Tropic @ Echoplex',    date:'Jun 20', sold:5, cut:0.10, price:25, status:'pending' },
  { event:'DJ Caro @ 1720',           date:'Jun 22', sold:2, cut:0.07, price:15, status:'pending' },
];

function EarningsSheet({ open, onClose, onPayout }) {
  const cleared = EARNING_EVENTS.filter(e=>e.status==='cleared').reduce((a,e)=>a+e.sold*e.price*e.cut,0);
  const pending = EARNING_EVENTS.filter(e=>e.status==='pending').reduce((a,e)=>a+e.sold*e.price*e.cut,0);
  return (
    <Sheet open={open} onClose={onClose} maxH="90%">
      <SheetHead title="Promoter Earnings" sub="Your referral payout history" onClose={onClose} />
      <div style={{ padding:'14px 18px 28px', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Summary cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[['$'+cleared.toFixed(2),'Available','#22e5d4'],['$'+pending.toFixed(2),'Pending','#ffb84a']].map(([v,l,c])=>(
            <div key={l} style={{ padding:'14px', borderRadius:16, background:`${c}11`, border:`1px solid ${c}33`, textAlign:'center' }}>
              <div style={{ fontFamily:'var(--f-d)', fontWeight:900, fontSize:'1.5rem', color:c }}>{v}</div>
              <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.1em', textTransform:'uppercase', color:c, marginTop:4, opacity:.8 }}>{l}</div>
            </div>
          ))}
        </div>
        {/* Referral rate info */}
        <div style={{ padding:'10px 14px', borderRadius:12, background:'rgba(185,131,255,.07)', border:'1px solid rgba(185,131,255,.15)', fontFamily:'var(--f-b)', fontSize:'.78rem', color:'rgba(185,131,255,.85)', lineHeight:1.6 }}>
          Earn up to <strong style={{ color:'#b983ff' }}>10% per ticket</strong> you refer. Rate scales with your share of the total gate — the more you drive, the more you earn.
        </div>
        {/* Per-event breakdown */}
        <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ink-3)' }}>Breakdown</div>
        {EARNING_EVENTS.map((e,i)=>{
          const amt = (e.sold*e.price*e.cut).toFixed(2);
          const pct = Math.round(e.cut*100);
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.85rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.event}</div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:'.7rem', color:'var(--ink-3)', marginTop:2 }}>{e.date} · {e.sold} tickets · {pct}% cut</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem', color:e.status==='cleared'?'#22e5d4':'#ffb84a' }}>${amt}</div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:'.62rem', color:e.status==='cleared'?'rgba(34,229,212,.6)':'rgba(255,184,74,.6)', textTransform:'uppercase', letterSpacing:'.08em' }}>{e.status}</div>
              </div>
            </div>
          );
        })}
        <button onClick={onPayout} disabled={cleared<1} style={{ width:'100%', padding:'13px', borderRadius:999, background:cleared>=1?'linear-gradient(90deg,#22e5d4,#5b8cff)':'var(--bg-3)', color:cleared>=1?'#000':'var(--ink-3)', border:'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.95rem', cursor:cleared>=1?'pointer':'default' }}>
          Request Payout → ${cleared.toFixed(2)}
        </button>
      </div>
    </Sheet>
  );
}

// ── 4. PAYOUT SHEET ───────────────────────────────────────────────────────────
function PayoutSheet({ open, onClose, amount, onToast }) {
  const [step, setStep] = React.useState(0); // 0=method 1=confirm 2=done
  const [method, setMethod] = React.useState(null);
  const methods = [
    { id:'bank', label:'Bank Account', sub:'****1234 · Chase', icon:'🏦', time:'2–3 business days' },
    { id:'venmo', label:'Venmo', sub:'@robinvega', icon:'💸', time:'Instant' },
    { id:'paypal', label:'PayPal', sub:'robin@email.com', icon:'🅿', time:'Instant' },
  ];
  const reset = () => { setStep(0); setMethod(null); onClose(); };
  return (
    <Sheet open={open} onClose={reset} maxH="75%">
      <SheetHead title={step===2?'Payout Sent!':'Request Payout'} sub={step===2?undefined:`$${(amount||0).toFixed(2)} available`} onClose={reset} />
      <div style={{ padding:'14px 18px 32px' }}>
        {step===0 && (
          <>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)', marginBottom:14 }}>Choose payout method</div>
            {methods.map(m=>(
              <button key={m.id} onClick={()=>{ setMethod(m); setStep(1); }} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'12px', borderRadius:14, border:`1px solid ${method?.id===m.id?'var(--accent)':'var(--line)'}`, background:'var(--bg-3)', marginBottom:8, cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:24, flexShrink:0 }}>{m.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.88rem' }}>{m.label}</div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:'.7rem', color:'var(--ink-3)', marginTop:2 }}>{m.sub} · {m.time}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color:'var(--ink-3)' }}><path d="m9 18 6-6-6-6"/></svg>
              </button>
            ))}
          </>
        )}
        {step===1 && method && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ padding:'20px', borderRadius:16, background:'var(--bg-3)', border:'1px solid var(--line)', textAlign:'center' }}>
              <div style={{ fontFamily:'var(--f-d)', fontWeight:900, fontSize:'2rem', color:'#22e5d4', marginBottom:6 }}>${(amount||0).toFixed(2)}</div>
              <div style={{ fontFamily:'var(--f-m)', fontSize:'.78rem', color:'var(--ink-3)' }}>via {method.label} · {method.time}</div>
            </div>
            <button onClick={()=>{ setStep(2); onToast && onToast('Payout requested ✓'); navigator.vibrate && navigator.vibrate([20,10,20]); setTimeout(reset, 2200); }} style={{ width:'100%', padding:'13px', borderRadius:999, background:'linear-gradient(90deg,#22e5d4,#5b8cff)', color:'#000', border:'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.95rem', cursor:'pointer' }}>
              Confirm Payout
            </button>
            <button onClick={()=>setStep(0)} style={{ width:'100%', padding:'10px', borderRadius:999, border:'1px solid var(--line)', background:'transparent', color:'var(--ink-3)', fontFamily:'var(--f-m)', fontSize:'.82rem', cursor:'pointer' }}>← Back</button>
          </div>
        )}
        {step===2 && (
          <div style={{ textAlign:'center', padding:'2rem 0' }}>
            <div style={{ fontSize:56, marginBottom:12 }}>✅</div>
            <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem', marginBottom:6 }}>Payout requested!</div>
            <div style={{ fontFamily:'var(--f-b)', fontSize:'.82rem', color:'var(--ink-3)', lineHeight:1.6 }}>Arrives {method?.time?.toLowerCase()} via {method?.label}.</div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

Object.assign(window, { LiveShowOverlay, GlobalSearch, EarningsSheet, PayoutSheet });
