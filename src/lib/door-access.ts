import type { Session } from 'next-auth';
import { canManageOwnedResource } from '@/lib/permissions';

/**
 * Who may work a show's door: scan tickets and download the manifest.
 *
 * The scan route used to admit the show's CREATOR and an admin, nobody else.
 * The venue dashboard links its owner to the scanner for their next ticketed
 * night — and a show created by a promoter or by the act has a creator who is
 * not the venue, so the person standing at the door was answered 403 by the
 * page their own dashboard sent them to. The cancel route had the right set
 * from the start: the venue's owner, the headliner's owner, the creator, and
 * an admin. The door takes the same four, and both routes read it from here
 * so they cannot disagree again.
 */
export type DoorShow = {
  creatorId: string | null;
  venueProfile: { ownerId: string | null } | null;
  headlinerProfile: { ownerId: string | null } | null;
};

export function canWorkTheDoor(session: Session | null | undefined, show: DoorShow): boolean {
  if (!session?.user?.id) return false;
  return (
    canManageOwnedResource(session, show.venueProfile?.ownerId) ||
    canManageOwnedResource(session, show.headlinerProfile?.ownerId) ||
    session.user.id === show.creatorId
  );
}

/** The `select` every door route needs, so the gate sees the same columns. */
export const DOOR_SHOW_SELECT = {
  id: true,
  slug: true,
  title: true,
  startsAt: true,
  creatorId: true,
  venueProfile: { select: { ownerId: true } },
  headlinerProfile: { select: { ownerId: true } },
} as const;
