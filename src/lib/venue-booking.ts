import { getScopeKeysForProfile, type ScopeKey } from '@/lib/activity-stats';

export type VenueBookingSlot = {
  value: string;
  label: string;
};

export type VenueBookingActOption = {
  id: string;
  slug: string;
  name: string;
  type: 'ARTIST' | 'DJ';
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  requestCount: number;
  pendingCount: number;
  bookedCount: number;
  scopeKeys: ScopeKey[];
  nextShowAtLabel: string | null;
  upcomingShowCount: number;
  availabilitySummary: string;
  suggestedSlots: VenueBookingSlot[];
  rationale: string;
};

export type VenueBookingScopeGroup = {
  key: ScopeKey;
  label: string;
  description: string;
  artists: VenueBookingActOption[];
};

export type VenueCalendarEventSummary = {
  id: string;
  title: string;
  startsAtLabel: string;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELED';
  headlinerName: string | null;
};

type BookingRequestRecord = {
  status: 'PENDING' | 'BOOKED' | 'DISMISSED';
  artistProfile: {
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string | null;
    stateRegion: string | null;
    country: string | null;
  } | null;
};

type ArtistScheduleRecord = {
  id: string;
  title: string;
  startsAt: Date;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELED';
  headlinerProfileId: string | null;
};

type VenueScheduleRecord = {
  id: string;
  title: string;
  startsAt: Date;
  status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELED';
  headlinerProfile?: {
    name: string | null;
  } | null;
};

const scopeLabels: Record<ScopeKey, { label: string; description: string }> = {
  local: {
    label: 'Local',
    description: 'Fan requests tied to the closest city footprint in the current globe model.'
  },
  regional: {
    label: 'Regional',
    description: 'Momentum from the wider nearby city cluster around the venue footprint.'
  },
  national: {
    label: 'National',
    description: 'Demand building across the broader country-level market.'
  },
  global: {
    label: 'Global',
    description: 'Cross-network demand signals worth testing beyond the immediate home lane.'
  }
};

function formatShowDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(value);
}

function formatSlotLabel(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(value);
}

function formatDatetimeLocalValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDateKey(value: Date) {
  return formatDatetimeLocalValue(value).slice(0, 10);
}

function getSuggestedSlots(venueShows: VenueScheduleRecord[], artistShows: ArtistScheduleRecord[]) {
  const blockedDates = new Set<string>();

  for (const show of [...venueShows, ...artistShows]) {
    if (show.status === 'CANCELED' || show.status === 'ENDED') {
      continue;
    }

    blockedDates.add(getDateKey(show.startsAt));
  }

  const suggestions: VenueBookingSlot[] = [];
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(20, 0, 0, 0);

  for (let index = 0; index < 45 && suggestions.length < 4; index += 1) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + index);

    if (blockedDates.has(getDateKey(candidate))) {
      continue;
    }

    suggestions.push({
      value: formatDatetimeLocalValue(candidate),
      label: formatSlotLabel(candidate)
    });
  }

  return suggestions;
}

export function buildVenueCalendarEvents(shows: VenueScheduleRecord[]): VenueCalendarEventSummary[] {
  return shows
    .filter((show) => show.status !== 'CANCELED')
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
    .map((show) => ({
      id: show.id,
      title: show.title,
      startsAtLabel: formatShowDate(show.startsAt),
      status: show.status,
      headlinerName: show.headlinerProfile?.name ?? null
    }));
}

export function buildVenueBookingRecommendations({
  requests,
  artistShows,
  venueShows
}: {
  requests: BookingRequestRecord[];
  artistShows: ArtistScheduleRecord[];
  venueShows: VenueScheduleRecord[];
}) {
  const artistShowMap = new Map<string, ArtistScheduleRecord[]>();

  for (const show of artistShows) {
    if (!show.headlinerProfileId || show.status === 'CANCELED' || show.status === 'ENDED') {
      continue;
    }

    const scopedShows = artistShowMap.get(show.headlinerProfileId) ?? [];
    scopedShows.push(show);
    artistShowMap.set(show.headlinerProfileId, scopedShows);
  }

  const groupedRecommendations = new Map<
    string,
    {
      id: string;
      slug: string;
      name: string;
      type: 'ARTIST' | 'DJ';
      city: string | null;
      stateRegion: string | null;
      country: string | null;
      requestCount: number;
      pendingCount: number;
      bookedCount: number;
      scopeKeys: ScopeKey[];
    }
  >();

  for (const request of requests) {
    if (!request.artistProfile || request.artistProfile.type !== 'ARTIST') {
      continue;
    }

    const current = groupedRecommendations.get(request.artistProfile.id) ?? {
      id: request.artistProfile.id,
      slug: request.artistProfile.slug,
      name: request.artistProfile.name,
      type: request.artistProfile.type,
      city: request.artistProfile.city,
      stateRegion: request.artistProfile.stateRegion,
      country: request.artistProfile.country,
      requestCount: 0,
      pendingCount: 0,
      bookedCount: 0,
      scopeKeys: getScopeKeysForProfile({
        city: request.artistProfile.city,
        country: request.artistProfile.country
      })
    };

    current.requestCount += 1;
    if (request.status === 'PENDING') {
      current.pendingCount += 1;
    }
    if (request.status === 'BOOKED') {
      current.bookedCount += 1;
    }

    groupedRecommendations.set(request.artistProfile.id, current);
  }

  const actOptions: VenueBookingActOption[] = Array.from(groupedRecommendations.values())
    .map((artist) => {
      const scheduledShows = (artistShowMap.get(artist.id) ?? []).sort(
        (left, right) => left.startsAt.getTime() - right.startsAt.getTime()
      );
      const suggestedSlots = getSuggestedSlots(venueShows, scheduledShows);
      const nextShow = scheduledShows[0] ?? null;
      const availabilitySummary = suggestedSlots.length
        ? `Suggested opening: ${suggestedSlots[0].label}`
        : nextShow
          ? `Busy around ${formatShowDate(nextShow.startsAt)}`
          : 'Open schedule right now';

      return {
        ...artist,
        nextShowAtLabel: nextShow ? formatShowDate(nextShow.startsAt) : null,
        upcomingShowCount: scheduledShows.length,
        availabilitySummary,
        suggestedSlots,
        rationale: `${artist.requestCount} fan request${artist.requestCount === 1 ? '' : 's'} - ${artist.pendingCount} pending - ${artist.bookedCount} already booked`
      };
    })
    .sort((left, right) => {
      const leftScore = left.requestCount * 5 + left.bookedCount * 3 + (left.suggestedSlots.length ? 1 : 0);
      const rightScore = right.requestCount * 5 + right.bookedCount * 3 + (right.suggestedSlots.length ? 1 : 0);
      return rightScore - leftScore;
    });

  const scopeGroups: VenueBookingScopeGroup[] = (['local', 'regional', 'national', 'global'] as const).map((scopeKey) => ({
    key: scopeKey,
    label: scopeLabels[scopeKey].label,
    description: scopeLabels[scopeKey].description,
    artists: actOptions.filter((artist) => artist.scopeKeys.includes(scopeKey)).slice(0, 4)
  }));

  return {
    actOptions,
    scopeGroups
  };
}
