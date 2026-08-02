export const ALPHA_CONTENT_TARGETS = {
  administrators: 2,
  playableTracks: 10,
  discoverableArtists: 5,
  discoverableVenues: 2,
  upcomingEvents: 2,
  scheduledRadioShows: 1,
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
  playableTracks,
  discoverableArtists,
  discoverableVenues,
  upcomingEvents,
  scheduledRadioShows,
  inviteOnlySignup,
  restoreDrillReady,
  launchBlockers = [],
}: {
  administrators: number;
  playableTracks: number;
  discoverableArtists: number;
  discoverableVenues: number;
  upcomingEvents: number;
  scheduledRadioShows: number;
  inviteOnlySignup: boolean;
  restoreDrillReady: boolean;
  launchBlockers?: string[];
}) {
  return [
    ...launchBlockers,
    administrators < ALPHA_CONTENT_TARGETS.administrators && `Promote a second administrator (${administrators}/${ALPHA_CONTENT_TARGETS.administrators} ready).`,
    !restoreDrillReady && 'Complete a database restore drill and set RESTORE_DRILL_VERIFIED_AT to its ISO timestamp.',
    !inviteOnlySignup && 'Keep invite-only registration enabled during alpha.',
    playableTracks < ALPHA_CONTENT_TARGETS.playableTracks && `Publish at least ${ALPHA_CONTENT_TARGETS.playableTracks} playable local tracks (${playableTracks} ready).`,
    discoverableArtists < ALPHA_CONTENT_TARGETS.discoverableArtists && `Onboard at least ${ALPHA_CONTENT_TARGETS.discoverableArtists} discoverable artists (${discoverableArtists} ready).`,
    discoverableVenues < ALPHA_CONTENT_TARGETS.discoverableVenues && `Onboard at least ${ALPHA_CONTENT_TARGETS.discoverableVenues} discoverable venues (${discoverableVenues} ready).`,
    upcomingEvents < ALPHA_CONTENT_TARGETS.upcomingEvents && `Publish at least ${ALPHA_CONTENT_TARGETS.upcomingEvents} upcoming events (${upcomingEvents} ready).`,
    scheduledRadioShows < ALPHA_CONTENT_TARGETS.scheduledRadioShows && `Schedule at least ${ALPHA_CONTENT_TARGETS.scheduledRadioShows} radio show (${scheduledRadioShows} ready).`,
  ].filter(Boolean) as string[];
}
