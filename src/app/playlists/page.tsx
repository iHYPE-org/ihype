import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { SavedPlaylistPlayButton } from '@/components/SavedPlaylistPlayButton';

export const metadata = { title: 'Saved · iHYPE' };
export const dynamic = 'force-dynamic';

export default async function PlaylistsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const seeds = await db.seed.findMany({
    where: { userId: session.user.id, action: 'save' },
    orderBy: { createdAt: 'desc' },
    take: 500
  });

  if (seeds.length === 0) {
    return (
      <main className="container section">
        <h1>Saved tracks</h1>
        <p className="meta">You haven't saved anything yet. Swipe right on the discovery feed to save tracks.</p>
      </main>
    );
  }

  const mediaIds = [...new Set(seeds.map((s) => s.mediaId))];
  const media = await db.artistMediaAsset.findMany({
    where: { id: { in: mediaIds } },
    select: {
      id: true,
      title: true,
      profile: { select: { name: true, slug: true } }
    }
  });
  const mediaMap = new Map(media.map((m) => [m.id, m]));

  // Group by year-month
  const groups = new Map<string, typeof seeds>();
  for (const seed of seeds) {
    const key = seed.createdAt.toISOString().slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(seed);
  }

  return (
    <main className="container section">
      <h1>Saved tracks</h1>
      <p className="meta">{seeds.length} saved · grouped by month</p>
      {[...groups.entries()].map(([month, items]) => (
        <section key={month} className="section">
          <h2 style={{ marginBottom: 8 }}>
            {new Date(`${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {items.map((seed) => {
              const m = mediaMap.get(seed.mediaId);
              if (!m) return null;
              return (
                <li
                  key={seed.id}
                  className="panel"
                  style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <strong>{m.title}</strong>
                    <div className="meta">{m.profile?.name ?? 'Unknown'}</div>
                  </div>
                  <SavedPlaylistPlayButton id={m.id} title={m.title} artist={m.profile?.name ?? ''} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
