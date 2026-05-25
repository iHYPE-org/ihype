'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';

// ── Types ──────────────────────────────────────────────────────
type GamifiedSeed = {
  id: string;
  title: string;
  artist: string;
  city: string;
  vibe: string;
  gradient: string;
  dark: boolean;
  hypers: Array<[string, string]>; // [initials, hex]
  hypedCount: number;
};

type SessionStats = { hyped: number; skipped: number; saved: number; xpEarned: number };

// ── Colours ────────────────────────────────────────────────────
const C = {
  accent: '#ff5029', pink: '#ff3e9a', teal: '#22e5d4',
  purple: '#b983ff', amber: '#ffb84a', blue: '#7fb3ff',
} as const;

// ── Level names ────────────────────────────────────────────────
const LEVELS = [
  'LISTENER', 'LURKER', 'SEEKER', 'SCOUT', 'TASTE BUD',
  'EAR', 'EAR FOR IT', 'CURATOR', 'TASTEMAKER', 'ORACLE',
];

// XP to level up
const XP_MAX = 1000;

// Waveform heights — deterministic so they're stable across renders
const WAVE_HEIGHTS = Array.from({ length: 60 }, (_, i) =>
  Math.min(36, 6 + Math.abs(Math.sin(i * 1.2) * 22 + Math.cos(i * 0.7) * 14))
);

// ── Seed deck ──────────────────────────────────────────────────
const SEED_DECK: GamifiedSeed[] = [
  { id: 's1', title: 'Halflight',         artist: 'Maya Reyes',    city: 'CHICAGO',   vibe: 'INDIE FOLK · SLOWCORE',       gradient: `linear-gradient(135deg, ${C.pink}, ${C.accent})`,   dark: false, hypers: [['MC', C.teal], ['SR', C.purple], ['NK', C.amber]], hypedCount: 412 },
  { id: 's2', title: 'Cobalt Hour',        artist: 'Vela',          city: 'CHICAGO',   vibe: 'DREAM POP',                   gradient: `linear-gradient(135deg, ${C.teal}, ${C.blue})`,    dark: false, hypers: [['EV', C.accent], ['SR', C.purple]], hypedCount: 341 },
  { id: 's3', title: 'Riverside Memory',   artist: 'Colin Atwood',  city: 'MILWAUKEE', vibe: 'SOFT ROCK · CINEMATIC',       gradient: `linear-gradient(135deg, ${C.purple}, ${C.pink})`,  dark: false, hypers: [['MC', C.teal]], hypedCount: 284 },
  { id: 's4', title: 'Bowery 3am',         artist: 'Pearl Cassette',city: 'BROOKLYN',  vibe: 'NIGHTCORE · NOIR',            gradient: 'linear-gradient(135deg, #1a1612, #2a2218)',        dark: true,  hypers: [['NK', C.amber], ['EV', C.accent]], hypedCount: 298 },
  { id: 's5', title: 'Glasshouse',         artist: 'June Mire',     city: 'CHICAGO',   vibe: 'EXPERIMENTAL · MIDWEST',      gradient: `linear-gradient(135deg, ${C.amber}, ${C.accent})`,dark: false, hypers: [['SR', C.purple], ['MC', C.teal], ['NK', C.amber]], hypedCount: 192 },
  { id: 's6', title: 'Long Highway',       artist: 'June Mire',     city: 'CHICAGO',   vibe: 'AMERICANA · DRIVING',         gradient: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,  dark: false, hypers: [['MC', C.teal]], hypedCount: 88 },
  { id: 's7', title: 'Carbon Blue',        artist: 'Vex',           city: 'DETROIT',   vibe: 'POST-PUNK',                   gradient: `linear-gradient(135deg, ${C.purple}, ${C.blue})`,  dark: false, hypers: [['NK', C.amber]], hypedCount: 212 },
  { id: 's8', title: 'Slow Drift',         artist: 'The Hightones', city: 'NASHVILLE', vibe: 'COUNTRY · ATMOSPHERIC',       gradient: `linear-gradient(135deg, ${C.teal}, ${C.pink})`,    dark: false, hypers: [['SR', C.purple], ['EV', C.accent]], hypedCount: 158 },
];

// ── Prop types (accepts real seed/track data from parent) ──────
export type SeedsGamifiedSeed = {
  id: string;
  title: string;
  artistName: string;
  city?: string;
  vibe?: string;
  color: string;
  hypedCount?: number;
};

type Props = {
  /** Real seeds from the API — if empty, falls back to the built-in deck */
  seeds?: SeedsGamifiedSeed[];
  onHype?: (id: string) => void;
  onSave?: (id: string) => void;
  onSkip?: (id: string) => void;
};

// ── Main component ─────────────────────────────────────────────
export const SeedsGamifiedView = memo(function SeedsGamifiedView({ seeds: apiSeeds, onHype, onSave, onSkip }: Props) {
  // Resolve deck: prefer API seeds, fall back to built-ins
  const deck = useMemo<GamifiedSeed[]>(() => {
    if (apiSeeds && apiSeeds.length > 0) {
      return apiSeeds.map((s, i) => ({
        id: s.id,
        title: s.title,
        artist: s.artistName,
        city: s.city ?? 'CHICAGO',
        vibe: s.vibe ?? SEED_DECK[i % SEED_DECK.length].vibe,
        gradient: `linear-gradient(135deg, ${s.color}, ${s.color}bb)`,
        dark: false,
        hypers: SEED_DECK[i % SEED_DECK.length].hypers,
        hypedCount: s.hypedCount ?? SEED_DECK[i % SEED_DECK.length].hypedCount,
      }));
    }
    return SEED_DECK;
  }, [apiSeeds]);

  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useState<'hype' | 'skip' | 'save' | 'deep' | null>(null);
  const [xp, setXp] = useState(420);
  const [level, setLevel] = useState(7);
  const [xpEarned, setXpEarned] = useState(0);
  const [combo, setCombo] = useState(0);
  const [stats, setStats] = useState<SessionStats>({ hyped: 0, skipped: 0, saved: 0, xpEarned: 0 });
  const [questNum, setQuestNum] = useState(3);
  const [levelUp, setLevelUp] = useState(false);
  const [xpPops, setXpPops] = useState<Array<{ id: number; text: string; color: string }>>([]);
  const [comboMsg, setComboMsg] = useState<{ text: string; sub: string } | null>(null);
  const [sessionStart] = useState(Date.now);
  const [sessionTime, setSessionTime] = useState('0:00');
  const popIdRef = useRef(0);

  // Session timer
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - sessionStart) / 1000);
      setSessionTime(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, [sessionStart]);

  const seed = deck[idx % deck.length];
  const behind1 = deck[(idx + 1) % deck.length];
  const behind2 = deck[(idx + 2) % deck.length];

  const xpPct = (xp % XP_MAX) / XP_MAX * 100;
  const questPct = Math.min(100, questNum / 5 * 100);

  function addXP(amount: number, color: string) {
    setXp(prev => {
      const next = prev + amount;
      if (next >= (level) * XP_MAX + XP_MAX && prev < (level) * XP_MAX + XP_MAX) {
        setTimeout(() => setLevelUp(true), 600);
        setLevel(l => l + 1);
      }
      return next;
    });
    setXpEarned(e => e + amount);
    setStats(s => ({ ...s, xpEarned: s.xpEarned + amount }));

    const id = ++popIdRef.current;
    setXpPops(p => [...p, { id, text: `+${amount} XP`, color }]);
    setTimeout(() => setXpPops(p => p.filter(x => x.id !== id)), 1400);
  }

  function showCombo(n: number) {
    const text = `${n}× COMBO`;
    const sub = n >= 10 ? 'ON FIRE · KEEP HYPING' : n >= 5 ? '+15 XP BONUS' : '+5 XP BONUS';
    const bonus = n >= 10 ? 25 : n >= 5 ? 15 : 5;
    setComboMsg({ text, sub });
    addXP(bonus, C.amber);
    setTimeout(() => setComboMsg(null), 900);
  }

  const doAction = useCallback((act: 'hype' | 'skip' | 'save' | 'deep') => {
    const current = deck[idx % deck.length];
    setExiting(act);

    if (act === 'hype') {
      setStats(s => ({ ...s, hyped: s.hyped + 1 }));
      setCombo(c => {
        const next = c + 1;
        const earned = 10 + (next >= 3 ? 5 : 0) + (next >= 5 ? 10 : 0) + (next >= 10 ? 25 : 0);
        addXP(earned, C.pink);
        if (next >= 3 && next % 3 === 0) setTimeout(() => showCombo(next), 100);
        if (current.city === 'CHICAGO') {
          setQuestNum(q => Math.min(5, q + 1));
        }
        return next;
      });
      onHype?.(current.id);
    } else if (act === 'skip') {
      setStats(s => ({ ...s, skipped: s.skipped + 1 }));
      setCombo(0);
      onSkip?.(current.id);
    } else if (act === 'save') {
      setStats(s => ({ ...s, saved: s.saved + 1 }));
      addXP(7, C.teal);
      onSave?.(current.id);
    } else if (act === 'deep') {
      addXP(5, C.purple);
    }

    setTimeout(() => {
      setIdx(i => i + 1);
      setExiting(null);
      setDrag({ x: 0, y: 0, active: false });
    }, 380);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, deck, onHype, onSave, onSkip]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (exiting) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); doAction('hype'); }
      else if (e.key === 'ArrowLeft') doAction('skip');
      else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'd') { e.preventDefault(); doAction('deep'); }
      else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') { e.preventDefault(); doAction('save'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doAction, exiting]);

  // Pointer drag on the card
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (exiting) return;
    const x0 = e.clientX; const y0 = e.clientY;
    setDrag({ x: 0, y: 0, active: true });
    const onMove = (ev: PointerEvent) => setDrag({ x: ev.clientX - x0, y: ev.clientY - y0, active: true });
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const dx = ev.clientX - x0; const dy = ev.clientY - y0;
      if (dx > 120) doAction('hype');
      else if (dx < -120) doAction('skip');
      else if (dy < -110) doAction('deep');
      else if (dy > 80) doAction('save');
      else setDrag({ x: 0, y: 0, active: false });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [doAction, exiting]);

  // Card transforms
  let cardTx = drag.x;
  let cardTy = drag.y;
  let cardRot = drag.x * 0.06;
  if (exiting === 'hype') { cardTx = 700; cardRot = 20; }
  else if (exiting === 'skip') { cardTx = -700; cardRot = -20; }
  else if (exiting === 'deep') { cardTy = -700; cardRot = 0; }
  else if (exiting === 'save') { cardTy = 700; }

  // Overlay thresholds
  const hintRight = drag.x > 60;
  const hintLeft  = drag.x < -60;
  const hintUp    = drag.y < -60 && Math.abs(drag.x) < 60;

  const levelName = LEVELS[Math.min(level, LEVELS.length - 1)];
  const nextLevelName = LEVELS[Math.min(level + 1, LEVELS.length - 1)];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* XP pop-ups */}
      {xpPops.map(p => (
        <div key={p.id} style={{ position: 'absolute', top: '45%', left: '50%', pointerEvents: 'none', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-.01em', zIndex: 200, color: p.color, textShadow: '0 4px 14px rgba(0,0,0,.5)', animation: 'sgFloatUp 1.4s ease-out forwards' }}>
          {p.text}
        </div>
      ))}

      {/* Combo banner */}
      {comboMsg && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 300, textAlign: 'center', animation: 'sgComboPop .8s ease-out forwards' }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 60, letterSpacing: '-.02em', color: C.amber, textShadow: `0 0 30px rgba(255,184,74,.7), 0 8px 30px rgba(0,0,0,.6)`, WebkitTextStroke: `2px #0a0805` }}>{comboMsg.text}</div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--wb-ink)', letterSpacing: '.18em', fontWeight: 700, marginTop: 4 }}>{comboMsg.sub}</div>
        </div>
      )}

      {/* Quest bar */}
      <div style={{ flexShrink: 0, padding: '10px 20px', borderBottom: '1px solid var(--wb-line)', display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(90deg, rgba(255,184,74,.07) 0%, transparent 60%)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${C.amber}, ${C.accent})`, color: 'var(--wb-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>★</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 8, color: C.amber, letterSpacing: '.18em', fontWeight: 700 }}>DAILY QUEST · RESETS IN 6H 24M</div>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, letterSpacing: '-.005em', marginTop: 1 }}>HYPE 5 seeds from Chicago artists tonight</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 300, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink)', fontWeight: 600, minWidth: 64 }}>
            <b style={{ color: C.amber }}>{questNum}</b> / 5 HYPED
          </span>
          <div style={{ flex: 1, height: 7, background: 'var(--wb-bg-3)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: `linear-gradient(90deg, ${C.amber}, ${C.accent})`, width: `${questPct}%`, borderRadius: 99, boxShadow: '0 0 8px rgba(255,184,74,.4)', transition: 'width .5s' }} />
          </div>
          <div style={{ padding: '4px 9px', borderRadius: 99, background: 'rgba(255,184,74,.12)', color: C.amber, fontFamily: 'var(--f-m)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', border: '1px solid rgba(255,184,74,.3)', whiteSpace: 'nowrap' }}>
            + 50 XP · GOLDEN EAR BADGE
          </div>
        </div>
      </div>

      {/* Arena + right rail */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Main arena */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 24px 0', position: 'relative', background: 'radial-gradient(ellipse at center top, rgba(255,80,41,.06), transparent 50%)' }}>

          {/* Card stack */}
          <div style={{ position: 'relative', width: 360, aspectRatio: '360/480', maxHeight: 'calc(100% - 180px)', minHeight: 320 }}>
            {/* Behind card 2 */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', background: behind2.gradient, transform: 'translateY(24px) scale(.88)', opacity: 0.25, zIndex: 0, boxShadow: '0 20px 40px -10px rgba(0,0,0,.4)' }} />
            {/* Behind card 1 */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', background: behind1.gradient, transform: 'translateY(13px) scale(.94)', opacity: 0.55, zIndex: 1, boxShadow: '0 20px 40px -10px rgba(0,0,0,.4)' }} />

            {/* Front card */}
            <div
              onPointerDown={onPointerDown}
              style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', zIndex: 5, background: seed.gradient, cursor: exiting ? 'default' : drag.active ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none', transform: `translate(${cardTx}px, ${cardTy}px) rotate(${cardRot}deg)`, transition: drag.active ? 'none' : 'transform .38s cubic-bezier(.2,.7,.2,1)', boxShadow: '0 28px 56px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05)' }}
            >
              {/* Sheen */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 75% 25%, rgba(255,255,255,.32), transparent 55%), radial-gradient(circle at 20% 80%, rgba(0,0,0,.38), transparent 55%)' }} />

              {/* Top bits */}
              <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ padding: '5px 11px', borderRadius: 99, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)', fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: C.pink, display: 'block' }} />
                  NEW SEED · {seed.vibe}
                </div>
                <div style={{ padding: '5px 11px', borderRadius: 99, background: 'rgba(255,255,255,.18)', border: '1px solid rgba(0,0,0,.2)', fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', fontWeight: 700, color: '#0a0805' }}>
                  {seed.city}
                </div>
              </div>

              {/* Waveform */}
              <div style={{ position: 'absolute', bottom: 148, left: 22, right: 22, height: 34, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, zIndex: 3 }}>
                {WAVE_HEIGHTS.map((h, i) => (
                  <div key={i} style={{ width: 3, height: h, borderRadius: 99, background: i < 24 ? (seed.dark ? '#fff' : 'rgba(0,0,0,.55)') : 'rgba(255,255,255,.28)' }} />
                ))}
              </div>

              {/* Bottom meta */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 22px 22px', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.55) 60%)', zIndex: 2 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.18em', fontWeight: 700, color: seed.dark ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.5)' }}>SEED · 0:18 / 0:30</div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', lineHeight: 1.05, marginTop: 4, color: seed.dark ? '#fff' : '#0a0805', wordBreak: 'break-word' }}>{seed.title}</div>
                <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: seed.dark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.65)', marginTop: 5 }}>{seed.artist}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <div style={{ display: 'flex' }}>
                    {seed.hypers.slice(0, 3).map(([init, col], i) => (
                      <div key={i} style={{ width: 22, height: 22, borderRadius: 99, border: '2px solid #0a0805', marginLeft: i === 0 ? 0 : -6, background: col, fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 9, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{init}</div>
                    ))}
                  </div>
                  <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: seed.dark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.7)', fontWeight: 600, letterSpacing: '.04em' }}>{seed.hypedCount} hyped this · {seed.hypers.length} in your scene</span>
                </div>
              </div>

              {/* Swipe overlays */}
              {(hintRight || exiting === 'hype') && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(255,62,154,.7), rgba(255,80,41,.5))' }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 64, letterSpacing: '-.02em', padding: '12px 28px', border: '5px solid #fff', borderRadius: 18, transform: 'rotate(-12deg)', color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.4)' }}>HYPE</div>
                </div>
              )}
              {(hintLeft || exiting === 'skip') && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,16,12,.7)', backdropFilter: 'blur(4px)' }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 64, letterSpacing: '-.02em', padding: '12px 28px', border: '5px solid rgba(255,255,255,.6)', borderRadius: 18, transform: 'rotate(-12deg)', color: 'rgba(255,255,255,.8)' }}>SKIP</div>
                </div>
              )}
              {(hintUp || exiting === 'save') && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 40, background: 'linear-gradient(180deg, transparent, rgba(34,229,212,.55))' }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 36, padding: '8px 24px', border: '4px solid #fff', borderRadius: 14, color: '#fff' }}>+ SAVED</div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '16px 0 6px', justifyContent: 'center' }}>
            {/* SKIP */}
            <ActionBtn onClick={() => doAction('skip')} color={C.accent} size={72} border>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
              <span style={{ position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)', letterSpacing: '.14em', fontWeight: 700, whiteSpace: 'nowrap' }}>SKIP</span>
              <Kbd>←</Kbd>
            </ActionBtn>

            {/* SAVE */}
            <ActionBtn onClick={() => doAction('save')} color={C.teal} size={60} tealBorder>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
              <span style={{ position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)', letterSpacing: '.14em', fontWeight: 700, whiteSpace: 'nowrap' }}>SAVE</span>
              <Kbd color={C.teal}>↓ S</Kbd>
            </ActionBtn>

            {/* HYPE — big button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}>
              <button
                onClick={() => doAction('hype')}
                style={{ width: 92, height: 92, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', background: 'radial-gradient(circle at 50% 35%, #ff7ac0, #ff3e9a 55%, #8a1f54 100%)', color: '#fff', boxShadow: 'inset 0 -8px 16px rgba(0,0,0,.4), inset 0 4px 8px rgba(255,255,255,.25), 0 0 0 6px rgba(255,62,154,.15), 0 0 60px rgba(255,62,154,.4)', transition: 'transform .1s, box-shadow .15s' }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(.9)')}
                onMouseUp={e => (e.currentTarget.style.transform = '')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9.2C.8 8.2 3 4.5 6.5 4.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4.5 23.2 8.2 21.5 11.8 19 16.5 12 21 12 21z"/></svg>
              </button>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: C.pink, letterSpacing: '.14em', fontWeight: 700 }}>HYPE +10</span>
              <Kbd color={C.pink}>→ SPACE</Kbd>
            </div>

            {/* DEEP DIVE */}
            <ActionBtn onClick={() => doAction('deep')} color={C.purple} size={60} purpleBorder>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              <span style={{ position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--wb-ink-3)', letterSpacing: '.14em', fontWeight: 700, whiteSpace: 'nowrap' }}>DEEP DIVE</span>
              <Kbd color={C.purple}>↑ D</Kbd>
            </ActionBtn>
          </div>
        </div>

        {/* Right rail */}
        <div style={{ width: 256, borderLeft: '1px solid var(--wb-line)', overflowY: 'auto', padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>

          {/* Session stats */}
          <div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              This session
              <span style={{ padding: '1px 7px', borderRadius: 99, background: 'rgba(34,229,212,.12)', color: C.teal, fontFamily: 'var(--f-m)', fontSize: 8, fontWeight: 700, letterSpacing: '.1em' }}>+ {sessionTime}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {[
                { v: stats.hyped,   l: 'HYPED',    c: C.pink },
                { v: stats.skipped, l: 'SKIPPED',  c: 'var(--wb-ink-2)' },
                { v: stats.saved,   l: 'SAVED',    c: C.teal },
                { v: stats.xpEarned,l: 'XP EARNED',c: C.amber },
              ].map(s => (
                <div key={s.l} style={{ padding: '10px 12px', background: 'var(--wb-bg-3)', borderRadius: 9, border: '1px solid var(--wb-line)' }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1, color: s.c }}>{s.v}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 8, color: 'var(--wb-ink-3)', letterSpacing: '.14em', fontWeight: 700, marginTop: 5 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              Weekly leaderboard
              <span style={{ padding: '1px 7px', borderRadius: 99, background: 'rgba(255,184,74,.12)', color: C.amber, fontFamily: 'var(--f-m)', fontSize: 8, fontWeight: 700, letterSpacing: '.1em' }}>RESET FRI</span>
            </div>
            {[
              { rank: '01', init: 'NK', grad: `${C.accent},${C.amber}`, name: 'Nikki K.',  sub: 'curator · 218 followers', pts: '2,840', top: true,  me: false },
              { rank: '02', init: 'SR', grad: `${C.purple},${C.pink}`,  name: 'Sade R.',   sub: 'scout · midwest',          pts: '2,612', top: false, me: false },
              { rank: '03', init: 'MC', grad: `${C.teal},${C.blue}`,    name: 'Marcus C.', sub: 'curator · chicago',         pts: '2,401', top: false, me: false },
              { rank: '17', init: 'JN', grad: `${C.blue},${C.purple}`,  name: 'You',       sub: '+ 4 spots since last week', pts: String(1820 + xpEarned), top: false, me: true },
              { rank: '18', init: 'EV', grad: `${C.accent},${C.pink}`,  name: 'Eve V.',    sub: 'listener · lo-fi',         pts: '1,798', top: false, me: false },
            ].map(r => (
              <div key={r.rank} style={{ display: 'grid', gridTemplateColumns: '16px 22px 1fr auto', gap: 8, alignItems: 'center', padding: '6px 4px', borderBottom: r.me ? 'none' : '1px solid var(--wb-line)', background: r.me ? 'rgba(255,80,41,.06)' : 'transparent', borderRadius: r.me ? 7 : 0, margin: r.me ? '2px 0' : 0 }}>
                <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 12, color: r.top ? C.amber : r.me ? C.accent : 'var(--wb-ink-3)', textAlign: 'center' }}>{r.rank}</span>
                <div style={{ width: 22, height: 22, borderRadius: 99, background: `linear-gradient(135deg, ${r.grad})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 9, color: 'var(--wb-bg)' }}>{r.init}</div>
                <div>
                  <div style={{ fontFamily: 'var(--f-b)', fontSize: 11, fontWeight: 500, color: 'var(--wb-ink)' }}>{r.name}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 8, color: 'var(--wb-ink-3)', marginTop: 1, letterSpacing: '.04em' }}>{r.sub}</div>
                </div>
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: '.04em' }}>{r.pts}</span>
              </div>
            ))}
          </div>

          {/* Achievements */}
          <div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              Achievements
              <span style={{ padding: '1px 7px', borderRadius: 99, background: 'rgba(255,62,154,.12)', color: C.pink, fontFamily: 'var(--f-m)', fontSize: 8, fontWeight: 700, letterSpacing: '.1em' }}>{Math.min(24, 8 + stats.hyped)} / 24</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
              {[
                { l: 'FIRST HYPE',  got: true,  icon: '♥' },
                { l: '10 COMBO',    got: combo >= 10, icon: '⚡' },
                { l: '7-DAY FIRE',  got: true,  icon: '🔥' },
                { l: 'PICKED A HIT',got: stats.hyped > 0, icon: '↗' },
                { l: '100 IN A DAY',got: false, icon: '🔒' },
                { l: 'SCOUT',       got: false, icon: '🔒' },
                { l: 'CURATOR',     got: level >= 8, icon: '🔒' },
                { l: 'TASTEMAKER',  got: false, icon: '🔒' },
              ].map(a => (
                <div key={a.l} style={{ aspectRatio: '1', borderRadius: 10, background: a.got ? 'rgba(255,62,154,.06)' : 'var(--wb-bg-3)', border: `1px solid ${a.got ? 'rgba(255,62,154,.3)' : 'var(--wb-line)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 5, opacity: a.got ? 1 : 0.4 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{a.icon}</span>
                  <span style={{ fontFamily: 'var(--f-m)', fontSize: 7, color: a.got ? 'var(--wb-ink)' : 'var(--wb-ink-2)', letterSpacing: '.08em', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{a.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Friends' activity */}
          <div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, marginBottom: 9 }}>Friends&apos; activity</div>
            {[
              { init: 'SR', color: C.purple, who: 'Sade R.',  action: 'hyped Halflight',          when: '2m' },
              { init: 'MC', color: C.teal,   who: 'Marcus C.',action: '+ 50 XP combo',            when: '7m' },
              { init: 'NK', color: C.amber,  who: 'Nikki K.', action: 'unlocked TASTEMAKER',      when: '14m' },
              { init: 'EV', color: C.accent, who: 'Eve V.',   action: 'saved 3 in a row',         when: '22m' },
            ].map(f => (
              <div key={f.who} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 3px', fontFamily: 'var(--f-b)', fontSize: 10, color: 'var(--wb-ink-2)' }}>
                <div style={{ width: 16, height: 16, borderRadius: 99, background: f.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 7, color: 'var(--wb-bg)' }}>{f.init}</div>
                <span><b style={{ color: 'var(--wb-ink)', fontWeight: 600 }}>{f.who}</b> {f.action}</span>
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 8, color: 'var(--wb-ink-3)', letterSpacing: '.04em', marginLeft: 'auto', flexShrink: 0 }}>{f.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* XP bar */}
      <div style={{ flexShrink: 0, padding: '11px 18px 13px', borderTop: '1px solid var(--wb-line)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center', background: 'var(--wb-bg-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${C.amber}, ${C.accent})`, color: 'var(--wb-bg)', fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '-.02em', boxShadow: '0 4px 12px rgba(255,184,74,.3)', flexShrink: 0 }}>{level}</div>
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 8, color: 'var(--wb-ink-3)', letterSpacing: '.16em', fontWeight: 700 }}>LEVEL {level} · {levelName}</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, letterSpacing: '-.005em' }}>Next: <span style={{ color: C.amber }}>{nextLevelName}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 9, background: 'var(--wb-bg-3)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: `linear-gradient(90deg, ${C.amber}, ${C.accent}, ${C.pink})`, width: `${xpPct}%`, borderRadius: 99, boxShadow: '0 0 10px rgba(255,184,74,.4)', transition: 'width .5s cubic-bezier(.2,.7,.2,1)' }} />
          </div>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--wb-ink)', letterSpacing: '.04em', fontWeight: 600, minWidth: 96, textAlign: 'right' }}><b style={{ color: C.amber }}>{xp % XP_MAX}</b> / {XP_MAX.toLocaleString()} XP</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 99, background: 'rgba(255,80,41,.1)', border: '1px solid rgba(255,80,41,.3)' }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>🔥</span>
          <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 16, color: C.accent, letterSpacing: '-.01em' }}>12</span>
          <span style={{ fontFamily: 'var(--f-m)', fontSize: 8, color: 'var(--wb-ink-2)', letterSpacing: '.14em', fontWeight: 700 }}>DAY STREAK</span>
        </div>
      </div>

      {/* Level-up overlay */}
      {levelUp && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(10px)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: C.amber, letterSpacing: '.4em', fontWeight: 700, marginBottom: 8 }}>LEVEL UP</div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 128, letterSpacing: '-.04em', lineHeight: 1, background: `linear-gradient(135deg, ${C.amber}, ${C.accent}, ${C.pink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 24px rgba(255,184,74,.5))' }}>
              {String(level).padStart(2, '0')}
            </div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 34, letterSpacing: '-.02em', marginTop: 10, color: 'var(--wb-ink)' }}>{levelName}</div>
            <div style={{ fontFamily: 'var(--f-s)', fontStyle: 'italic', fontSize: 16, color: 'var(--wb-ink-2)', marginTop: 10, lineHeight: 1.4, padding: '0 20px' }}>
              You&apos;re hearing it before everyone else. Your Hypes count <strong>1.5×</strong> on the chart for the next 24 hours.
            </div>
            <button onClick={() => setLevelUp(false)} style={{ marginTop: 22, padding: '13px 30px', background: C.pink, color: 'var(--wb-bg)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700, letterSpacing: '.16em', cursor: 'pointer', border: 'none' }}>
              KEEP DISCOVERING
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sgFloatUp { 0%{transform:translate(-50%,0) scale(.5);opacity:0} 20%{opacity:1;transform:translate(-50%,-10px) scale(1.2)} 100%{transform:translate(-50%,-150px) scale(.9);opacity:0} }
        @keyframes sgComboPop { 0%{opacity:0;transform:translate(-50%,-50%) scale(.5)} 30%{opacity:1;transform:translate(-50%,-50%) scale(1.1)} 100%{opacity:0;transform:translate(-50%,-100px) scale(1)} }
      `}</style>
    </div>
  );
});

// ── Small helpers ──────────────────────────────────────────────
function ActionBtn({ onClick, color, size, border, tealBorder, purpleBorder, children }: {
  onClick: () => void; color: string; size: number;
  border?: boolean; tealBorder?: boolean; purpleBorder?: boolean;
  children: React.ReactNode;
}) {
  const borderColor = tealBorder ? `rgba(34,229,212,.6)` : purpleBorder ? `rgba(185,131,255,.6)` : border ? 'rgba(255,255,255,.2)' : 'transparent';
  const bgColor = tealBorder ? 'var(--wb-bg-3)' : purpleBorder ? 'var(--wb-bg-3)' : border ? 'var(--wb-bg-3)' : 'transparent';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}>
      <button
        onClick={onClick}
        style={{ width: size, height: size, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${borderColor}`, background: bgColor, color, cursor: 'pointer', transition: 'transform .1s', position: 'relative' }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(.9)')}
        onMouseUp={e => (e.currentTarget.style.transform = '')}
        onMouseLeave={e => (e.currentTarget.style.transform = '')}
      >
        {children}
      </button>
    </div>
  );
}

function Kbd({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ position: 'absolute', bottom: -36, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--f-m)', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--wb-bg-3)', border: `1px solid ${color ? `${color}55` : 'var(--wb-line)'}`, color: color ?? 'var(--wb-ink-2)', letterSpacing: '.06em', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

// Need React import for JSX
import React from 'react';
