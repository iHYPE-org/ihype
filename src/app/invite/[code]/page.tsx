import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const profile = await db.profile.findFirst({
    where: { hexId: code },
    select: { name: true }
  });
  const name = profile?.name ?? 'Someone';
  return {
    title: `${name} invited you to iHYPE`,
    description: `Join iHYPE — the music discovery platform — via ${name}'s invite link.`,
    openGraph: {
      title: `${name} invited you to iHYPE`,
      description: `Discover music, hype artists, buy tickets, and more.`
    },
    twitter: { card: 'summary', title: `${name} invited you to iHYPE` }
  };
}

export default async function InviteLandingPage({ params }: Props) {
  const { code } = await params;

  const profile = await db.profile.findFirst({
    where: { hexId: code },
    select: { name: true, slug: true, type: true, avatarImage: true, headline: true }
  });

  const inviterName = profile?.name ?? 'A music fan';

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
        You&apos;re invited
      </p>
      <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, color: 'var(--ink)', marginBottom: 8 }}>
        {inviterName} wants you on iHYPE
      </h1>
      {profile?.headline ? (
        <p style={{ fontFamily: 'var(--f-m)', fontSize: 14, color: 'var(--ink-2)', marginBottom: 24 }}>
          {profile.headline}
        </p>
      ) : (
        <p style={{ fontFamily: 'var(--f-m)', fontSize: 14, color: 'var(--ink-2)', marginBottom: 24 }}>
          Discover music, hype artists, grab tickets — all in one place.
        </p>
      )}
      <Link
        href={`/register?ref=${code}`}
        className="button"
        style={{ display: 'inline-block', marginBottom: 16 }}
      >
        Join iHYPE free
      </Link>
      <p style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>
        Already have an account?{' '}
        <Link href="/login" className="text-link">Sign in</Link>
      </p>
    </div>
  );
}
