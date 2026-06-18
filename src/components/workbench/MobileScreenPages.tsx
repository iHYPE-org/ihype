'use client';

import React, { useState, useCallback } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { T } from './MobilePrimitives';
import { logoutAction } from '@/app/logout/actions';

type PageRole = 'ARTIST' | 'VENUE' | 'DJ' | 'LISTENER';

const PAGE_LABELS: Record<PageRole, string> = {
  ARTIST: 'Artist Page',
  VENUE: 'Venue Page',
  DJ: 'DJ Page',
  LISTENER: 'Fan Profile',
};

const PAGE_ORDER: PageRole[] = ['ARTIST', 'VENUE', 'DJ', 'LISTENER'];

function derivePages(data: WorkbenchData): PageRole[] {
  const types = data.activeProfileTypes ?? [];
  const ordered = PAGE_ORDER.filter(r => types.includes(r));
  if (ordered.length === 0 && data.profileType) {
    const t = (data.profileType as string).toUpperCase() as PageRole;
    if (PAGE_LABELS[t]) return [t];
  }
  return ordered.length > 0 ? ordered : ['LISTENER'];
}

interface Props {
  data: WorkbenchData;
  onPage: () => void;
  onCockpit: () => void;
  onStudio: () => void;
  onManage: () => void;
  onJournal: () => void;
  onNotif: () => void;
  onSettings: () => void;
  onTour: () => void;
  onEvents: () => void;
}

function ToolRow({ label, sub, icon, onClick, last = false }: {
  label: string; sub: string; icon: React.ReactNode; onClick: () => void; last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', background: 'none', border: 'none',
        borderBottom: last ? 'none' : `1px solid ${T.line}`,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.ink2,
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.fd, fontSize: 15, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{label}</div>
        <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink2, marginTop: 3 }}>{sub}</div>
      </div>
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  );
}

function ActionChip({ label, accent, onClick }: { label: string; accent?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 16px', borderRadius: 99, cursor: 'pointer', border: 'none',
        background: accent ? `${accent}22` : 'rgba(255,255,255,.06)',
        fontFamily: T.fm, fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
        color: accent ?? T.ink2,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

type AdRec = { headline: string; body: string; channel: string; cta: string };
const AD_CHANNEL_COLORS: Record<string, string> = {
  Instagram: '#e040fb', TikTok: '#22e5d4', Spotify: '#1db954', 'Local Flyers': '#ffb84a',
};

export function MobileScreenPages({
  data, onPage, onCockpit, onStudio, onManage, onJournal, onNotif, onSettings, onTour, onEvents,
}: Props) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'done'>('idle');
  const [selectedPage, setSelectedPage] = useState<PageRole | null>(null);
  const [adRecsOpen, setAdRecsOpen] = useState(false);
  const [adRecs, setAdRecs] = useState<AdRec[] | null>(null);
  const [adRecsLoading, setAdRecsLoading] = useState(false);

  const openAdRecs = useCallback(() => {
    setAdRecsOpen(true);
    if (!adRecs) {
      setAdRecsLoading(true);
      fetch('/api/page-builder/ad-recs')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: { recs: AdRec[] }) => { setAdRecs(d.recs); setAdRecsLoading(false); })
        .catch(() => setAdRecsLoading(false));
    }
  }, [adRecs]);

  const pages = derivePages(data);
  const activePage = selectedPage ?? pages[0] ?? 'LISTENER';

  const role = activePage;
  const isArtist = role === 'ARTIST';
  const isDJ = role === 'DJ';
  const isVenue = role === 'VENUE';
  const isCreator = isArtist || isDJ;
  const isCreatorOrVenue = isCreator || isVenue;
  const isFan = role === 'LISTENER';
  const showShareLink = isFan && !!data.profileHexId;

  const handleShareInvite = useCallback(async () => {
    if (!data.profileHexId) return;
    const url = new URL(`/invite/${data.profileHexId}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join me on iHYPE', url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt('Copy your invite link', url);
      }
      setShareStatus('done');
      window.setTimeout(() => setShareStatus('idle'), 1800);
    } catch { /* ignored */ }
  }, [data.profileHexId]);

  return (
    <>
    <div style={{ overflowY: 'auto', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ fontFamily: T.fm, fontSize: 11, color: T.ink3, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 6 }}>
          Your Presence
        </div>
        <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 28, letterSpacing: '-.03em', color: T.ink, lineHeight: 1 }}>
          Pages
        </div>
      </div>

      {/* Page tabs (subheader) */}
      {pages.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 14px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {pages.map(p => (
            <button
              key={p}
              onClick={() => setSelectedPage(p)}
              style={{
                padding: '7px 15px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: T.fb, fontWeight: 700, fontSize: 12,
                border: p === activePage ? '1px solid rgba(185,131,255,.4)' : `1px solid ${T.line2}`,
                background: p === activePage ? 'rgba(185,131,255,.14)' : T.bg2,
                color: p === activePage ? T.ink : T.ink2,
              }}
            >
              {PAGE_LABELS[p]}
            </button>
          ))}
        </div>
      )}

      {/* Page card */}
      <div style={{ margin: '0 16px 20px' }}>
        <div style={{ borderRadius: 18, background: T.bg2, border: `1px solid ${T.line2}`, overflow: 'hidden' }}>
          <div style={{ padding: '18px 18px 16px', background: 'linear-gradient(135deg, rgba(185,131,255,.1), rgba(255,80,41,.06))' }}>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 5 }}>
              {PAGE_LABELS[activePage]}
            </div>
            <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 20, color: T.ink, lineHeight: 1 }}>
              {data.userName ?? 'Your Page'}
            </div>
            {/* Stats */}
            {((data.hypeCount7d ?? 0) > 0 || (data.followerCount ?? 0) > 0) && (
              <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
                {(data.hypeCount7d ?? 0) > 0 && (
                  <div>
                    <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, color: T.ink, lineHeight: 1 }}>{(data.hypeCount7d ?? 0).toLocaleString()}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 2 }}>Hype (7d)</div>
                  </div>
                )}
                {(data.followerCount ?? 0) > 0 && (
                  <div>
                    <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 18, color: T.ink, lineHeight: 1 }}>{(data.followerCount ?? 0).toLocaleString()}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 9, color: T.ink3, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 2 }}>Followers</div>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Quick actions */}
          <div style={{ display: 'flex', borderTop: `1px solid ${T.line}` }}>
            {data.profilePath && (
              <a
                href={data.profilePath}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, padding: '13px 0', background: 'none', border: 'none',
                  borderRight: `1px solid ${T.line}`, cursor: 'pointer', textAlign: 'center',
                  fontFamily: T.fm, fontSize: 11, fontWeight: 700, color: '#ff5029', letterSpacing: '.1em',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                VIEW ↗
              </a>
            )}
            <button onClick={onPage} style={{
              flex: 1, padding: '13px 0', background: 'none', border: 'none',
              borderRight: `1px solid ${T.line}`, cursor: 'pointer',
              fontFamily: T.fm, fontSize: 11, fontWeight: 700, color: T.ink2, letterSpacing: '.1em',
            }}>
              EDIT
            </button>
            <button onClick={onCockpit} style={{
              flex: 1, padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: T.fm, fontSize: 11, fontWeight: 700, color: T.purple, letterSpacing: '.1em',
            }}>
              ✦ AI
            </button>
          </div>
        </div>
      </div>

      {/* Page action chips */}
      {isCreatorOrVenue && (
        <div style={{ padding: '0 16px 20px' }}>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10 }}>
            Page Tools
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isCreatorOrVenue && <ActionChip label="Tour Builder" accent={T.teal} onClick={onTour} />}
            {isCreatorOrVenue && <ActionChip label="Event Creator" accent="#ff5029" onClick={onEvents} />}
            {isCreatorOrVenue && <ActionChip label="Ad Recs" accent="#ffd700" onClick={openAdRecs} />}
          </div>
        </div>
      )}

      {/* Share link for fans */}
      {showShareLink && (
        <div style={{ margin: '-4px 16px 20px' }}>
          <button
            onClick={() => { void handleShareInvite(); }}
            style={{
              width: '100%', padding: '14px 18px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              background: shareStatus === 'done' ? 'rgba(34,229,212,.1)' : 'rgba(185,131,255,.07)',
              border: `1px solid ${shareStatus === 'done' ? 'rgba(34,229,212,.35)' : 'rgba(185,131,255,.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'background .2s, border-color .2s',
            }}
          >
            <div>
              <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, color: T.ink, lineHeight: 1, marginBottom: 3 }}>
                {shareStatus === 'done' ? 'Link copied!' : 'Share My Link'}
              </div>
              <div style={{ fontFamily: T.fb, fontSize: 11, color: T.ink2, lineHeight: 1.3 }}>
                Earn iHYPE points for every new sign-up
              </div>
            </div>
            <div style={{
              padding: '7px 13px', borderRadius: 99,
              background: shareStatus === 'done' ? 'rgba(34,229,212,.2)' : 'rgba(185,131,255,.15)',
              fontFamily: T.fm, fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
              color: shareStatus === 'done' ? '#22e5d4' : T.purple,
            }}>
              {shareStatus === 'done' ? '✓ DONE' : 'SHARE →'}
            </div>
          </button>
        </div>
      )}

      {/* Role tools */}
      {isCreatorOrVenue && (
        <div style={{ margin: '0 16px 20px' }}>
          <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 2 }}>
            Creator Tools
          </div>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.bg2 }}>
            {isCreator && (
              <ToolRow
                label="Studio"
                sub="Tracks, releases & tools"
                onClick={onStudio}
                icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><rect x="2" y="5" width="16" height="10" rx="2"/><path d="M6 10h1.5M10 8v4M13.5 9v2" strokeLinecap="round"/></svg>}
              />
            )}
            <ToolRow
              label="Console"
              sub={isVenue ? 'Venue requests & stats' : 'Artist stats & tools'}
              onClick={onManage}
              icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><rect x="1" y="4" width="18" height="12" rx="2"/><path d="M5 10h2.5M10 7.5v5M14 9v3"/></svg>}
            />
            <ToolRow
              label="Journal"
              sub="Posts & updates"
              last
              onClick={onJournal}
              icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><rect x="3" y="2" width="14" height="16" rx="2"/><path d="M7 7h6M7 11h4" strokeLinecap="round"/></svg>}
            />
          </div>
        </div>
      )}

      {/* Account */}
      <div style={{ margin: '0 16px 24px' }}>
        <div style={{ fontFamily: T.fm, fontSize: 10, color: T.ink3, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 2 }}>
          Account
        </div>
        <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.bg2 }}>
          <ToolRow
            label="Notifications"
            sub="Alerts & activity"
            onClick={onNotif}
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><path d="M5 8a5 5 0 0 1 10 0v3.5l1.5 2.5h-13L5 11.5V8Z"/><path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round"/></svg>}
          />
          <ToolRow
            label="Settings"
            sub="Account & preferences"
            onClick={onSettings}
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><circle cx="10" cy="10" r="2.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" strokeLinecap="round"/></svg>}
          />
          <ToolRow
            label="Sign out"
            sub="End your session"
            last
            onClick={() => { void logoutAction(); }}
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width={18} height={18}><path d="M7 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3M13 14l3-4-3-4M16 10H8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
        </div>
      </div>
    </div>

      {/* Ad Recs bottom sheet */}
      {adRecsOpen && (
        <>
          <div onClick={() => setAdRecsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,.65)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: T.bg3, borderTop: `1px solid ${T.line2}`, borderRadius: '18px 18px 0 0', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
              <div style={{ fontFamily: T.fd, fontWeight: 800, fontSize: 16, color: T.ink }}>Ad Recommendations</div>
              <button onClick={() => setAdRecsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '14px 18px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink2, marginBottom: 4, lineHeight: 1.4 }}>
                AI-generated campaign ideas tailored to your profile.
              </div>
              {adRecsLoading && [0,1,2,3].map(i => (
                <div key={i} style={{ height: 88, borderRadius: 12, background: T.bg2, opacity: 0.6 }} />
              ))}
              {adRecs?.map((r, i) => {
                const col = AD_CHANNEL_COLORS[r.channel] ?? T.purple;
                return (
                  <div key={i} style={{ borderRadius: 12, border: `1px solid rgba(255,255,255,.07)`, background: 'rgba(255,255,255,.02)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontFamily: T.fd, fontWeight: 700, fontSize: 14, color: T.ink, lineHeight: 1.2, flex: 1 }}>{r.headline}</div>
                      <span style={{ padding: '3px 8px', borderRadius: 99, background: `${col}1a`, fontFamily: T.fm, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: col, whiteSpace: 'nowrap', flexShrink: 0 }}>{r.channel}</span>
                    </div>
                    <div style={{ fontFamily: T.fb, fontSize: 12, color: T.ink2, lineHeight: 1.4, marginBottom: 4 }}>{r.body}</div>
                    <div style={{ fontFamily: T.fm, fontSize: 11, fontWeight: 700, color: col, letterSpacing: '.04em' }}>{r.cta}</div>
                  </div>
                );
              })}
              {!adRecsLoading && adRecs !== null && adRecs.length === 0 && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: T.ink3, fontFamily: T.fb, fontSize: 13 }}>No recommendations available.</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
