// Mobile: Show check-in flow — QR + +10 point moment
// Addresses: #6 "show up" verification surface

function MobileCheckIn() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      <div style={{ padding:'14px 20px 6px' }}>
        <Eyebrow c={T.venue}>● TONIGHT · 9:00 PM · DOORS NOW OPEN</Eyebrow>
        <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:26, marginTop:8, letterSpacing:'-.02em' }}>Maya Reyes</div>
        <div style={{ fontFamily:T.fm, fontSize:11, color:T.ink3, marginTop:3, letterSpacing:'.04em' }}>EMPTY BOTTLE · 1035 N WESTERN AVE · CHICAGO</div>
      </div>

      {/* QR card — dark surface, accent dots */}
      <div style={{ margin:'18px 20px 0', padding:'20px', background:T.bg2, border:`1px solid ${T.accent}40`, borderRadius:16, position:'relative', boxShadow:`0 0 60px ${T.accent}18` }}>
        <div style={{ aspectRatio:'1', background:T.bg, borderRadius:8, position:'relative', overflow:'hidden', border:`1px solid ${T.line}` }}>
          {/* fake QR */}
          <div style={{ position:'absolute', inset:'8%', display:'grid', gridTemplateColumns:'repeat(21,1fr)', gridTemplateRows:'repeat(21,1fr)', gap:1 }}>
            {Array.from({length:441}).map((_,i)=>{
              const r=(i*7919+i*i)%5;
              const isCorner = (i<7||i>413) || (i%21<7 && i<147) || (i%21>13 && i<147);
              return <div key={i} style={{ background: (r<3||isCorner) ? T.ink : 'transparent' }}/>;
            })}
          </div>
          {/* corner squares */}
          <div style={{ position:'absolute', top:'8%', left:'8%', width:36, height:36, border:`6px solid ${T.ink}`, background:T.bg }}>
            <div style={{ position:'absolute', inset:6, background:T.ink }}/>
          </div>
          <div style={{ position:'absolute', top:'8%', right:'8%', width:36, height:36, border:`6px solid ${T.ink}`, background:T.bg }}>
            <div style={{ position:'absolute', inset:6, background:T.ink }}/>
          </div>
          <div style={{ position:'absolute', bottom:'8%', left:'8%', width:36, height:36, border:`6px solid ${T.ink}`, background:T.bg }}>
            <div style={{ position:'absolute', inset:6, background:T.ink }}/>
          </div>
          {/* iH logo center */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', width:36, height:36, borderRadius:8, background:T.accent, color:T.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:T.fd, fontWeight:800, fontSize:13 }}>iH</div>
        </div>
        <div style={{ marginTop:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.14em' }}>SCAN AT DOOR</div>
            <div style={{ fontFamily:T.fm, fontSize:11, color:T.ink, letterSpacing:'.08em', marginTop:4 }}>iH-MR-EB-7K4M-9X22</div>
          </div>
          <div style={{ padding:'5px 10px', background:T.venue, color:T.bg, borderRadius:99, fontFamily:T.fm, fontSize:10, letterSpacing:'.08em', fontWeight:600 }}>GA · ROW —</div>
        </div>
      </div>

      {/* incentive */}
      <div style={{ margin:'14px 20px 0', padding:'14px 16px', border:`1px solid ${T.fan}40`, background:`${T.fan}10`, borderRadius:12, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:99, background:T.fan, color:T.bg, fontFamily:T.fd, fontWeight:800, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+10</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13 }}>Earn 10 Hype points when scanned</div>
          <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, marginTop:3, letterSpacing:'.04em' }}>Verified by venue · GPS confirmed within 100m</div>
        </div>
      </div>

      {/* actions */}
      <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:8 }}>
        <Btn accent={T.fan}>{I.pin(12, T.bg)} Get directions · 2.4 mi</Btn>
        <Btn ghost sm>Share ticket with friend</Btn>
      </div>

      {/* show details */}
      <div style={{ marginTop:'auto', padding:'14px 20px', borderTop:`1px solid ${T.line}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <Eyebrow>YOU MIGHT ALSO LIKE</Eyebrow>
          <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3 }}>2 nearby</div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:10 }}>
          {[{n:'Cobalt Hour',d:'Sat 8PM',c:T.fan},{n:'Vela',d:'Tue 8PM',c:T.venue}].map((s,i)=>(
            <div key={i} style={{ flex:1, padding:'10px 12px', background:T.bg2, border:`1px solid ${T.line}`, borderRadius:8, display:'flex', gap:10, alignItems:'center' }}>
              <AlbumArt c={s.c} size={32} />
              <div style={{ minWidth:0 }}>
                <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:11 }}>{s.n}</div>
                <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, marginTop:2 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileCheckInSuccess() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden', position:'relative' }}>
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 30%, ${T.venue}25, transparent 60%)` }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 32px', textAlign:'center', position:'relative' }}>
        <div style={{ width:120, height:120, borderRadius:99, background:T.venue, color:T.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24, boxShadow:`0 0 60px ${T.venue}80` }}>
          {I.check(56, T.bg)}
        </div>
        <Eyebrow c={T.venue}>● CHECKED IN · VERIFIED</Eyebrow>
        <h1 style={{ fontFamily:T.fd, fontWeight:800, fontSize:36, letterSpacing:'-.02em', marginTop:14, lineHeight:1 }}>You're in.</h1>
        <p style={{ fontFamily:T.fb, fontSize:13, color:T.ink2, marginTop:14, maxWidth:280, lineHeight:1.5 }}>
          You showed up for Maya Reyes at Empty Bottle. The scene sees you.
        </p>
        <div style={{ display:'flex', gap:24, marginTop:32, alignItems:'center' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:42, color:T.fan, letterSpacing:'-.02em', lineHeight:1 }}>+10</div>
            <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.14em', marginTop:4 }}>HYPE POINTS</div>
          </div>
          <div style={{ width:1, height:42, background:T.line2 }}/>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:42, color:T.accent, letterSpacing:'-.02em', lineHeight:1 }}>1.5×</div>
            <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.14em', marginTop:4 }}>HYPE BOOST · 24H</div>
          </div>
        </div>
        <p style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, marginTop:20, letterSpacing:'.04em', maxWidth:260, lineHeight:1.5 }}>
          Your Hypes count 1.5× for the next 24 hours. Show fans believe twice as hard.
        </p>
        <div style={{ marginTop:32, display:'flex', gap:8 }}>
          <Btn accent={T.venue} sm>{I.heart(11)} Hype Maya from the show</Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MobileCheckIn, MobileCheckInSuccess });
