import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pages · iHYPE',
  description: 'Your iHYPE pages — artist, venue, and promoter profiles you manage.',
  robots: { index: false, follow: false },
};

const TYPE_COLOR: Record<string, string> = {
  ARTIST: '#ff5029',
  DJ: '#ff3e9a',
  VENUE: '#22e5d4',
  FAN: '#b983ff',
};

const TYPE_LABEL: Record<string, string> = {
  ARTIST: 'Artist',
  DJ: 'Promoter / DJ',
  VENUE: 'Venue',
  FAN: 'Fan',
};

const profileRoute = (type: string, slug: string) =>
  type === 'VENUE' ? `/venues/${slug}` : `/artists/${slug}`;

export default async function PagesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/pages');
  }

  const profiles = await db.profile.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, slug: true, name: true, type: true, city: true,
      stateRegion: true, hypeCount: true, verificationStatus: true,
      _count: { select: { headlinedShows: true } },
    },
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
            YOUR PAGES
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>
            Manage your profiles
          </h1>
        </div>
        <Link href="/register?addPage=1" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 18px', background: 'var(--accent)', color: '#fff',
          borderRadius: 8, fontWeight: 700, fontSize: 13, letterSpacing: '.04em',
          textDecoration: 'none',
        }}>
          + Add page
        </Link>
      </div>

      {profiles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 8, color: 'var(--ink)' }}>
            No pages yet
          </p>
          <p style={{ fontSize: 14, color: 'rgba(240,235,229,.5)', marginBottom: 24 }}>
            Create an artist, venue, or promoter page to get started.
          </p>
          <Link href="/register?addPage=1" style={{
            display: 'inline-block', padding: '12px 24px',
            background: 'var(--accent)', color: '#fff',
            borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>
            Create your first page →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {profiles.map(p => {
            const color = TYPE_COLOR[p.type] ?? '#ff5029';
            return (
              <div key={p.id} style={{
                display: 'flex', gap: 16, alignItems: 'center',
                padding: '18px 20px', border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 10, background: 'var(--bg-2, #100d09)',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 24, flexShrink: 0,
                  background: `linear-gradient(135deg, ${color}, #b983ff)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>
                  {p.type === 'VENUE' ? '🏛️' : p.type === 'DJ' ? '🎛️' : '🎤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>
                      {p.name}
                    </span>
                    {p.verificationStatus === 'VERIFIED' && (
                      <span style={{ fontSize: 12, color, fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(240,235,229,.45)' }}>
                    <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', marginRight: 8 }}>
                      {TYPE_LABEL[p.type] ?? p.type}
                    </span>
                    {p.city && `${p.city}${p.stateRegion ? `, ${p.stateRegion}` : ''} · `}
                    {p._count.headlinedShows} show{p._count.headlinedShows !== 1 ? 's' : ''}
                    {p.hypeCount > 0 ? ` · 🔥 ${p.hypeCount.toLocaleString()} hypes` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link href={profileRoute(p.type, p.slug)} style={{
                    padding: '8px 14px', border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 6, fontSize: 12, color: 'rgba(240,235,229,.6)',
                    textDecoration: 'none', fontFamily: 'var(--font-mono)',
                  }}>
                    View
                  </Link>
                  <Link href="/studio" style={{
                    padding: '8px 14px', background: 'rgba(255,80,41,.15)',
                    border: '1px solid rgba(255,80,41,.25)',
                    borderRadius: 6, fontSize: 12, color: 'var(--accent)',
                    textDecoration: 'none', fontFamily: 'var(--font-mono)',
                  }}>
                    Studio
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: 40, fontSize: 11, color: 'rgba(240,235,229,.25)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
        iHYPE · 0% platform fee · 45/45/10 split · admin@ihype.org
      </p>
    </div>
  );
}
