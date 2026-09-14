'use client';

import { useState, type ReactNode } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { showTabLabel } from '@/lib/i18n-enum-labels';

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
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>('about');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            className={tab === tabDef.id ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setTab(tabDef.id)}
            type="button"
          >
            {showTabLabel(t, tabDef.label)}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 24, display: tab === 'about' ? 'block' : 'none' }}>{children}</div>
      <div style={{ marginTop: 24, display: tab === 'lineup' ? 'block' : 'none' }}>{lineupTab}</div>
      <div style={{ marginTop: 24, display: tab === 'venue' ? 'block' : 'none' }}>{venueTab}</div>
    </div>
  );
}
