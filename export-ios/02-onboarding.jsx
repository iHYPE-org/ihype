// Onboarding flow — welcome → role → cohort
// Three screens: Welcome (brand pitch), Pick role, Genre cohort selector

function ScrWelcome() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden', position:'relative' }}>
      {/* Aurora background */}
      <div style={{ position:'absolute', inset:0, opacity:.7,
        background: `radial-gradient(ellipse 80% 50% at 30% 10%, ${T.accent}30, transparent 60%),
                     radial-gradient(ellipse 60% 40% at 80% 30%, ${T.fan}25, transparent 60%),
                     radial-gradient(ellipse 70% 50% at 20% 80%, ${T.venue}20, transparent 60%)` }}/>

      {/* Brand mark */}
      <div style={{ padding:'24px 28px 0', position:'relative', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:T.accent, color:T.bg, fontFamily:T.fd, fontWeight:800, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', letterSpacing:'-.02em' }}>iH</div>
        <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.16em', color:T.ink3, textTransform:'uppercase' }}>Not-for-profit · 0% fees</div>
      </div>

      <div style={{ flex:1, padding:'40px 28px 0', display:'flex', flexDirection:'column', position:'relative' }}>
        <h1 style={{ fontFamily:T.fd, fontWeight:800, fontSize:46, letterSpacing:'-.035em', margin:0, lineHeight:.95 }}>
          Music discovery that works <span style={{ fontFamily:T.fs, fontStyle:'italic', fontWeight:400, background:`linear-gradient(120deg, ${T.accent}, ${T.fan})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>for the scene,</span> not the algorithm.
        </h1>

        <p style={{ fontFamily:T.fb, fontSize:15, color:T.ink2, marginTop:18, lineHeight:1.5, maxWidth:320 }}>
          Fans vote with real listens. Artists rise on genuine demand. Every dollar from every ticket stays with the people who made the show happen.
        </p>

        {/* receipts row */}
        <div style={{ display:'flex', gap:0, marginTop:28, padding:'14px 0', borderTop:`1px solid ${T.line}`, borderBottom:`1px solid ${T.line}` }}>
          {[
            { n:'0%', l:'Ticket fees' },
            { n:'9', l:'Members' },
            { n:'∞', l:'Free storage' },
          ].map((s,i)=>(
            <div key={i} style={{ flex:1, textAlign:i===1?'center':(i===0?'left':'right') }}>
              <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:24, letterSpacing:'-.02em', color: i===0?T.accent: i===1? T.fan : T.venue }}>{s.n}</div>
              <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.14em', color:T.ink3, marginTop:4 }}>{s.l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ marginTop:'auto', paddingBottom:36, display:'flex', flexDirection:'column', gap:10 }}>
          <button style={{ padding:'16px 20px', background:T.accent, color:T.bg, border:'none', borderRadius:14, fontFamily:T.fd, fontWeight:700, fontSize:16, letterSpacing:'-.01em', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            Join free — it takes 60 seconds
          </button>
          <button style={{ padding:'14px 20px', background:'transparent', color:T.ink, border:`1px solid ${T.line2}`, borderRadius:14, fontFamily:T.fb, fontSize:14 }}>
            Already a member? Sign in
          </button>
          <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink4, letterSpacing:'.08em', textAlign:'center', marginTop:6 }}>
            COMMUNITY-OWNED · FREE FOREVER · NO ADS THAT STALK YOU
          </div>
        </div>
      </div>
    </div>
  );
}

function ScrPickRole() {
  const roles = [
    { k:'FAN',     label:'Fan',      sub:'Build your listening identity and turn real attendance into signal.', c:T.fan },
    { k:'ARTIST',  label:'Artist',   sub:'Publish media, shows, tour context, and real growth stats.', c:T.accent },
    { k:'DJ',      label:'Promoter', sub:'Create show lanes and connect scenes without fee extraction.', c:T.promoter },
    { k:'VENUE',   label:'Venue',    sub:'List the room, manage ticket signal, and see what fans request.', c:T.venue },
  ];
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      <ScreenHeader eyebrow="STEP 1 OF 4" title="One platform. Four ways in." big />
      <p style={{ padding:'0 22px', fontFamily:T.fb, fontSize:14, color:T.ink2, marginTop:-6, marginBottom:18, lineHeight:1.4 }}>
        Pick how you show up to iHYPE. You can change this later — and you can hold more than one role.
      </p>

      <div style={{ flex:1, padding:'0 18px 8px', display:'flex', flexDirection:'column', gap:10, overflow:'hidden' }}>
        {roles.map((r,i)=>(
          <div key={r.k} style={{
            padding:'14px 16px',
            background: i===0 ? `${r.c}10` : T.bg2,
            border: `1px solid ${i===0 ? r.c : T.line}`,
            borderRadius:14, display:'flex', alignItems:'center', gap:14,
          }}>
            <div style={{
              width:46, height:46, borderRadius:12,
              background:`linear-gradient(135deg, ${r.c}, ${r.c}55)`,
              color:T.bg, fontFamily:T.fd, fontWeight:800, fontSize:18,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>{r.label[0]}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:16, letterSpacing:'-.01em' }}>{r.label}</div>
                <div style={{ fontFamily:T.fm, fontSize:8, letterSpacing:'.14em', color:r.c, padding:'2px 6px', border:`1px solid ${r.c}40`, borderRadius:4 }}>role={r.k}</div>
              </div>
              <div style={{ fontFamily:T.fb, fontSize:12, color:T.ink2, marginTop:3, lineHeight:1.35 }}>{r.sub}</div>
            </div>
            <div style={{
              width:22, height:22, borderRadius:99,
              border:`1.5px solid ${i===0 ? r.c : T.line2}`,
              background: i===0 ? r.c : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              {i===0 && I.check(12, T.bg)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding:'12px 20px 24px', display:'flex', gap:10, flexShrink:0 }}>
        <button style={{ flex:1, padding:'14px', background:T.accent, color:T.bg, border:'none', borderRadius:12, fontFamily:T.fd, fontWeight:700, fontSize:15 }}>
          Continue as Fan →
        </button>
      </div>
    </div>
  );
}

function ScrCohort() {
  const genres = [
    {n:'Indie',c:T.accent, on:true}, {n:'House',c:T.fan, on:true}, {n:'Folk',c:T.venue, on:false},
    {n:'Hip-Hop',c:T.promoter, on:true}, {n:'Jazz',c:T.warn, on:false}, {n:'Punk',c:T.accent, on:true},
    {n:'Ambient',c:T.fan, on:false}, {n:'Soul',c:T.venue, on:true}, {n:'Country',c:T.warn, on:false},
    {n:'Techno',c:T.promoter, on:true}, {n:'Math Rock',c:T.accent, on:false}, {n:'Bedroom Pop',c:T.fan, on:true},
    {n:'Footwork',c:T.venue, on:false}, {n:'Hardcore',c:T.promoter, on:false}, {n:'Shoegaze',c:T.accent, on:true},
  ];
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      <ScreenHeader eyebrow="STEP 2 OF 4 · 7 / 5 SELECTED" title="What's your scene?" big />
      <p style={{ padding:'0 22px', fontFamily:T.fb, fontSize:14, color:T.ink2, marginTop:-6, marginBottom:16, lineHeight:1.4 }}>
        Pick at least 5. Your Seeds will be served <strong style={{ color:T.fan }}>70%</strong> from these, <strong style={{ color:T.ink }}>20%</strong> adjacent, <strong style={{ color:T.accent }}>10%</strong> wildcards.
      </p>

      {/* City */}
      <div style={{ padding:'0 22px 14px' }}>
        <div style={{ padding:'12px 14px', background:T.bg2, border:`1px solid ${T.line2}`, borderRadius:12, display:'flex', alignItems:'center', gap:10 }}>
          {I.pin(16, T.venue)}
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.12em' }}>YOUR SCENE</div>
            <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:15, marginTop:2 }}>Chicago, IL</div>
          </div>
          <div style={{ fontFamily:T.fm, fontSize:11, color:T.venue, letterSpacing:'.05em' }}>Change</div>
        </div>
      </div>

      {/* Genre chips */}
      <div style={{ flex:1, padding:'0 22px', display:'flex', flexWrap:'wrap', gap:8, alignContent:'flex-start', overflow:'hidden' }}>
        {genres.map(g => (
          <div key={g.n} style={{
            padding:'9px 14px', borderRadius:99,
            background: g.on ? `${g.c}18` : T.bg2,
            border: `1px solid ${g.on ? g.c : T.line}`,
            color: g.on ? g.c : T.ink2,
            fontFamily:T.fd, fontWeight: g.on?700:600, fontSize:13,
            display:'flex', alignItems:'center', gap:6,
          }}>
            {g.on && <span style={{ width:5, height:5, borderRadius:99, background:g.c }}/>}
            {g.n}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding:'14px 20px 24px', borderTop:`1px solid ${T.line}`, flexShrink:0, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ flex:1, fontFamily:T.fm, fontSize:10, color:T.ink3, letterSpacing:'.04em', lineHeight:1.4 }}>
          We never sell this list. <span style={{ color:T.ink2, textDecoration:'underline' }}>Data Ethics →</span>
        </div>
        <button style={{ padding:'14px 24px', background:T.accent, color:T.bg, border:'none', borderRadius:12, fontFamily:T.fd, fontWeight:700, fontSize:14 }}>
          Cast a Hype →
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ScrWelcome, ScrPickRole, ScrCohort });
