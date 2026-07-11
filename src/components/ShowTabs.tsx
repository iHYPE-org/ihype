'use client';

import { useState, type ReactNode } from 'react';

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'lineup', label: 'Lineup' },
  { id: 'venue', label: 'Venue' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ShowTabs({
  children,
  lineupTab,
  venueTab,
}: {
  children: ReactNode;
  lineupTab: ReactNode;
  venueTab: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>('about');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 24, display: tab === 'about' ? 'block' : 'none' }}>{children}</div>
      <div style={{ marginTop: 24, display: tab === 'lineup' ? 'block' : 'none' }}>{lineupTab}</div>
      <div style={{ marginTop: 24, display: tab === 'venue' ? 'block' : 'none' }}>{venueTab}</div>
    </div>
  );
}
