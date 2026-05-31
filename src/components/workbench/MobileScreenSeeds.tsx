'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T, WMPill, WMChip, WMViewHead, WMCard, WMTrendingStrip } from './MobilePrimitives';

// ─── Collab Board Section ─────────────────────────────────────
function CollabBoardSection() {
  const [posts, setPosts] = React.useState<{ id: string; type: string; description: string; profile: { name: string; slug: string } }[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [newPost, setNewPost] = React.useState(false);
  const [postType, setPostType] = React.useState('');
  const [postDesc, setPostDesc] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [posted, setPosted] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/collab')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.posts) setPosts(d.posts.slice(0, 5)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handlePost = async () => {
    if (!postType || !postDesc.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/collab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: postType, description: postDesc }),
      });
      if (res.ok) {
        setPosted(true);
        setNewPost(false);
        setPostType('');
        setPostDesc('');
        setTimeout(() => setPosted(false), 3000);
      }
    } catch { /* ignore */ } finally { setPosting(false); }
  };

  return (
    <div style={{ padding: '14px 18px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h2 style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, color: T.ink, margin: 0 }}>Collab board</h2>
        <button onClick={() => setNewPost(!newPost)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.teal, fontFamily: T.fm, fontSize: 12, letterSpacing: '.1em', padding: 0 }}>+ Post</button>
      </div>
      {posted && <div style={{ color: T.teal, fontFamily: T.fm, fontSize: 13, marginBottom: 8 }}>Posted!</div>}
      {newPost && (
        <div style={{ background: T.bg2, border: `1px solid ${T.line2}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <input
            type="text" value={postType} onChange={e => setPostType(e.target.value.slice(0, 40))}
            placeholder="Type (e.g. vocalist, producer, venue…)"
            style={{ width: '100%', background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 7, color: T.ink, fontFamily: T.fb, fontSize: 13, padding: '8px 10px', marginBottom: 8, boxSizing: 'border-box', outline: 'none' }}
          />
          <textarea
            value={postDesc} onChange={e => setPostDesc(e.target.value.slice(0, 500))}
            placeholder="Describe what you're looking for…"
            rows={3}
            style={{ width: '100%', background: T.bg3, border: `1px solid ${T.line}`, borderRadius: 7, color: T.ink, fontFamily: T.fb, fontSize: 13, padding: '8px 10px', marginBottom: 8, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
          />
          <button
            onClick={handlePost} disabled={posting || !postType || !postDesc.trim()}
            style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: (postType && postDesc.trim()) ? T.accent : T.bg4, color: (postType && postDesc.trim()) ? T.bg : T.ink3, fontFamily: T.fd, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >{posting ? 'Posting…' : 'Post'}</button>
        </div>
      )}
      {!loaded && <div className="wm-skeleton" style={{ height: 48, borderRadius: 6 }} />}
      {loaded && posts.length === 0 && <div style={{ fontFamily: T.fb, fontSize: 13, color: T.ink3, padding: '8px 0' }}>No collab posts yet — be the first!</div>}
      {posts.map((p, i) => (
        <div key={p.id} style={{ padding: '10px 0', borderBottom: i < posts.length - 1 ? `1px dashed ${T.line}` : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 13, color: T.ink }}>{p.profile.name}</div>
            <WMPill>{p.type}</WMPill>
          </div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, marginTop: 4, lineHeight: 1.4 }}>{p.description.slice(0, 120)}{p.description.length > 120 ? '…' : ''}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Screen: Seeds ───────────────────────────────────────────
export function MobileScreenSeeds({ data, onHypersSheet }: { data: WorkbenchData; onHypersSheet?: (showId: string) => void }) {
  const waveform = [30, 55, 80, 42, 90, 70, 48, 88, 62, 35, 78, 55, 92, 40, 68, 82, 48, 30, 62, 88];

  // Deck state
  const [deck, setDeck] = useState(data.tracks);
  const [deckIdx, setDeckIdx] = useState(0);
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
  const [sessionStats, setSessionStats] = useState({ saved: 0, skipped: 0, hyped: 0 });
  const [loadingDeck, setLoadingDeck] = useState(true);

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

  // Fetch deck on mount
  useEffect(() => {
    setLoadingDeck(true);
    fetch('/api/discover/seeds')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.seeds?.length) setDeck(d.seeds); })
      .catch(() => {})
      .finally(() => setLoadingDeck(false));
  }, []);

  const handleAction = useCallback((action: 'save' | 'skip' | 'hype', fromDrag = false, dragDx = 0, dragDy = 0) => {
    const front = deck[deckIdx % Math.max(deck.length, 1)];
    if (!front || actionedIds.has(front.id)) return;

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(action === 'hype' ? [10, 30, 10] : 8);
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
      fetch(`/api/discover/seeds/${encodeURIComponent(front.id)}/${action}`, { method: 'POST' }).catch(() => {});
    }, 320);
  }, [deck, deckIdx, actionedIds]);

  const front = deck[deckIdx % Math.max(deck.length, 1)];
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
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setDragX(dragXRef.current);
      setDragY(dragYRef.current);
    });
  }

  function handlePointerUp() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const dx = dragXRef.current;
    const dy = dragYRef.current;
    if (isDragging) {
      if (dx > 100)       handleAction('hype', true, dx, dy);
      else if (dx < -100) handleAction('skip', true, dx, dy);
      else if (dy < -100) handleAction('save', true, dx, dy);
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
                <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: s.c, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Card stack */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 3.6', marginBottom: 14 }}>
          {/* Skeleton loading state */}
          {loadingDeck && (
            <div className="wm-skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 18 }} />
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
                {/* Action labels — appear past halfway */}
                {dragX > 50 && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9, color: '#fff', fontFamily: T.fd, fontWeight: 900, fontSize: 32, letterSpacing: '-.02em', opacity: Math.min((dragX - 50) / 50, 1), pointerEvents: 'none', textShadow: '0 2px 16px rgba(0,0,0,.4)' }}>HYPE ♥</div>}
                {dragX < -50 && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9, color: '#fff', fontFamily: T.fd, fontWeight: 900, fontSize: 32, letterSpacing: '-.02em', opacity: Math.min((-dragX - 50) / 50, 1), pointerEvents: 'none', textShadow: '0 2px 16px rgba(0,0,0,.4)' }}>SKIP ✕</div>}
                {dragY < -50 && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9, color: '#fff', fontFamily: T.fd, fontWeight: 900, fontSize: 32, letterSpacing: '-.02em', opacity: Math.min((-dragY - 50) / 50, 1), pointerEvents: 'none', textShadow: '0 2px 16px rgba(0,0,0,.4)' }}>SAVE ↑</div>}
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
        <div style={{ textAlign: 'center', fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 18 }}>
          swipe · ↑ save · → hype
        </div>

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

        {/* Collab board */}
        <CollabBoardSection />
        <div style={{ height: 24 }} />
      </div>
    </>
  );
}
