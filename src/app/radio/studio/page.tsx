import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { RadioShowCreator } from '@/components/RadioShowCreator';
import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Radio Show Creator',
  description: 'Build a radio show — crate tracks, voiceover, samples, and ad breaks — for DJs to broadcast on WebRadio.',
};

export default async function RadioStudioPage() {
  const t = await getServerT();
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/radio/studio');
  }

  const profile = await db.profile.findFirst({
    where: { ownerId: session.user.id, type: 'DJ' },
    select: { id: true, name: true, slug: true },
  });

  if (!profile) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, marginBottom: 12 }}>{t('radioStudioPage.needDjPageTitle', 'You need a DJ page first')}</h1>
        <p style={{ color: 'var(--ink-a60)', marginBottom: 20 }}>
          {t('radioStudioPage.needDjPageBody', "Radio Show Creator builds shows from a DJ profile's free-use crate. Set up your DJ page to get started.")}
        </p>
        <Link href="/pages" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
          {t('radioStudioPage.goToPages', 'Go to Pages →')}
        </Link>
      </div>
    );
  }

  const crate = await db.artistMediaAsset.findMany({
    where: { profileId: profile.id, freeUseEnabled: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: { hexId: true, title: true, durationSecs: true },
  });

  return (
    <RadioShowCreator
      initialCrate={crate.map((track) => ({
        hexId: track.hexId,
        title: track.title,
        artistName: profile.name,
        durationSecs: track.durationSecs ?? 180,
      }))}
      profile={{ id: profile.id, name: profile.name, slug: profile.slug }}
    />
  );
}
