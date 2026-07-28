import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';

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
  const t = await getServerT();

  const profile = await db.profile.findFirst({
    where: { hexId: code },
    select: { name: true, slug: true, type: true, avatarImage: true, headline: true }
  });

  const inviterName = profile?.name ?? t('inviteCodePage.defaultInviterName', 'A music fan');

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
        {t('inviteCodePage.eyebrow', "You're invited")}
      </p>
      <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, color: 'var(--ink)', marginBottom: 8 }}>
        {inviterName} {t('inviteCodePage.wantsYouOnIhype', 'wants you on iHYPE')}
      </h1>
      {profile?.headline ? (
        <p style={{ fontFamily: 'var(--f-m)', fontSize: 14, color: 'var(--ink-2)', marginBottom: 24 }}>
          {profile.headline}
        </p>
      ) : (
        <p style={{ fontFamily: 'var(--f-m)', fontSize: 14, color: 'var(--ink-2)', marginBottom: 24 }}>
          {t('inviteCodePage.defaultTagline', 'Discover music, hype artists, grab tickets — all in one place.')}
        </p>
      )}
      <Link
        href={`/register?ref=${code}`}
        className="button"
        style={{ display: 'inline-block', marginBottom: 16 }}
      >
        {t('inviteCodePage.joinFree', 'Join iHYPE free')}
      </Link>
      <p style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>
        {t('inviteCodePage.alreadyHaveAccount', 'Already have an account?')}{' '}
        <Link href="/login" className="text-link">{t('inviteCodePage.signIn', 'Sign in')}</Link>
      </p>
    </div>
  );
}
