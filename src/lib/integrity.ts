import { Profile, Show } from '@prisma/client';
import { formatShowTime } from '@/lib/utils';

export const FEED_HEURISTICS_VERSION = '1.2.0';

export const feedHeuristicsLedger = [
  {
    id: 'LIVE-001',
    title: 'Live Priority',
    summary: 'Shows that are live now receive the strongest visibility boost in the main feed.',
    userImpact: 'Live broadcasts should surface ahead of scheduled or archived shows when other factors are similar.'
  },
  {
    id: 'TIME-001',
    title: 'Freshness Window',
    summary: 'Scheduled shows closer to their start time receive a stronger freshness lift than distant events.',
    userImpact: 'Shows happening soon rise above far-future listings, and recent archives stay visible briefly before fading.'
  },
  {
    id: 'HYPE-001',
    title: 'Bounded Momentum',
    summary: 'Hype count increases feed momentum, but cannot override live status or basic freshness rules on its own.',
    userImpact: 'A heavily hyped show can climb, but it does not permanently dominate the feed.'
  },
  {
    id: 'SAFE-001',
    title: 'Archive De-emphasis',
    summary: 'Ended and canceled shows are de-emphasized unless they are still fresh enough to matter as recent context.',
    userImpact: 'The feed stays oriented toward what can be watched or acted on now.'
  },
  {
    id: 'TRUST-001',
    title: 'Visible Explanations',
    summary: 'Feed ranking rules and aggregate platform metrics are surfaced publicly rather than kept as hidden operator logic.',
    userImpact: 'Users can see why a show is surfaced and inspect the current heuristics version.'
  },
  {
    id: 'GOV-001',
    title: 'Versioned Changes',
    summary: 'Heuristic changes should be versioned and disclosed instead of silently drifting in production.',
    userImpact: 'Teams can compare behavior across versions and explain when ranking rules change.'
  },
  {
    id: 'RADIO-001',
    title: 'Radio Show Boost',
    summary: 'Curated radio shows receive a small visibility lift when live to distinguish them from standard streams.',
    userImpact: 'A live radio set surfaces slightly ahead of a live stream with the same hype, reflecting the additional curation effort.'
  }
] as const;

type ExplainableShow = Pick<Show, 'title' | 'status' | 'startsAt' | 'hypeCount' | 'tags' | 'isRadioShow'> & {
  venueProfile?: Pick<Profile, 'name' | 'city'> | null;
  headlinerProfile?: Pick<Profile, 'name'> | null;
};

type VisibilitySignal = {
  label: string;
  value: string;
};

export type ReasonChip = {
  label: string;
  icon: string;
  detail: string;
};

export function getShowVisibilitySignals(show: ExplainableShow, now = new Date()) {
  const startsAt = show.startsAt instanceof Date ? show.startsAt : new Date(show.startsAt);
  const hoursUntil = (startsAt.getTime() - now.getTime()) / (60 * 60 * 1000);

  let statusSignal = 'Upcoming';
  let freshnessSignal = `Starts ${formatShowTime(startsAt)}`;
  let statusScore = 40;
  let freshnessScore = 18;

  if (show.status === 'LIVE') {
    statusSignal = 'Live now';
    freshnessSignal = 'Broadcast is active, so it receives the strongest freshness lift.';
    statusScore = 100;
    freshnessScore = 30;
  } else if (show.status === 'SCHEDULED' && hoursUntil <= 12) {
    statusSignal = 'Starting soon';
    freshnessSignal = 'Starts within 12 hours, so it gets an aggressive freshness boost.';
    statusScore = 82;
    freshnessScore = 28;
  } else if (show.status === 'SCHEDULED' && hoursUntil <= 72) {
    statusSignal = 'This week';
    freshnessSignal = 'Starts within the next 72 hours, so it is prioritized over distant listings.';
    statusScore = 70;
    freshnessScore = 22;
  } else if (show.status === 'ENDED' && hoursUntil >= -168) {
    statusSignal = 'Recent archive';
    freshnessSignal = 'Recently ended shows stay visible briefly as context before dropping further in the feed.';
    statusScore = 26;
    freshnessScore = 12;
  } else if (show.status === 'CANCELED') {
    statusSignal = 'Canceled';
    freshnessSignal = 'Canceled shows are heavily de-emphasized.';
    statusScore = 4;
    freshnessScore = 0;
  }

  const radioBoost = show.isRadioShow && show.status === 'LIVE' ? 8 : 0;
  const momentumScore = Math.min(28, Math.floor(show.hypeCount / 3));
  let momentumSignal = `${show.hypeCount} hype signal${show.hypeCount === 1 ? '' : 's'}`;

  if (show.hypeCount >= 50) {
    momentumSignal = `${show.hypeCount} hype signals give this show a strong momentum boost.`;
  } else if (show.hypeCount >= 20) {
    momentumSignal = `${show.hypeCount} hype signals are helping this show climb.`;
  } else if (show.hypeCount === 0) {
    momentumSignal = 'No hype momentum yet.';
  }

  const contextParts = [show.venueProfile?.city, show.venueProfile?.name, show.headlinerProfile?.name].filter(Boolean);
  const contextSignal =
    contextParts.length > 0
      ? `Context includes ${contextParts.join(' / ')}.`
      : 'Basic show metadata is available, but there is no extra venue or headliner context yet.';

  const totalScore = statusScore + freshnessScore + momentumScore + radioBoost;

  const signals: VisibilitySignal[] = [
    { label: 'Status', value: statusSignal },
    { label: 'Freshness', value: freshnessSignal },
    { label: 'Momentum', value: momentumSignal },
    ...(radioBoost > 0 ? [{ label: 'Format', value: 'Curated radio set — live boost applied (RADIO-001).' }] : [])
  ];

  // Compact chips for inline "why you're seeing this" display
  const chips: ReasonChip[] = [];

  if (show.status === 'LIVE') {
    chips.push({ icon: '🔴', label: 'Live now', detail: 'This show is broadcasting right now.' });
  } else if (show.status === 'SCHEDULED' && hoursUntil <= 12) {
    chips.push({ icon: '⚡', label: 'Starting soon', detail: 'Starts within the next 12 hours.' });
  } else if (show.status === 'SCHEDULED' && hoursUntil <= 72) {
    chips.push({ icon: '📅', label: 'This week', detail: 'Starts within the next 72 hours.' });
  } else if (show.status === 'ENDED') {
    chips.push({ icon: '🗂️', label: 'Recent archive', detail: 'Recently ended — still visible for context.' });
  }

  if (show.hypeCount >= 50) {
    chips.push({ icon: '🔥', label: 'Trending', detail: `${show.hypeCount} hype signals — strong momentum.` });
  } else if (show.hypeCount >= 20) {
    chips.push({ icon: '📈', label: 'Building', detail: `${show.hypeCount} hype signals and climbing.` });
  } else if (show.hypeCount >= 5) {
    chips.push({ icon: '✨', label: `${show.hypeCount} hype`, detail: 'Early momentum signal.' });
  }

  if (show.isRadioShow) {
    chips.push({ icon: '📻', label: 'Radio set', detail: show.status === 'LIVE' ? 'Curated radio show — live boost active (RADIO-001).' : 'Curated radio show.' });
  }

  if (chips.length === 0) {
    chips.push({ icon: '📋', label: statusSignal, detail: freshnessSignal });
  }

  return {
    version: FEED_HEURISTICS_VERSION,
    totalScore,
    contextSignal,
    signals,
    chips,
    reasons: [
      `Status rule: ${statusSignal}.`,
      freshnessSignal,
      momentumSignal,
      contextSignal
    ]
  };
}

export function sortShowsForFeed<T extends ExplainableShow>(shows: T[], now = new Date()) {
  return [...shows].sort((left, right) => {
    const leftSignals = getShowVisibilitySignals(left, now);
    const rightSignals = getShowVisibilitySignals(right, now);

    if (rightSignals.totalScore !== leftSignals.totalScore) {
      return rightSignals.totalScore - leftSignals.totalScore;
    }

    const leftStartsAt = left.startsAt instanceof Date ? left.startsAt : new Date(left.startsAt);
    const rightStartsAt = right.startsAt instanceof Date ? right.startsAt : new Date(right.startsAt);

    return leftStartsAt.getTime() - rightStartsAt.getTime();
  });
}
