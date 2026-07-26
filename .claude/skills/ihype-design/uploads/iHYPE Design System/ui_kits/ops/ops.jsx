// iHYPE · iH/OPS — Operator Console
const T = {
  bg:'#0a0805', bg2:'#100d09', bg3:'#1a1612', bg4:'#221c16',
  ink:'#f0ebe5', ink2:'#9e9080', ink3:'#5a5048', ink4:'#3a342e',
  line:'rgba(255,255,255,.06)', line2:'rgba(255,255,255,.14)',
  ac:'#ff5029', fan:'#b983ff', venue:'#22e5d4', dj:'#ff3e9a',
  blue:'#7fb3ff', warn:'#ffb84a', good:'#22e5d4', bad:'#ff4545',
  fd:"'Syne',sans-serif", fb:"'DM Sans',sans-serif", fm:"'JetBrains Mono',monospace",
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const I = {
  queue:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="10" width="18" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="17" width="18" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg>,
  platform:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 17l6-6 4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  accounts:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.6"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M16 3.13a4 4 0 010 7.75M21 20c0-3.5-2.7-6-6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  log:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 12h6M9 8h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M5 20V4a1 1 0 011-1h8l5 5v12a1 1 0 01-1 1H6a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.6"/></svg>,
  check:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  warn:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.3 3.6L2.6 18a1 1 0 00.87 1.5h17.1a1 1 0 00.87-1.5L13.7 3.6a1 1 0 00-1.74 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  clock:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
};

const NAV = [
  { k:'queue',    label:'Queue',    icon:I.queue },
  { k:'platform', label:'Platform', icon:I.platform },
  { k:'accounts', label:'Accounts', icon:I.accounts },
  { k:'log',      label:'Log',      icon:I.log },
];

const TYPE_C = { Artist:T.ac, Venue:T.venue, DJ:T.dj, 'Music Store':T.warn, 'Merch':T.fan, '3rd-Party':T.blue };

// ── Data ──────────────────────────────────────────────────────────────────────
const QUEUE_DATA = [
  { id:'ADV-2847', type:'Artist',      name:'The Midnight',    copy:'"Nocturnal" — North American tour 2026',  body:'24 dates across US + Canada. Tickets on sale June 24.',     buyer:'pass', music:'pass', copy2:'pass', submitted:'2m ago'  },
  { id:'ADV-2848', type:'Venue',       name:'Empty Bottle',    copy:'New show announced · July 12',            body:'Doors open 8pm · $15 advance / $18 door · 21+',            buyer:'pass', music:'pass', copy2:'pass', submitted:'5m ago'  },
  { id:'ADV-2849', type:'3rd-Party',   name:'MusicGear.co',    copy:'Flash sale — 40% off effects pedals',     body:'Fender, Boss, TC Electronic. Free shipping orders $50+.',  buyer:'warn', music:'pass', copy2:'pass', submitted:'9m ago'  },
  { id:'ADV-2850', type:'3rd-Party',   name:'CryptoTune',      copy:'Earn crypto while listening to music',    body:'Join 50k+ listeners earning $TUNE tokens daily.',          buyer:'fail', music:'fail', copy2:'pass', submitted:'12m ago' },
  { id:'ADV-2851', type:'DJ',           name:'Jam Productions', copy:'Summer Fest — 3 days, 4 stages',          body:'Aug 14–16 · Millennium Park · Chicago · Free day-passes.', buyer:'pass', music:'pass', copy2:'pass', submitted:'18m ago' },
  { id:'ADV-2852', type:'Artist',      name:'Soccer Mommy',    copy:'"Sometimes, Forever" vinyl reissue',      body:'Limited edition pressing with 3 bonus tracks. Out July 5.', buyer:'pass', music:'pass', copy2:'warn', submitted:'24m ago' },
];

const LOG_DATA = [
  { id:'ADV-2843', action:'APPROVED', by:'System', time:'08:42', type:'Artist',    name:'Hovvdy' },
  { id:'ADV-2844', action:'REJECTED', by:'System', time:'08:39', type:'3rd-Party', name:'CryptoWave', reason:'Non-musical product category' },
  { id:'ADV-2845', action:'APPROVED', by:'System', time:'08:36', type:'Venue',     name:'Sleeping Village' },
  { id:'ADV-2846', action:'FLAGGED',  by:'Manual', time:'08:31', type:'3rd-Party', name:'EnergyMix Pro', reason:'Buyer verification incomplete' },
  { id:'ADV-2841', action:'APPROVED', by:'System', time:'08:24', type:'Artist',    name:'Lush (UK)' },
  { id:'ADV-2840', action:'REJECTED', by:'System', time:'08:19', type:'3rd-Party', name:'SportsBet.io', reason:'Non-music industry: gambling' },
];

const ACCOUNTS_DATA = [
  { name:'The Midnight',     type:'Artist',     status:'Active',   campaigns:3, spend:'$1,240', joined:'Jan 2026' },
  { name:'Empty Bottle',     type:'Venue',      status:'Active',   campaigns:5, spend:'$3,820', joined:'Mar 2025' },
  { name:'Jam Productions',  type:'DJ',         status:'Active',   campaigns:2, spend:'$890',   joined:'Nov 2025' },
  { name:'MusicGear.co',     type:'3rd-Party',  status:'Pending',  campaigns:1, spend:'$0',     joined:'Jun 2026' },
  { name:'Reverb.com',       type:'3rd-Party',  status:'Active',   campaigns:4, spend:'$5,610', joined:'Aug 2025' },
  { name:'Sleeping Village', type:'Venue',      status:'Active',   campaigns:2, spend:'$640',   joined:'Feb 2026' },
  { name:'CryptoTune',       type:'3rd-Party',  status:'Banned',   campaigns:0, spend:'$0',     joined:'Jun 2026' },
];

// ── Primitives ────────────────────────────────────────────────────────────────
function Eyebrow({ children, c = T.ink3, style: s }) {
  return <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.18em', textTransform:'uppercase', color:c, ...s }}>{children}</div>;
}
function GateDot({ r }) {
  const c = r==='pass'?T.good : r==='warn'?T.warn : T.bad;
  const ic = r==='pass'?I.check : r==='warn'?I.warn : I.x;
  return <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, borderRadius:4, background:`${c}18`, border:`1px solid ${c}40`, color:c }}>{ic}</span>;
}
function TypeBadge({ type }) {
  const c = TYPE_C[type] || T.ink3;
  return <span style={{ fontFamily:T.fm, fontSize:8, letterSpacing:'.12em', textTransform:'uppercase', color:c, background:`${c}15`, padding:'2px 7px', borderRadius:4 }}>{type}</span>;
}
function ActionBtn({ children, accent = T.ac, ghost, onClick }) {
  return <button onClick={onClick} style={{ padding:'6px 14px', background:ghost?'transparent':accent, color:ghost?T.ink:T.bg, border:ghost?`1px solid ${T.line2}`:'none', borderRadius:6, fontFamily:T.fm, fontSize:10, fontWeight:600, letterSpacing:'.08em', display:'inline-flex', alignItems:'center', gap:6 }}>{children}</button>;
}

// ── Queue Screen ──────────────────────────────────────────────────────────────
function QueueScreen() {
  const [sel, setSel] = React.useState(0);
  const [items, setItems] = React.useState(QUEUE_DATA);
  const item = items[sel];

  const decide = (id, action) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setSel(s => Math.max(0, s - (s >= items.length - 1 ? 1 : 0)));
  };

  return (
    <div style={{ flex:1, display:'flex', minHeight:0, overflow:'hidden' }}>
      {/* Queue list */}
      <div style={{ width:300, borderRight:`1px solid ${T.line}`, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.line}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <Eyebrow c={T.ac}>PENDING</Eyebrow>
          <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:18, color:T.ink }}>{items.length}</div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {items.length === 0 && (
            <div style={{ padding:32, textAlign:'center' }}>
              <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.14em', color:T.ink3 }}>QUEUE CLEAR</div>
              <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:22, color:T.good, marginTop:10 }}>✓</div>
            </div>
          )}
          {items.map((it, i) => {
            const allPass = it.buyer==='pass' && it.music==='pass' && it.copy2==='pass';
            const hasFail = it.buyer==='fail' || it.music==='fail' || it.copy2==='fail';
            const flagC = hasFail ? T.bad : it.buyer==='warn'||it.copy2==='warn' ? T.warn : T.ink3;
            return (
              <div key={it.id} onClick={() => setSel(i)} style={{ padding:'12px 16px', borderBottom:`1px solid ${T.line}`, cursor:'pointer', background:i===sel?T.bg3:'transparent', borderLeft:`2px solid ${i===sel?T.ac:'transparent'}`, transition:'background 100ms' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <TypeBadge type={it.type} />
                  <div style={{ fontFamily:T.fm, fontSize:8, color:T.ink3, display:'flex', alignItems:'center', gap:3 }}>{I.clock}{it.submitted}</div>
                </div>
                <div style={{ fontFamily:T.fb, fontSize:12, fontWeight:500, color:T.ink, marginTop:6, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{it.copy}</div>
                <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, marginTop:4 }}>{it.name}</div>
                <div style={{ display:'flex', gap:5, marginTop:7, alignItems:'center' }}>
                  <GateDot r={it.buyer} />
                  <GateDot r={it.music} />
                  <GateDot r={it.copy2} />
                  <span style={{ fontFamily:T.fm, fontSize:8, color:flagC, letterSpacing:'.1em', textTransform:'uppercase', marginLeft:4 }}>
                    {hasFail?'AUTO-REJECT':it.buyer==='warn'||it.copy2==='warn'?'REVIEW':'CLEAR'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:16 }}>
        {!item ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Eyebrow>Select a submission</Eyebrow>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <TypeBadge type={item.type} />
                  <Eyebrow c={T.ink3}>{item.id} · {item.submitted}</Eyebrow>
                </div>
                <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:20, color:T.ink, marginTop:8, letterSpacing:'-.015em' }}>{item.copy}</div>
                <div style={{ fontFamily:T.fb, fontSize:13, color:T.ink2, marginTop:4 }}>{item.name} · {item.body}</div>
              </div>
            </div>

            {/* Gate results */}
            <div style={{ background:T.bg2, border:`1px solid ${T.line}`, borderRadius:10 }}>
              {[['Buyer vetting', item.buyer], ['Music-only relevance', item.music], ['Copyright firewall', item.copy2]].map(([label, r], i) => {
                const c = r==='pass'?T.good : r==='warn'?T.warn : T.bad;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:i<2?`1px solid ${T.line}`:'none' }}>
                    <GateDot r={r} />
                    <div style={{ flex:1, fontFamily:T.fb, fontSize:13, color:T.ink }}>{label}</div>
                    <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.12em', textTransform:'uppercase', color:c }}>{r.toUpperCase()}</div>
                  </div>
                );
              })}
            </div>

            {/* Ad preview */}
            <div style={{ background:T.bg2, border:`1px solid ${T.line2}`, borderRadius:10, padding:16, position:'relative', overflow:'hidden' }}>
              <Eyebrow>Creative preview</Eyebrow>
              <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:16, color:T.ink, marginTop:8, letterSpacing:'-.01em' }}>{item.copy}</div>
              <div style={{ fontFamily:T.fb, fontSize:12, color:T.ink2, marginTop:4, lineHeight:1.5 }}>{item.body}</div>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${T.ac},transparent)`, animation:'opsPulse 2s ease-in-out infinite', animationIterationCount:'infinite' }} />
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:10, paddingTop:4 }}>
              <ActionBtn accent={T.good} onClick={() => decide(item.id, 'approve')}>
                <span style={{ color:'inherit', display:'flex', alignItems:'center', gap:5 }}>{React.cloneElement(I.check, {})}&nbsp;Approve</span>
              </ActionBtn>
              <ActionBtn accent={T.bad} onClick={() => decide(item.id, 'reject')}>
                <span style={{ color:'inherit', display:'flex', alignItems:'center', gap:5 }}>{React.cloneElement(I.x, {})}&nbsp;Reject</span>
              </ActionBtn>
              <ActionBtn ghost onClick={() => decide(item.id, 'flag')}>
                <span style={{ color:'inherit', display:'flex', alignItems:'center', gap:5 }}>{React.cloneElement(I.warn, {})}&nbsp;Flag for review</span>
              </ActionBtn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Platform Screen ───────────────────────────────────────────────────────────
const SPARK = [40,52,61,48,72,80,68,91,85,104,96,112,88,130,122,108,140,128,152,138,168,155,172,160,180,165,190,178,200,188];

function PlatformScreen() {
  const stats = [
    { label:'Submissions today',  value:'1,247', detail:'↑ 12% vs yesterday',   c:T.ac },
    { label:'Clearance rate',     value:'94%',   detail:'Auto-cleared in <60s',  c:T.good },
    { label:'Active campaigns',   value:'38',    detail:'Across all tiers',      c:T.fan },
    { label:'Avg review time',    value:'42ms',  detail:'HYPE Screen latency',   c:T.blue },
    { label:'Rejected today',     value:'74',    detail:'6% rejection rate',     c:T.bad },
    { label:'Queue depth',        value:'6',     detail:'Awaiting manual review', c:T.warn },
  ];
  return (
    <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:16 }}>
      <div>
        <Eyebrow c={T.ac}>PLATFORM HEALTH</Eyebrow>
        <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:20, letterSpacing:'-.02em', color:T.ink, marginTop:5 }}>Operator dashboard</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {stats.map((s,i) => (
          <div key={i} style={{ padding:'14px 16px', border:`1px solid ${T.line}`, borderRadius:10, background:T.bg2 }}>
            <Eyebrow c={T.ink3}>{s.label}</Eyebrow>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:26, letterSpacing:'-.015em', marginTop:8, color:T.ink }}>{s.value}</div>
            <div style={{ fontFamily:T.fm, fontSize:9, color:s.c, marginTop:5, letterSpacing:'.06em' }}>{s.detail}</div>
          </div>
        ))}
      </div>
      <div style={{ border:`1px solid ${T.line}`, borderRadius:10, background:T.bg2, overflow:'hidden' }}>
        <div style={{ padding:'11px 16px', borderBottom:`1px solid ${T.line}`, display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:13, color:T.ink }}>Submission volume · 30 days</div>
          <Eyebrow c={T.ink3}>HYPE SCREEN ACTIVITY</Eyebrow>
        </div>
        <div style={{ padding:'14px 16px 10px' }}>
          <svg width="100%" height={64} viewBox={`0 0 ${SPARK.length * 4} 64`} preserveAspectRatio="none" style={{ display:'block' }}>
            {SPARK.map((v,i) => { const max=200, bh=v/max*60; return <rect key={i} x={i*4} y={64-bh} width={3} height={bh} fill={T.ac} opacity={0.3 + v/max*0.7} />; })}
          </svg>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
            <Eyebrow c={T.ink4}>MAY 21</Eyebrow>
            <Eyebrow c={T.ink4}>JUN 20</Eyebrow>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Accounts Screen ───────────────────────────────────────────────────────────
function AccountsScreen() {
  const statusC = { Active:T.good, Pending:T.warn, Banned:T.bad };
  const [q, setQ] = React.useState('');
  const filtered = ACCOUNTS_DATA.filter(a =>
    a.name.toLowerCase().includes(q.toLowerCase()) ||
    a.type.toLowerCase().includes(q.toLowerCase()) ||
    a.status.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16 }}>
        <div>
          <Eyebrow c={T.blue}>ADVERTISER ACCOUNTS</Eyebrow>
          <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:20, letterSpacing:'-.02em', color:T.ink, marginTop:5 }}>Accounts</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, height:30, padding:'0 12px', background:T.bg3, border:`1px solid ${T.line}`, borderRadius:6, minWidth:220 }}>
          {I.search(11, T.ink3)}
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search accounts…" style={{ background:'transparent', border:'none', outline:'none', fontFamily:T.fm, fontSize:11, color:T.ink, width:'100%' }} />
        </div>
      </div>
      <div style={{ border:`1px solid ${T.line}`, borderRadius:10, background:T.bg2, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', padding:'8px 16px', borderBottom:`1px solid ${T.line}` }}>
          {['Account','Type','Status','Campaigns','Total spend','Joined'].map(h => (
            <Eyebrow key={h} c={T.ink3}>{h}</Eyebrow>
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ padding:'40px 24px', textAlign:'center' }}>
            <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:18, color:T.ink3, marginBottom:6 }}>No accounts found</div>
            <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink4, letterSpacing:'.1em' }}>Try a different search term</div>
          </div>
        )}
        {filtered.map((a,i) => {
          const sc = statusC[a.status] || T.ink3;
          return (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr', padding:'11px 16px', borderBottom:i<filtered.length-1?`1px solid ${T.line}`:'none', alignItems:'center' }}>
              <div style={{ fontFamily:T.fb, fontSize:13, fontWeight:500, color:T.ink }}>{a.name}</div>
              <TypeBadge type={a.type} />
              <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:sc }}>{a.status}</div>
              <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:14, color:T.ink }}>{a.campaigns}</div>
              <div style={{ fontFamily:T.fd, fontWeight:700, fontSize:14, color:T.ink }}>{a.spend}</div>
              <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3 }}>{a.joined}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Log Screen ────────────────────────────────────────────────────────────────
function LogScreen() {
  const ac = { APPROVED:T.good, REJECTED:T.bad, FLAGGED:T.warn };
  return (
    <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:16 }}>
      <div>
        <Eyebrow c={T.ink3}>AUDIT TRAIL</Eyebrow>
        <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:20, letterSpacing:'-.02em', color:T.ink, marginTop:5 }}>Decision log</div>
      </div>
      <div style={{ border:`1px solid ${T.line}`, borderRadius:10, background:T.bg2, overflow:'hidden' }}>
        {LOG_DATA.map((l,i) => {
          const c = ac[l.action] || T.ink3;
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 16px', borderBottom:i<LOG_DATA.length-1?`1px solid ${T.line}`:'none' }}>
              <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, flexShrink:0, width:44 }}>{l.time}</div>
              <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:c, background:`${c}15`, padding:'3px 8px', borderRadius:4, flexShrink:0 }}>{l.action}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:T.fb, fontSize:12, fontWeight:500, color:T.ink }}>{l.name}</div>
                {l.reason && <div style={{ fontFamily:T.fm, fontSize:9, color:T.bad, marginTop:2, letterSpacing:'.04em' }}>Reason: {l.reason}</div>}
              </div>
              <TypeBadge type={l.type} />
              <div style={{ fontFamily:T.fm, fontSize:8, color:T.ink3 }}>{l.id}</div>
              <div style={{ fontFamily:T.fm, fontSize:8, color:T.ink3 }}>by {l.by}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function App() {
  const [scr, setScr] = React.useState(() => {
    try { return localStorage.getItem('ihype-ops-scr') || 'queue'; } catch { return 'queue'; }
  });
  const [clock, setClock] = React.useState(new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));

  React.useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' })), 1000);
    return () => clearInterval(t);
  }, []);

  const go = k => { setScr(k); try { localStorage.setItem('ihype-ops-scr', k); } catch {} };

  const SCREENS = { queue:<QueueScreen/>, platform:<PlatformScreen/>, accounts:<AccountsScreen/>, log:<LogScreen/> };

  return (
    <div style={{ width:'100vw', height:'100vh', display:'flex', flexDirection:'column', background:T.bg, color:T.ink, overflow:'hidden' }}>
      {/* Top bar */}
      <div style={{ height:42, borderBottom:`1px solid ${T.line}`, background:T.bg2, display:'flex', alignItems:'center', padding:'0 16px', gap:14, flexShrink:0 }}>
        <div style={{ fontFamily:T.fd, fontWeight:800, fontSize:16, letterSpacing:'-.02em' }}>
          i<span style={{ color:T.ac }}>H</span><span style={{ color:T.ink3 }}>/</span><span style={{ color:T.ac }}>OPS</span>
        </div>
        <div style={{ fontFamily:T.fm, fontSize:9, letterSpacing:'.12em', padding:'3px 8px', border:`1px solid ${T.good}40`, borderRadius:4, color:T.good, display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:T.good, display:'inline-block', animation:'opsPulse 2s ease-in-out infinite' }}></span>
          LIVE
        </div>
        <div style={{ flex:1 }} />
        <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, letterSpacing:'.1em', display:'flex', alignItems:'center', gap:6 }}>
          {I.clock}&nbsp;{clock}
        </div>
        <div style={{ fontFamily:T.fm, fontSize:9, color:T.ink3, padding:'3px 10px', borderRadius:4, background:T.bg3, border:`1px solid ${T.line}` }}>Single operator · Automated admin</div>
      </div>

      {/* Body */}
      <div style={{ flex:1, display:'flex', minHeight:0, overflow:'hidden' }}>
        {/* Rail */}
        <div style={{ width:88, borderRight:`1px solid ${T.line}`, background:T.bg2, padding:'12px 0', display:'flex', flexDirection:'column', gap:1, flexShrink:0 }}>
          {NAV.map(it => (
            <div key={it.k} onClick={() => go(it.k)} style={{ padding:'10px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:5, cursor:'pointer', color:it.k===scr?T.ink:T.ink3, background:it.k===scr?T.bg3:'transparent', borderLeft:it.k===scr?`2px solid ${T.ac}`:'2px solid transparent', transition:'all 100ms' }}>
              <div style={{ width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center' }}>{it.icon}</div>
              <div style={{ fontFamily:T.fm, fontSize:8, letterSpacing:'.12em', textTransform:'uppercase' }}>{it.label}</div>
              {it.k==='queue' && QUEUE_DATA.length > 0 && (
                <div style={{ width:16, height:16, borderRadius:'50%', background:T.ac, color:T.bg, fontFamily:T.fd, fontWeight:800, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', position:'absolute', marginTop:-22, marginLeft:28 }}>{QUEUE_DATA.length}</div>
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {SCREENS[scr] || <QueueScreen />}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
