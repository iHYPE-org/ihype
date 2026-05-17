import Link from 'next/link';
import { db } from '@/lib/db';

function pathForProfile(type: string, slug: string): string {
  if (type === 'VENUE') return `/venues/${slug}`;
  if (type === 'DJ') return `/djs/${slug}`;
  return `/artists/${slug}`;
}

export async function PeopleAlsoHype({ profileId }: { profileId: string }) {
  // Find users who also hyped this profile
  const hypers = await db.profileHypeEvent.findMany({
    where: { profileId },
    select: { userId: true },
    take: 100
  });
  const hyperIds = hypers.map((h) => h.userId);
  if (hyperIds.length === 0) return null;

  // Find other profiles they hyped
  const otherHypes = await db.profileHypeEvent.findMany({
    where: {
      userId: { in: hyperIds },
      profileId: { not: profileId }
    },
    select: { profileId: true },
    take: 300
  });

  // Count occurrences
  const counts = new Map<string, number>();
  for (const h of otherHypes) {
    counts.set(h.profileId, (counts.get(h.profileId) ?? 0) + 1);
  }

  // Top 3
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ id, count }));

  if (top.length === 0) return null;

  const profiles = await db.profile.findMany({
    where: { id: { in: top.map((t) => t.id) } },
    select: { id: true, slug: true, name: true, type: true, city: true }
  });
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const cards = top
    .map((t) => {
      const p = profileMap.get(t.id);
      if (!p) return null;
      return { ...p, count: t.count };
    })
    .filter(Boolean) as Array<{
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string | null;
    count: number;
  }>;

  if (cards.length === 0) return null;

  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 14, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        People also hype
      </h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {cards.map((card) => (
          <Link
            key={card.id}
            href={pathForProfile(card.type, card.slug)}
            className="panel"
            style={{
              padding: '10px 14px',
              minWidth: 140,
              textDecoration: 'none',
              color: 'var(--ink)'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>{card.name}</div>
            {card.city && (
              <div className="meta" style={{ fontSize: 11 }}>
                {card.city}
              </div>
            )}
            <div className="meta" style={{ fontSize: 11, marginTop: 4 }}>
              {card.count} shared hypers
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
