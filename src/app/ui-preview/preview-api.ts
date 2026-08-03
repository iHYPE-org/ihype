import { coarsenFanCoordinates } from '@/lib/public-location';
import { track } from '@/lib/analytics';

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
  slug?: string;
  title: string;
  startsAt: string;
  hypeCount: number;
  venueName?: string | null;
  venueCity?: string | null;
  venueSlug?: string | null;
  venueProfile?: { name?: string | null; city?: string | null } | null;
  latitude?: number | null;
  longitude?: number | null;
  locationPrecision?: 'exact-venue' | 'none';
};

export type DashboardCard = {
  id: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  action?: string;
};

export type DashboardLiveData = {
  build: { title: string; detail: string; href: string };
  nextAction: { title: string; href: string };
  notifications: DashboardCard[];
  upcoming: DashboardCard[];
  recommendations: Array<{ title: string; detail: string; tag: string; href: string }>;
  insights: string[];
  actions: Array<{ title: string; href: string }>;
};

export type CommunityProposal = {
  id: string;
  title: string;
  description: string;
  votes: number;
  status: string;
  quorumMet: boolean;
  hasVoted: boolean;
  votingOpen: boolean;
  votingClosesAt?: string | null;
};

export type CommunityPayload = {
  eligible: boolean;
  requests: CommunityProposal[];
};

export type RadioStation = {
  id: string;
  title: string;
  meta: string;
  signal: string;
  time: string;
  href: string;
  profileId?: string | null;
  following?: boolean;
  track?: ExperienceTrack | null;
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

async function fetchJson<T>(url: string, signal: AbortSignal, endpoint: string): Promise<T> {
  const startedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
  let status = 0;
  try {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  });
  status = response.status;
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
  } finally {
    const endedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
    track('api_latency', { endpoint, durationMs: endedAt - startedAt, ok: status >= 200 && status < 400, status });
  }
}

export async function searchPreview(query: string, signal: AbortSignal, allowSamples = true): Promise<PreviewResponse<PreviewSearchResult[]>> {
  const normalized = query.trim();
  if (normalized.length < 2) return { data: [], source: 'live' };
  try {
    const payload = await fetchJson<{ results?: PreviewSearchResult[] }>(`/api/search?q=${encodeURIComponent(normalized)}&type=all&limit=8`, signal, 'search');
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

export async function loadNearbyShows({ latitude, longitude, radiusKm, signal, allowSamples = true, query, filter, genre, date, hypeOnly }: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  signal: AbortSignal;
  allowSamples?: boolean;
  query?: string;
  filter?: string;
  genre?: string;
  date?: string;
  hypeOnly?: boolean;
}): Promise<PreviewResponse<NearbyShow[]>> {
  const approximate = coarsenFanCoordinates(latitude, longitude);
  if (!approximate) return { data: [], source: 'live' };
  const params = new URLSearchParams({
    lat: String(approximate.latitude),
    lng: String(approximate.longitude),
    radius: String(Math.min(500, Math.max(1, radiusKm))),
  });
  if (query?.trim()) params.set('q', query.trim().slice(0, 80));
  if (filter) params.set('filter', filter);
  if (genre && genre !== 'All genres') params.set('genre', genre);
  if (date) params.set('date', date);
  if (hypeOnly) params.set('hypeOnly', '1');
  try {
    const payload = await fetchJson<{ shows?: NearbyShow[] }>(`/api/shows/nearby?${params}`, signal, 'nearby-shows');
    return { data: Array.isArray(payload.shows) ? payload.shows : [], source: 'live' };
  } catch (error) {
    if (signal.aborted) throw error;
    return { data: allowSamples ? sampleNearbyShows : [], source: allowSamples ? 'sample' : 'live' };
  }
}

async function fetchExperienceJson<T>(url: string, init?: RequestInit): Promise<T> {
  const endpoint = url.startsWith('/api/discover') ? 'discover' : url.startsWith('/api/radio') ? 'radio' : url.startsWith('/api/me') ? 'settings' : 'other';
  const startedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
  let status = 0;
  try {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    ...init,
  });
  status = response.status;
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
  } finally {
    const endedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
    track('api_latency', { endpoint, durationMs: endedAt - startedAt, ok: status >= 200 && status < 400, status });
  }
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

export async function loadRadioStations({ scope, genre, location, topic, ranking, signal }: {
  scope: string;
  genre: string;
  location: string;
  topic: string;
  ranking: string;
  signal: AbortSignal;
}): Promise<{ tracks: ExperienceTrack[]; stations: RadioStation[] }> {
  const params = new URLSearchParams({ scope, genre, location, topic, ranking });
  const payload = await fetchExperienceJson<{
    tracks?: Array<{ mediaId?: string; hexId: string; title: string; artistName: string; artistSlug?: string | null; artworkUrl?: string | null; url?: string }>;
    stations?: RadioStation[];
  }>(`/api/radio?${params}`, { signal });
  const tracks = (payload.tracks ?? []).map((track) => ({
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
  return { tracks, stations: payload.stations ?? [] };
}

export async function toggleProfileFollow(profileId: string) {
  return fetchExperienceJson<{ following: boolean; count: number }>('/api/follow', {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}

export async function loadDashboardData(role: string, signal: AbortSignal) {
  return fetchExperienceJson<DashboardLiveData>(`/api/me/dashboard?role=${encodeURIComponent(role)}`, { signal });
}

export async function loadCommunity(signal: AbortSignal) {
  return fetchExperienceJson<CommunityPayload>('/api/feedback', { signal });
}

export async function castCommunityVote(id: string) {
  return fetchExperienceJson<{ ok: boolean; votes: number; quorumMet: boolean; hasVoted: boolean }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({ action: 'vote', id }),
  });
}

export async function loadUserSettings(signal: AbortSignal) {
  return fetchExperienceJson<{ notificationPreference?: { newShows?: boolean } | null }>('/api/me', { signal });
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
