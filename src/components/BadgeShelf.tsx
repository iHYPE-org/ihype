const BADGE_META: Record<string, { emoji: string; label: string }> = {
  first_hype: { emoji: '🔥', label: 'First Hype' },
  hype_10: { emoji: '⚡', label: '10 Hypes' },
  hype_50: { emoji: '💥', label: '50 Hypes' },
  listener_100: { emoji: '🎧', label: 'Century Listener' },
  streak_7: { emoji: '📅', label: '7-Day Streak' },
};

type Badge = { type: string; awardedAt: Date };

export function BadgeShelf({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {badges.map((badge) => {
        const meta = BADGE_META[badge.type] ?? { emoji: '🏅', label: badge.type };
        return (
          <span
            key={badge.type}
            title={`Awarded ${badge.awardedAt.toLocaleDateString()}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {meta.emoji} {meta.label}
          </span>
        );
      })}
    </div>
  );
}
