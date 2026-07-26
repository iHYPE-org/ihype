// iHYPE Listen Tab — Search · Seeds · Radio · Charts · Playlists · Following

function ListenTab({ onToast }) {
  const [sub, setSub] = React.useState('seeds');
  const subs = ['Search', 'Seeds', 'Radio', 'Charts', 'Top', 'Playlists', 'Following'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 0, padding: '0', flexShrink: 0, borderBottom: '1px solid var(--line)' }}>
        {subs.map(s => {
          const on = sub === s.toLowerCase();
          return (
            <button key={s} onClick={() => setSub(s.toLowerCase())} style={{ flex: 1, minWidth: 0, padding: '10px 2px 8px', borderRadius: 0, border: 'none', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.02em', fontWeight: on ? 700 : 500, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.15rem 1.5rem' }}>
        {sub === 'search' && <ListenSearch onToast={onToast} />}
        {sub === 'seeds' && <SeedsWithPersist />}
        {sub === 'radio' && <ListenRadio />}
        {sub === 'charts' && <ListenCharts />}
        {sub === 'top' && <ListenLeaderboard />}
        {sub === 'playlists' && <ListenPlaylists />}
        {sub === 'following' && <ListenFollowing />}
      </div>
    </div>
  );
}

function SeedsWithPersist() {
  React.useEffect(() => {
    const saved = parseInt(localStorage.getItem('ihype_seeds_idx') || '0', 10);
    if (window._seedsSetIdx) window._seedsSetIdx(saved);
  }, []);
  const SC = window.SeedsScreen;
  if (!SC) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-3)' }}>Loading Seeds…</div>;
  return <SC onIdxChange={i => localStorage.setItem('ihype_seeds_idx', i)} />;
}

const LS_HISTORY_KEY = 'ihype_search_history';
function getHistory() { try { return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]'); } catch (e) { return []; } }

function ListenSearch({ onToast }) {
  const [q, setQ] = React.useState('');
  const [history, setHistory] = React.useState(getHistory);
  const D = window.IHYPE_DATA;
  const pool = [
    ...D.seeds.map(s => ({ type: 'Artist', name: s.artist, sub: s.track, tint: s.tint })),
    ...D.shows.map(s => ({ type: 'Artist', name: s.artist, sub: s.venue, tint: s.tint })),
  ];
  const results = q ? pool.filter(r => (r.name + r.sub).toLowerCase().includes(q.toLowerCase())) : [];
  const commit = (term) => {
    const next = [term, ...history.filter(x => x !== term)].slice(0, 5);
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(next));
    setHistory(next); setQ(term);
  };
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && q.trim()) commit(q.trim()); }} placeholder="Search artists, DJs, playlists…" style={{ width: '100%', padding: '10px 36px 10px 38px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box' }} />
        {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>}
      </div>
      {!q && history.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Recent</div>
            <button onClick={() => { localStorage.removeItem(LS_HISTORY_KEY); setHistory([]); }} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.7rem', cursor: 'pointer' }}>Clear</button>
          </div>
          {history.map(h => (
            <div key={h} onClick={() => setQ(h)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '.55rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.5" /></svg>
              <span style={{ fontFamily: 'var(--f-b)', fontSize: '.85rem', color: 'var(--ink-2)' }}>{h}</span>
            </div>
          ))}
        </div>
      )}
      {!q && (
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Trending now</div>
          {D.seeds.map(s => (
            <div key={s.artist} onClick={() => commit(s.artist)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.65rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: `linear-gradient(135deg,${s.tint}88,${s.tint}22)`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--f-b)', fontWeight: 700, fontSize: '.88rem' }}>{s.artist}</div><div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{s.tag}</div></div>
            </div>
          ))}
        </div>
      )}
      {q && results.length === 0 && <div style={{ textAlign: 'center', padding: '2rem 1rem', fontFamily: 'var(--f-m)', fontSize: '.85rem', color: 'var(--ink-3)' }}>No results for "{q}"</div>}
      {q && results.map((r, i) => (
        <div key={i} onClick={() => commit(r.name)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.65rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: `linear-gradient(135deg,${r.tint}88,${r.tint}22)`, flexShrink: 0 }} />
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: '.88rem' }}>{r.name}</div><div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{r.type} · {r.sub}</div></div>
        </div>
      ))}
    </div>
  );
}

const VERIFIED = new Set(['Midnight Echo','Nyla','DJ Caro','Wax Tropic']);
function Verified() { return <span title="Verified artist" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:14, height:14, borderRadius:'50%', background:'#5b8cff', marginLeft:4, flexShrink:0, verticalAlign:'middle' }}><svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7 8,3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>; }

function ListenRadio() {
  const D = window.IHYPE_DATA;
  const prefs = (window.IHYPE_USER_PREFS || {}).genres || [];
  const [active, setActive] = React.useState(null);
  const sorted = prefs.length > 0
    ? [...D.radioShows].sort((a,b) => { const am = prefs.some(g => (a.genre||'').toLowerCase().includes(g)); const bm = prefs.some(g => (b.genre||'').toLowerCase().includes(g)); return bm - am; })
    : D.radioShows;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map(s => {
        const on = active === s.id;
        return (
          <div key={s.id} onClick={() => { setActive(on ? null : s.id); if (!on && window.setIHYPENowPlaying) window.setIHYPENowPlaying({ t: s.name, a: 'by ' + s.host, tint: s.tint }); }} style={{ padding: 14, borderRadius: 16, border: `1px solid ${on ? s.tint + '55' : 'var(--line)'}`, background: on ? `${s.tint}0d` : 'var(--bg-2)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${s.tint}cc,${s.tint}33)`, display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0, fontSize: 18 }}>{on ? '⏸' : '▶'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem' }}>{s.name}{VERIFIED.has(s.host) && <Verified />}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 2 }}>by {s.host} · {s.genre}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)', marginTop: 2 }}>{s.listeners} listening · {s.day}</div>
              </div>
              {s.status === 'LIVE' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3c3c', flexShrink: 0 }} />}
            </div>
            {on && <div style={{ marginTop: 12, height: 3, borderRadius: 999, background: 'var(--bg-4)', overflow: 'hidden' }}><div style={{ height: '100%', width: '38%', background: `linear-gradient(90deg,${s.tint},var(--accent))`, borderRadius: 999 }} /></div>}
          </div>
        );
      })}
    </div>
  );
}

function ListenCharts() {
  const [period, setPeriod] = React.useState('week');
  const allTracks = {
    week: [
      { rank: 1, t: 'Carousel', a: 'Midnight Echo', plays: '48.1K', tint: '#ff5029' },
      { rank: 2, t: 'Goldenrod', a: 'Nyla', plays: '38.4K', tint: '#22e5d4' },
      { rank: 3, t: 'Heatwave', a: 'Wax Tropic', plays: '31.2K', tint: '#b983ff' },
      { rank: 4, t: 'Paper Cup', a: 'Sunroom', plays: '28.7K', tint: '#ffb84a' },
      { rank: 5, t: 'Halogen', a: 'Midnight Echo', plays: '18.9K', tint: '#ff5029' },
    ],
    month: [
      { rank: 1, t: 'Goldenrod', a: 'Nyla', plays: '142K', tint: '#22e5d4' },
      { rank: 2, t: 'Carousel', a: 'Midnight Echo', plays: '138K', tint: '#ff5029' },
      { rank: 3, t: 'Paper Cup', a: 'Sunroom', plays: '91K', tint: '#ffb84a' },
      { rank: 4, t: 'Slow Static', a: 'Midnight Echo', plays: '88K', tint: '#ff5029' },
      { rank: 5, t: 'Heatwave', a: 'Wax Tropic', plays: '72K', tint: '#b983ff' },
    ],
    alltime: [
      { rank: 1, t: 'Carousel', a: 'Midnight Echo', plays: '1.2M', tint: '#ff5029' },
      { rank: 2, t: 'Goldenrod', a: 'Nyla', plays: '984K', tint: '#22e5d4' },
      { rank: 3, t: 'Slow Static', a: 'Midnight Echo', plays: '812K', tint: '#ff5029' },
      { rank: 4, t: 'Paper Cup', a: 'Sunroom', plays: '748K', tint: '#ffb84a' },
      { rank: 5, t: 'Heatwave', a: 'Wax Tropic', plays: '621K', tint: '#b983ff' },
    ],
  };
  const tracks = allTracks[period];
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['week', 'This week'], ['month', 'This month'], ['alltime', 'All time']].map(([id, label]) => {
          const on = period === id;
          return <button key={id} onClick={() => setPeriod(id)} style={{ padding: '5px 12px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.12)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.7rem', cursor: 'pointer', fontWeight: on ? 700 : 500 }}>{label}</button>;
        })}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Top hypes · LA</div>
        <button onClick={() => window.openIHYPEFriendActivity && window.openIHYPEFriendActivity()} style={{ fontFamily:'var(--f-m)', fontSize:'.68rem', color:'var(--accent)', background:'none', border:'none', cursor:'pointer', letterSpacing:'.06em' }}>Friends →</button>
      </div>
      <style>{'@keyframes growUp{from{transform:scaleY(0)}to{transform:scaleY(1)}}'}</style>
      {tracks.map((t,ri) => (
        <div key={t.rank} onClick={() => { const a = window.lookupArtist && window.lookupArtist(t.a, t.tint); if (a) window.openIHYPEArtistProfile && window.openIHYPEArtistProfile(a); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.7rem 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', animation:`fadeSlide .3s ${ri*.06}s both` }}>
          <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--ink-3)', minWidth: 24, textAlign: 'center' }}>{t.rank}</span>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg,${t.tint}88,${t.tint}22)`, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '.88rem' }}>{t.t}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{t.a}</div>
          </div>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{t.plays}</span>
        </div>
      ))}
    </div>
  );
}

function ListenPlaylists() {
  const D = window.IHYPE_DATA;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontFamily:'var(--f-m)', fontSize:'.68rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--ink-3)' }}>Your playlists</div>
        <button onClick={() => window.openIHYPEPlaylistCreate && window.openIHYPEPlaylistCreate()} style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,80,41,.12)', border:'1px solid rgba(255,80,41,.25)', color:'var(--accent)', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem', cursor:'pointer', display:'grid', placeItems:'center', lineHeight:1 }}>+</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {D.playlists.map(p => (
        <div key={p.id} onClick={() => { if (window.setIHYPENowPlaying) window.setIHYPENowPlaying({ t: p.name, a: 'Playlist · ' + p.count + ' tracks', tint: p.tint }); }} style={{ padding: '1rem', borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg-2)', cursor: 'pointer', position: 'relative' }}>
          <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, background: `linear-gradient(135deg,${p.tint}cc,${p.tint}22)`, marginBottom: 10, position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-.04em', color: 'rgba(255,255,255,.85)' }}>{p.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
          </div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', lineHeight: 1.2, marginBottom: 4 }}>{p.name}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)' }}>{p.count} tracks · {p.by}{p.auto ? ' · auto' : ''}</div>
        </div>
      ))}
    </div>
    </div>
  );
}

function ListenFollowing() {
  const followed = [
    { name: 'Midnight Echo', role: 'Artist', action: 'Dropped tickets', detail: 'Live at The Echo · Fri Jun 20 · $18', time: '2m', tint: '#ff5029' },
    { name: 'DJ Caro', role: 'DJ', action: 'Starting a live show', detail: 'Late Night Frequencies · 2.4K listening', time: '1h', tint: '#b983ff' },
    { name: 'Nyla', role: 'Artist', action: 'Added track to Seeds', detail: 'Goldenrod · new preview available', time: '3h', tint: '#22e5d4' },
    { name: 'Sunroom', role: 'Artist', action: 'Announced new event', detail: 'Album Release · Gold-Diggers · Sun Jun 22', time: '1d', tint: '#ffb84a' },
  ];
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontFamily:'var(--f-m)', fontSize:'.68rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--ink-3)' }}>Activity from people you follow</div>
        <button onClick={() => window.openIHYPEFriendActivity && window.openIHYPEFriendActivity()} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:999, border:'1px solid rgba(185,131,255,.3)', background:'rgba(185,131,255,.06)', color:'#b983ff', fontFamily:'var(--f-m)', fontSize:'.7rem', cursor:'pointer', fontWeight:700 }}>👥 Friends</button>
      </div>
      {followed.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '.85rem 0', borderBottom: '1px solid var(--line-2)' }}>
          <div onClick={() => { const a = window.lookupArtist && window.lookupArtist(f.name, f.tint); if (a) window.openIHYPEArtistProfile && window.openIHYPEArtistProfile(a); }} style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${f.tint}88,${f.tint}22)`, flexShrink: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1rem', color: '#fff', cursor: 'pointer' }}>{f.name[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: 'var(--f-b)', fontWeight: 700, fontSize: '.85rem' }}>{f.name}</span>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', color: 'var(--ink-3)', padding: '1px 6px', borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--bg-3)' }}>{f.role}</span>
            </div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-2)', marginBottom: 2 }}>{f.action}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{f.detail}</div>
          </div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', color: 'var(--ink-3)', flexShrink: 0, marginTop: 2 }}>{f.time}</div>
        </div>
      ))}
    </div>
  );
}

function ListenLeaderboard() {
  const ARTISTS = [
    { rank:1, name:'Midnight Echo', hypes:'24.1K', tint:'#ff5029', change:'+2' },
    { rank:2, name:'Nyla',          hypes:'19.8K', tint:'#22e5d4', change:'—'  },
    { rank:3, name:'Wax Tropic',    hypes:'17.4K', tint:'#b983ff', change:'-2' },
    { rank:4, name:'DJ Caro',       hypes:'14.2K', tint:'#5b8cff', change:'+2' },
    { rank:5, name:'Cold Harbor',   hypes:'11.9K', tint:'#ffb84a', change:'-1' },
    { rank:6, name:'Sunroom',       hypes:'9.3K',  tint:'#ff5029', change:'-1' },
    { rank:7, name:'Robin Vega',    hypes:'7.8K',  tint:'#22e5d4', change:'+2' },
    { rank:8, name:'Slow Harbor',   hypes:'6.1K',  tint:'#b983ff', change:'—'  },
  ];
  const cc = c => c.startsWith('+')?'#22e5d4':c.startsWith('-')?'#ff5029':'var(--ink-3)';
  const medal = i => i===0?'🥇':i===1?'🥈':i===2?'🥉':null;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--ink-3)' }}>HYPE Leaderboard · This Week</div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#ff5029', boxShadow:'0 0 6px #ff5029', display:'inline-block' }} />
          <span style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', color:'var(--ink-3)' }}>Live</span>
        </div>
      </div>
      {ARTISTS.map((a,i) => (
        <div key={a.name} onClick={()=>{ const ar=window.lookupArtist&&window.lookupArtist(a.name,a.tint); if(ar&&window.openIHYPEArtistProfile) window.openIHYPEArtistProfile(ar); }} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.05)', cursor:'pointer' }}>
          <div style={{ width:28, textAlign:'center', fontFamily:'var(--f-d)', fontWeight:800, fontSize:i<3?'1.2rem':'.9rem', color:i===0?'#ffb84a':i===1?'#aaa':i===2?'#b983ff':'var(--ink-3)', flexShrink:0 }}>{medal(i)||a.rank}</div>
          <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,'+a.tint+'88,'+a.tint+'22)', flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.name}</div>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.7rem', color:'var(--ink-3)', marginTop:2 }}>{a.hypes} hypes</div>
          </div>
          <div style={{ fontFamily:'var(--f-m)', fontSize:'.82rem', fontWeight:700, color:cc(a.change), flexShrink:0, minWidth:28, textAlign:'right' }}>{a.change}</div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { ListenTab });
