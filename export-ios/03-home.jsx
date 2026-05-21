// Home / Today feed — the post-login landing surface.
// Now Playing — full-screen player when a Seed becomes a full track.

function ScrHome() {
  const queue = [
    { t:'Sundown',           a:'Maya Reyes',      c:T.accent,    plays:'now', hype:'+1' },
    { t:'Halflight',         a:'Maya Reyes',      c:T.accent,    plays:'next' },
    { t:'Cobalt Hour',       a:'Vela',            c:T.venue,     plays:'queued' },
    { t:'Riverside Memory',  a:'Colin Atwood',    c:T.fan,       plays:'queued' },
  ];
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      {/* Greeting */}
      <div style={{ padding:'4px 22px 14px' }}>
        <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, letterSpacing:'.14em' }}>SUNDAY · CHICAGO</div>
        <h1 style={{ fontFamily:T.fd, fontWeight:800, fontSize:30, letterSpacing:'-.025em', marginTop:6, marginBottom:0, lineHeight:1 }}>
          Evening, Jordan.
        </h1>
        <p style={{ fontFamily:T.fs, fontStyle:'italic', fontSize:15, color:T.ink2, marginTop:8, lineHeight:1.4 }}>
          Three artists you've Hyped have a show this week.
        </p>
      </div>

      <div style={{ flex:1, overflow:'hidden', padding:'0 0 8px' }}>
        {/* Hero — Seeds entry */}
        <div style={{ margin:'0 22px 16px', padding:'18px 18px 16px', borderRadius:18, position:'relative', overflow:'hidden',
                       background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accent}90 30%, ${T.bg3} 100%)` }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 80% 20%, rgba(255,255,255,.25), transparent 55%)' }}/>
          <div style={{ position:'relative' }}>
            <div style={{ fontFamily:T.fm, fontSize:9, color:T.bg, letterSpacing:'.18em', opacity:.85 }}>● 12 NEW SEEDS FOR YOU</div>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:24, color:T.bg, marginTop:8, lineHeight:1, letterSpacing:'-.02em' }}>
              Tonight's queue is ready.
            </div>
            <div style={{ fontFamily:T.fb, fontSize:12, color:'rgba(0,0,0,.7)', marginTop:6, maxWidth:240 }}>
              70 / 20 / 10 mix. Listen all the way through to Hype.
            </div>
            <div style={{ marginTop:14, display:'flex', gap:8 }}>
              <button style={{ padding:'10px 16px', background:T.bg, color:T.ink, border:'none', borderRadius:99, fontFamily:T.fd, fontWeight:700, fontSize:13, display:'inline-flex', alignItems:'center', gap:6 }}>
                {I.play(11, T.ink)} Start swiping
              </button>
              <button style={{ padding:'10px 14px', background:'rgba(0,0,0,.2)', color:T.bg, border:`1px solid rgba(0,0,0,.3)`, borderRadius:99, fontFamily:T.fm, fontSize:11, letterSpacing:'.06em' }}>
                Filter
              </button>
            </div>
          </div>
        </div>

        {/* Queue */}
        <div style={{ padding:'0 22px 12px' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:18, letterSpacing:'-.01em' }}>Queue</div>
            <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, letterSpacing:'.08em' }}>4 TRACKS · 14 MIN</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {queue.map((q,i)=>(
              <div key={i} style={{
                padding:'10px 12px', background: i===0 ? `${q.c}10` : T.bg2,
                border:`1px solid ${i===0 ? `${q.c}40` : T.line}`, borderRadius:12,
                display:'flex', alignItems:'center', gap:11,
              }}>
                <AlbumArt c={q.c} size={40} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:14, letterSpacing:'-.01em' }}>{q.t}</div>
                  <div style={{ fontFamily:T.fb, fontSize:12, color:T.ink3, marginTop:1 }}>{q.a}</div>
                </div>
                {i===0 ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ display:'flex', gap:1.5, alignItems:'flex-end', height:14 }}>
                      {[8,12,6,10,7].map((h,j)=><div key={j} style={{ width:2, height:h, background:q.c, borderRadius:1 }}/>)}
                    </div>
                    <div style={{ fontFamily:T.fm, fontSize:9, color:q.c, letterSpacing:'.12em' }}>PLAYING</div>
                  </div>
                ) : (
                  <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.12em', textTransform:'uppercase' }}>{q.plays}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tonight's shows */}
        <div style={{ padding:'8px 22px 12px' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:18, letterSpacing:'-.01em' }}>From artists you hyped</div>
            <div style={{ fontFamily:T.fm, fontSize:10, color:T.venue, letterSpacing:'.08em' }}>3 SHOWS</div>
          </div>
          <div style={{ display:'flex', gap:10, overflowX:'auto' }}>
            {[
              { a:'Maya Reyes', v:'Empty Bottle', d:'TUE · 9PM', c:T.accent },
              { a:'Vela',       v:'Schubas',      d:'FRI · 8PM', c:T.venue },
              { a:'Colin A.',   v:'Hideout',      d:'SAT · 10PM', c:T.fan },
            ].map((s,i)=>(
              <div key={i} style={{ width:160, padding:0, borderRadius:12, background:T.bg2, border:`1px solid ${T.line}`, overflow:'hidden', flexShrink:0 }}>
                <div style={{ height:64, background:`linear-gradient(135deg, ${s.c}, ${s.c}55)`, position:'relative' }}>
                  <div style={{ position:'absolute', top:8, left:10, fontFamily:T.fm, fontSize:9, color:T.bg, letterSpacing:'.14em', padding:'3px 6px', background:'rgba(0,0,0,.35)', borderRadius:4 }}>{s.d}</div>
                </div>
                <div style={{ padding:'10px 12px 12px' }}>
                  <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13 }}>{s.a}</div>
                  <div style={{ fontFamily:T.fb, fontSize:11, color:T.ink3, marginTop:2 }}>{s.v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TabBar active="home" />
    </div>
  );
}

function ScrNowPlaying() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden', position:'relative' }}>
      {/* huge art */}
      <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, ${T.accent}25 0%, ${T.bg} 60%)` }}/>

      <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 24px 8px', position:'relative', alignItems:'center' }}>
        <div style={{ width:32, height:32, borderRadius:99, background:'rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {I.arrow(14, T.ink, 'down')}
        </div>
        <div style={{ textAlign:'center', flex:1 }}>
          <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.16em' }}>NOW PLAYING FROM</div>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13, marginTop:2 }}>Tonight's queue</div>
        </div>
        <div style={{ width:32, height:32, borderRadius:99, background:'rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700 }}>⋯</div>
      </div>

      {/* art */}
      <div style={{ padding:'14px 28px 0', position:'relative' }}>
        <div style={{
          width:'100%', aspectRatio:1, borderRadius:18, position:'relative', overflow:'hidden',
          background: `linear-gradient(135deg, ${T.accent}, ${T.accent}77 50%, ${T.bg3})`,
          boxShadow: `0 30px 80px ${T.accent}40`,
        }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 30% 25%, rgba(255,255,255,.3), transparent 55%)'}}/>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 75% 80%, rgba(0,0,0,.4), transparent 60%)'}}/>
          <div style={{ position:'absolute', left:18, bottom:18, fontFamily:T.fd, fontWeight:800, fontSize:32, color:'rgba(255,255,255,.95)', textShadow:'0 2px 12px rgba(0,0,0,.5)', letterSpacing:'-.02em', lineHeight:1 }}>
            SUNDOWN
          </div>
        </div>
      </div>

      {/* meta */}
      <div style={{ padding:'22px 28px 0', position:'relative' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontFamily:T.fd, fontWeight:800, fontSize:26, margin:0, letterSpacing:'-.02em', lineHeight:1 }}>Sundown</h1>
            <div style={{ fontFamily:T.fb, fontSize:15, color:T.ink2, marginTop:5, display:'flex', alignItems:'center', gap:6 }}>
              Maya Reyes {I.verified(13, T.accent)}
            </div>
          </div>
          <button style={{ width:42, height:42, borderRadius:99, background:`${T.accent}20`, color:T.accent, border:`1px solid ${T.accent}50`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {I.heart(20, T.accent)}
          </button>
        </div>
      </div>

      {/* progress */}
      <div style={{ padding:'24px 28px 0', position:'relative' }}>
        <div style={{ height:4, background:'rgba(255,255,255,.1)', borderRadius:2, position:'relative' }}>
          <div style={{ width:'42%', height:'100%', background:T.ink, borderRadius:2, position:'relative' }}>
            <div style={{ position:'absolute', right:-6, top:-4, width:12, height:12, borderRadius:99, background:T.ink }}/>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontFamily:T.fm, fontSize:11, color:T.ink3, marginTop:8 }}>
          <span>1:32</span>
          <span style={{ color:T.accent, letterSpacing:'.08em' }}>● HYPE AT 0:00</span>
          <span>-2:08</span>
        </div>
      </div>

      {/* transport */}
      <div style={{ padding:'18px 28px 0', position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ width:42, height:42, display:'flex', alignItems:'center', justifyContent:'center', color:T.ink2 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11 19V5l-9 7 9 7zm2-14v14l9-7-9-7z"/></svg>
        </div>
        <div style={{ width:42, height:42, display:'flex', alignItems:'center', justifyContent:'center', color:T.ink }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8L6 20z"/></svg>
        </div>
        <div style={{ width:72, height:72, borderRadius:99, background:T.ink, color:T.bg, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 10px 30px rgba(0,0,0,.4)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        </div>
        <div style={{ width:42, height:42, display:'flex', alignItems:'center', justifyContent:'center', color:T.ink }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M18 20L4 12l14-8z" transform="rotate(180 12 12)"/></svg>
        </div>
        <div style={{ width:42, height:42, display:'flex', alignItems:'center', justifyContent:'center', color:T.ink2 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M13 5v14l9-7-9-7zm-11 0v14l9-7-9-7z"/></svg>
        </div>
      </div>

      {/* fan receipt strip */}
      <div style={{ marginTop:'auto', position:'relative', padding:'14px 22px 22px' }}>
        <div style={{ padding:'12px 14px', background:T.bg2, border:`1px solid ${T.line}`, borderRadius:14, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:34, height:34, borderRadius:99, background:`${T.fan}20`, color:T.fan, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:T.fd, fontWeight:800, fontSize:13 }}>389</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13, letterSpacing:'-.005em' }}>389 fans Hyped this week</div>
            <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, letterSpacing:'.04em', marginTop:2 }}>+18% on last week · Maya plays Empty Bottle Tue</div>
          </div>
          <button style={{ padding:'8px 12px', background:T.venue, color:T.bg, border:'none', borderRadius:99, fontFamily:T.fd, fontWeight:700, fontSize:11 }}>Tickets</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScrHome, ScrNowPlaying });
