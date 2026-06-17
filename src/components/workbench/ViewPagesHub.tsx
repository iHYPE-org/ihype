'use client';

import React, { useState } from 'react';
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
    <div style={{ display: 'flex', gap: 6, padding: '0 32px', marginBottom: 28 }}>
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
  const [kicker, title] = HEADERS[sub] ?? HEADERS['Page Editor'];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '32px 32px 20px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{kicker}</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '-.04em', margin: '0 0 20px', lineHeight: 1 }}>{title}</h1>
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
