'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { WorkbenchData } from '@/types/workbench';
import { DEFAULT_PREFS } from './types';
import { ViewSettings } from './ViewSettings';
import { ViewArtistPage } from './ViewArtistPage';
import { ViewVenuePage } from './ViewVenuePage';

const ViewPageStudio = dynamic(() => import('./ViewPageStudio'), {
  loading: () => (
    <div style={{ height: 240, background: 'linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
  ),
});

function SubTabs({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '12px 22px 0', marginBottom: 0 }}>
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            padding: '7px 16px', borderRadius: 99, cursor: 'pointer',
            fontFamily: 'var(--f-b)', fontWeight: 600, fontSize: 13,
            border: o === value ? '1px solid rgba(185,131,255,.35)' : '1px solid var(--line-2)',
            background: o === value ? 'rgba(185,131,255,.1)' : 'transparent',
            color: o === value ? 'var(--ink)' : 'var(--ink-2)',
            transition: 'background .14s, color .14s',
          }}
        >{o}</button>
      ))}
    </div>
  );
}

function MyPagePanel({ data }: { data: WorkbenchData }) {
  const role = (data.profileType ?? '').toUpperCase();
  if (role === 'ARTIST') return <ViewArtistPage data={data} />;
  if (role === 'VENUE') return <ViewVenuePage data={data} />;
  const djRole: 'dj' | 'fan' = role === 'DJ' ? 'dj' : 'fan';
  return (
    <div style={{ padding: '0 32px 32px' }}>
      <ViewPageStudio data={data} defaultRole={djRole} />
    </div>
  );
}

const HEADERS: Record<string, [string, string]> = {
  'Page Editor': ['Build your page', 'Customize what fans and venues see.'],
  'My Page':     ['Your public page', 'How the world sees you.'],
  Settings:      ['Settings & prefs', 'Profile, notifications, payout.'],
};

export function ViewPagesHub({
  data,
  prefs,
  setPref,
  onBack,
}: {
  data: WorkbenchData;
  prefs: typeof DEFAULT_PREFS;
  setPref: (k: string, v: unknown) => void;
  onBack?: () => void;
}) {
  const role = (data.profileType ?? '').toUpperCase();
  const hasPowerPage = role === 'ARTIST' || role === 'VENUE' || role === 'DJ';
  const tabs = hasPowerPage ? ['Page Editor', 'My Page', 'Settings'] : ['Page Editor', 'Settings'];
  const studioRole: 'artist' | 'venue' | 'dj' | 'fan' =
    role === 'ARTIST' ? 'artist' : role === 'VENUE' ? 'venue' : role === 'DJ' ? 'dj' : 'fan';

  const [sub, setSub] = useState('Page Editor');
  const [shareStatus, setShareStatus] = useState<'idle' | 'done'>('idle');
  const [kicker, title] = HEADERS[sub] ?? HEADERS['Page Editor'];

  const showShareLink = (role === 'LISTENER' || role === 'DJ') && !!data.profileHexId;

  const handleShareInvite = useCallback(async () => {
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

  const chipBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 13px', borderRadius: 99, cursor: 'pointer',
    fontFamily: 'var(--f-m)', fontSize: 11, fontWeight: 700,
    letterSpacing: '.06em', textDecoration: 'none', whiteSpace: 'nowrap',
    border: 'none', background: 'none',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px 14px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>{kicker}</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.025em', margin: '0 0 12px', lineHeight: 1 }}>{title}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSub('Page Editor')}
            style={{
              ...chipBase,
              border: '1px solid rgba(255,255,255,.15)',
              background: sub === 'Page Editor' ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.04)',
              color: 'var(--ink)',
            }}
          >
            Edit My Page
          </button>
          {data.profilePath && data.hasPublishedPage && (
            <a
              href={data.profilePath}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...chipBase,
                border: '1px solid rgba(255,80,41,.4)',
                background: 'rgba(255,80,41,.06)',
                color: '#ff5029',
              }}
            >
              View Your Page ↗
            </a>
          )}
          {showShareLink && (
            <button
              onClick={() => { void handleShareInvite(); }}
              style={{
                ...chipBase,
                border: shareStatus === 'done' ? '1px solid rgba(34,229,212,.4)' : '1px solid rgba(185,131,255,.35)',
                background: shareStatus === 'done' ? 'rgba(34,229,212,.1)' : 'rgba(185,131,255,.08)',
                color: shareStatus === 'done' ? '#22e5d4' : 'var(--ink)',
              }}
            >
              {shareStatus === 'done' ? 'Link copied ✓' : 'Share My Link'}
            </button>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <SubTabs value={sub} options={tabs} onChange={setSub} />
      </div>

      {sub === 'Page Editor' && (
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <ViewPageStudio data={data} defaultRole={studioRole} />
        </div>
      )}
      {sub === 'My Page' && (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <MyPagePanel data={data} />
        </div>
      )}
      {sub === 'Settings' && (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <ViewSettings prefs={prefs} setPref={setPref} data={data} onBack={onBack} />
        </div>
      )}
    </div>
  );
}
