import { db } from '@/lib/db';
import type { ProfileType } from '@prisma/client/wasm';
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

export async function getDefaultLandingPathForUser({
  userId,
  role,
  module
}: {
  userId: string;
  role: string | null | undefined;
  module?: DiscoverModuleId;
}) {
  void module;
  if (role === 'ADMIN') {
    return '/admin';
  }

  const hasProfile = await db.profile.findFirst({
    where: { ownerId: userId },
    select: { id: true },
    orderBy: { createdAt: 'asc' }
  });

  return hasProfile ? '/home' : '/register';
}
