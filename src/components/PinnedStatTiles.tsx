import type { PinnedStatValue } from '@/lib/profile-stats';

/** Renders the stat tiles an owner chose to pin — real values only, computed server-side. */
export function PinnedStatTiles({ stats, accent }: { stats: PinnedStatValue[]; accent: string }) {
  if (stats.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', margin: '20px 0 4px' }}>
      {stats.map((s) => (
        <div key={s.key}>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: accent, fontFamily: 'var(--font-display)' }}>
            {s.isPercent ? `${Math.round(s.value * 100)}%` : s.value.toLocaleString()}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a65)', marginTop: 2 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
