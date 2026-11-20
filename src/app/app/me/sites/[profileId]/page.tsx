import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { ProfileSiteBuilder } from '@/components/ProfileSiteBuilder';
import './site-builder.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Website + Video · iHYPE', robots: { index: false, follow: false } };

export default async function ArtistVenueSiteCreator({
  params,
}: { params: Promise<{ profileId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/app/me/profiles');
  const { profileId } = await params;
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { ownerId: true, type: true },
  });
  if (!profile || !['ARTIST', 'VENUE'].includes(profile.type) || !canManageOwnedResource(session, profile.ownerId)) notFound();
  return <ProfileSiteBuilder profileId={profileId} />;
}
