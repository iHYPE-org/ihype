// Canonical profile-type → public-path mapping.
// Client-safe (no DB imports) so workbench client components can share it.
// Server code should keep importing these via '@/lib/account-routing',
// which re-exports them.
import type { ProfileType } from '@prisma/client';

// DJ is deliberately absent from both functions, and falls through to the
// ARTIST branch. The role is being removed (docs/dj-role-removal-scope.md); the
// three DJ-typed rows were reassigned to ARTIST in migration
// 20260806130000_reassign_dj_profiles, and /promoters/* and /djs/* now redirect
// to /artists/*. Returning /promoters/[slug] here would emit a link that only
// works because a redirect catches it.
//
// The `DJ` enum value itself still exists until step 4, so a stale row would
// land on /artists/[slug] — which is exactly where it should go.

export function getProfilePathForType(type: ProfileType | (string & {}), slug: string) {
  if (type === 'VENUE') return `/venues/${slug}`;
  if (type === 'LISTENER') return `/fans/${slug}`;
  return `/artists/${slug}`;
}

/**
 * The SHELL pane for a profile — what the product links to itself (row 513).
 * `getProfilePathForType` returns the public alias (`/artists/<slug>`, …),
 * which is right for a URL that leaves the product (a Stripe business URL, a
 * share) and wrong for an in-product link: every alias is a `redirects()` hop,
 * and the profile editor built `/artists/<slug>` for FAN profiles, which the
 * artist pane answers "No such artist".
 */
export function getAppProfilePathForType(type: ProfileType | (string & {}), slug: string) {
  if (type === 'VENUE') return `/app/venues/${slug}`;
  if (type === 'LISTENER') return `/app/fans/${slug}`;
  return `/app/artists/${slug}`;
}

export function getDiscoverPathForType(type: ProfileType | (string & {})) {
  if (type === 'VENUE') return '/venues';
  if (type === 'LISTENER') return '/fans';
  return '/artists';
}
