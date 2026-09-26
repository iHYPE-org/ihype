/**
 * The quick-start guide's steps, per account type (the popup is
 * `MmmGettingStarted`; the facts come from `GET /api/me/getting-started`).
 *
 * Pure and dependency-light so the unit suite and the client both load it.
 * It returns step IDS, links and done-state only — the component translates
 * each id through literal `t()` calls, because a lib that hands English to a
 * member surface renders untranslated (DESIGN_SYNC row 425).
 *
 * Which guide a member gets is decided by the profiles they OWN, not by the
 * session role: an artist or venue page is what has information to fill in,
 * and it is the owner of one who most needs to be quick about it. A member who
 * owns both sees the venue guide first only when they own no artist page —
 * the first-created creator profile wins, the rule `/welcome` already uses.
 *
 * `done` is `null` for a step that has no measurable end (a fan's "find
 * music"), so the popup draws a number rather than a tick that could never
 * light. A creator step is done only on a fact the database holds.
 */

export type GuideRole = 'FAN' | 'ARTIST' | 'VENUE';

export type GuideSummary = {
  role: GuideRole;
  /** The creator profile the guide is about; null for a fan. */
  profile: { id: string; slug: string; name: string } | null;
  hasPhoto: boolean;
  hasBio: boolean;
  trackCount: number;
  /** Venue: an address, a city and a capacity are all on the page. */
  hasVenueDetails: boolean;
  /** Stripe setup finished — the venue can take a charge / the artist can be paid. */
  payoutsReady: boolean;
  /** Shows naming this profile as headliner or venue, cancelled ones excluded. */
  showCount: number;
  /** The guided setup wizard reported finishing. */
  onboarded: boolean;
};

export type GuideStepId =
  | 'artist-about'
  | 'artist-track'
  | 'artist-payouts'
  | 'artist-show'
  | 'venue-about'
  | 'venue-details'
  | 'venue-payouts'
  | 'venue-event'
  | 'venue-demand'
  | 'fan-listen'
  | 'fan-map'
  | 'fan-hype'
  | 'fan-tickets';

export type GuideStep = { id: GuideStepId; href: string; done: boolean | null };

export type Guide = {
  role: GuideRole;
  steps: GuideStep[];
  /** The guided wizard, offered until it reports finishing. */
  wizardHref: string | null;
};

/** The profile editor opened on one section of one profile. */
function editorHref(profileId: string, section: string): string {
  return `/app/me/profiles?profile=${encodeURIComponent(profileId)}&editor=${section}`;
}

export function buildGuide(summary: GuideSummary): Guide {
  const { role, profile } = summary;

  if (role === 'FAN' || !profile) {
    return {
      role: 'FAN',
      wizardHref: null,
      steps: [
        { id: 'fan-listen', href: '/app/music/discover', done: null },
        { id: 'fan-map', href: '/app/map?layer=events', done: null },
        { id: 'fan-hype', href: '/app/music/charts', done: null },
        { id: 'fan-tickets', href: '/app/tickets', done: null },
      ],
    };
  }

  const wizardHref = summary.onboarded
    ? null
    : `/app/me/${role === 'VENUE' ? 'venues' : 'artists'}/${encodeURIComponent(profile.slug)}/onboarding`;
  const about = summary.hasPhoto && summary.hasBio;

  if (role === 'VENUE') {
    return {
      role,
      wizardHref,
      steps: [
        { id: 'venue-about', href: editorHref(profile.id, 'about'), done: about },
        { id: 'venue-details', href: editorHref(profile.id, 'eventinfo'), done: summary.hasVenueDetails },
        { id: 'venue-payouts', href: '/app/me/payouts?tab=settings', done: summary.payoutsReady },
        { id: 'venue-event', href: '/app/me/events/new', done: summary.showCount > 0 },
        { id: 'venue-demand', href: '/app/me/booking', done: null },
      ],
    };
  }

  return {
    role,
    wizardHref,
    steps: [
      { id: 'artist-about', href: editorHref(profile.id, 'about'), done: about },
      { id: 'artist-track', href: editorHref(profile.id, 'media'), done: summary.trackCount > 0 },
      { id: 'artist-payouts', href: '/app/me/payouts?tab=settings', done: summary.payoutsReady },
      { id: 'artist-show', href: '/app/me/events/new', done: summary.showCount > 0 },
    ],
  };
}

/** How many measurable steps are done, out of how many can be. */
export function guideProgress(guide: Guide): { done: number; total: number } {
  const measurable = guide.steps.filter((step) => step.done !== null);
  return { done: measurable.filter((step) => step.done).length, total: measurable.length };
}

/**
 * The browser keys. "Don't show this again" is per device — it is a
 * convenience, not account state, and a member who ticks it on their phone and
 * then signs in on a laptop seeing it once more is the cheap direction to be
 * wrong in. Keyed by user id so a shared device does not hide it for the next
 * account. Unticked, it shows once per browser session, never on every page.
 */
export function guideHiddenKey(userId: string): string {
  return `ihype:getting-started:hidden:${userId}`;
}
export const GUIDE_SEEN_THIS_SESSION_KEY = 'ihype:getting-started:seen';
/** `?guide=1` on any /app URL reopens the guide (the ME info row links it). */
export const GUIDE_OPEN_PARAM = 'guide';
