import type { Session } from 'next-auth';
import { canManageOwnedResource, isAdminSession } from '@/lib/permissions';

/**
 * Who may run a show after it exists: the venue's owner, the headliner's
 * owner, whoever created it, and an administrator.
 *
 * The cancel route, the cancel page and the door (`canWorkTheDoor`) have
 * admitted these four since they were written; `PATCH /api/shows/[showId]`
 * admitted the CREATOR alone and the public show page drew its organiser
 * links for the creator alone, so a venue that could cancel a show could
 * not correct its date, and could not see the Cancel link that its own
 * route would have honoured (DESIGN_SYNC row 446). One rule, read by every
 * organiser surface, so the link and the route it points at agree.
 */
export type OrganizedShow = {
  creatorId: string | null;
  venueProfile?: { ownerId: string | null } | null;
  headlinerProfile?: { ownerId: string | null } | null;
};

export function isShowOrganizer(session: Session | null | undefined, show: OrganizedShow): boolean {
  if (!session?.user?.id) return false;
  return (
    isAdminSession(session) ||
    session.user.id === show.creatorId ||
    canManageOwnedResource(session, show.venueProfile?.ownerId) ||
    canManageOwnedResource(session, show.headlinerProfile?.ownerId)
  );
}

/** The `select` a caller needs on a Show for `isShowOrganizer`. */
export const ORGANIZER_SHOW_SELECT = {
  creatorId: true,
  venueProfile: { select: { ownerId: true } },
  headlinerProfile: { select: { ownerId: true } },
} as const;
