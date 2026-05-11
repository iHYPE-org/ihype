'use client';

import { usePathname } from 'next/navigation';

const STATS = [
  { label: '1,284 listening', live: true },
  { label: '637 hyped today' },
  { label: '7 shows tonight' },
];

function segmentLabel(pathname: string) {
  const seg = pathname.split('/').filter(Boolean)[0];
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : 'Home';
}

export function HeaderStats() {
  const pathname = usePathname();
  const label = segmentLabel(pathname);

  return (
    <div className="nav-stats">
      <span className="nav-stats-crumb">{label}</span>
      <span className="nav-stats-sep">/</span>
      {STATS.map((s, i) => (
        <span key={i} className="nav-stats-chip">
          {s.live && <span className="nav-stats-live">●</span>}
          {s.label}
        </span>
      ))}
    </div>
  );
}
