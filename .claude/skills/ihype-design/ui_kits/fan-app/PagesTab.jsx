// iHYPE Pages Tab — My Page (role-aware) · Browse · Create

const PAGE_ROLES = ['Fan', 'DJ', 'Artist', 'Venue'];

function TimePeriodSelect({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
      {['Week', 'Month', 'All time'].map(t => {
        const on = value === t;
        return <button key={t} onClick={() => onChange(t)} style={{ padding: '4px 11px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.1)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.68rem', fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{t}</button>;
      })}
    </div>
  );
}

const FAN_STATS_DATA = {
  Week: [
    { label: 'Hype earned', v: '$2.40', color: 'var(--accent)' }, { label: 'Hype given', v: '14', color: '#22e5d4' },
    { label: 'Events attended', v: '1', color: '#b983ff' }, { label: 'Referrals', v: '0', color: '#ffb84a' },
    { label: 'Seeds rated', v: '22', color: '#22e5d4' }, { label: 'Followers', v: '+3', color: 'var(--ink-2)' },
    { label: 'Artists followed', v: '2', color: 'var(--ink-2)' }, { label: 'DJs followed', v: '1', color: 'var(--ink-2)' },
  ],
  Month: [
    { label: 'Hype earned', v: '$16.20', color: 'var(--accent)' }, { label: 'Hype given', v: '84', color: '#22e5d4' },
    { label: 'Events attended', v: '4', color: '#b983ff' }, { label: 'Referrals', v: '1', color: '#ffb84a' },
    { label: 'Seeds rated', v: '58', color: '#22e5d4' }, { label: 'Followers', v: '+12', color: 'var(--ink-2)' },
    { label: 'Artists followed', v: '6', color: 'var(--ink-2)' }, { label: 'DJs followed', v: '4', color: 'var(--ink-2)' },
  ],
  'All time': [
    { label: 'Hype earned', v: '$82.40', color: 'var(--accent)' }, { label: 'Hype given', v: '284', color: '#22e5d4' },
    { label: 'Events attended', v: '12', color: '#b983ff' }, { label: 'Referrals', v: '3', color: '#ffb84a' },
    { label: 'Seeds rated', v: '142', color: '#22e5d4' }, { label: 'Followers', v: '48', color: 'var(--ink-2)' },
    { label: 'Artists followed', v: '22', color: 'var(--ink-2)' }, { label: 'DJs followed', v: '11', color: 'var(--ink-2)' },
  ],
};
const getFanStats = (period) => FAN_STATS_DATA[period] || FAN_STATS_DATA['All time'];

function StatGrid({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
      {stats.map(s => (
        <div key={s.label} style={{ padding: '10px 12px', borderRadius: 13, border: '1px solid var(--line)', background: 'var(--bg-2)' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.25rem', color: s.color, lineHeight: 1 }}>{s.v}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 4 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function PromoterLink({ onToast }) {
  return (
    <div style={{ padding: '1rem', borderRadius: 16, border: '1px solid rgba(185,131,255,.25)', background: 'rgba(185,131,255,.06)', marginBottom: 12 }}>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#b983ff', marginBottom: 6 }}>Your promoter link · 10% pool</div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        {[['$16.20', 'Earned', 'var(--accent)'], ['47', 'Clicks', '#22e5d4'], ['3', 'Purchases', '#b983ff']].map(([v, l, c]) => (
          <div key={l}><div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.2rem', color: c, lineHeight: 1 }}>{v}</div><div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>{l}</div></div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: '.75rem', color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>Each purchase through your link earns your proportional share of the 10% promoter pool.</div>
      <button onClick={() => onToast && onToast('Link copied!')} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(185,131,255,.3)', background: 'rgba(185,131,255,.1)', color: '#b983ff', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.85rem', cursor: 'pointer' }}>Copy my referral link</button>
    </div>
  );
}

function BarChart() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const vals = [22, 35, 28, 44, 38, 52];
  const max = Math.max(...vals);
  return (
    <div style={{ padding: '1rem', borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg-2)', marginBottom: 12 }}>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>Events attended by month</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {vals.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', background: 'var(--accent)', borderRadius: '4px 4px 0 0', height: Math.round((v / max) * 72) + 4 + 'px', opacity: .85 }} />
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.58rem', color: 'var(--ink-3)' }}>{months[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FanPage({ onToast }) {
  const [period, setPeriod] = React.useState('Month');
  return (
    <div>
      <TimePeriodSelect value={period} onChange={setPeriod} />
      <StatGrid stats={getFanStats(period)} />
      <BarChart />
      <PromoterLink onToast={onToast} />
      <button onClick={() => window.openIHYPEFriendActivity && window.openIHYPEFriendActivity()} style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid rgba(185,131,255,.3)', background: 'rgba(185,131,255,.06)', color: '#b983ff', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer', marginBottom: 8 }}>👥 Friend activity</button>
      <button style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer', marginBottom: 8 }}>Edit page</button>
      <button onClick={() => window.openIHYPESettings && window.openIHYPESettings()} style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer' }}>Settings</button>
    </div>
  );
}

function DJPage({ onToast }) {
  const [period, setPeriod] = React.useState('Month');
  const [crate, setCrate] = React.useState([{ id:'fu1', t:'Carousel', a:'Midnight Echo', len:'3:42', tint:'#ff5029' }, { id:'fu2', t:'Goldenrod', a:'Nyla', len:'3:21', tint:'#22e5d4' }, { id:'fu3', t:'Heatwave', a:'Wax Tropic', len:'4:10', tint:'#b983ff' }]);
  const moveUp = (i) => { if (i === 0) return; const c = [...crate]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; setCrate(c); };
  return (
    <div>
      <TimePeriodSelect value={period} onChange={setPeriod} />
      <StatGrid stats={[...getFanStats(period), { label: 'Radio shows', v: '14', color: '#b983ff' }, { label: 'Total listeners', v: '12.4K', color: '#22e5d4' }]} />
      <div style={{ marginBottom: 12, padding: '1rem', borderRadius: 16, border: '1px solid rgba(185,131,255,.25)', background: 'rgba(185,131,255,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#b983ff' }}>My Crate</div>
          <button style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(185,131,255,.3)', background: 'transparent', color: '#b983ff', fontFamily: 'var(--f-m)', fontSize: '.7rem', cursor: 'pointer' }}>+ Add track</button>
        </div>
        {crate.map((t, i) => (
          <div key={t.t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '.6rem 0', borderBottom: i < crate.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
              <button onClick={() => moveUp(i)} disabled={i === 0} style={{ background: 'none', border: 'none', color: i === 0 ? 'var(--bg-4)' : 'var(--ink-3)', cursor: i === 0 ? 'default' : 'pointer', padding: '0 2px', lineHeight: 1, fontSize: 12 }}>▲</button>
              <button onClick={() => moveUp(i + 1)} disabled={i === crate.length - 1} style={{ background: 'none', border: 'none', color: i === crate.length - 1 ? 'var(--bg-4)' : 'var(--ink-3)', cursor: i === crate.length - 1 ? 'default' : 'pointer', padding: '0 2px', lineHeight: 1, fontSize: 12 }}>▼</button>
            </div>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-3)', minWidth: 16, textAlign: 'center' }}>{i + 1}</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: '.85rem' }}>{t.t}</div><div style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)' }}>{t.a}</div></div>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{t.len}</span>
          </div>
        ))}
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button onClick={() => window.openIHYPERadioCreator && window.openIHYPERadioCreator(crate)} style={{ flex:1, padding:'9px', borderRadius:10, border:'1px solid rgba(185,131,255,.4)', background:'rgba(185,131,255,.1)', color:'#b983ff', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.82rem', cursor:'pointer' }}>🎙 Radio Studio →</button>
          <button onClick={() => window.openIHYPEEarnings && window.openIHYPEEarnings()} style={{ padding:'9px 12px', borderRadius:10, border:'1px solid rgba(34,229,212,.25)', background:'rgba(34,229,212,.07)', color:'#22e5d4', fontFamily:'var(--f-m)', fontSize:'.78rem', cursor:'pointer' }}>💰 Earnings</button>
        </div>
      </div>
      <BarChart />
      <PromoterLink onToast={onToast} />
      <button onClick={() => window.openIHYPESettings && window.openIHYPESettings()} style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer' }}>Settings</button>
    </div>
  );
}

function TrackUploadBlock({ onToast }) {
  const [tracks, setTracks] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('ihype_my_tracks')||'[]'); } catch { return []; }
  });
  const [dragging, setDragging] = React.useState(false);
  const save = (t) => { localStorage.setItem('ihype_my_tracks', JSON.stringify(t)); setTracks(t); };
  const addMock = () => {
    const titles = ['Neon Cascade','Glass Heart','Low Tide','Ember Drift','Static Rain'];
    const t = [...tracks, { id: 't_'+Date.now(), title: titles[tracks.length%titles.length], license: 'all_rights', duration: '3:'+Math.floor(Math.random()*59).toString().padStart(2,'0'), uploaded: Date.now() }];
    save(t); onToast && onToast('Track uploaded (simulated)');
  };
  const toggle = (id) => { save(tracks.map(t => t.id===id ? {...t, license: t.license==='free_use_limited' ? 'all_rights' : 'free_use_limited'} : t)); };
  const remove = (id) => { save(tracks.filter(t => t.id!==id)); };
  return (
    <div style={{ padding: '1rem', borderRadius: 16, border: `1px solid ${dragging ? 'var(--accent)' : 'var(--line)'}`, background: dragging ? 'rgba(255,80,41,.05)' : 'var(--bg-2)', marginBottom: 12, transition: 'border-color .15s' }}
         onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);addMock();}}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: tracks.length?10:0 }}>
        <div style={{ fontFamily:'var(--f-m)', fontSize:'.68rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--ink-3)' }}>My tracks · {tracks.length}</div>
        <button onClick={addMock} style={{ padding:'4px 12px', borderRadius:999, border:'1px solid rgba(255,80,41,.3)', background:'rgba(255,80,41,.08)', color:'var(--accent)', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.78rem', cursor:'pointer' }}>+ Upload</button>
      </div>
      {tracks.length === 0 && <div style={{ textAlign:'center', padding:'18px 0', fontFamily:'var(--f-m)', fontSize:'.8rem', color:'var(--ink-3)' }}>Drag an audio file here or tap Upload</div>}
      {tracks.map(t => (
        <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'.5rem 0', borderTop:'1px solid var(--line-2)' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:'.84rem' }}>{t.title}</div>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.68rem', color:'var(--ink-3)', marginTop:2 }}>{t.duration} · {t.license==='free_use_limited' ? '🔓 free-use' : '🔒 all rights'}</div>
          </div>
          <button onClick={()=>toggle(t.id)} style={{ padding:'3px 9px', borderRadius:999, border:'1px solid rgba(185,131,255,.3)', background:'transparent', color:'#b983ff', fontFamily:'var(--f-m)', fontSize:'.64rem', cursor:'pointer' }}>{t.license==='free_use_limited'?'Make private':'Free-use'}</button>
          <button onClick={()=>remove(t.id)} style={{ background:'none', border:'none', color:'var(--ink-3)', cursor:'pointer', fontSize:'.9rem' }}>×</button>
        </div>
      ))}
    </div>
  );
}

function ArtistPage({ onToast }) {
  const [period, setPeriod] = React.useState('Month');
  return (
    <div>
      <TimePeriodSelect value={period} onChange={setPeriod} />
      <StatGrid stats={[...getFanStats(period), { label: 'Monthly listeners', v: '12.4K', color: '#22e5d4' }, { label: 'Tickets sold', v: '218', color: '#ff5029' }, { label: 'Artist split', v: '$1,766', color: '#ff5029' }]} />
      <div style={{ marginBottom: 12, padding: '1rem', borderRadius: 16, border: '1px solid rgba(255,80,41,.2)', background: 'rgba(255,80,41,.06)' }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '3rem', letterSpacing: '-.04em', color: 'var(--accent)', lineHeight: 1 }}>45%</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 6 }}>of every ticket, automatically. iHYPE takes nothing.</div>
      </div>
      <TrackUploadBlock onToast={onToast} />
      <BarChart />
      <PromoterLink onToast={onToast} />
      <button onClick={() => window.openIHYPETourCreator && window.openIHYPETourCreator()} style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid rgba(255,80,41,.25)', background: 'rgba(255,80,41,.06)', color: '#ff5029', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer', marginBottom: 8 }}>Tour Creator →</button>
      <button onClick={() => window.openIHYPEAnalytics && window.openIHYPEAnalytics()} style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid rgba(255,80,41,.2)', background: 'rgba(255,80,41,.05)', color: 'var(--accent)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer', marginBottom: 8 }}>Analytics →</button>
      <button style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer', marginBottom: 8 }}>Edit page</button>
      <button onClick={() => window.openIHYPESettings && window.openIHYPESettings()} style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer' }}>Settings</button>
    </div>
  );
}

function VenuePage({ onToast }) {
  const [period, setPeriod] = React.useState('Month');
  return (
    <div>
      <TimePeriodSelect value={period} onChange={setPeriod} />
      <StatGrid stats={[...getFanStats(period).slice(0, 6), { label: 'Events hosted', v: '24', color: '#22e5d4' }, { label: 'Venue split', v: '$18.4K', color: '#22e5d4' }]} />
      <div style={{ marginBottom: 12, padding: '1rem', borderRadius: 16, border: '1px solid rgba(34,229,212,.2)', background: 'rgba(34,229,212,.06)' }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '3rem', letterSpacing: '-.04em', color: '#22e5d4', lineHeight: 1 }}>45%</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 6 }}>of every ticket sold at your venue. Direct. No middleman.</div>
      </div>
      <div style={{ marginBottom: 12, padding: '1rem', borderRadius: 16, border: '1px solid rgba(34,229,212,.2)', background: 'rgba(34,229,212,.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#22e5d4' }}>Upcoming events</div>
          <button style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(34,229,212,.3)', background: 'transparent', color: '#22e5d4', fontFamily: 'var(--f-m)', fontSize: '.7rem', cursor: 'pointer' }}>+ Create</button>
        </div>
        {[{ name: 'Midnight Echo', date: 'Fri Jun 20 · 9PM', sold: 218, cap: 300, tint: '#ff5029' }, { name: 'Wax Tropic', date: 'Sat Jun 21 · 8PM', sold: 142, cap: 250, tint: '#b983ff' }].map((ev, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '.6rem 0', borderBottom: i < 1 ? '1px solid rgba(34,229,212,.1)' : 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg,${ev.tint}88,${ev.tint}22)`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: '.82rem' }}>{ev.name}</div><div style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)' }}>{ev.date}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem', color: '#22e5d4' }}>{ev.sold}</div><div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', color: 'var(--ink-3)' }}>/{ev.cap} sold</div></div>
          </div>
        ))}
      </div>
      <button onClick={() => window.openIHYPESettings && window.openIHYPESettings()} style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer' }}>Settings</button>
    </div>
  );
}

function CreatePageFlow({ onToast, onDone }) {
  const ROLES = [
    { id:'Fan',    icon:'🎶', tint:'#b983ff', desc:'Stats, referral link, listening history.' },
    { id:'DJ',     icon:'📻', tint:'#ff3e9a', desc:'Crate, Radio Studio, promoter tools.' },
    { id:'Artist', icon:'🎤', tint:'#ff5029', desc:'45% of every ticket, Tour Creator, media.' },
    { id:'Venue',  icon:'🏛️', tint:'#22e5d4', desc:'Event Creator, door management, gate split.' },
  ];
  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState(null);
  const [form, setForm] = React.useState({ name:'', handle:'', bio:'', city:'', genre:'', capacity:'' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const rf = ROLES.find(r => r.id === role) || {};
  const inp = (placeholder, key, type='text') => (
    <input type={type} value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder}
      style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1px solid var(--line-2)',
               background:'var(--bg-3)', color:'var(--ink)', fontFamily:'var(--f-b)', fontSize:'.9rem',
               outline:'none', marginBottom:10, boxSizing:'border-box' }} />
  );
  const publish = () => {
    onToast && onToast(`${role} page created!`);
    window.track && window.track('page_create', { role, handle: form.handle });
    onDone && onDone(role);
  };
  return (
    <div>
      {step === 0 && (
        <div>
          <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.2rem', letterSpacing:'-.03em', marginBottom:6 }}>Create a page.</div>
          <p style={{ fontFamily:'var(--f-b)', fontSize:'.84rem', color:'var(--ink-2)', lineHeight:1.6, marginBottom:16 }}>Your public presence on iHYPE. Pick a type.</p>
          {ROLES.map(r => (
            <div key={r.id} onClick={()=>setRole(r.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14,
                           border:`1px solid ${role===r.id?r.tint+'66':'var(--line)'}`, background:role===r.id?r.tint+'12':'transparent', marginBottom:8, cursor:'pointer' }}>
              <span style={{ fontSize:22 }}>{r.icon}</span>
              <div style={{ flex:1 }}><div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.92rem', color:role===r.id?r.tint:'var(--ink)' }}>{r.id}</div><div style={{ fontFamily:'var(--f-m)', fontSize:'.7rem', color:'var(--ink-3)', marginTop:2 }}>{r.desc}</div></div>
              {role===r.id && <span style={{ color:r.tint }}>✓</span>}
            </div>
          ))}
          <button onClick={()=>role&&setStep(1)} disabled={!role} style={{ width:'100%', padding:'12px', borderRadius:999, border:'none', background:role?rf.tint:'var(--bg-3)', color:role?'#fff':'var(--ink-3)', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem', cursor:role?'pointer':'default', marginTop:6 }}>Continue →</button>
        </div>
      )}
      {step === 1 && (
        <div>
          <button onClick={()=>setStep(0)} style={{ background:'none', border:'none', color:'var(--ink-3)', fontFamily:'var(--f-m)', fontSize:'.78rem', cursor:'pointer', marginBottom:14, letterSpacing:'.04em', padding:0 }}>← Back</button>
          <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem', marginBottom:14, color:rf.tint }}>{rf.icon} {role} page</div>
          {inp('Display name', 'name')}
          {inp('@handle', 'handle')}
          {inp('Bio (one line)', 'bio')}
          {inp('City', 'city')}
          {role==='Artist' && inp('Genre / style', 'genre')}
          {role==='Venue' && inp('Capacity (e.g. 300)', 'capacity', 'number')}
          <button onClick={()=>(form.name&&form.handle)&&setStep(2)} disabled={!form.name||!form.handle}
            style={{ width:'100%', padding:'12px', borderRadius:999, border:'none', background:(form.name&&form.handle)?rf.tint:'var(--bg-3)', color:(form.name&&form.handle)?'#fff':'var(--ink-3)', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem', cursor:(form.name&&form.handle)?'pointer':'default' }}>Preview →</button>
        </div>
      )}
      {step === 2 && (
        <div>
          <button onClick={()=>setStep(1)} style={{ background:'none', border:'none', color:'var(--ink-3)', fontFamily:'var(--f-m)', fontSize:'.78rem', cursor:'pointer', marginBottom:14, letterSpacing:'.04em', padding:0 }}>← Edit</button>
          <div style={{ borderRadius:16, border:`1px solid ${rf.tint}44`, background:`${rf.tint}08`, padding:'18px', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:48, height:48, borderRadius:13, background:`linear-gradient(135deg,${rf.tint}88,${rf.tint}22)`, display:'grid', placeItems:'center', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.2rem', color:'#fff', flexShrink:0 }}>{form.name[0]||rf.icon}</div>
              <div><div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1rem' }}>{form.name}</div><div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)', marginTop:2 }}>@{form.handle} · {role}{form.city?' · '+form.city:''}</div></div>
            </div>
            {form.bio && <div style={{ fontFamily:'var(--f-b)', fontSize:'.84rem', color:'var(--ink-2)', lineHeight:1.5 }}>{form.bio}</div>}
          </div>
          {(role==='Artist'||role==='Venue') && (
            <div style={{ padding:'13px 16px', borderRadius:14, border:`1px solid ${rf.tint}33`, background:`${rf.tint}06`, marginBottom:14 }}>
              <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'2rem', color:rf.tint, lineHeight:1 }}>45%</div>
              <div style={{ fontFamily:'var(--f-m)', fontSize:'.74rem', color:'var(--ink-2)', marginTop:5, lineHeight:1.5 }}>of every ticket, locked in charter. iHYPE takes nothing from your split.</div>
            </div>
          )}
          <button onClick={publish} style={{ width:'100%', padding:'13px', borderRadius:999, border:'none', background:rf.tint, color:'#fff', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.96rem', cursor:'pointer', boxShadow:`0 6px 22px ${rf.tint}44` }}>Publish {role} page →</button>
          <div style={{ fontFamily:'var(--f-m)', fontSize:'.7rem', color:'var(--ink-3)', marginTop:10, textAlign:'center', lineHeight:1.5 }}>Beta: this is a simulated publish. Real pages go live after verification.</div>
        </div>
      )}
    </div>
  );
}

function BrowsePages() {
  const shows = [
    { id:'rs1', title:'Late Coast — Ep. 04', duration:'30:20', listeners:1240, date:'Jun 20' },
    { id:'rs2', title:'Late Coast — Ep. 03', duration:'28:14', listeners:980, date:'Jun 13' },
    { id:'rs3', title:'Late Coast — Ep. 02', duration:'31:05', listeners:740, date:'Jun 6' },
  ];
  return (
    <div>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--ink-3)', fontFamily:'var(--f-m)', fontSize:'.78rem', cursor:'pointer', padding:'0 0 14px', letterSpacing:'.04em' }}>← Browse</button>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
        <div style={{ width:56, height:56, borderRadius:16, background:`linear-gradient(135deg,${dj.tint}88,${dj.tint}22)`, display:'grid', placeItems:'center', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.4rem', color:'#fff', flexShrink:0 }}>{dj.name[0]}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem' }}>{dj.name}</div>
          <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)', marginTop:3 }}>{dj.handle} · DJ · {dj.stat}</div>
        </div>
        <button style={{ padding:'7px 16px', borderRadius:999, border:`1px solid ${dj.tint}55`, background:`${dj.tint}12`, color:dj.tint, fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.8rem', cursor:'pointer' }}>Follow</button>
      </div>
      <div style={{ fontFamily:'var(--f-m)', fontSize:'.7rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--ink-3)', marginBottom:12 }}>Radio shows</div>
      {shows.map(s => (
        <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'.8rem 0', borderBottom:'1px solid var(--line-2)' }}>
          <div style={{ width:44, height:44, borderRadius:11, background:`linear-gradient(135deg,${dj.tint}66,${dj.tint}22)`, flexShrink:0, display:'grid', placeItems:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dj.tint} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill={dj.tint} stroke="none"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:'.86rem' }}>{s.title}</div>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.7rem', color:'var(--ink-3)', marginTop:2 }}>{s.duration} · {s.listeners.toLocaleString()} plays · {s.date}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BrowsePages() {
  const pages = [
    { name: 'Midnight Echo', role: 'Artist', handle: '@midnightecho', tint: '#ff5029', stat: '4,821 hypes' },
    { name: 'DJ Caro', role: 'DJ', handle: '@djcaro', tint: '#ff3e9a', stat: '2.4K listeners' },
    { name: 'The Echo', role: 'Venue', handle: '@theecho', tint: '#22e5d4', stat: '24 events hosted' },
    { name: 'Nyla', role: 'Artist', handle: '@nyla', tint: '#22e5d4', stat: '1,320 hypes' },
    { name: 'Robin Vega', role: 'Fan', handle: '@robinv', tint: '#b983ff', stat: '$82.40 earned' },
  ];
  const [q, setQ] = React.useState('');
  const [viewing, setViewing] = React.useState(null);
  const results = q ? pages.filter(p => (p.name + p.role + p.handle).toLowerCase().includes(q.toLowerCase())) : pages;
  if (viewing) return <DJPublicProfile dj={viewing} onBack={() => setViewing(null)} />;
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search fans, DJs, artists, venues…" style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box' }} />
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
      </div>
      {results.map(p => (
        <div key={p.handle} onClick={() => p.role==='DJ' && setViewing(p)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.75rem 0', borderBottom: '1px solid var(--line-2)', cursor: p.role==='DJ' ? 'pointer' : 'default' }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: `linear-gradient(135deg,${p.tint}88,${p.tint}22)`, flexShrink: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{p.name[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem' }}>{p.name}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)' }}>{p.role} · {p.stat}{p.role==='DJ'?' · tap to view shows':''}</div>
          </div>
          <button onClick={e=>{e.stopPropagation();}} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: '.75rem', cursor: 'pointer' }}>Follow</button>
        </div>
      ))}
    </div>
  );
}

function ProfileHeader({ pageRole, onSwitchRole }) {
  const prefs = window.IHYPE_USER_PREFS || {};
  const roleColors = { Fan: '#b983ff', DJ: '#ff3e9a', Artist: '#ff5029', Venue: '#22e5d4' };
  const roleIcons = { Fan: '🎶', DJ: '📻', Artist: '🎤', Venue: '🏛️' };
  const tint = roleColors[pageRole] || '#b983ff';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 16px', marginBottom: 8, borderBottom: '1px solid var(--line)' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${tint}88,${tint}22)`, flexShrink: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.3rem', color: '#fff' }}>
        {(prefs.displayName || 'R')[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1rem', letterSpacing: '-.01em' }}>{prefs.displayName || 'Robin Vega'}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)', marginTop: 2 }}>@{prefs.handle || 'robinv'} · {prefs.city || 'Los Angeles'}</div>
      </div>
      <button onClick={onSwitchRole} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999, border: `1px solid ${tint}44`, background: `${tint}12`, color: tint, fontFamily: 'var(--f-m)', fontSize: '.72rem', cursor: 'pointer', flexShrink: 0 }}>
        <span>{roleIcons[pageRole]}</span> {pageRole} <span style={{ opacity: .6, fontSize: '.8rem' }}>⌄</span>
      </button>
    </div>
  );
}

function RoleSwitcherSheet({ open, currentRole, onClose, onSwitch }) {
  if (!open) return null;
  const roles = [
    { id: 'Fan', icon: '🎶', color: '#b983ff', desc: 'Discover, hype, earn referrals' },
    { id: 'DJ', icon: '📻', color: '#ff3e9a', desc: 'Radio studio + promoter tools' },
    { id: 'Artist', icon: '🎤', color: '#ff5029', desc: '45% split + tour creator' },
    { id: 'Venue', icon: '🏛️', color: '#22e5d4', desc: 'Event creator + door mgmt' },
  ];
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg-2)', borderRadius: '20px 20px 0 0', padding: '20px 16px 32px' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line-2)', margin: '0 auto 18px' }} />
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 14 }}>Switch role</div>
        {roles.map(r => {
          const on = r.id === currentRole;
          return (
            <div key={r.id} onClick={() => { onSwitch(r.id); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px', borderRadius: 14, border: `1px solid ${on ? r.color + '66' : 'var(--line)'}`, background: on ? r.color + '14' : 'transparent', marginBottom: 8, cursor: 'pointer' }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.92rem', color: on ? r.color : 'var(--ink)' }}>{r.id}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 2 }}>{r.desc}</div>
              </div>
              {on && <span style={{ color: r.color, fontSize: '.9rem' }}>✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PagesTab({ onToast }) {
  const [sub, setSub] = React.useState('mypage');
  const prefs = window.IHYPE_USER_PREFS || {};
  const [userPages] = React.useState(['Fan', 'Artist']);
  const [pageRole, setPageRole] = React.useState(prefs.role ? (prefs.role.charAt(0).toUpperCase() + prefs.role.slice(1)) : 'Fan');
  const [roleSwitcher, setRoleSwitcher] = React.useState(false);
  const handleSwitchRole = (newRole) => {
    setPageRole(newRole);
    const updated = { ...(window.IHYPE_USER_PREFS || {}), role: newRole.toLowerCase() };
    window.IHYPE_USER_PREFS = updated;
    try { localStorage.setItem('ihype_onboarded_v2', JSON.stringify(updated)); } catch(e) {}
    onToast && onToast(`Switched to ${newRole} view`);
  };
  const roleComponents = { Fan: FanPage, DJ: DJPage, Artist: ArtistPage, Venue: VenuePage };
  const MyPageComp = roleComponents[pageRole] || FanPage;
  const subs = [['mypage', 'My Page'], ['browse', 'Browse'], ['create', 'Create']];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
      <RoleSwitcherSheet open={roleSwitcher} currentRole={pageRole} onClose={() => setRoleSwitcher(false)} onSwitch={handleSwitchRole} />
      <div style={{ display: 'flex', gap: 0, padding: '0 1.15rem', overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--line)' }}>
        {subs.map(([id, label]) => {
          const on = sub === id;
          return <button key={id} onClick={() => setSub(id)} style={{ flexShrink: 0, padding: '10px 14px 8px', borderRadius: 0, border: 'none', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.75rem', letterSpacing: '.04em', fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{label}</button>;
        })}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.15rem 1.5rem' }}>
        {sub === 'mypage' && (
          <div>
            <ProfileHeader pageRole={pageRole} onSwitchRole={() => setRoleSwitcher(true)} />
            <MyPageComp onToast={onToast} />
          </div>
        )}
        {sub === 'browse' && <BrowsePages />}
        {sub === 'create' && <CreatePageFlow onToast={onToast} onDone={(r) => { handleSwitchRole(r); setSub('mypage'); }} />}
      </div>
    </div>
  );
}

Object.assign(window, { PagesTab });
