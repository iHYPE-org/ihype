'use client';

import React from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T, WMPill, WMCard, WMSkeleton, ReferralPanel } from './MobilePrimitives';

// ─── Listening History Section ────────────────────────────────
function ListeningHistorySection() {
  const [history, setHistory] = React.useState<{ id: string; title: string; artistName: string; createdAt: string }[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/me/listening-history')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.history) setHistory(d.history.slice(0, 10)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && history.length === 0) return null;

  return (
    <div style={{ padding: '14px 18px 0' }}>
      <WMCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Listening history</div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>recent</div>
        </div>
        {!loaded && <WMSkeleton h={48} />}
        {history.map((h, i) => (
          <div key={h.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: i === 0 ? 'none' : `1px dashed ${T.line}` }}>
            <div style={{ width: 28, height: 28, borderRadius: 5, background: T.bg3, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 13, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.04em' }}>{h.artistName}</div>
            </div>
            <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, whiteSpace: 'nowrap', alignSelf: 'center' }}>
              {new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        ))}
      </WMCard>
    </div>
  );
}

// ─── Playlists Section ────────────────────────────────────────
function PlaylistsSection() {
  const [playlists, setPlaylists] = React.useState<{ id: string; name: string; items: { id: string }[] }[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/playlists')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.playlists) setPlaylists(d.playlists); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && playlists.length === 0) return null;

  return (
    <div style={{ padding: '14px 18px 0' }}>
      <WMCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>My playlists</div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>{playlists.length}</div>
        </div>
        {!loaded && <WMSkeleton h={40} />}
        {playlists.map((pl, i) => (
          <a key={pl.id} href={`/playlist/${pl.id}`} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderTop: i === 0 ? 'none' : `1px dashed ${T.line}`,
            textDecoration: 'none', color: T.ink,
          }}>
            <div style={{ fontFamily: T.fb, fontSize: 13, fontWeight: 600 }}>{pl.name}</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>{pl.items.length} tracks ›</div>
          </a>
        ))}
      </WMCard>
    </div>
  );
}

// ─── Ad Campaigns Section ─────────────────────────────────────
function AdCampaignsSection() {
  const [campaigns, setCampaigns] = React.useState<{ id: string; title: string; status: string; impressions: number; clicks: number }[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/advertise/campaigns')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.campaigns) setCampaigns(d.campaigns); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && campaigns.length === 0) return null;

  return (
    <div style={{ padding: '14px 18px 0' }}>
      <WMCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Ad campaigns</div>
          <a href="/advertise/dashboard" style={{ fontFamily: T.fm, fontSize: 12, color: T.teal, letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none' }}>Manage →</a>
        </div>
        {!loaded && <WMSkeleton h={40} />}
        {campaigns.slice(0, 3).map((c, i) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i === 0 ? 'none' : `1px dashed ${T.line}` }}>
            <div>
              <div style={{ fontFamily: T.fb, fontSize: 13, fontWeight: 600, color: T.ink }}>{c.title}</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3 }}>{c.impressions} impressions · {c.clicks} clicks</div>
            </div>
            <WMPill tone={c.status === 'APPROVED' ? 'teal' : c.status === 'REJECTED' ? 'live' : 'amber'}>{c.status}</WMPill>
          </div>
        ))}
      </WMCard>
    </div>
  );
}

// ─── Screen: Me ──────────────────────────────────────────────
export function MobileScreenMe({ data }: { data: WorkbenchData }) {
  const [deletingAccount, setDeletingAccount] = React.useState(false);

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    if (!window.confirm('Final confirmation: all your data will be permanently deleted.')) return;
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/settings/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (res.ok) {
        window.location.href = '/login';
      }
    } catch { /* ignore */ } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <>
      {/* Hero portrait card */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: `linear-gradient(135deg,${T.bg2},${T.bg3})`,
          border: `1px solid ${T.line2}`, borderRadius: 16, padding: 18,
        }}>
          <div style={{ position: 'absolute', top: '-40%', right: '-20%', width: '70%', height: '200%', background: `radial-gradient(ellipse,rgba(255,80,41,.22),transparent 60%)`, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', position: 'relative', zIndex: 2 }}>
            <div style={{
              width: 90, aspectRatio: '1 / 1', borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg,${T.accent},${T.pink},${T.purple})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 36, color: T.bg, letterSpacing: '-.04em', mixBlendMode: 'overlay', opacity: .85 }}>{data.userInitials}</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap' }}>
                {data.activeProfileTypes.includes('LISTENER') && <WMPill><span style={{ width: 5, height: 5, borderRadius: '50%', background: T.purple, display: 'inline-block' }} />FAN</WMPill>}
                {data.activeProfileTypes.includes('ARTIST') && <WMPill><span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />ARTIST</WMPill>}
                <WMPill tone="amber">⚡ LV {Math.max(1, Math.floor((data.lifeStats?.totalHype ?? 0) / 100) + 1)}</WMPill>
              </div>
              <h1 style={{ fontFamily: T.fd, fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1, fontSize: 'clamp(24px, 7vw, 30px)', margin: 0, color: T.ink }}>{data.userName}</h1>
              <p style={{ fontFamily: T.fm, fontSize: 12, color: T.ink2, letterSpacing: '.08em', marginTop: 6 }}>@{data.userName.toLowerCase().replace(/\s/g, '.')} · {data.city}</p>
              {(data.uploadStreak ?? 0) > 0 && (
                <span style={{ display: 'inline-block', marginTop: 6, background: 'rgba(245,158,11,.13)', color: '#f59e0b', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                  🔥 {data.uploadStreak}wk streak
                </span>
              )}
            </div>
          </div>
          <p style={{ fontFamily: T.fs, fontStyle: 'italic', fontSize: 14, color: T.ink2, marginTop: 14, lineHeight: 1.4, position: 'relative', zIndex: 2 }}>
            "Halflight EP out now. Writing the next thing in a basement on Western Ave. Recommendations open."
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${T.line}` }}>
            {[
              { v: (data.lifeStats?.totalHype ?? 0).toLocaleString(), k: 'Given', accent: true },
              { v: (data.stats.find(s => s.label.toLowerCase().includes('received'))?.value ?? '—'), k: 'Received' },
              { v: String(data.lifeStats?.eventsAttended ?? 0), k: 'Shows' },
              { v: (data.stats.find(s => s.label.toLowerCase().includes('top'))?.value ?? String(data.tracks.length)), k: 'Tracks' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: T.fd, fontWeight: 800, letterSpacing: '-.025em', fontSize: 18, lineHeight: 1, color: s.accent ? T.accent : T.ink }}>{s.v}</div>
                <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 4 }}>{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pulse stat tiles — horizontal scroll */}
      <div style={{ padding: '16px 0 6px' }}>
        <div style={{ padding: '0 18px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 13, color: T.ink }}>Pulse</div>
          <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase' }}>this week</div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 18px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {(() => {
            const nextShow = data.shows[0];
            const payout = data.referralStats?.payoutCents ?? data.lifeStats?.totalEarnings ?? 0;
            const listens = data.stats.find(s => s.label.toLowerCase().includes('listen') || s.label.toLowerCase().includes('play'));
            const saves = data.stats.find(s => s.label.toLowerCase().includes('save'));
            return [
              { k: 'Total listens', v: listens?.value ?? (data.lifeStats?.songsPlayed ?? 0).toLocaleString(), d: listens?.delta ?? 'all time', c: T.teal },
              { k: 'Save rate',     v: saves?.value ?? '—',    d: saves?.delta ?? '',          c: T.accent },
              { k: 'Earnings',      v: `$${(payout / 100).toFixed(0)}`, d: 'lifetime',         c: T.amber },
              { k: 'Next show',     v: nextShow ? nextShow.date : '—', d: nextShow ? nextShow.name : 'No shows yet', c: T.pink },
            ];
          })().map((t, i) => (
            <div key={i} style={{ flex: '0 0 clamp(120px, 38vw, 148px)', background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 10, padding: '12px 13px' }}>
              <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', lineHeight: 1.2 }}>{t.k}</div>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 'clamp(18px, 5vw, 22px)', letterSpacing: '-.025em', marginTop: 5, lineHeight: 1, color: t.c }}>{t.v}</div>
              <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink2, marginTop: 4, letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 */}
      <div style={{ padding: '14px 18px 0' }}>
        <WMCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Top 5 — this week</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>Sundays</div>
          </div>
          {data.tracks.slice(0, 5).map((t, i) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '18px 34px 1fr auto', gap: 10, alignItems: 'center' }}>
              <span style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 14, color: T.ink3, textAlign: 'center' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ width: 34, height: 34, borderRadius: 5, background: `linear-gradient(135deg,${t.color},${t.color}80)`, display: 'block' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.fb, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{t.title}</div>
                <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.04em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artistName} · {t.album}</div>
              </div>
              <span style={{ fontFamily: T.fm, fontSize: 12, color: T.pink, fontWeight: 600, whiteSpace: 'nowrap' }}>♥ {t.hypeCount}</span>
            </div>
          ))}
        </WMCard>
      </div>

      {/* Referral / Invite panel */}
      <ReferralPanel data={data} />

      {/* Activity */}
      <div style={{ padding: '14px 18px 0' }}>
        <WMCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: T.fd, fontWeight: 700, letterSpacing: '-.01em', fontSize: 14, color: T.ink }}>Recent activity</div>
            <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.1em', textTransform: 'uppercase' }}>24h</div>
          </div>
          {data.activity.length === 0 && (
            <div style={{ padding: '16px 0', textAlign: 'center', fontFamily: T.fb, fontSize: 13, color: T.ink3 }}>
              Start exploring — hype tracks and follow artists to build your history
            </div>
          )}
          {data.activity.slice(0, 5).map((a, i, arr) => {
            const dotColors: Record<string, string> = { hype: T.pink, show: T.teal, radio: T.pink, payout: T.amber };
            const ic: Record<string, string> = { hype: '♥', show: '★', radio: '📻', payout: '$', default: '↗' };
            const c = dotColors[a.kind] ?? T.purple;
            return (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px dashed ${T.line}` }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  background: `${c}22`, color: c,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.fm, fontSize: 13, fontWeight: 700,
                }}>{ic[a.kind] ?? '↗'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink, lineHeight: 1.35 }}>{a.text}</div>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.ink3, letterSpacing: '.06em', marginTop: 2 }}>{a.time}</div>
                </div>
              </div>
            );
          })}
        </WMCard>
      </div>

      {/* Listening history */}
      <ListeningHistorySection />

      {/* Playlists */}
      <PlaylistsSection />

      {/* Ad Campaigns (if advertiser) */}
      <AdCampaignsSection />

      {/* Danger zone */}
      <div style={{ padding: '14px 18px 32px' }}>
        <button
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 9, border: `1px solid rgba(239,68,68,.4)`,
            background: 'rgba(239,68,68,.07)', color: '#ef4444',
            fontFamily: T.fm, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', cursor: 'pointer',
            opacity: deletingAccount ? .6 : 1,
          }}
        >
          {deletingAccount ? 'Deleting account…' : 'Delete account'}
        </button>
      </div>
    </>
  );
}
