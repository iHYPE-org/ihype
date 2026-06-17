'use client';

import React from 'react';
import type { WorkbenchData } from '@/types/workbench';
import { ViewSeeds } from './ViewSeeds';

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
  void onPickTrack; // not needed for Seeds-only view but kept in props for compatibility

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '32px 32px 20px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Rising near you</div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '-.04em', margin: 0, lineHeight: 1 }}>Plant a hype. Grow a scene.</h1>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ViewSeeds data={data} seedPlaying={seedPlaying} setSeedPlaying={setSeedPlaying} onSave={onSeedSave} />
      </div>
    </div>
  );
}
