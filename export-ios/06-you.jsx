// "You" tab: Hype log / fan profile · Settings (privacy) · Transparency ledger

function ScrYou() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      {/* Identity card */}
      <div style={{ padding:'2px 22px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:64, height:64, borderRadius:18, background:`linear-gradient(135deg, ${T.fan}, ${T.accent})`, color:T.bg, fontFamily:T.fd, fontWeight:800, fontSize:24, display:'flex', alignItems:'center', justifyContent:'center', letterSpacing:'-.02em' }}>J</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:22, letterSpacing:'-.02em' }}>Jordan Lee</div>
            <div style={{ fontFamily:T.fm, fontSize:11, color:T.ink3, marginTop:3, letterSpacing:'.04em' }}>iH/J4N7 · Joined Mar 2026 · Chicago</div>
            <div style={{ display:'flex', gap:5, marginTop:6 }}>
              <div style={{ fontFamily:T.fm, fontSize:9, color:T.fan, letterSpacing:'.1em', padding:'2px 7px', border:`1px solid ${T.fan}40`, borderRadius:99 }}>FAN</div>
              <div style={{ fontFamily:T.fm, fontSize:9, color:T.venue, letterSpacing:'.1em', padding:'2px 7px', border:`1px solid ${T.venue}40`, borderRadius:99 }}>● VERIFIED</div>
            </div>
          </div>
          <div style={{ color:T.ink3, fontSize:18, padding:6 }}>⋯</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding:'0 22px 14px', display:'flex', gap:8 }}>
        {[
          { n:'127', l:'HYPES',    c:T.accent },
          { n:'14',  l:'SHOWS',    c:T.venue },
          { n:'1.5×',l:'BOOST 24H',c:T.fan },
        ].map((s,i)=>(
          <div key={i} style={{ flex:1, padding:'12px 12px', background:T.bg2, border:`1px solid ${T.line}`, borderRadius:12 }}>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:24, color:s.c, letterSpacing:'-.02em', lineHeight:1 }}>{s.n}</div>
            <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, marginTop:5, letterSpacing:'.12em' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Taste map */}
      <div style={{ margin:'0 22px 14px', padding:'14px 14px', background:T.bg2, border:`1px solid ${T.line}`, borderRadius:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:14 }}>Your taste map</div>
          <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.1em' }}>3 NEW GENRES THIS MO</div>
        </div>

        {/* tag cloud */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {[
            {n:'Bedroom Pop', s:42, c:T.accent},
            {n:'Indie',       s:38, c:T.accent},
            {n:'Shoegaze',    s:18, c:T.fan},
            {n:'House',       s:14, c:T.fan},
            {n:'Folk',        s:9,  c:T.venue},
            {n:'Punk',        s:6,  c:T.warn},
            {n:'Techno',      s:5,  c:T.promoter},
            {n:'Ambient',     s:3,  c:T.ink3},
          ].map(t=>(
            <div key={t.n} style={{
              padding: t.s > 30 ? '7px 12px' : t.s > 10 ? '5px 10px' : '4px 8px',
              borderRadius:99,
              background:`${t.c}${t.s > 30 ? '25' : '12'}`,
              color: t.s > 30 ? t.c : (t.s > 10 ? T.ink2 : T.ink3),
              border:`1px solid ${t.c}${t.s > 30 ? '50' : '25'}`,
              fontFamily:T.fd, fontWeight: t.s > 30 ? 700 : 600,
              fontSize: t.s > 30 ? 14 : (t.s > 10 ? 12 : 10),
              letterSpacing:'-.005em',
            }}>{t.n} <span style={{fontFamily:T.fm, fontWeight:400, opacity:.65, fontSize:'.8em'}}>{t.s}%</span></div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ flex:1, overflow:'hidden', padding:'0 22px 4px' }}>
        <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.18em', marginBottom:8 }}>RECENT HYPES</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {[
            { t:'Sundown',       a:'Maya Reyes',   c:T.accent,   ago:'2 min', boost:true },
            { t:'Pacific Sun',   a:'Lola Bay',     c:T.venue,    ago:'1 hr' },
            { t:'Cassiopeia',    a:'Northbound',   c:T.accent,   ago:'Yesterday' },
            { t:'Slow Burn',     a:'Hex / Pearl',  c:T.promoter, ago:'Yesterday' },
          ].map((h,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0' }}>
              <AlbumArt c={h.c} size={32} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13 }}>{h.t}</div>
                <div style={{ fontFamily:T.fb, fontSize:11, color:T.ink3, marginTop:1 }}>{h.a}</div>
              </div>
              {h.boost ? (
                <div style={{ padding:'3px 8px', background:`${T.fan}20`, color:T.fan, borderRadius:99, fontFamily:T.fm, fontSize:9, letterSpacing:'.06em', fontWeight:600 }}>1.5× · LIVE BOOST</div>
              ) : (
                <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3 }}>{h.ago}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <TabBar active="you" />
    </div>
  );
}

function ScrSettings() {
  const Row = ({label, val, danger, on}) => (
    <div style={{ display:'flex', alignItems:'center', padding:'14px 16px', borderBottom:`1px solid ${T.line}` }}>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:T.fd, fontWeight:600, fontSize:14, color: danger ? '#ff5a5a' : T.ink, letterSpacing:'-.005em' }}>{label}</div>
        {val && <div style={{ fontFamily:T.fm, fontSize:10, color:T.ink3, marginTop:3, letterSpacing:'.04em' }}>{val}</div>}
      </div>
      {typeof on === 'boolean' ? (
        <div style={{
          width:42, height:25, borderRadius:99, padding:2, flexShrink:0,
          background: on ? T.venue : T.ink4,
          display:'flex', alignItems:'center', justifyContent: on ? 'flex-end' : 'flex-start',
        }}>
          <div style={{ width:21, height:21, borderRadius:99, background:'#fff' }}/>
        </div>
      ) : (
        <div style={{ color:T.ink3 }}>{I.arrow(12, T.ink3, 'right')}</div>
      )}
    </div>
  );

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      <ScreenHeader eyebrow="DATA ETHICS CHARTER · LIVE" title="Privacy" big accent={T.venue} />

      {/* Receipt card */}
      <div style={{ margin:'0 22px 16px', padding:'14px 16px', borderRadius:14, background:`${T.venue}10`, border:`1px solid ${T.venue}40`, flexShrink:0 }}>
        <div style={{ fontFamily:T.fm, fontSize:10, color:T.venue, letterSpacing:'.14em', display:'flex', alignItems:'center', gap:6 }}>
          {I.verified(12, T.venue)} YOUR DATA · THIS WEEK
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
          {[
            { l:'Times your PII was sold', n:'0', c:T.venue },
            { l:'Aggregated queries (k≥5)', n:'12', c:T.ink },
            { l:'Identity detached', n:'24h', c:T.fan },
            { l:'Industry-only ads served', n:'4', c:T.warn },
          ].map((s,i)=>(
            <div key={i}>
              <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:18, color:s.c, letterSpacing:'-.01em', lineHeight:1 }}>{s.n}</div>
              <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, marginTop:4, letterSpacing:'.06em' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflow:'hidden', padding:'0 22px 4px' }}>
        <div style={{ background:T.bg2, border:`1px solid ${T.line}`, borderRadius:14, overflow:'hidden', marginBottom:14 }}>
          <Row label="Show my Hypes publicly" val="Other fans can see what you've voted for" on={true} />
          <Row label="Share listening with the show" val="Hyped tracks become a setlist signal at venues you attend" on={true} />
          <Row label="Receive industry-only ads" val="Venues, labels, record stores only — never retargeted" on={true} />
          <Row label="Use my voice for governance" val="One member, one vote · regardless of dollars given" on={true} />
        </div>

        <div style={{ background:T.bg2, border:`1px solid ${T.line}`, borderRadius:14, overflow:'hidden' }}>
          <Row label="Download my data" val="JSON archive of Hypes, shows, taste vectors" />
          <Row label="View aggregate queries" val="12 cohort queries this week · all k≥5" />
          <Row label="Detach identity early" val="Replace your User ID with Cohort ID now" />
          <Row label="Delete account & data" danger />
        </div>
      </div>

      <TabBar active="you" />
    </div>
  );
}

function ScrTransparency() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:T.bg, color:T.ink, fontFamily:T.fb, overflow:'hidden' }}>
      <ScreenHeader eyebrow="THE LEDGER · UPDATED HOURLY" title="Transparency" big accent={T.fan} right={
        <div style={{ fontFamily:T.fm, fontSize:10, color:T.fan, letterSpacing:'.06em', padding:'5px 10px', border:`1px solid ${T.fan}40`, borderRadius:99 }}>YTD ▾</div>
      } />

      {/* The number */}
      <div style={{ padding:'0 22px 14px', flexShrink:0 }}>
        <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.18em' }}>DOLLARS COLLECTED IN FEES · ALL-TIME</div>
        <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:78, color:T.venue, letterSpacing:'-.04em', lineHeight:.9, marginTop:6 }}>$0</div>
        <div style={{ fontFamily:T.fs, fontStyle:'italic', fontSize:15, color:T.ink2, marginTop:8, lineHeight:1.4, maxWidth:300 }}>
          Not a promotional rate. Not a discount. Written into how we work.
        </div>
      </div>

      {/* Operations */}
      <div style={{ margin:'0 22px 12px', padding:'14px 14px', background:T.bg2, border:`1px solid ${T.line}`, borderRadius:14, flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13 }}>Operations · May 2026</div>
          <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.1em' }}>USD · CASH</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {[
            { l:'Patron membership ($5–$500/mo)', v:'+$3,840', c:T.venue },
            { l:'One-time gifts',                  v:'+$1,205', c:T.venue },
            { l:'Compute / object storage',        v:'−$847',   c:T.ink2 },
            { l:'Domains / email',                 v:'−$62',    c:T.ink2 },
            { l:'Contractor — payouts engineering', v:'−$2,200', c:T.ink2 },
            { l:'Net to reserve',                  v:'+$1,936', c:T.fan },
          ].map((r,i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderTop: i===0 ? 'none' : `1px solid ${T.line}` }}>
              <div style={{ fontFamily:T.fb, fontSize:12, color: i===5 ? T.ink : T.ink2 }}>{r.l}</div>
              <div style={{ fontFamily:T.fm, fontSize:12, color: r.c, letterSpacing:'.02em', fontWeight: i===5 ? 700 : 400 }}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ticket pass-through */}
      <div style={{ margin:'0 22px 12px', padding:'14px 14px', background:`${T.venue}08`, border:`1px solid ${T.venue}30`, borderRadius:14, flexShrink:0 }}>
        <div style={{ fontFamily:T.fm, fontSize:10, color:T.venue, letterSpacing:'.14em', marginBottom:8 }}>● TICKET PASS-THROUGH · YTD</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
          <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:32, color:T.ink, letterSpacing:'-.02em' }}>$184,720</div>
          <div style={{ fontFamily:T.fm, fontSize:11, color:T.ink3 }}>from 12,314 tickets</div>
        </div>
        <div style={{ fontFamily:T.fb, fontSize:12, color:T.ink2, marginTop:6, lineHeight:1.4 }}>
          Every dollar went to artists & venues. iHYPE took $0.
        </div>
      </div>

      <div style={{ marginTop:'auto', padding:'8px 22px 18px', flexShrink:0 }}>
        <button style={{ width:'100%', padding:'14px', background:T.bg2, color:T.ink, border:`1px solid ${T.line2}`, borderRadius:12, fontFamily:T.fd, fontWeight:700, fontSize:14 }}>
          Open full ledger →
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ScrYou, ScrSettings, ScrTransparency });
