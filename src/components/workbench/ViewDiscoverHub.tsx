'use client';

import React, { useState } from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { ViewSeeds } from './ViewSeeds';
import { ViewRadio } from './ViewRadio';
import ProfileBrowser from './ViewDiscover';

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
            border: o === value ? '1px solid rgba(34,229,212,.35)' : '1px solid var(--line-2)',
            background: o === value ? 'rgba(34,229,212,.1)' : 'transparent',
            color: o === value ? 'var(--ink)' : 'var(--ink-2)',
            transition: 'background .14s, color .14s',
          }}
        >{o}</button>
      ))}
    </div>
  );
}

const SUB_TABS = ['Seeds', 'Radio', 'Charts'];

const HEADERS: Record<string, [string, string]> = {
  Seeds:  ['Rising near you', 'Plant a hype. Grow a scene.'],
  Radio:  ['On air now', 'Artist-curated radio.'],
  Charts: ['Discover', "Artists, venues & DJs you haven't hyped yet."],
};

export function ViewDiscoverHub({
  data,
  seedPlaying,
  setSeedPlaying,
  onSeedSave,
  onPickTrack,
}: {
  data: WorkbenchData;
  seedPlaying: boolean;
  setSeedPlaying: (p: boolean) => void;
  onSeedSave: (idx: number) => void;
  onPickTrack: (i: number) => void;
}) {
  const [sub, setSub] = useState('Seeds');
  const [kicker, title] = HEADERS[sub];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '32px 32px 20px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{kicker}</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '-.04em', margin: '0 0 20px', lineHeight: 1 }}>{title}</h1>
      </div>
      <div style={{ flexShrink: 0 }}>
        <SubTabs value={sub} options={SUB_TABS} onChange={setSub} />
      </div>

      {sub === 'Seeds' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ViewSeeds data={data} seedPlaying={seedPlaying} setSeedPlaying={setSeedPlaying} onSave={onSeedSave} />
        </div>
      )}
      {sub === 'Radio' && (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <ViewRadio data={data} onPickTrack={onPickTrack} />
        </div>
      )}
      {sub === 'Charts' && (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <ProfileBrowser data={data} />
        </div>
      )}
    </div>
  );
}
