// iHYPE Sheets — all modal overlays, exported to window

function TourCreatorSheet({ open, onClose }) {
  const [shows, setShows] = React.useState([{ venue: '', date: '', price: 18 }]);
  const add = () => setShows(s => [...s, { venue: '', date: '', price: 18 }]);
  const update = (i, k, v) => setShows(s => s.map((x, j) => j === i ? { ...x, [k]: v } : x));
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem', maxHeight: '85%', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 16px' }} />
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>Tour Creator</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-3)', marginBottom: 18 }}>Add shows. Each becomes an event with 45% split — automatic.</div>
        {shows.map((sh, i) => (
          <div key={i} style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-3)', marginBottom: 10 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Show {i + 1}</div>
            <input value={sh.venue} onChange={e => update(i, 'venue', e.target.value)} placeholder="Venue name" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: '.85rem', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <input value={sh.date} onChange={e => update(i, 'date', e.target.value)} placeholder="Date (e.g. Fri Jun 28)" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: '.85rem', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-3)' }}>Price $</span>
              <input type="number" value={sh.price} onChange={e => update(i, 'price', +e.target.value)} min={5} max={200} style={{ width: 70, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', outline: 'none' }} />
              <span style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: '#22e5d4' }}>→ ${(sh.price * .45).toFixed(2)} artist</span>
            </div>
          </div>
        ))}
        <button onClick={add} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px dashed var(--line)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer', marginBottom: 14 }}>+ Add show</button>
        <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem', cursor: 'pointer' }}>Create tour →</button>
      </div>
    </div>
  );
}

function RadioSchedulerSheet({ open, onClose }) {
  const [name, setName] = React.useState('');
  const [day, setDay] = React.useState('Friday');
  const [genre, setGenre] = React.useState('lo-fi');
  if (!open) return null;
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const GENRES = ['lo-fi', 'r&b', 'electronic', 'hip-hop', 'jazz', 'dream-pop', 'folk', 'punk'];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 16px' }} />
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>Schedule a show</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-3)', marginBottom: 16 }}>Set a recurring slot. Listeners get notified before each broadcast.</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>Show name</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Late Night Frequencies" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Day</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {DAYS.map(d => { const on = day === d; return <button key={d} onClick={() => setDay(d)} style={{ flex: 1, padding: '6px 2px', borderRadius: 8, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.1)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.7rem', cursor: 'pointer', fontWeight: on ? 700 : 500 }}>{d}</button>; })}
        </div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Genre</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {GENRES.map(g => { const on = genre === g; return <button key={g} onClick={() => setGenre(g)} style={{ padding: '5px 12px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'rgba(255,80,41,.1)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.72rem', cursor: 'pointer', fontWeight: on ? 700 : 500 }}>{g}</button>; })}
        </div>
        <button onClick={() => name && onClose()} style={{ width: '100%', padding: '12px', borderRadius: 999, background: name ? 'var(--accent)' : 'var(--bg-3)', color: name ? '#fff' : 'var(--ink-3)', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem', cursor: name ? 'pointer' : 'default' }}>Schedule show →</button>
      </div>
    </div>
  );
}

function LiveEventOverlay({ event, onClose }) {
  const [hyped, setHyped] = React.useState(0);
  const [checkedIn, setCheckedIn] = React.useState(false);
  const [pulse, setPulse] = React.useState(1284);
  React.useEffect(() => {
    if (!event) return;
    const t = setInterval(() => setPulse(p => p + Math.floor(Math.random() * 3)), 3000);
    return () => clearInterval(t);
  }, [event]);
  if (!event) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#ff5029,#ff3e9a,#b983ff,#22e5d4)', borderRadius: 999, marginBottom: 20 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3c3c', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#ff3c3c' }}>Live now</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-.04em', lineHeight: .95, marginBottom: 6 }}>{event.artist}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: '.82rem', color: 'var(--ink-3)', marginBottom: 20 }}>{event.venue} · doors open</div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, padding: '1rem', borderRadius: 14, border: '1px solid rgba(255,60,60,.2)', background: 'rgba(255,60,60,.06)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.5rem', color: '#ff3c3c' }}>{pulse.toLocaleString()}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>Live hypes</div>
        </div>
        <div style={{ flex: 1, padding: '1rem', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-2)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--accent)' }}>218</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>Tickets</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-2)', padding: '10px 12px' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Live hype feed</div>
        {['@robinv hyped this show 🔥', '@jaysmith just bought a ticket', '@nocturnalwave shared your link', '@mx.lo hyped this show 🔥', '@dana.k just checked in'].map((item, i) => (
          <div key={i} style={{ fontFamily: 'var(--f-b)', fontSize: '.78rem', color: 'var(--ink-2)', padding: '.4rem 0', borderBottom: '1px solid var(--line-2)' }}>{item}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={() => setHyped(h => h + 1)} style={{ flex: 1, padding: '11px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>🔥 Hype · {(1284 + hyped).toLocaleString()}</button>
        <button onClick={() => setCheckedIn(true)} style={{ flex: 1, padding: '11px', borderRadius: 999, background: checkedIn ? 'rgba(34,229,212,.15)' : 'transparent', color: checkedIn ? '#22e5d4' : 'var(--ink-2)', border: `1px solid ${checkedIn ? 'rgba(34,229,212,.3)' : 'var(--line)'}`, fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>{checkedIn ? '✓ Here' : "I'm here"}</button>
      </div>
    </div>
  );
}

function PostPurchaseMoment({ show, onClose }) {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (!show) return;
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 900);
    const t3 = setTimeout(() => setStep(3), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [show]);
  const [sparks] = React.useState(() => Array.from({length:18},(_,i)=>({ x:30+Math.random()*40, delay:i*60, rot:Math.random()*360, color:['#ff5029','#b983ff','#22e5d4','#ffb84a'][i%4] })));
  if (!show) return null;
  const cells = [
    { amt: '$8.10', pct: '45%', who: 'Artist', color: '#ff5029', show: step >= 1 },
    { amt: '$8.10', pct: '45%', who: 'Venue', color: '#22e5d4', show: step >= 2 },
    { amt: '$1.80', pct: '10%', who: 'Promoters', color: '#b983ff', show: step >= 3 },
    { amt: '$0.00', pct: '0%', who: 'iHYPE', color: '#22e5d4', show: step >= 3 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 95, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', overflow:'hidden' }}>
      {sparks.map((sp,i)=>(
        <div key={i} style={{ position:'absolute', top:'-5%', left:sp.x+'%', width:8, height:8, borderRadius:sp.x%3===0?'50%':2, background:sp.color, animation:`confettiFall 1.4s ease-in ${sp.delay}ms both`, pointerEvents:'none' }} />
      ))}
      <style>{'@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(120vh) rotate(720deg);opacity:0}}'}</style>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(34,229,212,.12)', border: '2px solid #22e5d4', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22e5d4" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
      </div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', marginBottom: 6 }}>You're in.</div>
      <div style={{ fontFamily: 'var(--f-b)', fontSize: '.85rem', color: 'var(--ink-2)', marginBottom: 28, textAlign: 'center' }}>Here's where your $18 went.</div>
      <div style={{ width: '100%', marginBottom: 18 }}>
        <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', gap: 2, marginBottom: 16 }}>
          <div style={{ flex: 45, background: '#ff5029', borderRadius: '999px 0 0 999px' }} />
          <div style={{ flex: 45, background: '#22e5d4' }} />
          <div style={{ flex: 10, background: '#b983ff', borderRadius: '0 999px 999px 0' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {cells.map(c => (
            <div key={c.who} style={{ padding: '10px 12px', borderRadius: 13, border: `1px solid ${c.color}33`, background: `${c.color}0d`, transition: 'opacity .3s, transform .3s', opacity: c.show ? 1 : 0, transform: c.show ? 'translateY(0)' : 'translateY(10px)' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.3rem', color: c.color, lineHeight: 1 }}>{c.amt}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>{c.pct} · {c.who}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#22e5d4', marginBottom: 20 }}>iHYPE takes nothing · locked in charter</div>
      <button onClick={onClose} style={{ width: '100%', padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer' }}>View my ticket →</button>
    </div>
  );
}

function NotifPrimer({ show, onAllow, onSkip }) {
  if (!show) return null;
  const handleAllow = () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then(p => { onAllow && onAllow(p); });
    } else { onAllow && onAllow('granted'); }
  };
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.5rem 1.25rem 2.5rem' }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(255,80,41,.12)', border: '1px solid rgba(255,80,41,.25)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 24 }}>🔔</div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-.03em', textAlign: 'center', marginBottom: 8 }}>Know first.</div>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.6, textAlign: 'center', marginBottom: 24, maxWidth: '34ch', margin: '0 auto 24px' }}>Get notified when artists you've hyped drop tickets — before anyone else.</p>
        <button onClick={onAllow} style={{ width: '100%', padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', marginBottom: 10 }}>Allow notifications</button>
        <button onClick={onSkip} style={{ width: '100%', padding: '11px', borderRadius: 999, background: 'transparent', color: 'var(--ink-3)', border: 'none', fontFamily: 'var(--f-m)', fontSize: '.85rem', cursor: 'pointer' }}>Not now</button>
      </div>
    </div>
  );
}

function PostShowRating({ show, onClose }) {
  const [rating, setRating] = React.useState(0);
  const [done, setDone] = React.useState(false);
  if (!show) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 85, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.5rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 18px' }} />
        {!done ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.2rem', marginBottom: 4 }}>How was the show?</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-3)' }}>{show.artist} · {show.venue}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)} style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${rating >= n ? 'var(--accent)' : 'var(--line)'}`, background: rating >= n ? 'rgba(255,80,41,.12)' : 'transparent', fontSize: 20, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{rating >= n ? '🔥' : '☆'}</button>
              ))}
            </div>
            <button onClick={() => rating && setDone(true)} style={{ width: '100%', padding: '12px', borderRadius: 999, background: rating ? 'var(--accent)' : 'var(--bg-3)', color: rating ? '#fff' : 'var(--ink-3)', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem', cursor: rating ? 'pointer' : 'default' }}>Submit rating</button>
            <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer' }}>Skip</button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔥</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>Thanks.</div>
            <div style={{ fontFamily: 'var(--f-b)', fontSize: '.82rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>Your rating helps {show.artist} show up on the demand radar.</div>
            <button onClick={() => { window.openIHYPEMemoryCard && window.openIHYPEMemoryCard(show); onClose(); }} style={{ width: '100%', padding: '12px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem', cursor: 'pointer', marginBottom: 8 }}>Get your memory card 🎫</button>
            <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer' }}>Skip</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketTransferSheet({ open, onClose }) {
  const [val, setVal] = React.useState('');
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 16px' }} />
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 6 }}>Transfer ticket</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-3)', marginBottom: 18 }}>Midnight Echo · The Echo · Fri Jun 20</div>
        <input value={val} onChange={e => setVal(e.target.value)} placeholder="Phone number or email" style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
        <button onClick={() => val && onClose()} style={{ width: '100%', padding: '12px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem', cursor: 'pointer' }}>Send transfer</button>
        <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}

function RequestSheet({ open, onClose }) {
  const [artist, setArtist] = React.useState('');
  const [venue, setVenue] = React.useState('');
  const [sent, setSent] = React.useState(false);
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 16px' }} />
        {!sent ? (
          <>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 6 }}>Request an artist</div>
            <div style={{ fontFamily: 'var(--f-b)', fontSize: '.82rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 18 }}>Enough requests unlock a booking offer from the venue to the artist via the demand radar.</div>
            {[['Artist', artist, setArtist, 'Midnight Echo'], ['Venue', venue, setVenue, 'The Echo, Zebulon…']].map(([lbl, val, set, ph]) => (
              <div key={lbl} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>{lbl}</div>
                <input value={val} onChange={e => set(e.target.value)} placeholder={ph} style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <button onClick={() => artist && venue && setSent(true)} style={{ width: '100%', padding: '12px', borderRadius: 999, background: artist && venue ? 'var(--accent)' : 'var(--bg-3)', color: artist && venue ? '#fff' : 'var(--ink-3)', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem', cursor: artist && venue ? 'pointer' : 'default' }}>Send request →</button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔥</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.2rem', marginBottom: 8 }}>Request sent.</div>
            <div style={{ fontFamily: 'var(--f-b)', fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>{artist} at {venue}. When enough fans request this show, the venue gets notified.</div>
            <button onClick={() => { setSent(false); onClose(); }} style={{ width: '100%', padding: '12px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem', cursor: 'pointer' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ArtistAnalyticsSheet({ open, onClose }) {
  if (!open) return null;
  const plays = [8400, 12100, 9800, 14200];
  const maxP = Math.max(...plays);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem', maxHeight: '85%', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 18px' }} />
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 18 }}>Analytics · Midnight Echo</div>
        <div style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-3)', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Seeds performance</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['68%', 'Swipe right', 'var(--accent)'], ['18%', 'Swipe up', '#22e5d4'], ['14%', 'Swipe left', 'var(--ink-3)']].map(([v, l, c]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.3rem', color: c, lineHeight: 1 }}>{v}</div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-3)', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>Plays · last 4 weeks</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
            {plays.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: '.6rem', color: 'var(--ink-3)' }}>{(v / 1000).toFixed(1)}K</div>
                <div style={{ width: '100%', background: 'var(--accent)', borderRadius: '4px 4px 0 0', height: Math.round((v / maxP) * 60) + 'px', opacity: .85 }} />
                <div style={{ fontFamily: 'var(--f-m)', fontSize: '.62rem', color: 'var(--ink-3)' }}>W{i + 1}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-3)' }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Top cities</div>
          {[['Los Angeles', '62%'], ['New York', '18%'], ['Chicago', '8%'], ['Austin', '7%']].map(([city, pct]) => (
            <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, fontFamily: 'var(--f-b)', fontSize: '.82rem' }}>{city}</div>
              <div style={{ width: 80, height: 5, borderRadius: 999, background: 'var(--bg-2)', overflow: 'hidden', marginRight: 6 }}>
                <div style={{ height: '100%', width: pct, background: 'var(--accent)', borderRadius: 999 }} />
              </div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)', minWidth: 28, textAlign: 'right' }}>{pct}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: 14, padding: '11px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  );
}

function InviteSheet({ open, onClose, onToast }) {
  const [copied, setCopied] = React.useState(false);
  const link = 'https://ihype.app/join?ref=me';
  const share = async () => {
    const text = 'Join iHYPE — music, events, and zero fees. Early access:';
    const url = link;
    if (navigator.share) { try { await navigator.share({ title: 'iHYPE', text, url }); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch(e) {} }
    else { navigator.clipboard && navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); onToast && onToast('Invite link copied!'); }
  };
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.5rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 20px' }} />
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎶</div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-.03em', marginBottom: 8 }}>Invite a friend.</div>
          <div style={{ fontFamily: 'var(--f-b)', fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '34ch', margin: '0 auto' }}>They get early access. If they buy a ticket, you both earn from the 10% promoter pool.</div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.78rem', color: 'var(--ink-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</span>
          <button onClick={copy} style={{ padding: '6px 14px', borderRadius: 999, background: copied ? 'rgba(34,229,212,.15)' : 'rgba(255,80,41,.1)', border: `1px solid ${copied ? 'rgba(34,229,212,.3)' : 'rgba(255,80,41,.25)'}`, color: copied ? '#22e5d4' : 'var(--accent)', fontFamily: 'var(--f-m)', fontSize: '.72rem', cursor: 'pointer', flexShrink: 0, fontWeight: 700 }}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={share} style={{ flex: 1, padding: '12px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>Share invite</button>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 999, background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </div>
  );
}

const FAQ = [
  { q: 'Why is iHYPE free?', a: "Our founding charter prohibits iHYPE from taking a cut of ticket sales. It's structural — not a marketing choice." },
  { q: 'How does the 45/45/10 split work?', a: "Every ticket: 45% to the artist, 45% to the venue, 10% to the promoter pool — split among everyone whose referral link drove a purchase." },
  { q: 'How do I earn from referrals?', a: "Share any event link via the share button on an event card. When someone buys through your link, you earn your proportional share of the 10% promoter pool." },
  { q: 'How does artist verification work?', a: "Create an Artist, DJ, or Venue page in Pages → Create. Submit proof of identity — the iHYPE team reviews within 48 hours." },
  { q: 'When do artists get paid?', a: 'Payouts are processed same night as the show, automatically. Artists see the full breakdown in Pages → My Page → Artist.' },
];

function HelpSheet({ open, onClose }) {
  const [expanded, setExpanded] = React.useState(null);
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem', maxHeight: '85%', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 18px' }} />
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 18 }}>Help & FAQ</div>
        {FAQ.map((f, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--line-2)' }}>
            <button onClick={() => setExpanded(expanded === i ? null : i)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '.85rem 0', background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontFamily: 'var(--f-b)', fontWeight: 700, fontSize: '.88rem', flex: 1, paddingRight: 12 }}>{f.q}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: 16, flexShrink: 0 }}>{expanded === i ? '−' : '+'}</span>
            </button>
            {expanded === i && <div style={{ fontFamily: 'var(--f-b)', fontSize: '.82rem', color: 'var(--ink-2)', lineHeight: 1.65, paddingBottom: '1rem' }}>{f.a}</div>}
          </div>
        ))}
        <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: '11px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  );
}

function ChangelogSheet({ open, onClose }) {
  if (!open) return null;
  const entries = [
    { v: '0.1.0-beta.5', d: 'Jun 22, 2026', items: ['Closed-beta invite gate + skip-to-demo fast path', 'Settings: reset app data', 'Feedback widget captures screen + bug severity', 'Graceful mic-permission fallback in Radio Studio', 'Guided live demo walkthrough'] },
    { v: '0.1.0-beta.4', d: 'Jun 20, 2026', items: ['3-tab architecture: Listen · Events · Pages', 'Seeds swipe deck with gesture hint', 'Checkout with TM price comparison', 'Post-purchase 45/45/10 payout reveal', 'Notification primer after first ticket purchase'] },
    { v: '0.1.0-beta.3', d: 'Jun 13, 2026', items: ['Media player mini-bar (top) with play/pause', 'Onboarding: role → city → genres', 'Notification center with bell icon', 'Charts with period filter'] },
    { v: '0.1.0-beta.2', d: 'Jun 6, 2026', items: ['4-platform preview: Desktop · Mobile · iOS · Android', 'Distance chips on event cards', 'Referral link share + clipboard', 'Beta feedback widget'] },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem', maxHeight: '80%', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem' }}>What's new</div>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', padding: '3px 10px', borderRadius: 999, background: 'rgba(255,184,74,.1)', border: '1px solid rgba(255,184,74,.25)', color: '#ffb84a' }}>Beta</span>
        </div>
        {entries.map(e => (
          <div key={e.v} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem' }}>{e.v}</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)' }}>{e.d}</div>
            </div>
            {e.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '.45rem 0', borderBottom: '1px solid var(--line-2)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 8 }} />
                <span style={{ fontFamily: 'var(--f-b)', fontSize: '.82rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        ))}
        <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '11px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  );
}

function SettingsSheet({ open, onClose }) {
  const [notifs, setNotifs] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(() => localStorage.getItem('ihype_theme') !== 'light');
  const toggleTheme = () => { const next = !darkMode; setDarkMode(next); if (window.toggleIHYPETheme) window.toggleIHYPETheme(); };
  if (!open) return null;
  const rows = [
    { label: 'Notifications', sub: 'Ticket drops, referrals, live shows', ctrl: 'toggle', val: notifs, set: setNotifs },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.25rem 1.25rem 2.5rem', maxHeight: '80%', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 18px' }} />
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 18 }}>Settings</div>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.85rem 0', borderBottom: '1px solid var(--line-2)' }}>
            <div><div style={{ fontWeight: 600, fontSize: '.9rem' }}>{r.label}</div><div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 2 }}>{r.sub}</div></div>
            <button onClick={() => r.set(v => !v)} style={{ width: 42, height: 25, borderRadius: 999, background: r.val ? 'var(--accent)' : 'var(--bg-3)', border: r.val ? 'none' : '1px solid var(--line)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
              <span style={{ position: 'absolute', top: 2, left: r.val ? 19 : 2, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
            </button>
          </div>
        ))}
        {[
          ['Invite a friend', () => { onClose(); setTimeout(() => window.openIHYPEInvite && window.openIHYPEInvite(), 200); }],
          ["What's new", () => { onClose(); setTimeout(() => window.openIHYPEChangelog && window.openIHYPEChangelog(), 200); }],
          ['Help & FAQ', () => { onClose(); setTimeout(() => window.openIHYPEHelp && window.openIHYPEHelp(), 200); }],
          ['Linked payment', null, 'Apple Pay ✓'],
          ['Terms of Service', () => window.open('https://ihype.app/terms', '_blank')],
          ['Privacy Policy', () => window.open('https://ihype.app/privacy', '_blank')],
        ].map(([label, action, note]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '.85rem 0', borderBottom: '1px solid var(--line-2)', alignItems: 'center' }}>
            <span style={{ fontSize: '.9rem' }}>{label}</span>
            {action ? <button onClick={action} style={{ fontFamily: 'var(--f-m)', fontSize: '.8rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Open →</button> : <span style={{ fontFamily: 'var(--f-m)', fontSize: '.8rem', color: 'var(--ink-3)' }}>{note}</span>}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '.85rem 0' }}>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)' }}>iHYPE 0.1.0-beta.5 · Jun 2026</span>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: '#ffb84a', padding: '2px 8px', borderRadius: 999, background: 'rgba(255,184,74,.1)', border: '1px solid rgba(255,184,74,.2)' }}>Beta</span>
        </div>
        <button onClick={() => { if (confirm('Reset all local data and restart the app? This clears your onboarding, tickets, and preferences.')) { const plat = localStorage.getItem('ihype_platform'); localStorage.clear(); if (plat) localStorage.setItem('ihype_platform', plat); location.reload(); } }} style={{ width: '100%', marginTop: 8, padding: '11px', borderRadius: 999, border: '1px solid rgba(255,80,41,.3)', background: 'rgba(255,80,41,.06)', color: '#ff5029', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.84rem', cursor: 'pointer' }}>Reset app data</button>
        <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '11px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  );
}

function FeedbackWidget({ onToast }) {
  const [open, setOpen] = React.useState(false);
  const [cat, setCat] = React.useState('idea');
  const [sev, setSev] = React.useState('medium');
  const [msg, setMsg] = React.useState('');
  const screen = () => { const plat = localStorage.getItem('ihype_platform') || 'ios'; return plat; };
  const submit = () => { if (!msg.trim()) return; window.track && window.track('beta_feedback', { cat, sev, screen: screen(), len: msg.length }); setOpen(false); setMsg(''); onToast && onToast('Thanks — feedback received 🙏'); };
  return (
    <>
      {!open && <button onClick={() => setOpen(true)} style={{ position: 'absolute', bottom: 72, right: 12, zIndex: 50, width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,184,74,.15)', border: '1px solid rgba(255,184,74,.35)', color: '#ffb84a', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      </button>}
      {open && <div style={{ position: 'absolute', bottom: 72, right: 12, left: 12, zIndex: 60, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '1rem', boxShadow: '0 20px 40px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.9rem' }}>Beta feedback</div>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[['bug', 'Bug'], ['idea', 'Idea'], ['confusing', 'Unclear']].map(([id, lbl]) => (
            <button key={id} onClick={() => setCat(id)} style={{ flex: 1, padding: '5px', borderRadius: 8, border: `1px solid ${cat === id ? 'var(--accent)' : 'var(--line)'}`, background: cat === id ? 'rgba(255,80,41,.1)' : 'transparent', color: cat === id ? 'var(--accent)' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.72rem', cursor: 'pointer' }}>{lbl}</button>
          ))}
        </div>
        <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="What's on your mind?" rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: '.82rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
        {cat === 'bug' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {[['low', 'Minor'], ['medium', 'Annoying'], ['high', 'Blocking']].map(([id, lbl]) => (
              <button key={id} onClick={() => setSev(id)} style={{ flex: 1, padding: '5px', borderRadius: 8, border: `1px solid ${sev === id ? '#ffb84a' : 'var(--line)'}`, background: sev === id ? 'rgba(255,184,74,.1)' : 'transparent', color: sev === id ? '#ffb84a' : 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.68rem', cursor: 'pointer' }}>{lbl}</button>
            ))}
          </div>
        )}
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.6rem', color: 'var(--ink-3)', marginTop: 8, letterSpacing: '.04em' }}>Attached: {screen()} screen · v0.1.0-beta.5</div>
        <button onClick={submit} style={{ width: '100%', marginTop: 8, padding: '9px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.82rem', cursor: 'pointer' }}>Send feedback</button>
      </div>}
    </>
  );
}

const VERIFIED_APS = new Set(['Midnight Echo','Nyla','DJ Caro','Wax Tropic','Cold Harbor']);

// Animated HYPE counter (odometer-style)
function HypeCounter({ val, color, label }) {
  const [disp, setDisp] = React.useState(val - 120);
  React.useEffect(() => { let v = val - 120; const t = setInterval(() => { v = Math.min(val, v + Math.ceil((val - v) / 8) + 1); setDisp(v); if (v >= val) clearInterval(t); }, 40); return () => clearInterval(t); }, [val]);
  return <div><div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem', color, lineHeight:1.1 }}>{disp.toLocaleString()}</div><div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', color:'var(--ink-3)', letterSpacing:'.06em', textTransform:'uppercase', marginTop:2 }}>{label}</div></div>;
}

// Artist ··· report/block menu
function ArtistMenu({ artist }) {
  const [open, setOpen] = React.useState(false);
  const [done, setDone] = React.useState(null);
  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:34, height:34, borderRadius:'50%', border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.06)', color:'var(--ink-2)', cursor:'pointer', display:'grid', placeItems:'center', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem' }}>···</button>
      {open && (
        <div onClick={()=>setOpen(false)} style={{ position:'fixed', inset:0, zIndex:200 }}>
          <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:40, right:0, background:'var(--bg-2)', border:'1px solid var(--line)', borderRadius:14, padding:'6px 0', minWidth:160, boxShadow:'0 8px 32px rgba(0,0,0,.5)', zIndex:201 }}>
            {done ? <div style={{ padding:'10px 14px', fontFamily:'var(--f-m)', fontSize:'.8rem', color:'#22e5d4' }}>{done} ✓</div> : [
              ['🔗 Share profile', () => { if(navigator.share) navigator.share({title:artist?.name, url:'https://ihype.app/a/'+encodeURIComponent(artist?.name||'')}); setOpen(false); }],
              ['🚩 Report', () => { setDone('Reported'); setTimeout(()=>setOpen(false),1200); }],
              ['🚫 Block', () => { setDone('Blocked'); setTimeout(()=>setOpen(false),1200); }],
            ].map(([lbl, fn]) => <button key={lbl} onClick={fn} style={{ display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none', color:lbl.includes('Block')?'#ff5029':'var(--ink)', fontFamily:'var(--f-b)', fontSize:'.84rem', cursor:'pointer', textAlign:'left' }}>{lbl}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}
function VArtistBadge() { return <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:16, height:16, borderRadius:'50%', background:'#5b8cff', marginLeft:5, flexShrink:0, verticalAlign:'middle' }}><svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="2,5 4,7 8,3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>; }

function ArtistProfileSheet({ artist, onClose, onBuy }) {
  const [followed, setFollowed] = React.useState(false);
  const [hyped, setHyped] = React.useState(false);
  // Swipe-back: track pointer from left edge
  const swipeRef = React.useRef(null);
  const onPD = e => { if (e.clientX < 28) swipeRef.current = e.clientX; };
  const onPU = e => { if (swipeRef.current !== null && e.clientX - swipeRef.current > 60) { swipeRef.current = null; onClose(); } else swipeRef.current = null; };
  if (!artist) return null;
  const D = window.IHYPE_DATA;
  const shows = (D.shows || []).filter(s => s.artist === artist.name);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 75, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onPointerDown={onPD} onPointerUp={onPU}>
      {/* Hero */}
      <div style={{ height: 150, background: `linear-gradient(160deg,${artist.tint}88,${artist.tint}18)`, position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 60%,${artist.tint}55,transparent 65%)` }} />
        <button onClick={onClose} style={{ position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,.45)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 20, lineHeight: 1, zIndex: 2 }}>‹</button>
        <div style={{ position: 'absolute', bottom: -24, left: 16, width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${artist.tint},${artist.tint}88)`, border: '3px solid var(--bg)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.3rem', color: '#fff', zIndex: 2 }}>{artist.name[0]}</div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '34px 16px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-.03em', display:'flex', alignItems:'center' }}>{artist.name}{VERIFIED_APS.has(artist.name) && <VArtistBadge />}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 3 }}>{artist.handle} · {artist.city}</div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            <ArtistMenu artist={artist} onToast={onClose} />
            <button onClick={() => { setHyped(h => !h); window.IHYPE_HYPE_BRIDGE && window.IHYPE_HYPE_BRIDGE.canSpend() && window.IHYPE_HYPE_BRIDGE.spend(); }} style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${hyped ? 'var(--accent)' : 'var(--line)'}`, background: hyped ? 'rgba(255,80,41,.12)' : 'transparent', color: hyped ? 'var(--accent)' : 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: '.78rem', cursor: 'pointer', fontWeight: 700 }}>🔥 {hyped ? 'Hyped' : 'Hype'}</button>
            <button onClick={() => setFollowed(f => !f)} style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${followed ? 'var(--accent)' : 'var(--line)'}`, background: followed ? 'rgba(255,80,41,.08)' : 'transparent', color: followed ? 'var(--accent)' : 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: '.78rem', cursor: 'pointer', fontWeight: followed ? 700 : 500 }}>{followed ? 'Following' : 'Follow'}</button>
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
          {[['hypes', 'var(--accent)', true], ['listeners/mo', '#22e5d4', false], ['upcoming', 'var(--ink-2)', false]].map(([l,c,animated],ki) => {
            const vals = ['4,821','12.4K',String(shows.length)||'1'];
            return animated ? <HypeCounter key={ki} val={4821} color={c} label={l} /> : <div key={ki}><div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem', color:c, lineHeight:1.1 }}>{vals[ki]}</div><div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', color:'var(--ink-3)', letterSpacing:'.06em', textTransform:'uppercase', marginTop:2 }}>{l}</div></div>;
          })}
          {false && [['DEAD_CODE_REMOVEDcoming', '#b983ff']].map(([v,l,c]) => (
            <div key={l}><div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', color: c, lineHeight: 1 }}>{v}</div><div style={{ fontFamily: 'var(--f-m)', fontSize: '.62rem', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>{l}</div></div>
          ))}
        </div>
        {/* Tags */}
        {artist.tags && artist.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {artist.tags.map(t => <span key={t} style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', padding: '4px 10px', borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--bg-2)', color: 'var(--ink-3)' }}>{t}</span>)}
          </div>
        )}
        {/* Bio */}
        <p style={{ fontFamily: 'var(--f-b)', fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: 22 }}>{artist.bio || 'Independent artist on iHYPE.'}</p>
        {/* Tracks */}
        {artist.tracks && artist.tracks.length > 0 && (
          <>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Top tracks</div>
            {artist.tracks.map((t, i) => (
              <div key={t.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.65rem 0', borderBottom: '1px solid var(--line-2)' }}>
                <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.88rem', color: 'var(--ink-3)', minWidth: 20, textAlign: 'center' }}>{i+1}</span>
                <div onClick={() => window.setIHYPENowPlaying && window.setIHYPENowPlaying({ t: t.t, a: artist.name, tint: artist.tint })} style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg,${artist.tint}88,${artist.tint}22)`, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
                </div>
                <div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--f-b)', fontWeight: 700, fontSize: '.88rem' }}>{t.t}</div><div style={{ fontFamily: 'var(--f-m)', fontSize: '.7rem', color: 'var(--ink-3)' }}>{t.plays} plays</div></div>
                <span style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)' }}>{t.len}</span>
              </div>
            ))}
          </>
        )}
        {/* Upcoming shows */}
        {shows.length > 0 && (
          <>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.65rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '22px 0 10px' }}>Upcoming shows</div>
            {shows.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.75rem 0', borderBottom: '1px solid var(--line-2)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: `linear-gradient(135deg,${s.tint}88,${s.tint}22)`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '.88rem' }}>{s.venue}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 2 }}>{s.date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1rem', color: 'var(--accent)' }}>${s.price}</div>
                  <button onClick={() => onBuy && onBuy(s)} style={{ marginTop: 5, padding: '5px 12px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-m)', fontSize: '.72rem', cursor: 'pointer', fontWeight: 700 }}>Get ticket</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SeedMatchSheet({ match, onClose, onBuy }) {
  if (!match) return null;
  const tint = match.tint || '#ff5029';
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 82, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: 'var(--bg-2)', borderRadius: '22px 22px 0 0', padding: '1.5rem 1.25rem 2.5rem' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 22px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tint, display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', letterSpacing: '.12em', textTransform: 'uppercase', color: tint }}>Playing near you</span>
        </div>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-.04em', lineHeight: .95, marginBottom: 6 }}>{match.artist}</div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '.82rem', color: 'var(--ink-2)', marginBottom: 22 }}>{match.event} · {match.date}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 14, border: `1px solid ${tint}33`, background: `${tint}0d`, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', color: 'var(--ink-3)', marginBottom: 2 }}>You hyped them — early access</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.1rem', color: tint }}>${match.price} · +$0 fees</div>
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth="2" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>
        </div>
        <button onClick={() => { onClose(); onBuy && onBuy(match); }} style={{ width: '100%', padding: '13px', borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', marginBottom: 8 }}>Get ticket →</button>
        <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: '.82rem', cursor: 'pointer' }}>Dismiss</button>
      </div>
    </div>
  );
}

// ── Ticket QR Flip ──────────────────────────────────────────────────────────
function TicketQRSheet({ ticket, onClose }) {
  const [flipped, setFlipped] = React.useState(false);
  if (!ticket) return null;
  const tint = ticket.tint || '#ff5029';
  // Fake QR grid (9×9)
  const qr = React.useMemo(() => {
    const s = 81;
    const out = [];
    const corners = [[0,0],[0,1],[0,2],[1,0],[2,0],[0,6],[0,7],[0,8],[1,8],[2,8],[6,0],[7,0],[8,0],[8,1],[8,2],[6,8],[7,8],[8,8],[8,7],[8,6]];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const isCorner = corners.some(([cr,cc]) => cr===r && cc===c);
      out.push(isCorner || (Math.random() > 0.45));
    }
    return out;
  }, [ticket]);
  return (
    <div style={{ position:'absolute', inset:0, zIndex:88, background:'rgba(0,0,0,.85)', backdropFilter:'blur(10px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
      <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'none', border:'none', color:'var(--ink-3)', fontSize:26, cursor:'pointer', lineHeight:1 }}>×</button>
      <div onClick={() => setFlipped(f => !f)} style={{ width:280, height:380, perspective:1000, cursor:'pointer' }}>
        <div style={{ width:'100%', height:'100%', position:'relative', transformStyle:'preserve-3d', transition:'transform .55s cubic-bezier(.4,0,.2,1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
          {/* Front — ticket info */}
          <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', borderRadius:22, background:`linear-gradient(160deg,${tint}44,${tint}11)`, border:`1px solid ${tint}44`, padding:'1.5rem', display:'flex', flexDirection:'column' }}>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.14em', textTransform:'uppercase', color:tint, marginBottom:10 }}>🎟 Your ticket</div>
            <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.4rem', letterSpacing:'-.03em', lineHeight:1, marginBottom:6 }}>{ticket.artist}</div>
            <div style={{ fontFamily:'var(--f-b)', fontSize:'.85rem', color:'var(--ink-2)', marginBottom:4 }}>{ticket.event}</div>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.78rem', color:'var(--ink-3)' }}>{ticket.date}</div>
            <div style={{ flex:1 }} />
            <div style={{ display:'flex', height:3, borderRadius:999, overflow:'hidden', gap:2, marginBottom:14 }}>
              <div style={{ flex:45, background:'#ff5029', borderRadius:'999px 0 0 999px' }} />
              <div style={{ flex:45, background:'#22e5d4' }} />
              <div style={{ flex:10, background:'#b983ff', borderRadius:'0 999px 999px 0' }} />
            </div>
            <div style={{ textAlign:'center', fontFamily:'var(--f-m)', fontSize:'.7rem', color:'var(--ink-3)', opacity:.7 }}>Tap to reveal QR</div>
          </div>
          {/* Back — QR */}
          <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', transform:'rotateY(180deg)', borderRadius:22, background:'#fff', padding:'1.5rem', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', gap:3, marginBottom:16 }}>
              {qr.map((on, i) => <div key={i} style={{ width:24, height:24, borderRadius:3, background: on ? '#111' : 'transparent' }} />)}
            </div>
            <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1rem', color:'#111', marginBottom:4 }}>{ticket.artist}</div>
            <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'#666' }}>{ticket.date}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop:20, fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)', letterSpacing:'.06em' }}>Tap ticket to flip</div>
    </div>
  );
}

// ── Post-show memory card ────────────────────────────────────────────────────
function PostShowMemoryCard({ show, onClose }) {
  const [shared, setShared] = React.useState(false);
  if (!show) return null;
  const tint = show.tint || '#ff5029';
  const share = async () => {
    const text = `I was there 🔥 ${show.artist} at ${show.venue || 'the show'}. Powered by iHYPE.`;
    if (navigator.share) { try { await navigator.share({ text, url: 'https://ihype.app' }); setShared(true); } catch(e) {} }
    else { navigator.clipboard && navigator.clipboard.writeText(text); setShared(true); }
  };
  return (
    <div style={{ position:'absolute', inset:0, zIndex:88, background:'rgba(0,0,0,.88)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
      <div style={{ width:'100%', maxWidth:320 }}>
        {/* Card */}
        <div style={{ borderRadius:24, background:`linear-gradient(160deg,${tint}55,${tint}11)`, border:`1px solid ${tint}33`, padding:'2rem 1.5rem', textAlign:'center', marginBottom:18, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:`${tint}18` }} />
          <div style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.18em', textTransform:'uppercase', color:tint, marginBottom:14 }}>You were there.</div>
          <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'2rem', letterSpacing:'-.04em', lineHeight:.95, marginBottom:8 }}>{show.artist}</div>
          <div style={{ fontFamily:'var(--f-b)', fontSize:'.88rem', color:'var(--ink-2)', marginBottom:6 }}>{show.venue || 'Live'}</div>
          <div style={{ fontFamily:'var(--f-m)', fontSize:'.75rem', color:'var(--ink-3)', marginBottom:20 }}>{show.date || 'Jun 20, 2026'}</div>
          <div style={{ display:'flex', justifyContent:'center', gap:18 }}>
            {[['🔥','4,821 hypes'], ['🎟','218 tickets'], ['💸','$0 fees']].map(([ic, lbl]) => (
              <div key={lbl} style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{ic}</div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:'.6rem', letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink-3)' }}>{lbl}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:18, fontFamily:'var(--f-m)', fontSize:'.65rem', letterSpacing:'.08em', color:'rgba(255,255,255,.3)' }}>iHYPE · powered by fans</div>
        </div>
        <button onClick={share} style={{ width:'100%', padding:'13px', borderRadius:999, background:shared?'rgba(34,229,212,.15)':'var(--accent)', color:shared?'#22e5d4':'#fff', border:shared?'1px solid rgba(34,229,212,.3)':'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.95rem', cursor:'pointer', marginBottom:10 }}>{shared ? '✓ Shared' : 'Share this moment'}</button>
        <button onClick={onClose} style={{ width:'100%', padding:'10px', borderRadius:999, border:'none', background:'transparent', color:'var(--ink-3)', fontFamily:'var(--f-m)', fontSize:'.82rem', cursor:'pointer' }}>Done</button>
      </div>
    </div>
  );
}

// ── Playlist create ──────────────────────────────────────────────────────────
const TINTS = ['#ff5029','#22e5d4','#b983ff','#ffb84a','#5b8cff','#ff3e9a'];
function PlaylistCreateSheet({ open, onClose, onCreated }) {
  const [name, setName] = React.useState('');
  const [tint, setTint] = React.useState(TINTS[0]);
  if (!open) return null;
  const create = () => { if (!name.trim()) return; onCreated && onCreated({ name, tint }); onClose(); setName(''); };
  return (
    <div style={{ position:'absolute', inset:0, zIndex:80, background:'rgba(0,0,0,.6)', backdropFilter:'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position:'absolute', bottom:0, left:0, right:0, background:'var(--bg-2)', borderRadius:'22px 22px 0 0', padding:'1.25rem 1.25rem 2.5rem' }}>
        <div style={{ width:36, height:4, borderRadius:999, background:'var(--line)', margin:'0 auto 18px' }} />
        <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem', marginBottom:18 }}>New playlist</div>
        {/* Color picker */}
        <div style={{ display:'flex', gap:8, marginBottom:16, justifyContent:'center' }}>
          {TINTS.map(t => (
            <button key={t} onClick={() => setTint(t)} style={{ width:36, height:36, borderRadius:'50%', background:t, border: tint===t ? '3px solid #fff' : '3px solid transparent', cursor:'pointer', boxShadow: tint===t ? `0 0 10px ${t}` : 'none', transition:'all .15s' }} />
          ))}
        </div>
        {/* Preview */}
        <div style={{ width:72, height:72, borderRadius:16, background:`linear-gradient(135deg,${tint}cc,${tint}33)`, margin:'0 auto 18px', display:'grid', placeItems:'center', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.6rem', color:'rgba(255,255,255,.8)' }}>
          {name ? name[0].toUpperCase() : '+'}
        </div>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key==='Enter' && create()} placeholder="Playlist name" style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1px solid var(--line)', background:'var(--bg-3)', color:'var(--ink)', fontFamily:'var(--f-b)', fontSize:'.9rem', outline:'none', boxSizing:'border-box', marginBottom:16, textAlign:'center' }} autoFocus />
        <button onClick={create} disabled={!name.trim()} style={{ width:'100%', padding:'12px', borderRadius:999, background:name.trim()?'var(--accent)':'var(--bg-3)', color:name.trim()?'#fff':'var(--ink-3)', border:'none', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.9rem', cursor:name.trim()?'pointer':'default' }}>Create playlist</button>
      </div>
    </div>
  );
}

// ── Friend activity feed ─────────────────────────────────────────────────────
function FriendActivitySheet({ open, onClose }) {
  if (!open) return null;
  const D = window.IHYPE_DATA;
  const activities = [
    { friend:'Dev R', tint:'#b983ff', action:'hyped', target:'Midnight Echo', detail:'Carousel', time:'4m', type:'hype' },
    { friend:'Mara K', tint:'#22e5d4', action:'bought a ticket to', target:'Nyla', detail:'Basement Tapes · Jun 21', time:'22m', type:'ticket' },
    { friend:'Theo P', tint:'#ffb84a', action:'shared', target:'Sunroom', detail:'Album Release · $20', time:'1h', type:'share' },
    { friend:'Sun L', tint:'#ff5029', action:'hyped', target:'Wax Tropic', detail:'Heatwave', time:'2h', type:'hype' },
    { friend:'Dev R', tint:'#b983ff', action:'saved', target:'Cold Harbor', detail:'Tidewater', time:'3h', type:'save' },
    { friend:'Mara K', tint:'#22e5d4', action:'bought a ticket to', target:'Midnight Echo', detail:'Live at The Echo · Jun 20', time:'5h', type:'ticket' },
  ];
  const icons = { hype:'🔥', ticket:'🎟', share:'↗', save:'♡' };
  return (
    <div style={{ position:'absolute', inset:0, zIndex:72, background:'rgba(0,0,0,.55)', backdropFilter:'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position:'absolute', bottom:0, left:0, right:0, background:'var(--bg-2)', borderRadius:'22px 22px 0 0', padding:'1.25rem 1.25rem 2.5rem', maxHeight:'80%', overflowY:'auto' }}>
        <div style={{ width:36, height:4, borderRadius:999, background:'var(--line)', margin:'0 auto 18px' }} />
        <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:'1.1rem', marginBottom:18 }}>Friend activity</div>
        {activities.map((a, i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'.85rem 0', borderBottom:'1px solid var(--line-2)' }}>
            <div style={{ width:38, height:38, borderRadius:10, background:`linear-gradient(135deg,${a.tint}88,${a.tint}22)`, flexShrink:0, display:'grid', placeItems:'center', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.95rem', color:'#fff' }}>{a.friend[0]}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'.85rem', lineHeight:1.4 }}>
                <b style={{ fontFamily:'var(--f-d)', fontWeight:800 }}>{a.friend}</b>
                <span style={{ fontFamily:'var(--f-b)', color:'var(--ink-2)' }}> {a.action} </span>
                <b style={{ color:a.tint }}>{a.target}</b>
              </div>
              <div style={{ fontFamily:'var(--f-m)', fontSize:'.72rem', color:'var(--ink-3)', marginTop:3 }}>{a.detail}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
              <span style={{ fontFamily:'var(--f-m)', fontSize:'.65rem', color:'var(--ink-3)' }}>{a.time}</span>
              <span style={{ fontSize:14 }}>{icons[a.type]}</span>
            </div>
          </div>
        ))}
        <button onClick={onClose} style={{ width:'100%', marginTop:14, padding:'11px', borderRadius:999, border:'1px solid var(--line)', background:'transparent', color:'var(--ink-2)', fontFamily:'var(--f-d)', fontWeight:800, fontSize:'.88rem', cursor:'pointer' }}>Done</button>
      </div>
    </div>
  );
}

Object.assign(window, {
  TourCreatorSheet, RadioSchedulerSheet, LiveEventOverlay,
  PostPurchaseMoment, NotifPrimer, PostShowRating,
  TicketTransferSheet, RequestSheet, ArtistAnalyticsSheet,
  InviteSheet, HelpSheet, ChangelogSheet, SettingsSheet, FeedbackWidget,
  ArtistProfileSheet, SeedMatchSheet,
  TicketQRSheet, PostShowMemoryCard, PlaylistCreateSheet, FriendActivitySheet,
});
