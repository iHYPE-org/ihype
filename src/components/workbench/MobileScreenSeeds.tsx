'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T, WMPill, WMChip, WMViewHead, WMCard, WMTrendingStrip } from './MobilePrimitives';

// ─── Screen: Seeds ───────────────────────────────────────────
export function MobileScreenSeeds({ data, onHypersSheet }: { data: WorkbenchData; onHypersSheet?: (showId: string) => void }) {
  const waveform = [30, 55, 80, 42, 90, 70, 48, 88, 62, 35, 78, 55, 92, 40, 68, 82, 48, 30, 62, 88];

  // Genre picker state (cold start)
  const GENRE_OPTIONS = ['Hip-Hop', 'Electronic', 'Indie', 'R&B', 'Jazz', 'Rock', 'Pop', 'Classical', 'Country', 'Metal', 'Folk', 'Soul'];
  const [pickedGenres, setPickedGenres] = useState<string[]>([]);
  const [savingGenres, setSavingGenres] = useState(false);

  // Deck state
  type SeedDeckTrack = typeof data.tracks[number] & { nowPlaying?: string | null; journalContent?: string | null };
  const [deck, setDeck] = useState<SeedDeckTrack[]>(data.tracks);
  const [deckIdx, setDeckIdx] = useState(0);
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
  const [sessionStats, setSessionStats] = useState({ saved: 0, skipped: 0, hyped: 0 });
  const [pendingUndo, setPendingUndo] = useState<{ id: string; action: 'save' | 'skip' | 'hype'; title: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deckError, setDeckError] = useState(false);
  const [longPressCard, setLongPressCard] = useState<SeedDeckTrack | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const sheetDragRef = useRef<number | null>(null);
  const [hintDismissed, setHintDismissed] = useState(() => typeof window !== 'undefined' && !!sessionStorage.getItem('seeds-hint-seen'));
  const [loadingDeck, setLoadingDeck] = useState(true);
  const [dailyPick, setDailyPick] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/discover/daily-pick')
      .then(r => r.ok ? r.json() : null)
      .then((d: { reason?: string } | null) => { if (d?.reason) setDailyPick(d.reason); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swipe / drag state — use refs for hot-path, state only for render triggers
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [flyOff, setFlyOff] = useState<{ x: number; y: number; rot: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragXRef = useRef(0);
  const dragYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const lastTapTimeRef = useRef(0);

  const refreshDeck = useCallback(() => {
    setLoadingDeck(true);
    setDeckError(false);
    fetch('/api/discover/seeds')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.seeds?.length) { setDeck(d.seeds); setDeckIdx(0); } })
      .catch(() => { setDeckError(true); })
      .finally(() => setLoadingDeck(false));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshDeck(); }, []);

  async function saveGenres() {
    if (pickedGenres.length < 2 || !data.profileId || savingGenres) return;
    setSavingGenres(true);
    try {
      await fetch('/api/profile/genre', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: data.profileId, genres: pickedGenres }),
      });
    } catch { /* ignore */ } finally {
      setSavingGenres(false);
      refreshDeck();
    }
  }

  // Saved seeds history
  type HistorySeed = { id: string; title: string; artistName: string; action: string };
  const [history, setHistory] = useState<HistorySeed[]>([]);
  useEffect(() => {
    fetch('/api/discover/history')
      .then(r => r.ok ? r.json() : null)
      .then((d: { seeds?: HistorySeed[] } | null) => { if (d?.seeds?.length) setHistory(d.seeds); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh hype counts for upcoming cards every 45 s
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!deck.length) return;
      const ids = deck.slice(deckIdx, deckIdx + 5).map((s: { id: string }) => s.id);
      try {
        const res = await fetch(`/api/media/hype-counts?ids=${ids.join(',')}`);
        if (!res.ok) return;
        const { counts } = await res.json() as { counts: Record<string, number> };
        setDeck((prev: SeedDeckTrack[]) => prev.map(s => counts[s.id] !== undefined ? { ...s, hypeCount: counts[s.id] } : s));
      } catch {}
    }, 45_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckIdx]);

  const handleAction = useCallback((action: 'save' | 'skip' | 'hype', fromDrag = false, dragDx = 0, dragDy = 0) => {
    const front = deck[deckIdx % Math.max(deck.length, 1)];
    if (!front || actionedIds.has(front.id)) return;

    // Haptic feedback — distinct pattern per action
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (action === 'hype') navigator.vibrate([15, 30, 15]);
      else if (action === 'save') navigator.vibrate([8, 60, 8]);
      // skip: no haptic (negative feedback)
    }

    // Compute fly-off direction
    const flyX = action === 'hype' ? 500 : action === 'skip' ? -500 : fromDrag ? dragDx * 3 : 0;
    const flyY = action === 'save' ? -600 : fromDrag ? dragDy * 2 : 0;
    const rot  = action === 'hype' ? 25 : action === 'skip' ? -25 : dragDx * 0.15;
    setFlyOff({ x: flyX, y: flyY, rot });

    setTimeout(() => {
      setFlyOff(null);
      setActionedIds(prev => new Set([...prev, front.id]));
      setDeckIdx(i => i + 1);
      setSessionStats(prev => ({
        ...prev,
        saved:   action === 'save'  ? prev.saved + 1  : prev.saved,
        skipped: action === 'skip'  ? prev.skipped + 1 : prev.skipped,
        hyped:   action === 'hype'  ? prev.hyped + 1  : prev.hyped,
      }));
      // Load more when near end
      const remaining = deck.length - (deckIdx + 1);
      if (remaining <= 3) {
        fetch('/api/discover/seeds').then(r => r.ok ? r.json() : null).then(d => {
          if (d?.seeds?.length) {
            setDeck(prev => [...prev, ...d.seeds.filter((s: {id:string}) => !actionedIds.has(s.id))]);
          }
        }).catch(() => {});
      }
      // Defer API call 2s to allow undo
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      const capturedId = front.id;
      const capturedAction = action;
      const capturedTitle = front.title;
      setPendingUndo({ id: capturedId, action: capturedAction, title: capturedTitle });
      undoTimerRef.current = setTimeout(() => {
        fetch(`/api/discover/seeds/${encodeURIComponent(capturedId)}/${capturedAction}`, { method: 'POST' }).catch(() => {});
        setPendingUndo(null);
        undoTimerRef.current = null;
      }, 2000);
    }, 320);
  }, [deck, deckIdx, actionedIds]);

  function handleUndo() {
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    if (!pendingUndo) return;
    setActionedIds(prev => { const next = new Set(prev); next.delete(pendingUndo.id); return next; });
    setDeckIdx(i => Math.max(0, i - 1));
    setSessionStats(prev => ({
      ...prev,
      saved:   pendingUndo.action === 'save'  ? Math.max(0, prev.saved - 1)  : prev.saved,
      skipped: pendingUndo.action === 'skip'  ? Math.max(0, prev.skipped - 1) : prev.skipped,
      hyped:   pendingUndo.action === 'hype'  ? Math.max(0, prev.hyped - 1)  : prev.hyped,
    }));
    setPendingUndo(null);
  }

  const front = deck.length > 0 && deckIdx < deck.length ? deck[deckIdx] : undefined;
  const behind = deck.length > 1 ? [
    deck[(deckIdx + 2) % deck.length],
    deck[(deckIdx + 1) % deck.length],
  ] : [];

  const xp = sessionStats.saved * 10 + sessionStats.hyped * 5 + sessionStats.skipped * 1;
  const totalReviewed = sessionStats.saved + sessionStats.skipped + sessionStats.hyped;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragXRef.current = 0;
    dragYRef.current = 0;
    setIsPressed(true);
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
    longPressedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      navigator.vibrate?.([10, 40, 10]);
      setLongPressCard(front ?? null);
    }, 500);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragXRef.current = dx;
    dragYRef.current = dy;
    if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      setIsDragging(true);
      setIsPressed(false);
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setDragX(dragXRef.current);
      setDragY(dragYRef.current);
    });
  }

  function handlePointerUp() {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const dx = dragXRef.current;
    const dy = dragYRef.current;
    if (isDragging) {
      if (dx > 100)       handleAction('hype', true, dx, dy);
      else if (dx < -100) handleAction('skip', true, dx, dy);
      else if (dy < -100) handleAction('save', true, dx, dy);
    } else if (!longPressedRef.current && !flyOff && front && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      // Double-tap to hype
      const now = Date.now();
      if (now - lastTapTimeRef.current < 350) {
        handleAction('hype');
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
      }
    }
    setIsPressed(false);
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
    dragStart.current = null;
    dragXRef.current = 0;
    dragYRef.current = 0;
  }

  return (
    <>
      <WMViewHead
        eyebrow="DISCOVER · 15–30s · CHICAGO"
        title="Seeds"
        italic="— decide in 15s."
        sub="Hand-cut hooks from new uploads. Save it, hype it, skip it."
        actions={<><WMChip>⚙ Filters</WMChip><WMChip>Local · Chicago ▾</WMChip></>}
      />
      {data.city && <WMTrendingStrip city={data.city} />}

      <div style={{ padding: '0 18px' }}>
        {/* Daily Pick AI banner */}
        {dailyPick && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: `${T.accent}12`, border: `1px solid ${T.accent}30`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⚡</span>
            <div>
              <div style={{ fontFamily: T.fm, fontSize: 11, color: T.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 2 }}>Today's Pick</div>
              <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink, lineHeight: 1.4 }}>{dailyPick}</div>
            </div>
          </div>
        )}
        {/* Session stats */}
        <div style={{
          background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 10, padding: '10px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 18,
        }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {[
              { k: 'Reviewed', v: totalReviewed > 0 ? String(totalReviewed) : '—', c: T.ink },
              { k: 'Saved',    v: sessionStats.saved   > 0 ? `+${sessionStats.saved}`   : '—', c: T.teal },
              { k: 'Hyped',    v: sessionStats.hyped   > 0 ? String(sessionStats.hyped) : '—', c: T.pink },
              { k: 'XP',       v: xp > 0 ? `+${xp}` : '—', c: T.amber },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>{s.k}</div>
                <div key={s.v} className="wm-stat-pop" style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: s.c, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
          {(data.hypeStreak ?? 0) > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>Streak</div>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: T.accent, marginTop: 2 }}>🔥{data.hypeStreak}d</div>
            </div>
          )}
        </div>

        {/* Saved seeds strip */}
        {history.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 7 }}>Saved &amp; Hyped</div>
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {history.map(h => (
                <div key={h.id} style={{ flexShrink: 0, padding: '7px 10px', borderRadius: 8, background: T.bg2, border: `1px solid ${h.action === 'hype' ? T.pink + '40' : T.teal + '40'}`, minWidth: 130, maxWidth: 130 }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 11, color: T.ink, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.artistName}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 11, color: h.action === 'hype' ? T.pink : T.teal, marginTop: 3, letterSpacing: '.1em', textTransform: 'uppercase' }}>{h.action === 'hype' ? '♥ Hyped' : '↑ Saved'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deck progress + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 99, background: T.bg3, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg,${T.accent},${T.pink})`, width: `${Math.min((deckIdx / Math.max(deck.length - 1, 1)) * 100, 100)}%`, transition: 'width .3s ease' }} />
          </div>
          <button
            onClick={refreshDeck}
            disabled={loadingDeck}
            aria-label="Refresh deck"
            style={{ width: 28, height: 28, borderRadius: '50%', background: T.bg2, border: `1px solid ${T.line}`, color: loadingDeck ? T.ink4 : T.ink2, cursor: loadingDeck ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={loadingDeck ? 'wm-spin' : undefined}><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"/><path d="M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          </button>
        </div>

        {/* Card stack */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 2.4', marginBottom: 14 }}>
          {/* Skeleton loading state */}
          {loadingDeck && (
            <div className="wm-skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 18 }} />
          )}
          {/* Error state */}
          {!loadingDeck && deckError && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: T.bg2, border: `1px solid rgba(255,80,41,.25)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32 }}>⚠️</div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15, color: T.ink }}>Couldn&apos;t load seeds</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', maxWidth: 200 }}>Check your connection and try again.</div>
              <button onClick={refreshDeck} style={{ marginTop: 4, padding: '7px 20px', borderRadius: 99, background: T.accent, color: '#fff', border: 'none', fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Try again</button>
            </div>
          )}
          {/* All-reviewed state */}
          {!loadingDeck && deck.length > 0 && !front && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: T.bg2, border: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ fontSize: 36 }}>✅</div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15, color: T.ink }}>You&#39;re all caught up!</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', textAlign: 'center', maxWidth: 200 }}>You reviewed {totalReviewed} seed{totalReviewed !== 1 ? 's' : ''} this session.</div>
              <button onClick={refreshDeck} style={{ marginTop: 4, padding: '7px 20px', borderRadius: 99, background: T.accent, color: '#fff', border: 'none', fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Load more</button>
            </div>
          )}
          {/* Empty state / Genre picker */}
          {!loadingDeck && deck.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: T.bg2, border: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 20px' }}>
              {data.needsGenreQuiz ? (
                <>
                  <div style={{ fontSize: 32 }}>🎵</div>
                  <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, color: T.ink, textAlign: 'center' }}>Pick your sound</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, textAlign: 'center', maxWidth: 220 }}>Tap 2+ genres so we know what to play you.</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 4 }}>
                    {GENRE_OPTIONS.map(g => {
                      const on = pickedGenres.includes(g);
                      return (
                        <button
                          key={g}
                          onClick={() => setPickedGenres(prev => on ? prev.filter(x => x !== g) : [...prev, g])}
                          style={{
                            padding: '6px 14px', borderRadius: 99, fontFamily: T.fm, fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', border: on ? `1px solid ${T.accent}` : `1px solid ${T.line2}`,
                            background: on ? `${T.accent}22` : T.bg3, color: on ? T.accent : T.ink2,
                            transition: 'background .12s, color .12s, border-color .12s',
                          }}
                        >{g}</button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => void saveGenres()}
                    disabled={pickedGenres.length < 2 || savingGenres}
                    style={{
                      marginTop: 8, padding: '10px 28px', borderRadius: 99, border: 'none',
                      background: pickedGenres.length >= 2 ? T.accent : T.bg3,
                      color: pickedGenres.length >= 2 ? '#fff' : T.ink3,
                      fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: pickedGenres.length >= 2 ? 'pointer' : 'default',
                      transition: 'background .15s, color .15s',
                    }}
                  >{savingGenres ? 'Saving…' : `Let's go →`}</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 36 }}>🌱</div>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 15, color: T.ink }}>No seeds right now</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', textAlign: 'center', maxWidth: 200 }}>Check back soon — new music drops daily.</div>
                  <button onClick={refreshDeck} style={{ marginTop: 4, padding: '7px 20px', borderRadius: 99, background: T.accent, color: '#fff', border: 'none', fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Refresh</button>
                </>
              )}
            </div>
          )}
          {/* behind cards */}
          {!loadingDeck && behind.map((t, i) => (
            <div key={t.id} style={{
              position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden',
              transform: `translateY(${(behind.length - i) * 8}px) scale(${.9 + i * .05})`,
              opacity: .35 + i * .25, zIndex: i,
              background: `linear-gradient(135deg,${t.color},${t.color}80)`,
              boxShadow: '0 12px 32px rgba(0,0,0,.5)',
            }} />
          ))}
          {/* front card */}
          {!loadingDeck && front && (() => {
            // Proportional tint: 0 at 0px drag, full at 100px
            const hypeAlpha = Math.min(Math.max(dragX / 100, 0), 1) * 0.55;
            const skipAlpha = Math.min(Math.max(-dragX / 100, 0), 1) * 0.55;
            const saveAlpha = Math.min(Math.max(-dragY / 100, 0), 1) * 0.55;
            return (
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{
                  position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden', zIndex: 5,
                  background: `linear-gradient(150deg,${front.color}ee,${front.color}99)`,
                  boxShadow: isPressed
                    ? `0 8px 24px rgba(0,0,0,.5), 0 0 0 2px ${front.color}88`
                    : '0 20px 48px -8px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.06)',
                  transform: flyOff
                    ? `translateX(${flyOff.x}px) translateY(${flyOff.y}px) rotate(${flyOff.rot}deg)`
                    : isDragging
                      ? `translateX(${dragX}px) translateY(${dragY * 0.3}px) rotate(${dragX * 0.06}deg)`
                      : isPressed ? 'scale(0.97)' : 'scale(1)',
                  transition: flyOff
                    ? 'transform .3s cubic-bezier(.4,0,.2,1)'
                    : isDragging ? 'none'
                    : 'transform .15s ease, box-shadow .15s ease',
                  touchAction: 'none',
                  userSelect: 'none',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  willChange: 'transform',
                }}>
                {/* Full-card tint overlays — proportional to drag */}
                {hypeAlpha > 0 && <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: `rgba(34,200,80,${hypeAlpha})`, pointerEvents: 'none', borderRadius: 18 }} />}
                {skipAlpha > 0 && <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: `rgba(255,60,60,${skipAlpha})`, pointerEvents: 'none', borderRadius: 18 }} />}
                {saveAlpha > 0 && <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: `rgba(34,229,212,${saveAlpha})`, pointerEvents: 'none', borderRadius: 18 }} />}
                {/* Action pill badges — corner-positioned, appear past halfway */}
                {dragX > 50 && <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 9, padding: '5px 12px', borderRadius: 99, background: 'rgba(34,200,80,.92)', backdropFilter: 'blur(6px)', color: '#fff', fontFamily: T.fm, fontWeight: 800, fontSize: 13, letterSpacing: '.08em', opacity: Math.min((dragX - 50) / 50, 1), pointerEvents: 'none' }}>♥ HYPE</div>}
                {dragX < -50 && <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 9, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,60,60,.92)', backdropFilter: 'blur(6px)', color: '#fff', fontFamily: T.fm, fontWeight: 800, fontSize: 13, letterSpacing: '.08em', opacity: Math.min((-dragX - 50) / 50, 1), pointerEvents: 'none' }}>✕ SKIP</div>}
                {dragY < -50 && <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 9, padding: '5px 12px', borderRadius: 99, background: 'rgba(34,229,212,.92)', backdropFilter: 'blur(6px)', color: '#fff', fontFamily: T.fm, fontWeight: 800, fontSize: 13, letterSpacing: '.08em', opacity: Math.min((-dragY - 50) / 50, 1), pointerEvents: 'none' }}>↑ SAVE</div>}
                {/* texture */}
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 8px,transparent 8px 16px)' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 60% 20%,rgba(255,255,255,.18),transparent 55%)' }} />
                {/* strong bottom gradient so text is always readable */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 35%,rgba(0,0,0,.92) 100%)', zIndex: 2 }} />
                {/* tags */}
                <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', zIndex: 3 }}>
                  <span style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(0,0,0,.6)', fontFamily: T.fm, fontSize: 11, letterSpacing: '.12em', fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />SEED · 22s
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(255,255,255,.15)', fontFamily: T.fm, fontSize: 11, letterSpacing: '.12em', fontWeight: 700, color: '#fff' }}>CHICAGO</span>
                </div>
                {/* waveform */}
                <div style={{ position: 'absolute', bottom: 100, left: 16, right: 16, height: 28, display: 'flex', alignItems: 'flex-end', gap: 2, zIndex: 3 }}>
                  {waveform.map((h, i) => (
                    <span key={i} style={{ flex: 1, height: `${h}%`, background: 'rgba(255,255,255,.5)', borderRadius: 99, display: 'block' }} />
                  ))}
                </div>
                {/* track info */}
                <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, zIndex: 3, color: '#fff' }}>
                  <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,.5)' }}>{front.title}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 11, color: 'rgba(255,255,255,.75)', letterSpacing: '.1em', marginTop: 3, textTransform: 'uppercase' }}>{front.artistName} · {front.album}</div>
                  {front.nowPlaying && <div style={{ fontFamily: T.fb, fontStyle: 'italic', fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Listening to: {front.nowPlaying.slice(0, 60)}</div>}
                  {front.journalContent && <div style={{ fontFamily: T.fb, fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{front.journalContent.slice(0, 60)}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: T.fm, fontSize: 11, letterSpacing: '.06em', color: 'rgba(255,255,255,.6)' }}>
                    <span>♥ {front.hypeCount} hype</span>
                    <span>{deck.length - deckIdx} left</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Swipe controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
          {[
            { c: '#ff6b5a', bd: 'rgba(255,107,90,.4)', sz: 46, label: '✕', action: 'skip' },
            { c: T.ink2,    bd: T.line2,               sz: 42, label: '↺', action: 'replay' },
            { c: T.teal,    bd: 'rgba(34,229,212,.4)', sz: 60, label: '▶', action: 'save' },
            { c: T.pink,    bd: 'rgba(255,62,154,.4)', sz: 46, label: '♥', action: 'hype' },
          ].map((b, i) => (
            <button key={i} onClick={() => {
              if (b.action === 'skip')   void handleAction('skip');
              else if (b.action === 'save')  void handleAction('save');
              else if (b.action === 'hype')  void handleAction('hype');
              // replay: no-op
            }} style={{
              width: b.sz, height: b.sz, borderRadius: '50%',
              background: T.bg2, border: `1px solid ${b.bd}`, color: b.c,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              fontFamily: T.fm, fontSize: b.sz * 0.32, fontWeight: 700,
            }}>{b.label}</button>
          ))}
        </div>
        {!hintDismissed ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '9px 12px', borderRadius: 10, background: T.bg3, border: `1px solid ${T.line2}`, animation: 'fadeIn .2s ease-out both' }}>
            <span style={{ fontFamily: T.fm, fontSize: 11, color: T.ink2, letterSpacing: '.06em' }}>← Skip · ↑ Save · → Hype · Double-tap ♥</span>
            <button onClick={() => { sessionStorage.setItem('seeds-hint-seen', '1'); setHintDismissed(true); }} style={{ background: 'none', border: 'none', color: T.ink4, fontFamily: T.fm, fontSize: 14, cursor: 'pointer', padding: '0 0 0 10px', lineHeight: 1, flexShrink: 0 }} aria-label="Dismiss hint">✕</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 10 }}>
            swipe · ↑ save · → hype
          </div>
        )}

        {pendingUndo ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 10, marginBottom: 10,
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
            animation: 'fadeIn .15s ease-out both',
          }}>
            <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>
              {pendingUndo.action === 'hype' ? '♥' : pendingUndo.action === 'save' ? '↑' : '✕'}{' '}
              <span style={{ color: T.ink, fontWeight: 700 }}>{pendingUndo.title.slice(0, 28)}</span>
            </span>
            <button
              onClick={handleUndo}
              style={{
                padding: '5px 12px', borderRadius: 99, border: `1px solid ${T.amber}60`,
                background: `${T.amber}15`, color: T.amber,
                fontFamily: T.fm, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer',
              }}
            >UNDO</button>
          </div>
        ) : (
          <div style={{ height: 10, marginBottom: 8 }} />
        )}

        {/* Daily quest */}
        <WMCard style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 13, letterSpacing: '-.01em', color: T.ink }}>Daily Quest · Save 5 seeds</div>
            <WMPill tone="amber">+60 XP</WMPill>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: i < sessionStats.saved ? T.accent : T.bg3, display: 'block' }} />
            ))}
          </div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em' }}>{sessionStats.saved} / 5 · earn Seed Curator badge</div>
        </WMCard>

        {/* Up next */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, padding: '0 4px' }}>Up next</div>
          <WMCard style={{ gap: 8 }}>
            {deck.slice(deckIdx + 1, deckIdx + 4).map((t, i) => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 10, alignItems: 'center', opacity: i === 2 ? .5 : 1 }}>
                <div style={{ width: 38, height: 38, borderRadius: 6, background: `linear-gradient(135deg,${t.color},${t.color}80)` }} />
                <div>
                  <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 12, color: T.ink }}>{t.title}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 2 }}>{t.artistName}</div>
                </div>
              </div>
            ))}
          </WMCard>
        </div>

        {/* Why this seed */}
        <WMCard style={{ marginBottom: 14, fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.2em', fontWeight: 700, textTransform: 'uppercase' }}>Why this seed?</div>
          <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
            You hyped <span style={{ color: T.accent, fontWeight: 600 }}>3 tracks</span> from this artist this month — promoter test pressing from their unreleased EP.
          </div>
        </WMCard>

        <div style={{ height: 48 }} />
      </div>

      {/* Long-press quick action sheet */}
      {longPressCard && (
        <>
          <div onClick={() => setLongPressCard(null)} style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,.6)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', padding: '20px 18px 40px', transform: `translateY(${sheetDragY}px)`, transition: isDraggingSheet ? 'none' : 'transform .2s' }}>
            <div
              style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12, paddingTop: 4, touchAction: 'none', cursor: 'grab' }}
              onPointerDown={e => { sheetDragRef.current = e.clientY; setIsDraggingSheet(true); (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
              onPointerMove={e => { if (sheetDragRef.current === null) return; setSheetDragY(Math.max(0, e.clientY - sheetDragRef.current)); }}
              onPointerUp={e => { if (sheetDragRef.current === null) return; const dy = Math.max(0, e.clientY - sheetDragRef.current); sheetDragRef.current = null; setIsDraggingSheet(false); setSheetDragY(0); if (dy > 80) setLongPressCard(null); }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: T.line2 }} />
            </div>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 16, color: T.ink, marginBottom: 4 }}>{longPressCard.title}</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, marginBottom: 18 }}>{longPressCard.artistName}</div>
            {([
              { label: '♥  Hype', action: () => { handleAction('hype'); setLongPressCard(null); }, color: T.pink },
              { label: '↑  Save', action: () => { handleAction('save'); setLongPressCard(null); }, color: T.teal },
              { label: '✕  Skip', action: () => { handleAction('skip'); setLongPressCard(null); }, color: T.ink3 },
              { label: '↗  Share', action: () => { navigator.share?.({ title: longPressCard.title, text: `${longPressCard.title} by ${longPressCard.artistName}` }).catch(() => {}); setLongPressCard(null); }, color: T.blue },
            ] as { label: string; action: () => void; color: string }[]).map(item => (
              <button key={item.label} onClick={item.action} style={{ width: '100%', padding: '14px 0', marginBottom: 8, borderRadius: 12, border: 'none', background: T.bg4, color: item.color, fontFamily: T.fd, fontWeight: 700, fontSize: 15, cursor: 'pointer', textAlign: 'center' }}>{item.label}</button>
            ))}
            <button onClick={() => setLongPressCard(null)} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: `1px solid ${T.line2}`, background: 'transparent', color: T.ink3, fontFamily: T.fm, fontSize: 13, cursor: 'pointer' }}>Dismiss</button>
          </div>
        </>
      )}
    </>
  );
}
