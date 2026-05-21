// Mobile: Seed swipe screen + post-swipe Hype confirmation
// Addresses: #2 (product hook visible). This IS the iHYPE moment.

function MobileSeed() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      {/* header */}
      <div style={{ padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:18, letterSpacing:'-.02em' }}>Seeds</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.14em', color:T.fan, padding:'3px 8px', border:`1px solid ${T.fan}40`, borderRadius:99 }}>70/20/10</div>
        </div>
      </div>

      {/* deck stack */}
      <div style={{ flex:1, padding:'8px 20px 0', position:'relative' }}>
        {/* back card */}
        <div style={{ position:'absolute', inset:'8px 32px 0', borderRadius:14, background:T.bg3, transform:'translateY(8px) scale(.96)', opacity:.5 }}/>
        <div style={{ position:'absolute', inset:'8px 26px 0', borderRadius:14, background:T.bg3, transform:'translateY(4px) scale(.98)', opacity:.8 }}/>

        {/* top card */}
        <div style={{ position:'relative', borderRadius:14, background:T.bg2, border:`1px solid ${T.line2}`, overflow:'hidden', height:'calc(100% - 12px)', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
          {/* art region */}
          <div style={{ height:'58%', position:'relative' }}>
            <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg, ${T.accent}, ${T.accent}66 50%, ${T.bg3})` }}/>
            <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 25% 25%, rgba(255,255,255,.25), transparent 60%)' }}/>
            {/* waveform */}
            <div style={{ position:'absolute', left:20, right:20, bottom:50, height:50, display:'flex', alignItems:'center', gap:2 }}>
              {Array.from({length:46}).map((_,i)=>{
                const h = 8 + Math.abs(Math.sin(i*0.55) * 28) + (i<14?6:0) + (i>32?6:0);
                const active = i < 18;
                return <div key={i} style={{ width:3, height:`${h}px`, background: active ? T.ink : 'rgba(255,255,255,.3)', borderRadius:1 }} />;
              })}
            </div>
            {/* timer */}
            <div style={{ position:'absolute', left:20, bottom:20, fontFamily:T.fm, fontSize:11, color:T.ink, letterSpacing:'.06em' }}>0:08 / 0:22</div>
            <div style={{ position:'absolute', right:20, bottom:20, fontFamily:T.fm, fontSize:10, color:T.ink, letterSpacing:'.14em', padding:'4px 8px', border:`1px solid ${T.ink}40`, borderRadius:99 }}>SEED</div>
          </div>

          {/* meta */}
          <div style={{ flex:1, padding:'18px 20px', display:'flex', flexDirection:'column' }}>
            <Eyebrow c={T.accent}>● 22S SEED · CHICAGO INDIE</Eyebrow>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:24, letterSpacing:'-.02em', marginTop:8, lineHeight:1 }}>Sundown</div>
            <div style={{ fontFamily:T.fb, fontSize:14, color:T.ink2, marginTop:4 }}>Maya Reyes</div>
            <div style={{ fontFamily:T.fs, fontStyle:'italic', fontSize:14, color:T.ink2, marginTop:14, lineHeight:1.45 }}>
              "The drop after the bridge — that's the seed."
            </div>
            <div style={{ marginTop:'auto', display:'flex', gap:8, fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.08em' }}>
              <span>104 SAVES</span><span>·</span><span>22 HYPED</span><span>·</span><span>18% SKIP</span>
            </div>
          </div>
        </div>
      </div>

      {/* action bar */}
      <div style={{ padding:'24px 28px 36px', display:'flex', alignItems:'center', justifyContent:'space-around', gap:16 }}>
        <button style={{ width:56, height:56, borderRadius:99, background:T.bg3, border:`1px solid ${T.line2}`, color:T.ink2, display:'flex', alignItems:'center', justifyContent:'center' }}>{I.x(20, T.ink2)}</button>
        <button style={{ width:48, height:48, borderRadius:99, background:T.bg3, border:`1px solid ${T.line}`, color:T.ink3, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:T.fm, fontSize:9, letterSpacing:'.1em' }}>★</button>
        <button style={{ width:72, height:72, borderRadius:99, background:T.accent, color:T.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:T.fm, fontSize:9, letterSpacing:'.1em', boxShadow:`0 10px 40px ${T.accent}40` }}>
          {I.heart(28, T.bg)}
        </button>
        <button style={{ width:48, height:48, borderRadius:99, background:T.bg3, border:`1px solid ${T.line}`, color:T.ink3, display:'flex', alignItems:'center', justifyContent:'center' }}>{I.play(16, T.ink3)}</button>
        <button style={{ width:56, height:56, borderRadius:99, background:T.bg3, border:`1px solid ${T.line2}`, color:T.ink2, display:'flex', alignItems:'center', justifyContent:'center' }}>{I.arrow(20, T.ink2, 'right')}</button>
      </div>

      {/* labels */}
      <div style={{ padding:'0 28px 24px', display:'flex', justifyContent:'space-between', fontFamily:T.fm, fontSize:9, color:T.ink4, letterSpacing:'.16em' }}>
        <span>SKIP</span>
        <span>SAVE</span>
        <span style={{color:T.accent}}>QUEUE FULL · HYPE</span>
        <span>PLAY NEXT</span>
        <span>BUMP</span>
      </div>
    </div>
  );
}

function MobileHypeMoment() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, position:'relative', overflow:'hidden' }}>
      {/* burst */}
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 35%, ${T.accent}30, transparent 60%)` }}/>

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 32px', textAlign:'center', position:'relative' }}>
        <div style={{ width:140, height:140, borderRadius:99, border:`2px solid ${T.accent}`, background:`${T.accent}10`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:32, position:'relative' }}>
          {I.heart(72, T.accent)}
          {/* sparks */}
          {[0,60,120,180,240,300].map(a=>(
            <div key={a} style={{ position:'absolute', width:6, height:6, borderRadius:99, background:T.accent, transform:`rotate(${a}deg) translateY(-92px)` }}/>
          ))}
        </div>
        <Eyebrow c={T.accent}>● HYPE CAST · VERIFIED</Eyebrow>
        <h1 style={{ fontFamily:T.fs, fontStyle:'italic', fontWeight:400, fontSize:42, letterSpacing:'-.02em', marginTop:14, lineHeight:1 }}>
          You hyped<br/>
          <span style={{ fontFamily:T.fd, fontStyle:'normal', fontWeight:800, color:T.accent }}>Sundown.</span>
        </h1>
        <p style={{ fontFamily:T.fb, fontSize:13, color:T.ink2, marginTop:14, maxWidth:280, lineHeight:1.5 }}>
          You finished the track. That's 1 of <strong style={{color:T.ink}}>389</strong> real fans behind Maya this week.
        </p>

        {/* progression */}
        <div style={{ marginTop:28, padding:'14px 18px', border:`1px solid ${T.line2}`, borderRadius:12, background:T.bg2, width:'100%', maxWidth:300 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontFamily:T.fm, fontSize:10, color:T.ink3, letterSpacing:'.08em' }}>
            <span>YOUR HYPES THIS WEEK</span>
            <span style={{ color:T.fan }}>3 / 5</span>
          </div>
          <div style={{ height:4, background:'rgba(255,255,255,.06)', borderRadius:2, marginTop:8, overflow:'hidden' }}>
            <div style={{ width:'60%', height:'100%', background:T.fan }}/>
          </div>
          <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, marginTop:8, letterSpacing:'.04em' }}>2 more to unlock your taste map</div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:24 }}>
          <Btn ghost sm>{I.calendar(11)} See Maya's shows</Btn>
          <Btn accent={T.accent} sm>Next seed →</Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MobileSeed, MobileHypeMoment });
