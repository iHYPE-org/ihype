// Charts (Rising in Chicago) + Artist profile mobile

function ScrCharts() {
  const rising = [
    { r:1,  prev:3,  a:'Maya Reyes',     t:'Sundown',         c:T.accent,    h:'389', fr:'94%', city:'Chicago' },
    { r:2,  prev:7,  a:'Vela',           t:'Cobalt Hour',     c:T.venue,     h:'312', fr:'89%', city:'Chicago' },
    { r:3,  prev:2,  a:'Colin Atwood',   t:'Riverside Memory',c:T.fan,       h:'287', fr:'91%', city:'Chicago' },
    { r:4,  prev:11, a:'Hex / Pearl',    t:'Slow Burn',       c:T.promoter,  h:'241', fr:'86%', city:'Chicago' },
    { r:5,  prev:4,  a:'June Mire',      t:'Halflight',       c:T.warn,      h:'218', fr:'88%', city:'Chicago' },
    { r:6,  prev:9,  a:'Northbound',     t:'Cassiopeia',      c:T.accent,    h:'201', fr:'82%', city:'Chicago' },
    { r:7,  prev:5,  a:'Lola Bay',       t:'Pacific Sun',     c:T.venue,     h:'194', fr:'90%', city:'Chicago' },
  ];

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      <ScreenHeader eyebrow="LIVE · CHICAGO · UPDATED 2 MIN AGO" title="Rising" big right={
        <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, letterSpacing:'.06em', padding:'5px 10px', border:`1px solid ${T.line2}`, borderRadius:99 }}>This week ▾</div>
      } />

      {/* filters */}
      <div style={{ padding:'0 22px 14px', display:'flex', gap:6, overflowX:'auto', flexShrink:0 }}>
        {['Chicago','All scenes','Indie','House','Bedroom Pop','Folk','Punk'].map((f,i)=>(
          <div key={f} style={{
            padding:'7px 14px', borderRadius:99, flexShrink:0,
            background: i===0 ? T.accent : T.bg2,
            color: i===0 ? T.bg : T.ink2,
            border: i===0 ? 'none' : `1px solid ${T.line}`,
            fontFamily:T.fd, fontWeight:700, fontSize:12, letterSpacing:'-.005em',
          }}>{f}</div>
        ))}
      </div>

      {/* Top card */}
      <div style={{ margin:'0 22px 14px', padding:'14px 14px 14px', borderRadius:16, background:`${T.accent}10`, border:`1px solid ${T.accent}40`, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <AlbumArt c={T.accent} size={60} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:24, color:T.accent, letterSpacing:'-.02em', lineHeight:1 }}>#1</div>
            <div style={{ fontFamily:T.fm, fontSize:9, color:T.accent, letterSpacing:'.14em' }}>↑2</div>
          </div>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:15, marginTop:4 }}>Sundown · Maya Reyes</div>
          <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, marginTop:3, letterSpacing:'.04em' }}>389 Hypes · 94% finish · 26 venues</div>
        </div>
        <button style={{ width:38, height:38, borderRadius:99, background:T.accent, color:T.bg, border:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{I.play(14, T.bg)}</button>
      </div>

      {/* list */}
      <div style={{ flex:1, overflow:'hidden', padding:'0 22px 4px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'0 0 8px', fontFamily:T.fm, fontSize:9, color:T.ink4, letterSpacing:'.14em' }}>
          <span>RANK · ARTIST · TRACK</span>
          <span>HYPES · FINISH</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column' }}>
          {rising.slice(1).map(r => {
            const up = r.prev > r.r, same = r.prev === r.r;
            return (
              <div key={r.r} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderTop:`1px solid ${T.line}` }}>
                <div style={{ width:32, textAlign:'right', fontFamily:T.fd, fontWeight:800, fontSize:18, color:T.ink, letterSpacing:'-.02em' }}>{r.r}</div>
                <div style={{ width:24, fontFamily:T.fm, fontSize:10, color: up ? T.venue : same ? T.ink4 : '#ff5a5a', letterSpacing:'.04em' }}>
                  {up ? '↑' : same ? '–' : '↓'}{Math.abs(r.prev - r.r) || ''}
                </div>
                <AlbumArt c={r.c} size={34} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13, letterSpacing:'-.005em' }}>{r.t}</div>
                  <div style={{ fontFamily:T.fb, fontSize:11, color:T.ink3, marginTop:1 }}>{r.a}</div>
                </div>
                <div style={{ textAlign:'right', minWidth:64 }}>
                  <div style={{ fontFamily:T.fm, fontSize:11, color:T.ink, letterSpacing:'.04em' }}>{r.h}</div>
                  <div style={{ fontFamily:T.fm, fontSize:9, color: parseInt(r.fr) >= 90 ? T.fan : T.ink3, letterSpacing:'.04em', marginTop:1 }}>{r.fr}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TabBar active="charts" />
    </div>
  );
}

function ScrArtistProfile() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>

      {/* hero */}
      <div style={{ height:240, position:'relative', flexShrink:0, marginTop:-STATUS_H }}>
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg, ${T.accent}, ${T.accent}60 50%, ${T.bg})` }}/>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 25% 20%, rgba(255,255,255,.3), transparent 55%)'}}/>
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, transparent 30%, ${T.bg} 100%)` }}/>

        {/* nav buttons */}
        <div style={{ position:'absolute', top:STATUS_H, left:0, right:0, padding:'4px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ width:36, height:36, borderRadius:99, background:'rgba(0,0,0,.4)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {I.arrow(14, T.ink, 'left')}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ width:36, height:36, borderRadius:99, background:'rgba(0,0,0,.4)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {I.share(13, T.ink)}
            </div>
            <div style={{ width:36, height:36, borderRadius:99, background:'rgba(0,0,0,.4)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700 }}>⋯</div>
          </div>
        </div>

        <div style={{ position:'absolute', bottom:18, left:22, right:22 }}>
          <div style={{ fontFamily:T.fm, fontSize:9, color:'rgba(255,255,255,.7)', letterSpacing:'.18em' }}>● CHICAGO · INDIE / DREAM POP</div>
          <h1 style={{ fontFamily:T.fd, fontWeight:800, fontSize:38, letterSpacing:'-.03em', margin:'6px 0 0', lineHeight:.95 }}>Maya Reyes</h1>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, fontFamily:T.fm, fontSize:11, color:'rgba(255,255,255,.8)', letterSpacing:'.04em' }}>
            {I.verified(12, T.ink)} Verified artist · iH/2,847
          </div>
        </div>
      </div>

      {/* stat strip */}
      <div style={{ padding:'14px 22px 14px', borderBottom:`1px solid ${T.line}`, flexShrink:0, display:'flex', gap:14 }}>
        {[
          { l:'HYPES THIS WEEK', n:'389', d:'+18%', c:T.accent },
          { l:'CHART POSITION', n:'#1', d:'Chicago', c:T.fan },
          { l:'NEXT SHOW', n:'Tue', d:'Empty Bottle', c:T.venue },
        ].map((s,i)=>(
          <div key={i} style={{ flex:1 }}>
            <div style={{ fontFamily:T.fm, fontSize:8, color:T.ink4, letterSpacing:'.14em' }}>{s.l}</div>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:22, color:s.c, letterSpacing:'-.02em', marginTop:6, lineHeight:1 }}>{s.n}</div>
            <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, marginTop:3 }}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div style={{ padding:'14px 22px 6px', display:'flex', gap:8, flexShrink:0 }}>
        <button style={{ flex:1, padding:'12px', background:T.accent, color:T.bg, border:'none', borderRadius:12, fontFamily:T.fd, fontWeight:700, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          {I.heart(14, T.bg)} Hype Maya
        </button>
        <button style={{ flex:1, padding:'12px', background:T.bg2, color:T.ink, border:`1px solid ${T.line2}`, borderRadius:12, fontFamily:T.fd, fontWeight:700, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          {I.calendar(12, T.ink)} See shows (3)
        </button>
      </div>

      {/* Top tracks */}
      <div style={{ flex:1, overflow:'hidden', padding:'12px 22px 4px' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:15, letterSpacing:'-.01em' }}>Top tracks</div>
          <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.1em' }}>BY HYPE · ALL-TIME</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column' }}>
          {[
            { n:1, t:'Sundown',           h:'2,104', d:'94%' },
            { n:2, t:'Halflight',         h:'1,887', d:'91%' },
            { n:3, t:'Late Roses',        h:'1,402', d:'88%' },
            { n:4, t:'Carry Me',          h:'1,288', d:'85%' },
          ].map(t=>(
            <div key={t.n} style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 0', borderTop:`1px solid ${T.line}` }}>
              <div style={{ width:18, fontFamily:T.fm, fontSize:11, color:T.ink3, textAlign:'right' }}>{t.n}</div>
              <AlbumArt c={T.accent} size={32} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13 }}>{t.t}</div>
                <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, marginTop:1, letterSpacing:'.04em' }}>{t.h} Hypes · {t.d} finish</div>
              </div>
              <div style={{ color:T.ink3 }}>{I.play(14, T.ink3)}</div>
            </div>
          ))}
        </div>
      </div>

      <TabBar />
    </div>
  );
}

Object.assign(window, { ScrCharts, ScrArtistProfile });
