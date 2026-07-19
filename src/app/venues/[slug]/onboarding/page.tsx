import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import VenueOnboardingWizard from '@/components/VenueOnboardingWizard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: profile ? `Set up ${profile.name} · iHYPE` : 'Venue Setup · iHYPE',
    robots: { index: false, follow: false },
  };
}

export default async function VenueOnboardingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/venues/${slug}/onboarding`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      capacity: true,
      roomType: true,
      type: true,
      ownerId: true,
      verificationStatus: true,
    },
  });
  if (!profile || profile.type !== 'VENUE') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  return (
    <VenueOnboardingWizard
      profileId={profile.id}
      slug={profile.slug}
      initialName={profile.name}
      initialCity={profile.city ?? ''}
      initialCapacity={profile.capacity ?? null}
      initialRoomType={profile.roomType ?? ''}
      initialVerificationStatus={profile.verificationStatus}
    />
  );
}
