import { ProfileType } from '@prisma/client/wasm';
import { db } from '@/lib/db';
import type { DiscoverModuleId } from '@/lib/discover-modules';

export function getProfilePathForType(type: ProfileType, slug: string) {
  if (type === 'DJ') return `/promoters/${slug}`;
  if (type === 'VENUE') return `/venues/${slug}`;
  if (type === 'LISTENER') return `/fans/${slug}`;
  return `/artists/${slug}`;
}

export function getDiscoverPathForType(type: ProfileType) {
  if (type === 'DJ') return '/promoters';
  if (type === 'VENUE') return '/venues';
  if (type === 'LISTENER') return '/fans';
  return '/artists';
}

export function getRoleLandingPathForType(type: ProfileType, module: DiscoverModuleId = 'tool-hub') {
  return `${getDiscoverPathForType(type)}?module=${module}`;
}

function getPreferredProfileTypeForRole(role: string | null | undefined): ProfileType | null {
  if (role === 'ARTIST') return 'ARTIST';
  if (role === 'DJ') return 'DJ';
  if (role === 'VENUE') return 'VENUE';
  if (role === 'FAN') return 'LISTENER';
  return null;
}

export async function getDefaultLandingPathForUser({
  userId,
  role,
  module
}: {
  userId: string;
  role: string | null | undefined;
  module?: DiscoverModuleId;
}) {
  if (role === 'ADMIN') {
    return '/admin';
  }

  const preferredProfileType = getPreferredProfileTypeForRole(role);

  // Check if user has a profile before sending to /home
  const hasProfile = await db.profile.findFirst({
    where: preferredProfileType
      ? { ownerId: userId, type: preferredProfileType }
      : { ownerId: userId },
    select: { id: true },
    orderBy: { createdAt: 'asc' }
  });

  return hasProfile ? '/home' : '/auth/landing?module=tool-hub';
}
