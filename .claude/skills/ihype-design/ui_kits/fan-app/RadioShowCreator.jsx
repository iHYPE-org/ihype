// RadioShowCreator.jsx — DJ Radio Show Studio
// Screens: Library → Crate → Studio

const SFX_PADS = [
  { id:'scratch', label:'Scratch',   tint:'#b983ff' },
  { id:'horn',    label:'Air Horn',  tint:'#ff5029' },
  { id:'drop',    label:'Bass Drop', tint:'#22e5d4' },
  { id:'crowd',   label:'Crowd',     tint:'#ffb84a' },
  { id:'laser',   label:'Laser',     tint:'#5b8cff' },
  { id:'snare',   label:'Snare',     tint:'#ff3e9a' },
  { id:'sweep',   label:'Sweep',     tint:'#22e5d4' },
  { id:'bell',    label:'Bell',      tint:'#ffb84a' },
  { id:'kick',    label:'Kick',      tint:'#ff5029' },
  { id:'rewind',  label:'Rewind',    tint:'#b983ff' },
  { id:'foghorn', label:'Foghorn',   tint:'#5b8cff' },
  { id:'static',  label:'Static',    tint:'#888'    },
];

const GENRES = ['All','Dream-Pop','Electronic','R&B','Ambient','Hip-Hop','Indie','Lo-Fi','Shoegaze'];

// ── Web Audio SFX ────────────────────────────────────────────────────────────
let _actx = null;
function getACtx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') _actx.resume();
  return _actx;
}
function playSFX(id) {
  try {
    const ctx = getACtx(), now = ctx.currentTime;
    const out = ctx.createGain(); out.gain.value = 0.7; out.connect(ctx.destination);
    const osc = (type, freq) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o; };
    const noise = (dur) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = buf; return s;
    };
    const env = (g, peak, dur, delay=0) => {
      g.gain.setValueAtTime(0, now+delay);
      g.gain.linearRampToValueAtTime(peak, now+delay+0.02);
      g.gain.linearRampToValueAtTime(0, now+delay+dur);
    };
    switch(id) {
      case 'scratch': { const o=osc('sawtooth',600),g=ctx.createGain(); o.frequency.linearRampToValueAtTime(200,now+.15); o.frequency.linearRampToValueAtTime(900,now+.28); o.frequency.linearRampToValueAtTime(200,now+.4); env(g,.8,.42); o.connect(g);g.connect(out);o.start(now);o.stop(now+.45); break; }
      case 'horn':    { const o=osc('sawtooth',233),o2=osc('sawtooth',350),g=ctx.createGain(); env(g,.55,.8); [o,o2].forEach(x=>{x.connect(g);x.start(now);x.stop(now+.85);}); g.connect(out); break; }
      case 'drop':    { const o=osc('sine',80),g=ctx.createGain(); o.frequency.exponentialRampToValueAtTime(35,now+.5); env(g,1,.55); o.connect(g);g.connect(out);o.start(now);o.stop(now+.6); break; }
      case 'crowd':   { const n=noise(1.5),g=ctx.createGain(),f=ctx.createBiquadFilter(); f.type='lowpass';f.frequency.value=3500; env(g,.7,1.5); n.connect(f);f.connect(g);g.connect(out);n.start(now); break; }
      case 'laser':   { const o=osc('sine',1400),g=ctx.createGain(); o.frequency.exponentialRampToValueAtTime(80,now+.4); env(g,.8,.42); o.connect(g);g.connect(out);o.start(now);o.stop(now+.45); break; }
      case 'snare':   { const n=noise(.15),g=ctx.createGain(),f=ctx.createBiquadFilter(); f.type='highpass';f.frequency.value=1500; env(g,.9,.18); n.connect(f);f.connect(g);g.connect(out);n.start(now); break; }
      case 'sweep':   { const o=osc('sawtooth',80),g=ctx.createGain(); o.frequency.exponentialRampToValueAtTime(2200,now+.8); env(g,.5,.82); o.connect(g);g.connect(out);o.start(now);o.stop(now+.85); break; }
      case 'bell':    { const o=osc('sine',880),g=ctx.createGain(); g.gain.setValueAtTime(.8,now); g.gain.exponentialRampToValueAtTime(.001,now+1.5); o.connect(g);g.connect(out);o.start(now);o.stop(now+1.6); break; }
      case 'kick':    { const o=osc('sine',200),g=ctx.createGain(); o.frequency.exponentialRampToValueAtTime(30,now+.3); g.gain.setValueAtTime(1,now); g.gain.exponentialRampToValueAtTime(.001,now+.32); o.connect(g);g.connect(out);o.start(now);o.stop(now+.35); break; }
      case 'rewind':  { const o=osc('sawtooth',500),g=ctx.createGain(); o.frequency.linearRampToValueAtTime(40,now+.55); env(g,.6,.58); o.connect(g);g.connect(out);o.start(now);o.stop(now+.6); break; }
      case 'foghorn': { const o=osc('sine',98),o2=osc('sine',73),g=ctx.createGain(); env(g,.7,1.0); [o,o2].forEach(x=>{x.connect(g);x.start(now);x.stop(now+1.05);}); g.connect(out); break; }
      case 'static':  { const n=noise(.25),g=ctx.createGain(); env(g,.45,.28); n.connect(g);g.connect(out);n.start(now); break; }
    }
  } catch(e) { console.warn('SFX error', e); }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function lenToSecs(len) { const [m,s]=(len||'3:00').split(':'); return (+m)*60+(+s); }
function secsToMin(s) { return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`; }
function totalDur(blocks) { return blocks.reduce((a,b) => a + (b.secs||lenToSecs(b.len||'3:00')), 0); }
let _blockId = 1;
function mkBlock(type, label, secs, tint, meta={}) { return { _id: _blockId++, type, label, secs, tint, ...meta }; }

// ── Library Screen ───────────────────────────────────────────────────────────
function LibraryScreen({ crate, onAddToCrate, onRemoveFromCrate }) {
  const [q, setQ] = React.useState('');
  const [genre, setGenre] = React.useState('All');
  const lib = (window.IHYPE_DATA.freeUseLibrary || []);
  const crateIds = crate.map(c => c.id);
  const filtered = lib.filter(s =>
    (genre === 'All' || s.genre === genre) &&
    (!q || s.t.toLowerCase().includes(q.toLowerCase()) || s.a.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Search */}
      <div style={{ padding:'0 14px 10px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.06)', borderRadius:12, padding:'9px 12px', border:'1px solid rgba(185,131,255,.15)' }}>
          <span style={{ color:'var(--ink-3)', fontSize:14 }}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search free-use tracks…" style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--ink)', fontFamily:'var(--f-b)', fontSize:'.88rem' }} />
          {q && <button onClick={()=>setQ('')} style={{ background:'none', border:'none', color:'var(--ink-3)', cursor:'pointer', fontSize:14 }}>×</button>}
        </div>
      </div>
      {/* Genre chips */}
      <div style={{ display:'flex', gap:6, padding:'0 14px 10px', overflowX:'auto', flexShrink:0, scrollbarWidth:'none' }}>
        {GENRES.map(g => (
          <button key={g} onClick={()=>setGenre(g)} style={{ flexShrink:0, padding:'5px 12px', borderRadius:999, border:`1px solid ${genre===g?'#b983ff':'rgba(255,255,255,.1)'}`, background:genre===g?'rgba(185,131,255,.15)':'transparent', color:genre===g?'#b983ff':'var(--ink-3)', fontFamily:'var(--f-m)', fontSize:'.72rem', cursor:'pointer', letterSpacing:'.06em', fontWeight:genre===g?700:400 }}>{g}</button>
        ))}
      </div>
      {/* Notice */}
      <div style={{ margin:'0 14px 10px', padding:'7px 12px', borderRadius:10, background:'rgba(185,131,255,.07)', border:'1px solid rgba(185,131,255,.15)', fontFamily:'var(--f-m)', fontSize:'.68rem', color:'rgba(185,131,255,.8)', letterSpacing:'.04em' }}>
        ✓ All tracks below are licensed for free use by artists on iHYPE.
      </div>
      {/* Song list */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 14px 14px' }}>
        {filtered.map(s => {
          const inCrate = crateIds.includes(s.id);
          return (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
              <div style={{ width:42, height:42, borderRadius:10, background:`linear-gradient(135deg,${s.tint}88,${s.tint}22)`, flexShrink:0, display:'grid', placeItems:'center', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1rem', color:'rgba(255,255,255,.7)' }}>{s.bpm}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.t}</div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)' }}>{s.a} · {s.genre} · {s.len}</div>
              </div>
              <button onClick={() => inCrate ? onRemoveFromCrate(s.id) : onAddToCrate(s)} style={{ width:32, height:32, borderRadius:'50%', border:`1px solid ${inCrate?'rgba(34,229,212,.4)':'rgba(185,131,255,.35)'}`, background:inCrate?'rgba(34,229,212,.1)':'rgba(185,131,255,.1)', color:inCrate?'#22e5d4':'#b983ff', fontSize:16, cursor:'pointer', display:'grid', placeItems:'center', fontWeight:800, flexShrink:0, transition:'all .15s' }}>{inCrate ? '✓' : '+'}</button>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ textAlign:'center', padding:'2rem', color:'var(--ink-3)', fontFamily:'var(--f-b)', fontSize:'.85rem' }}>No tracks match your search.</div>}
      </div>
    </div>
  );
}

// ── Crate Screen ─────────────────────────────────────────────────────────────
function CrateScreen({ crate, setCrate, onGoStudio }) {
  const move = (i, dir) => setCrate(c => { const a=[...c]; const t=a[i]; a[i]=a[i+dir]; a[i+dir]=t; return a; });
  const remove = id => setCrate(c => c.filter(s => s.id !== id));
  const total = crate.reduce((a,s) => a + lenToSecs(s.len||s.length||'3:00'), 0);
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding:'0 14px 10px', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)', letterSpacing:'.08em', textTransform:'uppercase' }}>{crate.length} tracks · {Math.floor(total/60)}m total</div>
        <button onClick={onGoStudio} disabled={crate.length===0} style={{ padding:'7px 16px', borderRadius:999, background:crate.length?'#b983ff':'var(--bg-3)', color:crate.length?'#fff':'var(--ink-3)', border:'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.82rem', cursor:crate.length?'pointer':'default' }}>Open Studio →</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'0 14px 14px' }}>
        {crate.length === 0 && (
          <div style={{ textAlign:'center', padding:'3rem 1rem', color:'var(--ink-3)', fontFamily:'var(--f-b)', fontSize:'.85rem', lineHeight:1.6 }}>Your crate is empty.<br/>Browse the library and add tracks.</div>
        )}
        {crate.map((s,i) => (
          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
              <button onClick={()=>i>0&&move(i,-1)} disabled={i===0} style={{ background:'none', border:'none', color:i===0?'rgba(255,255,255,.1)':'var(--ink-3)', cursor:i===0?'default':'pointer', fontSize:11, padding:0, lineHeight:1 }}>▲</button>
              <button onClick={()=>i<crate.length-1&&move(i,1)} disabled={i===crate.length-1} style={{ background:'none', border:'none', color:i===crate.length-1?'rgba(255,255,255,.1)':'var(--ink-3)', cursor:i===crate.length-1?'default':'pointer', fontSize:11, padding:0, lineHeight:1 }}>▼</button>
            </div>
            <div style={{ width:36, height:36, borderRadius:9, background:`linear-gradient(135deg,${s.tint||'#b983ff'}88,${s.tint||'#b983ff'}22)`, flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.88rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.t}</div>
              <div style={{ fontFamily:'var(--f-m)', fontSize:'.7rem', color:'var(--ink-3)' }}>{s.a} · {s.len}</div>
            </div>
            <button onClick={()=>remove(s.id)} style={{ background:'none', border:'none', color:'rgba(255,80,41,.5)', cursor:'pointer', fontSize:18, flexShrink:0, lineHeight:1 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Studio Screen ────────────────────────────────────────────────────────────
function StudioScreen({ crate, showTitle, setShowTitle, onPublish }) {
  const [timeline, setTimeline] = React.useState([]);
  const [recording, setRecording] = React.useState(false);
  const [recSecs, setRecSecs] = React.useState(0);
  const [activePad, setActivePad] = React.useState(null);
  const [playing, setPlaying] = React.useState(false);
  const [waveVals, setWaveVals] = React.useState(() => Array(20).fill(0.2));
  const [micDenied, setMicDenied] = React.useState(false);
  const timerRef = React.useRef(null);
  const waveRef = React.useRef(null);
  const recorderRef = React.useRef(null);
  const timelineRef = React.useRef(null);

  const addBlock = block => {
    setTimeline(t => [...t, block]);
    setTimeout(() => { if (timelineRef.current) timelineRef.current.scrollLeft = 99999; }, 50);
  };

  const removeBlock = id => setTimeline(t => t.filter(b => b._id !== id));

  // Voice recording
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderRef.current = { mr, stream };
      mr.start();
      setRecording(true);
      setRecSecs(0);
      timerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000);
      waveRef.current = setInterval(() => setWaveVals(Array.from({length:20}, () => 0.15 + Math.random() * 0.85)), 80);
    } catch(e) {
      setMicDenied(true);
      setTimeout(() => setMicDenied(false), 4000);
    }
  };

  const stopRec = () => {
    const { mr, stream } = recorderRef.current || {};
    if (mr && mr.state !== 'inactive') {
      mr.stop(); stream.getTracks().forEach(t => t.stop());
    }
    clearInterval(timerRef.current); clearInterval(waveRef.current);
    const dur = recSecs || 5;
    addBlock(mkBlock('voice', `Voice (${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')})`, dur, '#ff5029'));
    setRecording(false);
    setWaveVals(Array(20).fill(0.2));
  };

  // Total show duration
  const showDur = totalDur(timeline);
  const TARGET_MINS = showDur < 1800 ? 30 : showDur < 3600 ? 60 : 90;
  const durPct = Math.min(100, (showDur / (TARGET_MINS * 60)) * 100);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Show title */}
      <div style={{ padding:'0 14px 8px', flexShrink:0 }}>
        <input value={showTitle} onChange={e=>setShowTitle(e.target.value)} style={{ width:'100%', background:'none', border:'none', outline:'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.3rem', letterSpacing:'-.03em', color:'var(--ink)', boxSizing:'border-box' }} placeholder="Untitled Show" />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
          <div style={{ flex:1, height:4, borderRadius:999, background:'rgba(255,255,255,.08)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:durPct+'%', borderRadius:999, background:`linear-gradient(90deg,#b983ff,${durPct>=100?'#22e5d4':'#5b8cff'})`, transition:'width .4s ease' }} />
          </div>
          <span style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', color:'var(--ink-3)', letterSpacing:'.04em', flexShrink:0 }}>{Math.floor(showDur/60)}m / {TARGET_MINS}m target</span>
        </div>
      </div>

      {/* Timeline */}
      <div ref={timelineRef} style={{ display:'flex', gap:4, padding:'8px 14px', overflowX:'auto', flexShrink:0, scrollbarWidth:'none', minHeight:58, alignItems:'center', background:'rgba(0,0,0,.25)', borderTop:'1px solid rgba(255,255,255,.06)', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        {timeline.length === 0 && <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'rgba(255,255,255,.18)', letterSpacing:'.08em', whiteSpace:'nowrap' }}>Add songs, record your voice, or hit a pad →</div>}
        {timeline.map(b => {
          const w = Math.max(40, Math.min(140, (b.secs/totalDur(timeline))*320));
          return (
            <div key={b._id} onClick={()=>removeBlock(b._id)} title="Tap to remove" style={{ flexShrink:0, width:w, height:42, borderRadius:8, background:`linear-gradient(135deg,${b.tint}cc,${b.tint}55)`, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'4px 6px', cursor:'pointer', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', inset:0, opacity:.15, backgroundImage:`repeating-linear-gradient(90deg,rgba(255,255,255,.3) 0px,rgba(255,255,255,.3) 1px,transparent 1px,transparent ${b.type==='sfx'?8:20}px)` }} />
              <div style={{ fontFamily:'var(--f-m)', fontSize:'.55rem', letterSpacing:'.06em', textTransform:'uppercase', color:'rgba(255,255,255,.9)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', position:'relative' }}>{b.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'10px 14px 14px' }}>
        {/* Voice recorder */}
        <div style={{ marginBottom:16, padding:'14px', borderRadius:16, background:'rgba(255,80,41,.06)', border:'1px solid rgba(255,80,41,.15)', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,80,41,.7)' }}>Voice Track</div>
          {micDenied && <div style={{ fontFamily:'var(--f-b)', fontSize:'.72rem', color:'#ffb84a', textAlign:'center', lineHeight:1.5, padding:'4px 8px' }}>Microphone blocked. Enable mic access in your browser settings to record a voice intro — you can still build a show with songs + SFX.</div>}
          {/* Waveform */}
          <div style={{ display:'flex', alignItems:'center', gap:2, height:40, width:'100%', justifyContent:'center' }}>
            {waveVals.map((v,i) => (
              <div key={i} style={{ width:4, borderRadius:999, background:recording?'#ff5029':'rgba(255,80,41,.25)', height: v*40, transition:recording?'height .08s':'height .3s' }} />
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {recording && <div style={{ fontFamily:'var(--f-m)', fontSize:'.88rem', color:'#ff5029', letterSpacing:'.06em' }}>● {Math.floor(recSecs/60)}:{String(recSecs%60).padStart(2,'0')}</div>}
            <button onClick={recording?stopRec:startRec} style={{ width:64, height:64, borderRadius:'50%', border:`3px solid ${recording?'#ff5029':'rgba(255,80,41,.4)'}`, background:recording?'rgba(255,80,41,.15)':'rgba(255,80,41,.08)', cursor:'pointer', display:'grid', placeItems:'center', boxShadow:recording?'0 0 24px rgba(255,80,41,.4)':'none', transition:'all .2s' }}>
              <div style={{ width:recording?20:24, height:recording?20:24, borderRadius:recording?4:'50%', background:'#ff5029', transition:'all .2s' }} />
            </button>
            {recording && <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)' }}>Tap to stop</div>}
          </div>
        </div>

        {/* Empty crate nudge */}
        {crate.length === 0 && (
          <div style={{ marginBottom:14, padding:'16px', borderRadius:16, background:'rgba(185,131,255,.06)', border:'1px dashed rgba(185,131,255,.25)', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem', marginBottom:6 }}>Your crate is empty</div>
            <div style={{ fontFamily:'var(--f-b)', fontSize:'.78rem', color:'var(--ink-3)', marginBottom:12, lineHeight:1.5 }}>Browse free-use tracks and add them to your crate first.</div>
            <button onClick={()=>setTab('library')} style={{ padding:'8px 20px', borderRadius:999, background:'rgba(185,131,255,.15)', border:'1px solid rgba(185,131,255,.35)', color:'#b983ff', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.82rem', cursor:'pointer' }}>Browse Library →</button>
          </div>
        )}
        {/* Crate songs → add to timeline */}
        {crate.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:8 }}>Add from Crate</div>
            <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:4 }}>
              {crate.map(s => (
                <button key={s.id} onClick={()=>addBlock(mkBlock('song', s.t, lenToSecs(s.len||'3:00'), s.tint||'#b983ff', { artist:s.a }))} style={{ flexShrink:0, padding:'7px 12px', borderRadius:10, border:`1px solid ${s.tint||'#b983ff'}44`, background:`${s.tint||'#b983ff'}11`, color:'var(--ink)', fontFamily:'var(--f-m)', fontSize:'.78rem', cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontWeight:700, color:s.tint||'#b983ff', marginBottom:2 }}>{s.t}</div>
                  <div style={{ fontSize:'.65rem', color:'var(--ink-3)' }}>{s.len}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SFX Pad grid */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:8 }}>Sound Effects</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7 }}>
            {SFX_PADS.map(p => (
              <button key={p.id} onPointerDown={()=>{
                playSFX(p.id); setActivePad(p.id);
                addBlock(mkBlock('sfx', p.label, 2, p.tint));
                setTimeout(()=>setActivePad(null), 200);
              }} style={{ aspectRatio:'1', borderRadius:12, border:`1px solid ${p.tint}44`, background:activePad===p.id?`${p.tint}44`:`${p.tint}11`, color:p.tint, fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.04em', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', fontWeight:700, boxShadow:activePad===p.id?`0 0 14px ${p.tint}66`:'none', transition:'all .1s', transform:activePad===p.id?'scale(.94)':'scale(1)', lineHeight:1.3 }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Publish */}
        {timeline.length >= 2 && (
          <button onClick={()=>onPublish(timeline)} style={{ width:'100%', padding:'13px', borderRadius:999, background:'linear-gradient(90deg,#b983ff,#5b8cff)', color:'#fff', border:'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1rem', cursor:'pointer', letterSpacing:'.02em', boxShadow:'0 4px 24px rgba(185,131,255,.35)' }}>
            Publish Radio Show →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
function RadioShowCreator({ initialCrate, onClose, onToast }) {
  const [tab, setTab] = React.useState('library');
  const [crate, setCrate] = React.useState(initialCrate || []);
  const [showTitle, setShowTitle] = React.useState('My Radio Show');
  const [published, setPublished] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(null);

  const addToCrate = s => setCrate(c => c.find(x=>x.id===s.id) ? c : [...c,s]);
  const removeFromCrate = id => setCrate(c => c.filter(x=>x.id!==id));

  const publish = (timeline) => {
    const songs = timeline.filter(b=>b.type==='song');
    const voices = timeline.filter(b=>b.type==='voice');
    const sfx = timeline.filter(b=>b.type==='sfx');
    const dur = totalDur(timeline);
    setAnalytics({ songs:songs.length, voices:voices.length, sfx:sfx.length, dur, reach: Math.round(dur/60 * 340 + Math.random()*200) });
    setPublished(true);
    onToast && onToast('Radio show published! 🎙️');
  };

  const TABS = [
    { id:'library', label:'Library', icon:'🎵' },
    { id:'crate',   label:`Crate (${crate.length})`, icon:'📦' },
    { id:'studio',  label:'Studio', icon:'🎙' },
  ];

  return (
    <div style={{ position:'absolute', inset:0, zIndex:90, background:'var(--bg)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px 8px', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--ink-3)', cursor:'pointer', fontSize:22, lineHeight:1, padding:'0 4px' }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1rem', letterSpacing:'-.02em' }}>Radio Show Creator</div>
          <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.1em', textTransform:'uppercase', color:'#b983ff' }}>DJ Studio</div>
        </div>
        {published && <div style={{ padding:'4px 12px', borderRadius:999, background:'rgba(185,131,255,.15)', border:'1px solid rgba(185,131,255,.3)', color:'#b983ff', fontFamily:'var(--f-m)', fontSize:'.72rem' }}>Published ✓</div>}
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, padding:'10px 4px', border:'none', background:'none', color:tab===t.id?'#b983ff':'var(--ink-3)', fontFamily:'var(--f-m)', fontSize:'.72rem', cursor:'pointer', borderBottom:`2px solid ${tab===t.id?'#b983ff':'transparent'}`, transition:'all .15s', letterSpacing:'.04em' }}>
            <div style={{ marginBottom:2 }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      {/* Screen */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab==='library' && <LibraryScreen crate={crate} onAddToCrate={addToCrate} onRemoveFromCrate={removeFromCrate} />}
        {tab==='crate'   && <CrateScreen crate={crate} setCrate={setCrate} onGoStudio={()=>setTab('studio')} />}
        {analytics && (
          <div style={{ position:'absolute', inset:0, zIndex:91, background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', gap:16, textAlign:'center' }}>
            <div style={{ fontSize:52 }}>📻</div>
            <div style={{ fontFamily:'var(--f-d)', fontWeight:900, fontSize:'1.4rem', letterSpacing:'-.03em' }}>{showTitle || 'Your Show'} is live!</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, width:'100%', maxWidth:280 }}>
              {[['🎵','Songs',analytics.songs],['🎙','Voices',analytics.voices],['🥁','SFX',analytics.sfx],['👥','Est. Reach',analytics.reach]].map(([ic,lb,v])=>(
                <div key={lb} style={{ padding:'12px', borderRadius:14, background:'rgba(185,131,255,.08)', border:'1px solid rgba(185,131,255,.18)' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{ic}</div>
                  <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem', color:'#b983ff' }}>{v}</div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', color:'var(--ink-3)', letterSpacing:'.08em', textTransform:'uppercase' }}>{lb}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)', lineHeight:1.6 }}>Total runtime: {Math.floor(analytics.dur/60)}m {analytics.dur%60}s</div>
            <button onClick={onClose} style={{ padding:'12px 28px', borderRadius:999, background:'linear-gradient(90deg,#b983ff,#5b8cff)', color:'#fff', border:'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem', cursor:'pointer' }}>Done ✓</button>
          </div>
        )}
        {tab==='studio'  && <StudioScreen crate={crate} showTitle={showTitle} setShowTitle={setShowTitle} onPublish={publish} />}
      </div>
    </div>
  );
}

Object.assign(window, { RadioShowCreator });
