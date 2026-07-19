import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { DJOnboardingWizard } from '@/components/DJOnboardingWizard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: profile ? `DJ setup · ${profile.name} · iHYPE` : 'DJ setup · iHYPE',
    robots: { index: false, follow: false },
  };
}

export default async function DJOnboardingPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/promoters/${slug}/onboarding`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      type: true,
      city: true,
      genres: true,
      links: true,
      verificationStatus: true,
    },
  });
  if (!profile || profile.type !== 'DJ') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  return (
    <DJOnboardingWizard
      profileId={profile.id}
      slug={profile.slug}
      initialName={profile.name}
      initialCity={profile.city ?? ''}
      initialGenre={profile.genres?.[0] ?? ''}
      initialLink={profile.links ?? ''}
      initialVerificationStatus={profile.verificationStatus}
    />
  );
}
