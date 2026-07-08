// Canonical profile-type → public-path mapping.
// Client-safe (no DB imports) so workbench client components can share it.
// Server code should keep importing these via '@/lib/account-routing',
// which re-exports them.
import type { ProfileType } from '@prisma/client';

export function getProfilePathForType(type: ProfileType | (string & {}), slug: string) {
  if (type === 'DJ') return `/promoters/${slug}`;
  if (type === 'VENUE') return `/venues/${slug}`;
  if (type === 'LISTENER') return `/fans/${slug}`;
  return `/artists/${slug}`;
}

export function getDiscoverPathForType(type: ProfileType | (string & {})) {
  if (type === 'DJ') return '/promoters';
  if (type === 'VENUE') return '/venues';
  if (type === 'LISTENER') return '/fans';
  return '/artists';
}
