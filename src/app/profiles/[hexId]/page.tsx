import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { normalizeHexId } from '@/lib/hex-id';

function getProfilePath(type: 'ARTIST' | 'DJ' | 'VENUE' | 'LISTENER', slug: string) {
  if (type === 'DJ') return `/promoters/${slug}`;
  if (type === 'VENUE') return `/venues/${slug}`;
  if (type === 'LISTENER') return `/listeners/${slug}`;
  return `/artists/${slug}`;
}

export default async function ProfileHexRedirectPage({
  params
}: {
  params: Promise<{ hexId: string }>;
}) {
  const { hexId } = await params;
  const normalizedHexId = normalizeHexId(hexId);

  if (!normalizedHexId) {
    return notFound();
  }

  const profile = await db.profile.findUnique({
    where: { hexId: normalizedHexId },
    select: {
      slug: true,
      type: true
    }
  });

  if (!profile) {
    return notFound();
  }

  redirect(getProfilePath(profile.type, profile.slug));
}
