import type { ShowStatus } from '@prisma/client';

/**
 * What "upcoming shows" means on a profile page.
 *
 * An artist and a venue each render at two routes — `/artists/[slug]` and
 * `/app/artists/[slug]`, `/venues/[slug]` and `/app/venues/[slug]` — for the
 * same reason a show does: the public one has to render logged out because it
 * is the URL people share, and the shell one is the same profile inside the
 * signed-in frame. Four pages, one question, and they answered it four
 * different ways. Both answers were wrong, in opposite directions:
 *
 *  - **The public pages listed shows that are not public.** They filtered
 *    `status === 'LIVE' || startsAt >= now` over an unfiltered query, with no
 *    status gate at all — so a **DRAFT** show appeared in the upcoming list of
 *    a public profile, and so did a **CANCELED** one. The draft case
 *    contradicts the show page directly: `canViewShow()` 404s a draft for
 *    everyone but its creator, so the listing disclosed the title, date and
 *    venue of a show the detail page then refused to show. A cancelled show
 *    being listed as upcoming is its own, simpler problem.
 *  - **The shell pages dropped the show that is happening right now.** They
 *    queried `status in (SCHEDULED, LIVE) AND startsAt >= now`, and a LIVE show
 *    started an hour ago fails that second clause. The one show a member is
 *    most likely to be looking for — the one on stage — was missing from the
 *    shell and present on the public page.
 *
 * So: a show is upcoming when it is publicly visible AND it has not finished.
 * LIVE always counts, whenever it started.
 *
 * NOTE what is deliberately NOT here. The other rule these four pages share —
 * the profile must be the right type, and not a demo account while demo
 * content is hidden — is written out in each of them and stays that way. All
 * four already agreed about it, and a helper wrapping two boolean checks
 * behind an injected `isDemoOwner` callback would be longer at every call site
 * than the thing it replaced. Duplication that has never drifted is not the
 * problem this module exists for; disagreement is.
 */

/** The statuses a stranger may see listed. DRAFT is private; CANCELED is over. */
export const PUBLIC_SHOW_STATUSES: ShowStatus[] = ['SCHEDULED', 'LIVE'];

export type ListableShow = {
  status: ShowStatus;
  startsAt: Date;
};

/** True when this show belongs in a profile's "upcoming" list. */
export function isUpcomingShow(show: ListableShow, now: Date = new Date()): boolean {
  if (!PUBLIC_SHOW_STATUSES.includes(show.status)) return false;
  // A show on stage is upcoming even though it started in the past — that is
  // the clause the shell copies were missing.
  if (show.status === 'LIVE') return true;
  return show.startsAt >= now;
}

/**
 * The same rule as a Prisma `where` fragment, for the pages that filter in the
 * query rather than in memory.
 *
 * It has to be a disjunction for the same reason `isUpcomingShow` does: LIVE
 * ignores the clock, SCHEDULED does not. Expressing it as
 * `status in (...) AND startsAt >= now` is the bug this replaces, and it is an
 * easy one to reintroduce because it reads as though it says the same thing.
 */
export function upcomingShowWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: 'LIVE' as ShowStatus },
      { status: 'SCHEDULED' as ShowStatus, startsAt: { gte: now } },
    ],
  };
}

/**
 * The complement of `upcomingShowWhere` over the public statuses: a show that
 * was visible and is over. ENDED always counts; SCHEDULED counts once its
 * start has passed, because a show whose status was never flipped still
 * happened. LIVE is never past (it is upcoming, above), and DRAFT/CANCELED are
 * neither — a cancelled show did not take place and must not inflate a "past
 * events" figure that sits beside a tickets-sold one.
 *
 * Written as a disjunction for the same reason as its sibling: `status in
 * (SCHEDULED, ENDED) AND startsAt < now` would drop an ENDED show whose
 * `startsAt` was edited forward, and reads as though it would not.
 */
export function pastShowWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: 'ENDED' as ShowStatus },
      { status: 'SCHEDULED' as ShowStatus, startsAt: { lt: now } },
    ],
  };
}
