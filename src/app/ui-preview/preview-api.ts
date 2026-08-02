import { coarsenFanCoordinates } from '@/lib/public-location';

export type PreviewDataSource = 'live' | 'sample';

export type PreviewSearchResult = {
  id: string;
  name: string;
  slug?: string;
  subtitle: string;
  type: 'artist' | 'venue' | 'promoter' | 'song' | 'show' | 'genre';
};

export type NearbyShow = {
  id: string;
  title: string;
  startsAt: string;
  hypeCount: number;
  venueName?: string | null;
  venueCity?: string | null;
  venueProfile?: { name?: string | null; city?: string | null } | null;
  latitude?: number | null;
  longitude?: number | null;
  locationPrecision?: 'exact-venue' | 'none';
};

export type PreviewResponse<T> = {
  data: T;
  source: PreviewDataSource;
};

export type ExperienceTrack = {
  mediaId: string | null;
  hexId?: string | null;
  title: string;
  artist: string;
  artistSlug?: string | null;
  art: string;
  url?: string | null;
  scene: string;
  match: string;
  hypeCount?: number;
};

type DiscoverySeed = {
  id: string;
  trackId: string;
  hexId?: string;
  url?: string;
  title: string;
  artistName: string;
  artistSlug?: string | null;
  artworkUrl?: string | null;
  city?: string | null;
  genres?: string[];
  hypeCount?: number;
  reason?: string;
};

const sampleSearchResults: PreviewSearchResult[] = [
  { id: 'sample-jayla', name: 'Jayla Reign', subtitle: 'Detroit · artist', type: 'artist' },
  { id: 'sample-motor-city', name: 'Motor City Room', subtitle: 'Detroit · venue', type: 'venue' },
  { id: 'sample-after-dark', name: 'After Dark', subtitle: 'Detroit · radio show', type: 'show' },
];

const sampleNearbyShows: NearbyShow[] = [
  { id: 'sample-city-lights', title: 'City Lights release show', startsAt: '2026-08-01T20:30:00-04:00', hypeCount: 2418, venueName: 'Motor City Room', venueCity: 'Detroit', latitude: 42.335, longitude: -83.041, locationPrecision: 'exact-venue' },
  { id: 'sample-basement-signal', title: 'Basement Signal Live', startsAt: '2026-08-01T21:00:00-04:00', hypeCount: 1106, venueName: 'The Painted Lady', venueCity: 'Hamtramck', latitude: 42.348, longitude: -83.063, locationPrecision: 'exact-venue' },
  { id: 'sample-after-hours', title: 'After Hours Radio', startsAt: '2026-08-07T23:30:00-04:00', hypeCount: 876, venueName: 'Marble Bar', venueCity: 'Detroit', latitude: 42.357, longitude: -83.066, locationPrecision: 'exact-venue' },
];

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export async function searchPreview(query: string, signal: AbortSignal, allowSamples = true): Promise<PreviewResponse<PreviewSearchResult[]>> {
  const normalized = query.trim();
  if (normalized.length < 2) return { data: [], source: 'live' };
  try {
    const payload = await fetchJson<{ results?: PreviewSearchResult[] }>(`/api/search?q=${encodeURIComponent(normalized)}&type=all&limit=8`, signal);
    return { data: Array.isArray(payload.results) ? payload.results.slice(0, 8) : [], source: 'live' };
  } catch (error) {
    if (signal.aborted) throw error;
    const lowered = normalized.toLowerCase();
    return allowSamples ? {
      data: sampleSearchResults.filter((result) => `${result.name} ${result.subtitle} ${result.type}`.toLowerCase().includes(lowered)),
      source: 'sample',
    } : { data: [], source: 'live' };
  }
}

export async function loadNearbyShows({ latitude, longitude, radiusKm, signal, allowSamples = true }: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  signal: AbortSignal;
  allowSamples?: boolean;
}): Promise<PreviewResponse<NearbyShow[]>> {
  const approximate = coarsenFanCoordinates(latitude, longitude);
  if (!approximate) return { data: [], source: 'live' };
  const params = new URLSearchParams({
    lat: String(approximate.latitude),
    lng: String(approximate.longitude),
    radius: String(Math.min(500, Math.max(1, radiusKm))),
  });
  try {
    const payload = await fetchJson<{ shows?: NearbyShow[] }>(`/api/shows/nearby?${params}`, signal);
    return { data: Array.isArray(payload.shows) ? payload.shows : [], source: 'live' };
  } catch (error) {
    if (signal.aborted) throw error;
    return { data: allowSamples ? sampleNearbyShows : [], source: allowSamples ? 'sample' : 'live' };
  }
}

async function fetchExperienceJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function loadDiscoveryTracks(signal: AbortSignal): Promise<ExperienceTrack[]> {
  const payload = await fetchExperienceJson<{ seeds?: DiscoverySeed[] }>('/api/discover/seeds', { signal });
  return (payload.seeds ?? []).map((seed) => ({
    mediaId: seed.id,
    hexId: seed.hexId ?? null,
    title: seed.title,
    artist: seed.artistName,
    artistSlug: seed.artistSlug ?? null,
    art: seed.artworkUrl || '/brand/ihype-menu-logo.webp',
    url: seed.url ?? (seed.hexId ? `/api/media/${seed.hexId}` : null),
    scene: [seed.city, ...(seed.genres ?? []).slice(0, 2)].filter(Boolean).join(' · ') || 'Independent local music',
    match: seed.reason || 'Your scene signal',
    hypeCount: seed.hypeCount ?? 0,
  }));
}

export async function recordDiscoveryDecision(mediaId: string, action: 'save' | 'skip' | 'hype') {
  return fetchExperienceJson<{ ok: boolean }>(`/api/discover/seeds/${encodeURIComponent(mediaId)}/${action}`, {
    method: 'POST',
    body: '{}',
  });
}

export async function loadRadioTracks(signal: AbortSignal): Promise<ExperienceTrack[]> {
  const payload = await fetchExperienceJson<{ tracks?: Array<{ mediaId?: string; hexId: string; title: string; artistName: string; artistSlug?: string | null; artworkUrl?: string | null; url?: string }> }>('/api/radio', { signal });
  return (payload.tracks ?? []).map((track) => ({
    mediaId: track.mediaId ?? track.hexId,
    hexId: track.hexId,
    title: track.title,
    artist: track.artistName,
    artistSlug: track.artistSlug ?? null,
    art: track.artworkUrl || '/brand/ihype-menu-logo.webp',
    url: track.url || `/api/media/${track.hexId}`,
    scene: 'Independent radio',
    match: 'Live from your scene',
  }));
}

export async function updateSceneNotifications(enabled: boolean) {
  const current = await fetchExperienceJson<{ notificationPreference?: Record<string, boolean> | null }>('/api/me');
  const existing = current.notificationPreference ?? {};
  return fetchExperienceJson<{ ok: boolean }>('/api/me', {
    method: 'PATCH',
    body: JSON.stringify({
      notificationPreference: {
        newShows: enabled,
        journalPosts: existing.journalPosts ?? true,
        milestones: existing.milestones ?? true,
        weeklyDigest: existing.weeklyDigest ?? true,
        radioLive: enabled,
        crateUploads: existing.crateUploads ?? true,
        bookingRequests: existing.bookingRequests ?? true,
      },
    }),
  });
}
