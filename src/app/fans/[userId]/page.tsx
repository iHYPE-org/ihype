import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getDiscoveryStreak } from '@/lib/streaks';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ userId: string }> }
): Promise<Metadata> {
  const { userId } = await params;
  const user = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (!user) return { title: 'Fan | iHYPE' };
  return { title: `${user.username} | iHYPE Fan` };
}

export default async function FanProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      createdAt: true,
      profileHypeEvents: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          profile: {
            select: { id: true, slug: true, name: true, type: true }
          }
        }
      }
    }
  });

  if (!user) notFound();

  const [hypeCount, streak] = await Promise.all([
    db.profileHypeEvent.count({ where: { userId } }),
    getDiscoveryStreak(userId)
  ]);

  return (
    <main className="container section">
      <header className="panel" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
        <div className="badge">FAN</div>
        <h1 className="title">{user.username}</h1>
        <div className="meta" style={{ marginTop: 4 }}>
          Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 24 }}>{hypeCount}</div>
            <div className="meta" style={{ fontSize: 11, letterSpacing: '.1em' }}>HYPE COUNT</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 24 }}>{streak}</div>
            <div className="meta" style={{ fontSize: 11, letterSpacing: '.1em' }}>STREAK</div>
          </div>
        </div>
      </header>

      <section className="panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Hyped Artists</h2>
        {user.profileHypeEvents.length === 0 ? (
          <p className="meta">No hyped artists yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {user.profileHypeEvents.map((ev) => {
              const p = ev.profile;
              const href = p.type === 'VENUE' ? `/venues/${p.slug}` : p.type === 'DJ' ? `/djs/${p.slug}` : `/artists/${p.slug}`;
              return (
                <li key={ev.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <Link href={href} style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.name}</Link>
                  <span className="meta" style={{ marginLeft: 8 }}>{p.type}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
