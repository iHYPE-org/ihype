'use client';

import React from 'react';

export function Toggle({ on, onChange, small }: { on: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  const w = small ? 30 : 38, h = small ? 18 : 22;
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: w, height: h, borderRadius: 99,
        background: on ? 'var(--accent)' : 'var(--bg-4)',
        position: 'relative', transition: 'background .2s', flexShrink: 0,
        border: 'none', cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? w - h + 2 : 2,
        width: h - 4, height: h - 4, borderRadius: '50%',
        background: 'var(--ink)', transition: 'left .2s',
      }} />
    </button>
  );
}
