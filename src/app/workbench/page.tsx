'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useMediaPlayer, type MediaTrack } from '@/components/GlobalMediaPlayer';
import { SeedsSwipeStack, type SeedsSwipeStackSeed, type SeedsSwipeStackTrack } from '@/components/SeedsSwipeStack';

// ── Icons ─────────────────────────────────────────────────────────

function Ic({ s = 16, sw = 1.6, children }: { s?: number; sw?: number; children: React.ReactNode }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
}
const IcHome     = (p: {s?:number}) => <Ic {...p}><path d="M3 11l9-8 9 8"/><path d="M5 9v12h14V9"/></Ic>;
const IcLibrary  = (p: {s?:number}) => <Ic {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M14 3v18M19 7l-3 3"/></Ic>;
const IcRadio    = (p: {s?:number}) => <Ic {...p}><circle cx="12" cy="12" r="3"/><path d="M5.5 8.5a8 8 0 0 1 13 0M3 6a11 11 0 0 1 18 0M5.5 15.5a8 8 0 0 0 13 0M3 18a11 11 0 0 0 18 0"/></Ic>;
const IcTicket   = (p: {s?:number}) => <Ic {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" strokeDasharray="2 2"/></Ic>;
const IcDisco    = (p: {s?:number}) => <Ic {...p}><circle cx="12" cy="12" r="9"/><polygon points="15 9 13 13 9 15 11 11" fill="currentColor" stroke="none"/></Ic>;
const IcShows    = (p: {s?:number}) => <Ic {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></Ic>;
const IcStudio   = (p: {s?:number}) => <Ic {...p}><path d="M6 3v18M18 3v18M3 6h18M3 12h18M3 18h18"/></Ic>;
const IcSettings = (p: {s?:number}) => <Ic {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Ic>;
const IcPlay  = ({s=14}:{s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>;
const IcHeart = ({s=14,c='currentColor'}:{s?:number;c?:string}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IcCheck = ({s=11}:{s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcBolt  = ({s=12}:{s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>;
const IcDot   = ({c='currentColor',s=8}:{c?:string;s?:number}) => <svg width={s} height={s} viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill={c}/></svg>;
const IcArrow = ({s=12}:{s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>;
const IcQR = ({s=140}:{s?:number}) => (
  <svg width={s} height={s} viewBox="0 0 80 80">
    <rect width="80" height="80" fill="currentColor" opacity="0.06"/>
    {([[0,0],[60,0],[0,60]] as [number,number][]).map(([x,y],i)=>(
      <g key={i}><rect x={x} y={y} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3"/><rect x={x+6} y={y+6} width="8" height="8" fill="currentColor"/></g>
    ))}
    {Array.from({length:36}).map((_,i) => {
      const x=24+(i%6)*4, y=24+Math.floor(i/6)*4, on=(i*13+7)%3===0;
      return on ? <rect key={i} x={x} y={y} width="3" height="3" fill="currentColor"/> : null;
    })}
  </svg>
);

// ── Data ──────────────────────────────────────────────────────────

const TRACKS = [
  { id:'1', t:'Sundown',        a:'Maya Reyes',    d:'3:24', h:142, c:'#ff5029', dSec:204, album:'Halflight EP' },
  { id:'2', t:'Westline',       a:'Cobalt Hour',   d:'4:11', h:89,  c:'#b983ff', dSec:251, album:'Westline' },
  { id:'3', t:'Gold Teeth',     a:'Vela',          d:'2:58', h:67,  c:'#22e5d4', dSec:178, album:'Demo' },
  { id:'4', t:'Slow Burn',      a:'The Lowriders', d:'3:42', h:211, c:'#ff3e9a', dSec:222, album:'Road Tape' },
  { id:'5', t:'Cassette Heart', a:'Juno North',    d:'3:09', h:54,  c:'#ffb84a', dSec:189, album:'Cassette Heart' },
  { id:'6', t:'Underpass',      a:'Saint Hex',     d:'4:36', h:128, c:'#7fb3ff', dSec:276, album:'Underpass' },
  { id:'7', t:'Halflight',      a:'Maya Reyes',    d:'3:51', h:76,  c:'#ff5029', dSec:231, album:'Halflight EP' },
  { id:'8', t:'Brass City',     a:'Cobalt Hour',   d:'3:18', h:33,  c:'#b983ff', dSec:198, album:'Westline' },
];

const MEDIA_TRACKS: MediaTrack[] = TRACKS.map(t => ({
  id: t.id, title: t.t, artistName: t.a, url: '', artworkUrl: null, mediaId: null,
}));

const SHOWS = [
  { id:'s1', name:'Maya Reyes',    venue:'Empty Bottle',    date:'Thu Jun 18', time:'9:00 PM', hype:412, sold:148, cap:200, price:18, status:'TONIGHT' as const },
  { id:'s2', name:'Cobalt Hour',   venue:'Sleeping Village',date:'Sat Jun 20', time:'8:00 PM', hype:287, sold:91,  cap:150, price:15, status:'THIS WEEK' as const },
  { id:'s3', name:'Vela',          venue:'Subterranean',    date:'Tue Jun 23', time:'8:00 PM', hype:156, sold:42,  cap:180, price:12, status:'UPCOMING' as const },
  { id:'s4', name:'The Lowriders', venue:'Hideout',         date:'Fri Jun 26', time:'10:00 PM',hype:331, sold:201, cap:225, price:20, status:'NEAR SOLD' as const },
];

const RADIO_SHOWS = [
  { id:'r1', name:'Chicago Underground', host:'DJ Vex',        time:'Thu 9PM',    next:'in 2h',      live:true,  listeners:412, c:'#ff3e9a', desc:'Chicago indie + post-punk. Live tonight from the Empty Bottle basement.' },
  { id:'r2', name:'After Hours',         host:'Saint Hex',     time:'Daily 11PM', next:'tonight 11PM',live:false, listeners:128, c:'#7fb3ff', desc:'Slow-burn ambient and downtempo. One hour, no talking.' },
  { id:'r3', name:'New Tape Tuesday',    host:'Juno North',    time:'Tue 7PM',    next:'next Tue',   live:false, listeners:67,  c:'#ffb84a', desc:'Cassette-only releases from the Midwest underground. Submissions open.' },
  { id:'r4', name:'Halflight FM',        host:'Maya Reyes',    time:'Sun 10AM',   next:'Sunday',     live:false, listeners:289, c:'#ff5029', desc:'Maya plays her writing-room playlist, plus one new track from the EP each week.' },
  { id:'r5', name:'Side Roads',          host:'The Lowriders', time:'Fri 8PM',    next:'Friday',     live:false, listeners:184, c:'#22e5d4', desc:'Country-fried Americana with a left turn. Listener requests welcome.' },
];

const MY_TICKETS = [
  { id:'tk1', show:'Cobalt Hour @ Sleeping Village', date:'Sat Jun 20 · 8PM', seat:'GA',        price:15, status:'CONFIRMED' as const, qr:'iH-AX91-CB20' },
  { id:'tk2', show:'Vela @ Subterranean',            date:'Tue Jun 23 · 8PM', seat:'GA',        price:12, status:'CONFIRMED' as const, qr:'iH-VE23-7K4M' },
  { id:'tk3', show:'Saint Hex @ Lincoln Hall',       date:'Sat Jul 11 · 9PM', seat:'BALCONY 4', price:24, status:'WAITLIST' as const,  qr:'' },
];

const ACTIVITY = [
  { txt:'3 new HYPEs on Sundown',                    t:'2m ago',  kind:'hype'   as const },
  { txt:'Cobalt Hour confirmed for Sat Jun 20',       t:'14m ago', kind:'show'   as const },
  { txt:'DJ Vex spun Sundown on Chicago Underground', t:'1h ago',  kind:'radio'  as const },
  { txt:'Payout $2,460 scheduled for Jun 24',         t:'3h ago',  kind:'payout' as const },
  { txt:'Sleeping Village wants a date in August',    t:'today',   kind:'show'   as const },
];

const ACT_COLORS: Record<string,string> = { hype:'#ff3e9a', show:'#22e5d4', radio:'#b983ff', payout:'#ffb84a' };

const NAV_ITEMS = [
  { id:'home',     label:'Home',             icon: <IcHome s={16}/> },
  { id:'library',  label:'Library',          icon: <IcLibrary s={16}/> },
  { id:'radio',    label:'Radio',            icon: <IcRadio s={16}/> },
  { id:'tickets',  label:'Live Events',      icon: <IcTicket s={16}/> },
  { id:'discover', label:'Discover · Seeds', icon: <IcDisco s={16}/> },
  { id:'studio',   label:'Create',           icon: <IcStudio s={16}/> },
];

type View = 'home'|'library'|'radio'|'tickets'|'discover'|'studio'|'settings';

// ── Shared utils ──────────────────────────────────────────────────

const panel: React.CSSProperties = { border:'1px solid var(--line)', borderRadius:10, background:'var(--bg-2)', overflow:'hidden' };
const panelHead: React.CSSProperties = { padding:'12px 16px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center' };
const panelTitle: React.CSSProperties = { fontFamily:'var(--f-d)', fontWeight:700, fontSize:14, letterSpacing:'-.005em', color:'var(--ink)' };
const linkBtn: React.CSSProperties = { fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-2)', letterSpacing:'.1em', textTransform:'uppercase' as const, background:'none', border:'none', cursor:'pointer' };
const eyebrow = (c='var(--ink-3)'): React.CSSProperties => ({ fontFamily:'var(--f-m)', fontSize:10, letterSpacing:'.18em', color:c, marginBottom:10 });
const pageTitle: React.CSSProperties = { fontFamily:'var(--f-d)', fontWeight:800, fontSize:42, letterSpacing:'-.03em', lineHeight:1, margin:0, color:'var(--ink)' };
const pageSub: React.CSSProperties = { fontFamily:'var(--f-b)', fontSize:14, color:'var(--ink-2)', marginTop:10, maxWidth:560, lineHeight:1.5 };
const btnPrime: React.CSSProperties = { padding:'9px 16px', background:'var(--ink)', color:'var(--bg)', borderRadius:6, fontFamily:'var(--f-m)', fontSize:12, fontWeight:600, letterSpacing:'.04em', border:'none', cursor:'pointer' };
const btnGhost: React.CSSProperties = { padding:'9px 14px', border:'1px solid var(--line-2)', borderRadius:6, fontFamily:'var(--f-m)', fontSize:12, letterSpacing:'.04em', color:'var(--ink)', background:'transparent', cursor:'pointer' };

// ── Sidebar button ────────────────────────────────────────────────

function SidebarBtn({ active, onClick, label, children, accent='var(--accent)' }:
  { active:boolean; onClick:()=>void; label:string; children:React.ReactNode; accent?:string }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      aria-label={label} type="button"
      style={{ width:38, height:38, borderRadius:8, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', transition:'color .15s, background .15s',
        color: active ? accent : hover ? 'var(--ink)' : 'var(--ink-3)',
        background: active ? (accent==='var(--accent)' ? 'rgba(255,80,41,.10)' : 'rgba(255,255,255,.05)') : hover ? 'rgba(255,255,255,.04)' : 'transparent',
      }}>
      {active && <span style={{ position:'absolute', left:-9, top:8, bottom:8, width:2, borderRadius:2, background:accent }}/>}
      {children}
      {hover && <span style={{ position:'absolute', left:50, top:'50%', transform:'translateY(-50%)', padding:'4px 10px', background:'var(--bg-3)', border:'1px solid var(--line-2)', borderRadius:5, fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink)', letterSpacing:'.06em', whiteSpace:'nowrap', zIndex:10, pointerEvents:'none' }}>{label}</span>}
    </button>
  );
}

// ── Home view ─────────────────────────────────────────────────────

function ViewHome({ session, onPickTrack, currentId, setView }:
  { session: ReturnType<typeof useSession>['data']; onPickTrack:(id:string)=>void; currentId:string|null; setView:(v:View)=>void }) {
  const hour = new Date().getHours();
  const greeting = hour<12 ? 'Good morning' : hour<18 ? 'Good afternoon' : 'Good evening';
  const firstName = session?.user?.name?.split(' ')[0] ?? 'friend';
  const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const now = new Date();
  const eb = `${days[now.getDay()]} · CHICAGO · ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;

  return (
    <div style={{ padding:'24px 32px 8px' }}>
      {/* Greeting */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24, gap:24 }}>
        <div>
          <div style={eyebrow()}>● {eb}</div>
          <h1 style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:38, letterSpacing:'-.025em', lineHeight:1, margin:0, color:'var(--ink)' }}>{greeting}, {firstName}.</h1>
          <p style={{ fontFamily:'var(--f-b)', fontSize:14, color:'var(--ink-2)', marginTop:10, maxWidth:560, lineHeight:1.5 }}>
            3 new HYPEs on <strong style={{ color:'var(--ink)' }}>Sundown</strong>. Cobalt Hour opens for you Saturday at Sleeping Village. Two venues asked about August.
          </p>
        </div>
        <div style={{ display:'flex', gap:10, flexShrink:0 }}>
          <button onClick={()=>setView('studio')} type="button"
            style={{ padding:'9px 16px', background:'var(--accent)', color:'var(--bg)', borderRadius:6, fontFamily:'var(--f-m)', fontSize:12, fontWeight:600, letterSpacing:'.04em', display:'flex', alignItems:'center', gap:6, border:'none', cursor:'pointer' }}>
            <IcBolt s={12}/> Create an event
          </button>
          <button onClick={()=>setView('tickets')} type="button" style={btnGhost}>Browse events →</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
        {[
          { l:'HYPE THIS WEEK', v:'1,247', d:'↑ 23% vs last wk', c:'#ff3e9a' },
          { l:'TICKETS SOLD',   v:'184',   d:'↑ 12 today',        c:'#22e5d4' },
          { l:'RADIO PLAYS',    v:'3,891', d:'across 8 shows',     c:'#b983ff' },
          { l:'PAYOUT PENDING', v:'$2,460',d:'releases Jun 24',    c:'#ffb84a' },
        ].map(s=>(
          <div key={s.l} style={{ padding:'14px 16px', border:'1px solid var(--line)', borderRadius:10, background:'var(--bg-2)' }}>
            <div style={{ fontFamily:'var(--f-m)', fontSize:9, letterSpacing:'.16em', color:'var(--ink-3)', textTransform:'uppercase', marginBottom:8 }}>{s.l}</div>
            <div style={{ fontFamily:'var(--f-d)', fontSize:26, fontWeight:700, letterSpacing:'-.015em', color:'var(--ink)' }}>{s.v}</div>
            <div style={{ fontFamily:'var(--f-m)', fontSize:10, letterSpacing:'.02em', marginTop:6, color:s.c }}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* Shows + Activity */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:12 }}>
        <section style={panel}>
          <div style={panelHead}>
            <div style={panelTitle}>Tonight in Chicago</div>
            <button onClick={()=>setView('tickets')} type="button" style={linkBtn}>All events →</button>
          </div>
          {SHOWS.slice(0,3).map((s,i)=>{
            const sc = s.status==='TONIGHT'?'#22e5d4':s.status==='NEAR SOLD'?'#ffb84a':'var(--ink-3)';
            const fc = s.sold/s.cap>0.85?'#ffb84a':'#22e5d4';
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid var(--line)' }}>
                <div style={{ width:3, height:36, borderRadius:2, flexShrink:0, background:sc }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:14, color:'var(--ink)' }}>{s.name} <span style={{ color:'var(--ink-3)', fontWeight:500 }}>· {s.venue}</span></div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em', marginTop:3 }}>{s.date} · {s.time} · ♡ {s.hype}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, minWidth:80 }}>
                  <div style={{ width:70, height:3, background:'rgba(255,255,255,.06)', borderRadius:2, position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', inset:0, width:`${s.sold/s.cap*100}%`, background:fc, borderRadius:2 }}/>
                  </div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)' }}>{s.sold}/{s.cap}</div>
                </div>
                <button type="button" style={{ color:'var(--ink-3)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }}><IcArrow s={12}/></button>
              </div>
            );
          })}
        </section>
        <section style={panel}>
          <div style={panelHead}>
            <div style={panelTitle}>Activity</div>
            <button type="button" style={linkBtn}>Mark read</button>
          </div>
          {ACTIVITY.map((a,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'1px solid var(--line)' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background:ACT_COLORS[a.kind] }}/>
              <div style={{ flex:1, fontFamily:'var(--f-b)', fontSize:13, color:'var(--ink)' }}>{a.txt}</div>
              <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em' }}>{a.t}</div>
            </div>
          ))}
        </section>
      </div>

      {/* Track grid */}
      <section style={{ ...panel, marginTop:14 }}>
        <div style={panelHead}>
          <div style={panelTitle}>HYPEd this week</div>
          <button onClick={()=>setView('library')} type="button" style={linkBtn}>Discover all →</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, padding:'14px 16px' }}>
          {TRACKS.slice(0,6).map(t=>(
            <button key={t.id} onClick={()=>onPickTrack(t.id)} type="button"
              style={{ padding:8, border:`1px solid ${t.id===currentId?t.c:'var(--line)'}`, borderRadius:8, background:'var(--bg-3)', textAlign:'left', cursor:'pointer', transition:'border-color .2s' }}>
              <div style={{ width:'100%', aspectRatio:'1', borderRadius:5, marginBottom:8, position:'relative', overflow:'hidden', background:`linear-gradient(135deg, ${t.c}, ${t.c}80)` }}>
                <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 25% 25%, rgba(255,255,255,.25), transparent 65%)' }}/>
                <div style={{ position:'absolute', left:10, bottom:10, width:26, height:26, borderRadius:'50%', background:'var(--ink)', color:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}><IcPlay s={12}/></div>
                <div style={{ position:'absolute', right:8, top:8, padding:'2px 7px', background:'rgba(0,0,0,.5)', borderRadius:99, fontFamily:'var(--f-m)', fontSize:9, color:'#ff3e9a', display:'flex', alignItems:'center', gap:3 }}><IcHeart s={10} c="#ff3e9a"/> {t.h}</div>
              </div>
              <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:13, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.t}</div>
              <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em', marginTop:3 }}>{t.a} · {t.d}</div>
            </button>
          ))}
        </div>
      </section>

    </div>
  );
}

// ── Library view ──────────────────────────────────────────────────

function ViewLibrary({ onPickTrack, currentId }:{ onPickTrack:(id:string)=>void; currentId:string|null }) {
  const [tab, setTab] = useState<'saved'|'discover'>('saved');
  const [openMenuId, setOpenMenuId] = useState<string|null>(null);
  const menuRef = useRef<HTMLDivElement|null>(null);

  const playlists = [
    { n:'HYPEd tracks',      c:'#ff3e9a', count:247 },
    { n:'Top 5 — this week', c:'#ff5029', count:5 },
    { n:'Writing room',      c:'#b983ff', count:42 },
    { n:'Tour van',          c:'#22e5d4', count:88 },
  ];

  function handleMenuItem(item: string) {
    setOpenMenuId(null);
    if (item === 'Play' && TRACKS.length > 0) onPickTrack(TRACKS[0].id);
    if (item === 'Shuffle' && TRACKS.length > 0) {
      const shuffled = [...TRACKS].sort(() => Math.random() - 0.5);
      onPickTrack(shuffled[0].id);
    }
  }

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openMenuId]);

  const MENU_ITEMS = ['Play', 'Shuffle', 'Add to queue', 'Share', 'Rename', 'Delete'];

  return (
    <div style={{ padding:'24px 32px 32px' }}>
      <div style={{ marginBottom:18 }}>
        <div style={eyebrow('#b983ff')}>● YOUR SAVED TRACKS · 247 SONGS · 18 PLAYLISTS</div>
        <h1 style={pageTitle}>Library</h1>
        <p style={pageSub}>Everything you've HYPEd, saved, or curated. Your library is yours.</p>
      </div>
      <div style={{ display:'flex', gap:4, padding:4, background:'var(--bg-2)', border:'1px solid var(--line)', borderRadius:8, marginBottom:20, width:'fit-content' }}>
        {(['saved','discover'] as const).map(k=>(
          <button key={k} onClick={()=>setTab(k)} type="button"
            style={{ padding:'7px 16px', borderRadius:5, fontFamily:'var(--f-m)', fontSize:11, letterSpacing:'.04em', border:'none', cursor:'pointer', background:tab===k?'var(--bg-3)':'transparent', color:tab===k?'var(--ink)':'var(--ink-3)' }}>
            {k==='saved'?'Saved':'Discover'}
          </button>
        ))}
      </div>

      {tab==='saved' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
            {playlists.map(p=>(
              <div key={p.n} style={{ position:'relative', padding:14, border:'1px solid var(--line)', borderRadius:10, background:'var(--bg-2)', cursor:'pointer' }}
                onClick={()=>setOpenMenuId(openMenuId===p.n ? null : p.n)}>
                <div style={{ aspectRatio:'1', borderRadius:6, background:`linear-gradient(135deg, ${p.c}, ${p.c}80)`, marginBottom:10 }}/>
                <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:14, color:'var(--ink)' }}>{p.n}</div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', marginTop:3 }}>{p.count} tracks</div>
                {openMenuId===p.n && (
                  <div ref={menuRef} style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:20, background:'var(--bg-3)', border:'1px solid var(--line-2)', borderRadius:8, minWidth:160, overflow:'hidden', boxShadow:'0 8px 24px rgba(0,0,0,.4)' }}>
                    {MENU_ITEMS.map(item=>(
                      <button key={item} type="button" onClick={(e)=>{e.stopPropagation();handleMenuItem(item);}}
                        style={{ display:'block', width:'100%', textAlign:'left', padding:'9px 14px', fontFamily:'var(--f-m)', fontSize:12, color:item==='Delete'?'#ff5029':'var(--ink)', background:'none', border:'none', cursor:'pointer', letterSpacing:'.02em' }}>
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={panel}>
            <div style={panelHead}><div style={panelTitle}>Recently played</div><button type="button" style={linkBtn}>See all</button></div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, padding:'14px 16px' }}>
              {TRACKS.slice(0,4).map(t=>(
                <button key={t.id} onClick={()=>onPickTrack(t.id)} type="button"
                  style={{ padding:8, border:`1px solid ${t.id===currentId?t.c:'var(--line)'}`, borderRadius:8, background:'var(--bg-3)', textAlign:'left', cursor:'pointer', transition:'border-color .2s' }}>
                  <div style={{ width:'100%', aspectRatio:'1', borderRadius:5, marginBottom:8, position:'relative', overflow:'hidden', background:`linear-gradient(135deg, ${t.c}, ${t.c}80)` }}>
                    <div style={{ position:'absolute', left:10, bottom:10, width:26, height:26, borderRadius:'50%', background:'var(--ink)', color:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}><IcPlay s={12}/></div>
                  </div>
                  <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:13, color:'var(--ink)' }}>{t.t}</div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', marginTop:3 }}>{t.a}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {tab==='discover' && (
        <div>
          <div style={{ marginBottom:16 }}>
            <div style={eyebrow('#ff5029')}>● HYPED THIS WEEK · 432 NEW TRACKS · CHICAGO IS HOT</div>
            <p style={pageSub}>Trending tracks from the artists, venues, and DJs in your scene.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {TRACKS.map(t=>(
              <button key={t.id} onClick={()=>onPickTrack(t.id)} type="button"
                style={{ padding:12, border:`1px solid ${t.id===currentId?t.c:'var(--line)'}`, borderRadius:10, background:'var(--bg-2)', textAlign:'left', cursor:'pointer', transition:'border-color .2s' }}>
                <div style={{ width:'100%', aspectRatio:'1', borderRadius:7, marginBottom:10, position:'relative', overflow:'hidden', background:`linear-gradient(135deg, ${t.c}, ${t.c}80)` }}>
                  <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 25% 25%, rgba(255,255,255,.25), transparent 65%)' }}/>
                  <div style={{ position:'absolute', left:10, bottom:10, width:28, height:28, borderRadius:'50%', background:'var(--ink)', color:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}><IcPlay s={12}/></div>
                  <div style={{ position:'absolute', right:8, top:8, padding:'2px 7px', background:'rgba(0,0,0,.5)', borderRadius:99, fontFamily:'var(--f-m)', fontSize:9, color:'#ff3e9a', display:'flex', alignItems:'center', gap:3 }}><IcHeart s={10} c="#ff3e9a"/> {t.h}</div>
                </div>
                <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:14, color:'var(--ink)' }}>{t.t}</div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', marginTop:3 }}>{t.a} · {t.d}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Radio view ────────────────────────────────────────────────────

function ViewRadio({ onPickTrack }:{ onPickTrack:(id:string)=>void }) {
  const [active, setActive] = useState('r1');
  const show = RADIO_SHOWS.find(r=>r.id===active)!;
  const freqs = ['88.3','94.1','101.7','107.9','104.5'];
  const idx = RADIO_SHOWS.findIndex(r=>r.id===active);

  return (
    <div style={{ padding:'24px 32px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24 }}>
        <div>
          <div style={eyebrow('#ff3e9a')}>● ON AIR · 5 CHANNELS · 1,080 LISTENING NOW</div>
          <h1 style={pageTitle}>Radio</h1>
          <p style={pageSub}>Curated shows from promoters, DJs, and artists. No ads, no algorithm — just real people picking music.</p>
        </div>
        <button type="button" style={{ padding:'9px 16px', border:'1px solid rgba(255,62,154,.4)', color:'#ff3e9a', borderRadius:6, fontFamily:'var(--f-m)', fontSize:12, fontWeight:600, letterSpacing:'.04em', display:'flex', alignItems:'center', gap:6, background:'transparent', cursor:'pointer' }}>
          <IcBolt s={12}/> Start your show →
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16 }}>
        {/* Channel list */}
        <div style={{ ...panel, alignSelf:'start' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.14em' }}>CHANNELS</div>
          {RADIO_SHOWS.map(r=>{
            const isActive = r.id===active;
            return (
              <button key={r.id} onClick={()=>setActive(r.id)} type="button"
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'1px solid var(--line)', textAlign:'left', cursor:'pointer', transition:'background .15s', background:isActive?`${r.c}10`:'transparent', borderLeft:`2px solid ${isActive?`${r.c}50`:'transparent'}` }}>
                <div style={{ width:3, height:32, borderRadius:2, flexShrink:0, background:r.c, opacity:r.live?1:.3 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:13, color:'var(--ink)', display:'flex', alignItems:'center', gap:8 }}>
                    {r.name}
                    {r.live && <span style={{ fontFamily:'var(--f-m)', fontSize:8, color:'#ff3e9a', letterSpacing:'.16em', padding:'1px 5px', border:'1px solid rgba(255,62,154,.4)', borderRadius:3 }}>LIVE</span>}
                  </div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em', marginTop:3 }}>{r.host} · {r.time}</div>
                </div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:11, color:'var(--ink-2)' }}>{r.listeners}</div>
              </button>
            );
          })}
          <div style={{ padding:'10px 14px', textAlign:'center' }}>
            <span style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.06em', cursor:'pointer' }}>+ Add station</span>
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ ...panel, padding:'24px 28px', background:`linear-gradient(135deg, ${show.c}30 0%, transparent 60%), var(--bg-2)` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              {show.live ? (
                <span style={{ fontFamily:'var(--f-m)', fontSize:10, color:'#ff3e9a', letterSpacing:'.14em', display:'flex', alignItems:'center', gap:6, padding:'4px 10px', border:'1px solid rgba(255,62,154,.3)', borderRadius:99 }}>
                  <IcDot c="#ff3e9a" s={8}/> ON AIR · {show.listeners} listening
                </span>
              ) : (
                <span style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.14em' }}>NEXT BROADCAST · {show.next}</span>
              )}
              <span style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:18, color:'var(--ink-2)' }}>{freqs[idx]} MHz</span>
            </div>
            <h2 style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:34, letterSpacing:'-.025em', lineHeight:1, margin:0, color:'var(--ink)' }}>{show.name}</h2>
            <div style={{ fontFamily:'var(--f-m)', fontSize:11, color:'var(--ink-2)', letterSpacing:'.06em', marginTop:8 }}>Hosted by <strong>{show.host}</strong> · {show.time}</div>
            <p style={{ fontFamily:'var(--f-b)', fontSize:14, color:'var(--ink-2)', marginTop:14, maxWidth:540, lineHeight:1.55 }}>{show.desc}</p>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              {show.live ? (
                <button type="button" style={{ ...btnPrime, display:'flex', alignItems:'center', gap:6, background:show.c, color:'var(--bg)' }}><IcPlay s={12}/> Tune in</button>
              ) : (
                <button type="button" style={{ ...btnPrime, display:'flex', alignItems:'center', gap:6 }}><IcPlay s={12}/> Pre-roll archive</button>
              )}
              <button type="button" style={btnGhost}>♡ Subscribe</button>
              <button type="button" style={{ ...btnGhost, display:'flex', alignItems:'center', gap:6 }}><IcHeart s={12} c="#ff3e9a"/> HYPE show</button>
            </div>
          </div>

          {/* Set list */}
          <div style={panel}>
            <div style={panelHead}>
              <div>
                <div style={panelTitle}>Set list · this broadcast</div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em', marginTop:3 }}>{show.live?'Played in the last hour':'Played last show'}</div>
              </div>
              <button type="button" style={linkBtn}>Save all to playlist →</button>
            </div>
            <div>
              {TRACKS.slice(0,6).map((t,i)=>(
                <button key={t.id} onClick={()=>onPickTrack(t.id)} type="button"
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'10px 18px', textAlign:'left', background:'transparent', border:'none', cursor:'pointer', borderBottom:'1px solid var(--line)' }}>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:11, color:'var(--ink-3)', width:22 }}>{String(i+1).padStart(2,'0')}</div>
                  <div style={{ width:34, height:34, borderRadius:4, flexShrink:0, background:`linear-gradient(135deg, ${t.c}, ${t.c}80)` }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'var(--f-d)', fontWeight:600, fontSize:13, color:'var(--ink)' }}>{t.t}</div>
                    <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em', marginTop:2 }}>{t.a} · {t.album}</div>
                  </div>
                  <div style={{ padding:'2px 8px', background:'var(--bg-3)', borderRadius:3, fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-2)', letterSpacing:'.08em' }}>
                    {i===0&&show.live?'NOW':i<2?'JUST PLAYED':`-${i*4}m`}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontFamily:'var(--f-m)', fontSize:11, color:'#ff3e9a', width:50, justifyContent:'flex-end' }}>
                    <IcHeart s={10} c="#ff3e9a"/> {t.h}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ticketing view ────────────────────────────────────────────────

function ViewTicketing() {
  const [tab, setTab] = useState<'mine'|'selling'|'scan'|'browse'>('mine');
  return (
    <div style={{ padding:'24px 32px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:22, gap:24 }}>
        <div>
          <div style={eyebrow('#22e5d4')}>● 3 TICKETS · 1 TONIGHT · NO QUEUES, NO SCALPERS</div>
          <h1 style={pageTitle}>Live Events</h1>
          <p style={pageSub}>Buy, hold, transfer, and verify tickets — all without leaving iHYPE. Wallet entries are signed to your account; venues scan QR at the door.</p>
        </div>
        <div style={{ display:'flex', gap:4, padding:4, background:'var(--bg-2)', border:'1px solid var(--line)', borderRadius:8, flexShrink:0 }}>
          {(['mine','selling','scan','browse'] as const).map((k,i)=>(
            <button key={k} onClick={()=>setTab(k)} type="button"
              style={{ padding:'7px 12px', borderRadius:5, fontFamily:'var(--f-m)', fontSize:11, letterSpacing:'.04em', border:'none', cursor:'pointer', background:tab===k?'var(--bg-3)':'transparent', color:tab===k?'var(--ink)':'var(--ink-3)' }}>
              {['My tickets','Selling','Scan / verify','Browse'][i]}
            </button>
          ))}
        </div>
      </div>

      {tab==='mine' && (
        <>
          {/* Hero ticket */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.16em', marginBottom:10 }}>NEXT UP</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 200px', gap:32, padding:'24px 28px', border:'1px solid var(--line)', borderRadius:12, background:`linear-gradient(135deg, rgba(255,80,41,.15) 0%, transparent 60%), var(--bg-2)` }}>
              <div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'#22e5d4', letterSpacing:'.14em', display:'flex', alignItems:'center', gap:6 }}>
                  <IcDot c="#22e5d4" s={7}/> CONFIRMED · DOORS 7:30 PM
                </div>
                <h2 style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:32, letterSpacing:'-.025em', margin:'10px 0 4px', color:'var(--ink)' }}>
                  Maya Reyes <span style={{ color:'var(--ink-2)', fontWeight:500 }}>@ Empty Bottle</span>
                </h2>
                <div style={{ fontFamily:'var(--f-m)', fontSize:12, color:'var(--ink-2)', letterSpacing:'.06em' }}>Thursday, June 18 · 9:00 PM</div>
                <div style={{ display:'flex', gap:30, marginTop:20, paddingTop:20, borderTop:'1px solid var(--line)' }}>
                  {[['SEAT','General Admission'],['PAID','$18.00'],['ENTRY CODE','iH-MR18-K3X9']].map(([l,v])=>(
                    <div key={l}><div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)', letterSpacing:'.16em', marginBottom:6 }}>{l}</div><div style={{ fontFamily:'var(--f-d)', fontWeight:600, fontSize:14, color:'var(--ink)' }}>{v}</div></div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:22, flexWrap:'wrap' }}>
                  <button type="button" style={btnPrime}>Show at door →</button>
                  <button type="button" style={btnGhost}>Transfer</button>
                  <button type="button" style={btnGhost}>Add to Wallet</button>
                  <button type="button" style={{ ...btnGhost, borderColor:'rgba(255,80,41,.3)', color:'#ff5029' }}>Request refund</button>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10 }}>
                <div style={{ padding:14, background:'var(--ink)', color:'var(--bg)', borderRadius:8 }}><IcQR s={140}/></div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)', letterSpacing:'.06em', textAlign:'center', maxWidth:140 }}>Signed by iHYPE · scan with venue app</div>
              </div>
            </div>
          </div>
          {/* Ticket list */}
          <div style={panel}>
            <div style={panelHead}><div style={panelTitle}>All my tickets</div><div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em' }}>3 active</div></div>
            {MY_TICKETS.map(tk=>(
              <div key={tk.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom:'1px solid var(--line)' }}>
                <div style={{ width:3, height:40, background:'var(--accent)', borderRadius:2 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:14, color:'var(--ink)' }}>{tk.show}</div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em', marginTop:3 }}>{tk.date}</div>
                </div>
                <div style={{ minWidth:80 }}><div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)', letterSpacing:'.14em', marginBottom:3 }}>SEAT</div><div style={{ fontFamily:'var(--f-d)', fontWeight:600, fontSize:13, color:'var(--ink)' }}>{tk.seat}</div></div>
                <div style={{ minWidth:80 }}><div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)', letterSpacing:'.14em', marginBottom:3 }}>PAID</div><div style={{ fontFamily:'var(--f-d)', fontWeight:600, fontSize:13, color:'var(--ink)' }}>${tk.price}</div></div>
                {tk.qr && <div style={{ fontFamily:'var(--f-m)', fontSize:11, color:'var(--ink-2)', letterSpacing:'.05em' }}>{tk.qr}</div>}
                <div style={{ padding:'4px 10px', border:`1px solid ${tk.status==='CONFIRMED'?'rgba(34,229,212,.3)':'rgba(255,184,74,.3)'}`, borderRadius:99, fontFamily:'var(--f-m)', fontSize:10, letterSpacing:'.08em', color:tk.status==='CONFIRMED'?'#22e5d4':'#ffb84a' }}>{tk.status}</div>
                <button type="button" style={{ color:'var(--ink-3)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }}><IcArrow s={12}/></button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab==='selling' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              { l:'TICKETS SOLD',   v:'184',    d:'across 4 shows',  c:'#22e5d4' },
              { l:'GROSS',          v:'$3,128',  d:'this month',      c:'#22e5d4' },
              { l:'ARTIST SHARE',   v:'45%',     d:'per ticket sold',  c:'#b983ff' },
              { l:'PAYOUT PENDING', v:'$2,460',  d:'releases Jun 24', c:'#ffb84a' },
            ].map(s=>(
              <div key={s.l} style={{ padding:'14px 16px', border:'1px solid var(--line)', borderRadius:10, background:'var(--bg-2)' }}>
                <div style={{ fontFamily:'var(--f-m)', fontSize:9, letterSpacing:'.16em', color:'var(--ink-3)', textTransform:'uppercase', marginBottom:8 }}>{s.l}</div>
                <div style={{ fontFamily:'var(--f-d)', fontSize:26, fontWeight:700, color:'var(--ink)' }}>{s.v}</div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:10, marginTop:6, color:s.c }}>{s.d}</div>
              </div>
            ))}
          </div>
          <div style={panel}>
            <div style={panelHead}><div style={panelTitle}>Shows on sale</div><button type="button" style={btnPrime}>+ New show</button></div>
            {SHOWS.map(s=>(
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom:'1px solid var(--line)' }}>
                <div style={{ width:3, height:40, background:'var(--accent)', borderRadius:2 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:14, color:'var(--ink)' }}>{s.name} <span style={{ color:'var(--ink-3)' }}>· {s.venue}</span></div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em', marginTop:3 }}>{s.date} · {s.time}</div>
                </div>
                <div style={{ minWidth:120 }}>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)', letterSpacing:'.14em', marginBottom:4 }}>SOLD</div>
                  <div style={{ width:80, height:3, background:'rgba(255,255,255,.06)', borderRadius:2, position:'relative', overflow:'hidden', marginBottom:4 }}>
                    <div style={{ position:'absolute', inset:0, width:`${s.sold/s.cap*100}%`, background:s.sold/s.cap>0.85?'#ffb84a':'#22e5d4', borderRadius:2 }}/>
                  </div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)' }}>{s.sold} / {s.cap}</div>
                </div>
                <div style={{ minWidth:60 }}><div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)', letterSpacing:'.14em', marginBottom:3 }}>PRICE</div><div style={{ fontFamily:'var(--f-d)', fontWeight:600, fontSize:13, color:'var(--ink)' }}>${s.price}</div></div>
                <div style={{ minWidth:70 }}><div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)', letterSpacing:'.14em', marginBottom:3 }}>GROSS</div><div style={{ fontFamily:'var(--f-d)', fontWeight:600, fontSize:13, color:'var(--ink)' }}>${(s.sold*s.price).toLocaleString()}</div></div>
                <button type="button" style={{ padding:'7px 12px', border:'1px solid var(--line-2)', borderRadius:5, fontFamily:'var(--f-m)', fontSize:11, color:'var(--ink-2)', background:'transparent', cursor:'pointer' }}>Manage →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='scan' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:24, border:'1px solid var(--line)', borderRadius:12, padding:'28px', background:'var(--bg-2)' }}>
          <div>
            <div style={eyebrow('#22e5d4')}>● VENUE MODE · EMPTY BOTTLE · GATE 1</div>
            <h2 style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:28, letterSpacing:'-.025em', margin:'0 0 12px', color:'var(--ink)' }}>Door scanner</h2>
            <p style={pageSub}>Point a phone camera at the QR. Valid tickets show a green check; transferred tickets reveal the original buyer. Replays are blocked at the protocol layer.</p>
            <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { code:'iH-MR18-K3X9', meta:'Maya Reyes · GA · admitted 21:04', status:'VALID', c:'#22e5d4' },
                { code:'iH-MR18-7QQR', meta:'Transferred from J.Park 14m ago · GA · admitted 21:06', status:'VALID', c:'#22e5d4' },
                { code:'iH-MR18-9BLN', meta:'Already scanned at 20:51 · blocked', status:'REPLAY', c:'#ff5029' },
              ].map((row,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', border:'1px solid var(--line)', borderRadius:8, background:'var(--bg-3)', borderLeft:`2px solid ${row.c}` }}>
                  <span style={{ color:row.c }}>{row.status==='VALID'?'✓':'✗'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'var(--f-m)', fontSize:12, color:'var(--ink)', letterSpacing:'.04em' }}>{row.code}</div>
                    <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', marginTop:2 }}>{row.meta}</div>
                  </div>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:11, color:row.c, letterSpacing:'.08em' }}>{row.status}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16, alignItems:'center' }}>
            <div style={{ width:200, height:200, border:'2px solid var(--line-2)', borderRadius:12, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', flexDirection:'column', gap:8 }}>
              <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.1em' }}>Ready for QR</div>
              <div style={{ position:'absolute', top:8, left:8, width:20, height:20, borderTop:'2px solid var(--accent)', borderLeft:'2px solid var(--accent)', borderRadius:'4px 0 0 0' }}/>
              <div style={{ position:'absolute', top:8, right:8, width:20, height:20, borderTop:'2px solid var(--accent)', borderRight:'2px solid var(--accent)', borderRadius:'0 4px 0 0' }}/>
              <div style={{ position:'absolute', bottom:8, left:8, width:20, height:20, borderBottom:'2px solid var(--accent)', borderLeft:'2px solid var(--accent)', borderRadius:'0 0 0 4px' }}/>
              <div style={{ position:'absolute', bottom:8, right:8, width:20, height:20, borderBottom:'2px solid var(--accent)', borderRight:'2px solid var(--accent)', borderRadius:'0 0 4px 0' }}/>
            </div>
            <div style={{ display:'flex', gap:20 }}>
              {[['ADMITTED','148'],['WAITING','23'],['BLOCKED','2']].map(([l,v])=>(
                <div key={l} style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)', letterSpacing:'.14em', marginBottom:3 }}>{l}</div>
                  <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:18, color:l==='BLOCKED'?'#ff5029':'var(--ink)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==='browse' && (
        <div>
          <div style={{ marginBottom:22 }}>
            <div style={eyebrow('#22e5d4')}>● 7 TONIGHT · 23 THIS WEEK · CHICAGO</div>
            <p style={pageSub}>Live events in your city. No platform fee. Tickets settle at the door.</p>
          </div>
          <div style={panel}>
            {SHOWS.map((s,i)=>{
              const sc = s.status==='TONIGHT'?'#22e5d4':s.status==='NEAR SOLD'?'#ffb84a':'var(--ink-3)';
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 20px', borderBottom:'1px solid var(--line)' }}>
                  <div style={{ width:3, height:48, borderRadius:2, flexShrink:0, background:sc }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:16, color:'var(--ink)' }}>{s.name} <span style={{ color:'var(--ink-3)', fontWeight:500 }}>· {s.venue}</span></div>
                    <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', marginTop:3 }}>{s.date} · {s.time} · ♡ {s.hype}</div>
                  </div>
                  <div style={{ minWidth:100 }}>
                    <div style={{ width:80, height:3, background:'rgba(255,255,255,.06)', borderRadius:2, overflow:'hidden', marginBottom:4 }}>
                      <div style={{ height:'100%', width:`${s.sold/s.cap*100}%`, background:s.sold/s.cap>0.85?'#ffb84a':'#22e5d4', borderRadius:2 }}/>
                    </div>
                    <div style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)' }}>{s.sold}/{s.cap} capacity</div>
                  </div>
                  <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:18, color:'var(--ink)' }}>${s.price}</div>
                  <button type="button" style={btnPrime}>Get ticket</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Studio / Create event view ────────────────────────────────────

function ViewStudio() {
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [doorsTime, setDoorsTime] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [desc, setDesc] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const previewDate = date && startTime
    ? new Date(`${date}T${startTime}`).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })
    : 'Date · Time';
  const previewPrice = price && Number(price) > 0 ? `$${Number(price).toFixed(2)}` : 'Free';
  const previewCap = capacity ? `0 / ${capacity} capacity` : '0 / — capacity';

  const field: React.CSSProperties = { width:'100%', padding:'9px 12px', background:'var(--bg-3)', border:'1px solid var(--line-2)', borderRadius:6, fontFamily:'var(--f-m)', fontSize:13, color:'var(--ink)', outline:'none', boxSizing:'border-box' as const };
  const label: React.CSSProperties = { fontFamily:'var(--f-m)', fontSize:10, letterSpacing:'.12em', color:'var(--ink-3)', marginBottom:6, display:'block' };
  const group: React.CSSProperties = { display:'flex', flexDirection:'column' as const };

  if (submitted) return (
    <div style={{ padding:'24px 32px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400, gap:16, textAlign:'center' }}>
      <div style={{ fontSize:40 }}>🎉</div>
      <h2 style={pageTitle}>{name || 'Your event'}</h2>
      <p style={pageSub}>Your event would be published here. Sign in to go live.</p>
      <button type="button" style={btnPrime} onClick={() => { setSubmitted(false); setName(''); setVenue(''); setDate(''); setStartTime(''); setPrice(''); setCapacity(''); setDesc(''); }}>
        Create another
      </button>
    </div>
  );

  return (
    <div style={{ padding:'24px 32px 32px' }}>
      <div style={{ marginBottom:22 }}>
        <div style={eyebrow('#ff5029')}>● CREATE · YOUR SCENE · ARTIST SHARE · 45%</div>
        <h1 style={pageTitle}>Create an event</h1>
        <p style={pageSub}>Publish a show, set your ticket price, and sell directly to fans. iHYPE takes nothing.</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:16, alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={panel}>
            <div style={panelHead}><div style={panelTitle}>Event details</div></div>
            <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={group}><label style={label}>EVENT NAME</label><input style={field} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Maya Reyes — Halflight Release Show" /></div>
              <div style={group}><label style={label}>VENUE</label><input style={field} value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Empty Bottle, Chicago IL" /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={group}><label style={label}>DATE</label><input type="date" style={field} value={date} onChange={e=>setDate(e.target.value)} /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div style={group}><label style={label}>DOORS</label><input type="time" style={field} value={doorsTime} onChange={e=>setDoorsTime(e.target.value)} /></div>
                  <div style={group}><label style={label}>START</label><input type="time" style={field} value={startTime} onChange={e=>setStartTime(e.target.value)} /></div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={group}><label style={label}>TICKET PRICE ($)</label><input type="number" min="0" style={field} value={price} onChange={e=>setPrice(e.target.value)} placeholder="0 = free" /></div>
                <div style={group}><label style={label}>CAPACITY</label><input type="number" min="1" style={field} value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="200" /></div>
              </div>
              <div style={group}><label style={label}>DESCRIPTION</label><textarea rows={4} style={{ ...field, resize:'vertical' as const }} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What should fans know? Vibe, lineup notes, age restriction, parking…" /></div>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ ...panel, padding:'18px 16px' }}>
            <div style={{ fontFamily:'var(--f-m)', fontSize:10, letterSpacing:'.14em', color:'var(--ink-3)', marginBottom:12 }}>PREVIEW</div>
            <div style={{ aspectRatio:'16/9', borderRadius:8, background:'linear-gradient(135deg, #ff5029, #ff3e9a80)', marginBottom:14 }}/>
            <div style={{ fontFamily:'var(--f-d)', fontWeight:800, fontSize:18, color:'var(--ink)' }}>{name || 'Your event name'}</div>
            <div style={{ fontFamily:'var(--f-m)', fontSize:11, color:'var(--ink-3)', marginTop:4 }}>{venue || 'Venue'} · {previewDate}</div>
            <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'var(--f-m)', fontSize:11, color:'var(--ink-2)' }}>{previewCap}</span>
              <span style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:16, color:'var(--ink)' }}>{previewPrice}</span>
            </div>
          </div>
          <button type="button" onClick={() => name.trim() && setSubmitted(true)} style={{ ...btnPrime, width:'100%', padding:'12px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <IcBolt s={13}/> Publish event →
          </button>
          <p style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', textAlign:'center', lineHeight:1.6 }}>
            iHYPE takes 0% of ticket revenue. Fans pay face value, you keep everything.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Settings view ─────────────────────────────────────────────────

const ACCENTS = [
  { v:'#ff5029', label:'Ember' }, { v:'#ff3e9a', label:'Hot pink' },
  { v:'#b983ff', label:'Lilac' }, { v:'#22e5d4', label:'Aqua' },
  { v:'#ffb84a', label:'Amber' }, { v:'#7fb3ff', label:'Sky' },
];

function ViewSettings({ accent, setAccent, density, setDensity, queueRail, setQueueRail }:{
  accent:string; setAccent:(v:string)=>void;
  density:string; setDensity:(v:string)=>void;
  queueRail:boolean; setQueueRail:(v:boolean)=>void;
}) {
  const sec: React.CSSProperties = { padding:'18px 20px', border:'1px solid var(--line)', borderRadius:10, background:'var(--bg-2)', display:'flex', flexDirection:'column', gap:14 };
  const secTitle: React.CSSProperties = { fontFamily:'var(--f-d)', fontWeight:700, fontSize:14, color:'var(--ink)', marginBottom:2 };
  const secSub: React.CSSProperties = { fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.08em' };
  const seg = (k:string): React.CSSProperties => ({ padding:'7px 14px', border:'none', borderRadius:5, fontFamily:'var(--f-m)', fontSize:11, cursor:'pointer', background: density===k?'var(--bg-3)':'transparent', color: density===k?'var(--ink)':'var(--ink-3)' });
  const toggle: React.CSSProperties = { width:36, height:20, borderRadius:99, border:'none', cursor:'pointer', position:'relative', background: queueRail?'var(--accent)':'rgba(255,255,255,.1)', transition:'background .2s', flexShrink:0 };
  return (
    <div style={{ padding:'24px 32px 32px', maxWidth:900 }}>
      <div style={{ marginBottom:28 }}>
        <div style={eyebrow()}>● PERSONAL · THIS BROWSER</div>
        <h1 style={pageTitle}>Settings <span style={{ color:'var(--ink-2)', fontWeight:400 }}>· page customization</span></h1>
        <p style={pageSub}>Make iHYPE feel like yours. Changes apply live.</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div style={sec}>
          <div><div style={secTitle}>Accent colour</div><div style={secSub}>Highlights, player, active nav</div></div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ACCENTS.map(c=>(
              <button key={c.v} onClick={()=>setAccent(c.v)} type="button"
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'8px 10px', border:`1px solid ${accent===c.v?c.v:'var(--line)'}`, borderRadius:8, background:'var(--bg-3)', cursor:'pointer', position:'relative' }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:c.v }}/>
                <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink)' }}>{c.label}</div>
                {accent===c.v && <IcCheck s={11}/>}
              </button>
            ))}
          </div>
        </div>
        <div style={sec}>
          <div><div style={secTitle}>Density</div><div style={secSub}>Tighter = more on screen</div></div>
          <div style={{ display:'flex', gap:4, padding:4, background:'var(--bg-3)', border:'1px solid var(--line)', borderRadius:7 }}>
            {(['compact','cozy','comfy'] as const).map(k=>(
              <button key={k} onClick={()=>setDensity(k)} type="button" style={seg(k)}>
                {k==='compact'?'Compact':k==='cozy'?'Cozy':'Comfortable'}
              </button>
            ))}
          </div>
          <div><div style={secTitle}>Queue rail</div><div style={secSub}>Right-hand track list</div></div>
          <button onClick={()=>setQueueRail(!queueRail)} type="button" style={toggle}>
            <div style={{ position:'absolute', top:3, left:queueRail?18:3, width:14, height:14, borderRadius:'50%', background:'var(--ink)', transition:'left .2s' }}/>
          </button>
        </div>
      </div>
      <div style={{ marginTop:16, fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em' }}>
        Preferences live in this browser's localStorage. Sign in to sync across devices.
      </div>
    </div>
  );
}

// ── Discover / Seeds view ─────────────────────────────────────────

function ViewSeeds() {
  const tracks: SeedsSwipeStackTrack[] = TRACKS.map(t => ({
    id: t.id, title: t.t, artistName: t.a, album: t.album,
    color: t.c, durationLabel: t.d, hypeCount: t.h,
  }));
  const seeds: SeedsSwipeStackSeed[] = [];

  return (
    <SeedsSwipeStack
      seeds={seeds}
      tracks={tracks}
      onSave={(seed) => fetch(`/api/discover/seeds/${seed.id}/save`, { method: 'POST' })}
      onSkip={(seed) => fetch(`/api/discover/seeds/${seed.id}/skip`, { method: 'POST' })}
      onHype={(seed) => fetch(`/api/discover/seeds/${seed.id}/hype`, { method: 'POST' })}
    />
  );
}

// ── Queue rail ────────────────────────────────────────────────────

function QueueRail({ onPickTrack, currentId }:{ onPickTrack:(id:string)=>void; currentId:string|null }) {
  return (
    <aside style={{ width:'var(--queue-w)', borderLeft:'1px solid var(--line)', display:'flex', flexDirection:'column', background:'var(--bg)', overflow:'hidden', flexShrink:0 }}>
      <div style={{ padding:'18px 20px 12px', display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:'var(--f-d)', fontWeight:700, fontSize:15, letterSpacing:'-.005em', color:'var(--ink)' }}>Queue</div>
          <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em', marginTop:3 }}>This week's playlist · 8 tracks · 28 min</div>
        </div>
        <button type="button" style={linkBtn}>Edit</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
        {TRACKS.map(t=>{
          const active = t.id===currentId;
          return (
            <button key={t.id} onClick={()=>onPickTrack(t.id)} type="button"
              style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:6, border:'none', cursor:'pointer', transition:'background .15s', background:active?'rgba(255,255,255,.04)':'transparent' }}>
              <div style={{ width:34, height:34, borderRadius:4, flexShrink:0, position:'relative', overflow:'hidden', background:`linear-gradient(135deg, ${t.c}, ${t.c}80)` }}>
                {active && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.4)' }}><div style={{ width:6, height:6, borderRadius:'50%', background:t.c }}/></div>}
              </div>
              <div style={{ minWidth:0, flex:1, textAlign:'left' }}>
                <div style={{ fontFamily:'var(--f-b)', fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--ink)' }}>{t.t}</div>
                <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', letterSpacing:'.04em', marginTop:2 }}>{t.a}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:3, fontFamily:'var(--f-m)', fontSize:10, color:'#ff3e9a' }}><IcHeart s={10} c="#ff3e9a"/> {t.h}</div>
              <div style={{ fontFamily:'var(--f-m)', fontSize:10, color:'var(--ink-3)', width:30, textAlign:'right' }}>{t.d}</div>
            </button>
          );
        })}
      </div>
      <div style={{ padding:'14px 20px 18px', borderTop:'1px solid var(--line)', flexShrink:0 }}>
        <span style={{ fontFamily:'var(--f-m)', fontSize:9, color:'var(--ink-3)', letterSpacing:'.14em' }}>CURATED BY</span>
        <div style={{ fontFamily:'var(--f-s)', fontStyle:'italic', fontSize:18, marginTop:4, color:'var(--ink)' }}>DJ Vex · Chicago Underground</div>
      </div>
    </aside>
  );
}

// ── Root ──────────────────────────────────────────────────────────

const LS = 'ihype-wb-demo-prefs';

export default function WorkbenchPage() {
  const [view, setView] = useState<View>('home');
  const { data: session } = useSession();
  const { playTrack, currentTrack } = useMediaPlayer();

  const [accent, setAccentRaw] = useState('#ff5029');
  const [density, setDensityRaw] = useState('cozy');
  const [queueRail, setQueueRailRaw] = useState(true);

  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS) ?? '{}');
      if (stored.accent) setAccentRaw(stored.accent);
      if (stored.density) setDensityRaw(stored.density);
      if (stored.queueRail !== undefined) setQueueRailRaw(stored.queueRail);
    } catch {}
  }, []);

  // Persist and apply CSS vars whenever prefs change
  React.useEffect(() => {
    try { localStorage.setItem(LS, JSON.stringify({ accent, density, queueRail })); } catch {}
    document.documentElement.style.setProperty('--accent', accent);
    const dm = density === 'compact' ? 0.85 : density === 'comfy' ? 1.15 : 1;
    document.documentElement.style.setProperty('--density', String(dm));
    document.documentElement.style.setProperty('--queue-w', queueRail ? '300px' : '0px');
  }, [accent, density, queueRail]);

  const setAccent = (v: string) => setAccentRaw(v);
  const setDensity = (v: string) => setDensityRaw(v);
  const setQueueRail = (v: boolean) => setQueueRailRaw(v);

  const handlePickTrack = useCallback((id: string) => {
    const t = TRACKS.find(x=>x.id===id);
    if (!t) return;
    playTrack({ id:t.id, title:t.t, artistName:t.a, url:'', artworkUrl:null, mediaId:null }, MEDIA_TRACKS);
  }, [playTrack]);

  const currentId = currentTrack?.id ?? null;

  return (
    <>
      <style>{`@keyframes wb-fadein { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} } .wb-main{animation:wb-fadein .18s ease;}`}</style>
      <div className="wb-wrap">
        {/* Sidebar */}
        <aside style={{ width:'var(--rail-w)', borderRight:'1px solid var(--line)', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:8, background:'var(--bg)', flexShrink:0 }}>
          <div style={{ width:34, height:34, borderRadius:8, background:'linear-gradient(135deg,#ff5029,#ff3e9a)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--f-d)', fontWeight:800, fontSize:13, color:'var(--bg)', marginBottom:6 }}>iH</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center', marginTop:8 }}>
            {NAV_ITEMS.map(n=>(
              <SidebarBtn key={n.id} active={view===n.id} onClick={()=>setView(n.id as View)} label={n.label}>{n.icon}</SidebarBtn>
            ))}
          </div>
          <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
            <SidebarBtn active={view==='settings'} onClick={()=>setView('settings')} label="Settings" accent="var(--ink-2)"><IcSettings s={16}/></SidebarBtn>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#b983ff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--f-d)', fontWeight:700, fontSize:11, color:'var(--bg)' }} title={session?.user?.name??'Profile'}>
              {session?.user?.name?.charAt(0).toUpperCase()??'U'}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main key={view} className="wb-main">
          {view==='home'     && <ViewHome session={session} onPickTrack={handlePickTrack} currentId={currentId} setView={setView}/>}
          {view==='library'  && <ViewLibrary onPickTrack={handlePickTrack} currentId={currentId}/>}
          {view==='radio'    && <ViewRadio onPickTrack={handlePickTrack}/>}
          {view==='tickets'  && <ViewTicketing/>}

          {view==='discover' && <ViewSeeds/>}
          {view==='studio'   && <ViewStudio/>}
          {view==='settings' && <ViewSettings accent={accent} setAccent={setAccent} density={density} setDensity={setDensity} queueRail={queueRail} setQueueRail={setQueueRail}/>}
        </main>

        {/* Queue */}
        {queueRail && <QueueRail onPickTrack={handlePickTrack} currentId={currentId}/>}
      </div>
    </>
  );
}
