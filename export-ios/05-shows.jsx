// Shows tab + Show detail page

function ScrShows() {
  const sections = [
    {
      label: 'TONIGHT',
      shows: [
        { a:'Maya Reyes',      v:'Empty Bottle', n:'1.4 mi · 9:00 PM', c:T.accent,  hyped:true,  going:true,  price:'$15' },
        { a:'Vex / Pearl',     v:'Sleeping Village', n:'2.7 mi · 9:30 PM', c:T.promoter, going:false, price:'$12' },
      ],
    },
    {
      label: 'THIS WEEK',
      shows: [
        { a:'Vela',            v:'Schubas',     n:'Fri · 8:00 PM', c:T.venue,  hyped:true, price:'$18' },
        { a:'Colin Atwood',    v:'Hideout',     n:'Sat · 10:00 PM', c:T.fan, hyped:true, price:'$10' },
        { a:'June Mire + 2',   v:'Lincoln Hall',n:'Sun · 7:00 PM', c:T.warn, price:'$22' },
      ],
    },
    {
      label: 'NEXT',
      shows: [
        { a:'Northbound',      v:'Sleeping Village',n:'Jun 24 · 8 PM', c:T.accent, price:'$14' },
      ],
    },
  ];

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      <ScreenHeader eyebrow="● 26 SHOWS IN CHICAGO · 0% FEES" title="Shows" big accent={T.venue} right={
        <div style={{ width:32, height:32, borderRadius:99, background:T.bg2, border:`1px solid ${T.line2}`, display:'flex', alignItems:'center', justifyContent:'center' }}>{I.search(14, T.ink2)}</div>
      } />

      {/* ticket banner */}
      <div style={{ margin:'0 22px 14px', padding:'12px 14px', borderRadius:12, background:`${T.venue}10`, border:`1px solid ${T.venue}40`, display:'flex', alignItems:'center', gap:11, flexShrink:0 }}>
        <div style={{ width:36, height:36, borderRadius:8, background:T.venue, color:T.bg, fontFamily:T.fd, fontWeight:800, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', letterSpacing:'-.02em' }}>0%</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13 }}>Every ticket. 0% fees.</div>
          <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, marginTop:2 }}>Face value goes to the artist & venue. Always.</div>
        </div>
      </div>

      <div style={{ flex:1, overflow:'hidden', padding:'0 22px 4px' }}>
        {sections.map(sec => (
          <div key={sec.label} style={{ marginBottom:18 }}>
            <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.18em', marginBottom:8 }}>{sec.label}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {sec.shows.map((s,i)=>(
                <div key={i} style={{
                  padding:'12px 12px',
                  background: s.going ? `${s.c}10` : T.bg2,
                  border:`1px solid ${s.going ? `${s.c}40` : T.line}`,
                  borderRadius:12, display:'flex', alignItems:'center', gap:11,
                }}>
                  <AlbumArt c={s.c} size={48} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:14, letterSpacing:'-.01em' }}>{s.a}</div>
                      {s.hyped && <div style={{ width:6, height:6, borderRadius:99, background:T.accent }}/>}
                    </div>
                    <div style={{ fontFamily:T.fb, fontSize:11, color:T.ink2, marginTop:2 }}>{s.v}</div>
                    <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, marginTop:3, letterSpacing:'.06em' }}>{s.n}</div>
                  </div>
                  {s.going ? (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ padding:'7px 10px', background:s.c, color:T.bg, borderRadius:8, fontFamily:T.fm, fontSize:9, fontWeight:700, letterSpacing:'.1em' }}>GOING</div>
                      <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, marginTop:5, letterSpacing:'.06em' }}>+10 HYPE</div>
                    </div>
                  ) : (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:14, color:T.ink, letterSpacing:'-.01em' }}>{s.price}</div>
                      <div style={{ fontFamily:T.fm, fontSize:8, color:T.ink3, marginTop:2, letterSpacing:'.1em' }}>FACE</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <TabBar active="shows" />
    </div>
  );
}

function ScrShowDetail() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>

      {/* Hero with map */}
      <div style={{ height:200, position:'relative', flexShrink:0, marginTop:-STATUS_H }}>
        {/* fake map */}
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg, #1a1a22, #14141a 60%, #0e0e14)` }}/>
        {/* fake roads */}
        <svg width="100%" height="100%" viewBox="0 0 390 200" style={{ position:'absolute', inset:0 }}>
          <g stroke="rgba(255,255,255,.06)" fill="none" strokeWidth="1">
            {Array.from({length:10}).map((_,i)=>(<line key={`h${i}`} x1="0" y1={i*22} x2="390" y2={i*22}/>))}
            {Array.from({length:18}).map((_,i)=>(<line key={`v${i}`} x1={i*24} y1="0" x2={i*24} y2="200"/>))}
            <path d="M0 110 Q120 100 180 130 T390 90" stroke="rgba(255,255,255,.14)" strokeWidth="2"/>
            <path d="M50 0 Q70 80 110 130 T200 200" stroke="rgba(255,255,255,.1)" strokeWidth="1.5"/>
          </g>
          <circle cx="200" cy="120" r="14" fill={T.venue} fillOpacity=".15"/>
          <circle cx="200" cy="120" r="8" fill={T.venue}/>
        </svg>
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, transparent 60%, ${T.bg} 100%)` }}/>

        {/* top nav */}
        <div style={{ position:'absolute', top:STATUS_H, left:0, right:0, padding:'4px 18px', display:'flex', justifyContent:'space-between' }}>
          <div style={{ width:36, height:36, borderRadius:99, background:'rgba(0,0,0,.6)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {I.arrow(14, T.ink, 'left')}
          </div>
          <div style={{ padding:'8px 14px', borderRadius:99, background:'rgba(0,0,0,.6)', backdropFilter:'blur(8px)', fontFamily:T.fm, fontSize:11, color:T.ink, letterSpacing:'.04em', display:'flex', alignItems:'center', gap:6 }}>
            {I.pin(11, T.venue)} 1.4 mi · 8 min
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding:'4px 22px 12px', flexShrink:0 }}>
        <div style={{ fontFamily:T.fm, fontSize:10, color:T.venue, letterSpacing:'.16em', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:99, background:T.venue }}/>
          TUESDAY · DOORS 8 PM · SHOW 9 PM
        </div>
        <h1 style={{ fontFamily:T.fd, fontWeight:800, fontSize:30, letterSpacing:'-.025em', margin:'8px 0 0', lineHeight:1 }}>Maya Reyes</h1>
        <div style={{ fontFamily:T.fb, fontSize:14, color:T.ink2, marginTop:5 }}>w/ June Mire · The Hightones</div>
      </div>

      {/* Venue card */}
      <div style={{ margin:'0 22px 12px', padding:'12px 14px', background:T.bg2, border:`1px solid ${T.line}`, borderRadius:12, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <div style={{ width:42, height:42, borderRadius:10, background:`linear-gradient(135deg, ${T.venue}, ${T.venue}55)`, color:T.bg, fontFamily:T.fd, fontWeight:800, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>EB</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:14 }}>Empty Bottle</div>
          <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, marginTop:2, letterSpacing:'.04em' }}>1035 N Western Ave · Cap 400 · 21+</div>
        </div>
        <div style={{ fontFamily:T.fm, fontSize:11, color:T.venue, letterSpacing:'.04em', display:'flex', alignItems:'center', gap:4 }}>
          {I.arrow(11, T.venue, 'right')}
        </div>
      </div>

      {/* Demand signal */}
      <div style={{ padding:'0 22px 12px', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, letterSpacing:'.12em' }}>FAN DEMAND · 342 / 400</div>
          <div style={{ fontFamily:T.fm, fontSize:10, color:T.accent, letterSpacing:'.06em' }}>HOT</div>
        </div>
        <div style={{ height:6, background:T.bg2, borderRadius:3, overflow:'hidden', position:'relative' }}>
          <div style={{ width:'85%', height:'100%', background:`linear-gradient(90deg, ${T.venue}, ${T.accent})` }}/>
        </div>
        <div style={{ fontFamily:T.fb, fontSize:11, color:T.ink3, marginTop:6 }}>58 seats left · 124 of your scene are going</div>
      </div>

      {/* Buy / RSVP */}
      <div style={{ marginTop:'auto', padding:'14px 22px 22px', flexShrink:0, borderTop:`1px solid ${T.line}`, background:T.bg }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:10 }}>
          <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:30, letterSpacing:'-.02em', color:T.ink, lineHeight:1 }}>$15</div>
          <div style={{ fontFamily:T.fm, fontSize:10, color:T.venue, letterSpacing:'.08em' }}>+ $0 FEES</div>
          <div style={{ flex:1 }}/>
          <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, letterSpacing:'.06em' }}>FACE VALUE · 100% TO ARTIST + VENUE</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={{ flex:1, padding:'14px', background:T.venue, color:T.bg, border:'none', borderRadius:12, fontFamily:T.fd, fontWeight:700, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            {I.qr(14, T.bg)} Get ticket
          </button>
          <button style={{ padding:'14px 16px', background:T.bg2, color:T.ink, border:`1px solid ${T.line2}`, borderRadius:12, fontFamily:T.fd, fontWeight:700, fontSize:13 }}>
            RSVP free
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScrShows, ScrShowDetail });
