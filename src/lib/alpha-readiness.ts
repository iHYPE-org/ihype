/**
 * What the alpha cohort needs on the ground before the doors open.
 *
 * There is deliberately NO radio-show target. There used to be one — "schedule
 * at least 1 radio show" — and it could never be satisfied again: DJ-authored
 * radio shows were retired as a product decision, `RadioShowCreator` is gone,
 * and nothing in the app can author one. It counted `Show.isRadioShow` rows,
 * of which only pre-retirement rows can exist. A permanent blocker on a
 * readiness board teaches everyone to read past the board, which is how the
 * Lighthouse budget stopped being read.
 *
 * There is also NO track minimum (owner, 2026-09-02: "There should be no
 * minimum number of uploads"). This used to require ten playable tracks on the
 * reasoning that the always-on station is assembled from them. It still is —
 * the count is reported on /api/health so an operator can see an empty station
 * coming — but a number of uploads is not a condition of opening the doors.
 */
export const ALPHA_CONTENT_TARGETS = {
  administrators: 2,
  discoverableArtists: 5,
  discoverableVenues: 2,
  upcomingEvents: 2,
} as const;

const RESTORE_EVIDENCE_MAX_AGE_DAYS = 35;

export function evaluateRestoreDrill(raw: string | undefined, now = Date.now()) {
  if (!raw) return { ready: false, verifiedAt: null, ageDays: null };
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp) || timestamp > now) return { ready: false, verifiedAt: null, ageDays: null };
  const ageDays = Math.floor((now - timestamp) / 86_400_000);
  return {
    ready: ageDays <= RESTORE_EVIDENCE_MAX_AGE_DAYS,
    verifiedAt: new Date(timestamp).toISOString(),
    ageDays,
  };
}

export function buildAlphaBlockers({
  administrators,
  discoverableArtists,
  discoverableVenues,
  upcomingEvents,
  inviteOnlySignup,
  restoreDrillReady,
  launchBlockers = [],
}: {
  administrators: number;
  discoverableArtists: number;
  discoverableVenues: number;
  upcomingEvents: number;
  inviteOnlySignup: boolean;
  restoreDrillReady: boolean;
  launchBlockers?: string[];
}) {
  return [
    ...launchBlockers,
    administrators < ALPHA_CONTENT_TARGETS.administrators && `Promote a second administrator (${administrators}/${ALPHA_CONTENT_TARGETS.administrators} ready).`,
    !restoreDrillReady && 'Complete a database restore drill and set RESTORE_DRILL_VERIFIED_AT to its ISO timestamp.',
    !inviteOnlySignup && 'Keep invite-only registration enabled during alpha.',
    discoverableArtists < ALPHA_CONTENT_TARGETS.discoverableArtists && `Onboard at least ${ALPHA_CONTENT_TARGETS.discoverableArtists} discoverable artists (${discoverableArtists} ready).`,
    discoverableVenues < ALPHA_CONTENT_TARGETS.discoverableVenues && `Onboard at least ${ALPHA_CONTENT_TARGETS.discoverableVenues} discoverable venues (${discoverableVenues} ready).`,
    upcomingEvents < ALPHA_CONTENT_TARGETS.upcomingEvents && `Publish at least ${ALPHA_CONTENT_TARGETS.upcomingEvents} upcoming events (${upcomingEvents} ready).`,
  ].filter(Boolean) as string[];
}
