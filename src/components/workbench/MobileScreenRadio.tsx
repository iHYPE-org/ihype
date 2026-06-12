'use client';

import React from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T, WMPill, WMChip, WMViewHead, WMTrendingStrip } from './MobilePrimitives';

function FollowDJ({ profileId }: { profileId: string }) {
  const [following, setFollowing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    void fetch(`/api/follow?profileId=${profileId}`)
      .then(r => r.json())
      .then((d: { following?: boolean }) => { if (d.following !== undefined) setFollowing(d.following); })
      .catch(() => null);
  }, [profileId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const prev = following;
    setFollowing(!following);
    try {
      const res = await fetch('/api/follow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      if (!res.ok) setFollowing(prev);
      else { const d = (await res.json()) as { following: boolean }; setFollowing(d.following); }
    } catch { setFollowing(prev); } finally { setBusy(false); }
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); void toggle(); }} disabled={busy}
      style={{
        padding: '4px 12px', borderRadius: 99,
        border: following ? `1px solid ${T.teal}60` : `1px solid ${T.line2}`,
        background: following ? `${T.teal}18` : T.bg2,
        color: following ? T.teal : T.ink3,
        fontFamily: T.fm, fontSize: 11, fontWeight: 700,
        cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap',
        letterSpacing: '.04em', transition: 'background .15s, color .15s',
      }}
    >
      {following ? '✓ Following' : '+ Follow DJ'}
    </button>
  );
}

// ─── Screen: Radio ───────────────────────────────────────────
export function MobileScreenRadio({ data, onSetlistSheet, onHypersSheet, onSeedsTab }: {
  data: WorkbenchData;
  onSetlistSheet?: (showId: string) => void;
  onHypersSheet?: (showId: string) => void;
  onSeedsTab?: () => void;
}) {
  const shows = data.radioShows;
  const live = shows.find(s => s.live);
  const rest = shows.filter(s => !s.live);

  return (
    <>
      <WMViewHead
        eyebrow={`LIVE NOW · ${shows.filter(s => s.live).length || 1} SHOWS ON AIR`}
        title="Radio"
        sub="Live and prerecorded shows from DJs and artists — every spin pays the source."
        actions={<><WMChip>⌲ Schedule</WMChip><WMChip>+ New show</WMChip></>}
      />
      {data.city && <WMTrendingStrip city={data.city} />}

      <div style={{ padding: '0 18px' }}>
        {/* Live hero */}
        {live && (
          <div style={{
            background: `linear-gradient(120deg,rgba(255,62,154,.22),rgba(255,80,41,.12),transparent)`,
            border: `1px solid ${T.line2}`, borderRadius: 14, padding: 16, position: 'relative', overflow: 'hidden', marginBottom: 20,
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', background: `repeating-linear-gradient(45deg,rgba(255,62,154,.06) 0 2px,transparent 2px 14px)`, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{
                width: 88, height: 88, borderRadius: 11, background: `linear-gradient(135deg,${live.color},${live.color}80)`,
                position: 'relative', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%,rgba(255,255,255,.3),transparent 60%)' }} />
                <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 36, color: T.bg, letterSpacing: '-.04em', zIndex: 2, mixBlendMode: 'overlay', opacity: .9 }}>01</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fm, fontSize: 12, color: T.accent, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' }}>
                  <span className="wm-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent, boxShadow: `0 0 12px ${T.accent}`, display: 'inline-block' }} />
                  ON AIR · {live.listeners.toLocaleString()}
                </div>
                <h2 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 22, letterSpacing: '-.025em', margin: '5px 0 0', color: T.ink }}>{live.name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <p style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 13, color: T.ink2, margin: 0 }}>with {live.host}</p>
                  {live.hostProfileId && <FollowDJ profileId={live.hostProfileId} />}
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: T.bg3, border: `1px solid ${T.line2}`, borderRadius: 7, fontFamily: T.fm, fontSize: 13, color: T.ink,
            }}>
              <span style={{ fontStyle: 'normal', color: T.ink3, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase' }}>NOW</span>
              <span style={{ flex: 1 }}>{data.tracks[0]?.title} — {data.tracks[0]?.artistName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2 }}>Next: <b style={{ color: T.ink }}>{data.tracks[1]?.title}</b></span>
              <button style={{
                padding: '10px 18px', borderRadius: 99, background: T.ink, color: T.bg,
                fontFamily: T.fm, fontWeight: 700, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase',
                border: 'none', cursor: 'pointer',
              }}>▶ Tune In</button>
            </div>
          </div>
        )}

        {/* Shows list */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 16, color: T.ink, margin: 0 }}>All shows</h2>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.08em' }}>by <span style={{ color: T.ink }}>next on air</span></div>
        </div>
        {!live && shows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 18px', color: T.ink3, fontFamily: T.fb, fontSize: 14 }}>
            No live shows right now —{' '}
            <button onClick={onSeedsTab} style={{ background: 'none', border: 'none', color: T.accent, cursor: 'pointer', fontFamily: T.fb, fontSize: 14, padding: 0, textDecoration: 'underline' }}>
              explore Seeds to discover new music ↗
            </button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {rest.slice(0, 4).map((r, i) => (
            <div key={r.id} style={{
              display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12,
              background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 11, padding: 12, alignItems: 'flex-start',
            }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, background: `linear-gradient(135deg,${r.color},${r.color}80)` }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <h3 style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, letterSpacing: '-.025em', margin: 0, color: T.ink }}>{r.name}</h3>
                    <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 3 }}>with {r.host}</div>
                  </div>
                  <WMPill>{i === 0 ? 'PRERECORDED' : i === 2 ? 'YOURS' : 'WEEKLY'}</WMPill>
                </div>
                <p style={{ fontFamily: T.fb, fontSize: 13, color: T.ink2, marginTop: 8, lineHeight: 1.4 }}>{r.desc}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.line}` }}>
                  <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink, fontWeight: 600 }}>{r.time}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {r.hostProfileId && <FollowDJ profileId={r.hostProfileId} />}
                    {!r.live && onSetlistSheet && (
                      <button onClick={() => onSetlistSheet(r.id)} style={{
                        background: 'none', border: `1px solid ${T.line2}`, borderRadius: 99, padding: '3px 9px',
                        color: T.ink3, fontFamily: T.fm, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>Vote setlist →</button>
                    )}
                    <span style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>{r.next}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
