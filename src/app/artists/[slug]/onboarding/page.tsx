import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { ArtistOnboardingWizard } from '@/components/ArtistOnboardingWizard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: profile ? `Set up · ${profile.name} · iHYPE` : 'Artist setup · iHYPE',
    robots: { index: false, follow: false },
  };
}

export default async function ArtistOnboardingPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/artists/${slug}/onboarding`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      type: true,
      genre: true,
    },
  });
  if (!profile || profile.type !== 'ARTIST') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  return (
    <ArtistOnboardingWizard
      profileId={profile.id}
      slug={profile.slug}
      initialName={profile.name}
      initialGenre={profile.genre ?? ''}
    />
  );
}
