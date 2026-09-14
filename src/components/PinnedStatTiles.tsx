import type { Locale } from '@/lib/i18n/locales';
import { formatNumber } from '@/lib/format-locale';
import type { PinnedStatValue } from '@/lib/profile-stats';

/** Renders the stat tiles an owner chose to pin — real values only, computed server-side. */
export function PinnedStatTiles({ stats, accent, locale }: { stats: PinnedStatValue[]; accent: string; locale: Locale }) {
  if (stats.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', margin: '20px 0 4px' }}>
      {stats.map((s) => (
        <div key={s.key}>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: accent, fontFamily: 'var(--font-display)' }}>
            {s.isPercent ? `${Math.round(s.value * 100)}%` : formatNumber(locale, s.value)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-a65)', marginTop: 2 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
