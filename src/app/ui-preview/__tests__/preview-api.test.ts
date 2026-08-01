import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDiscoveryTracks, loadNearbyShows, loadRadioTracks, recordDiscoveryDecision, searchPreview } from '../preview-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ui preview API adapters', () => {
  it('uses the existing search API and preserves navigable result data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{ id: 'artist-1', name: 'Jayla Reign', slug: 'jayla-reign', subtitle: 'Detroit', type: 'artist' }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await searchPreview('Jayla', new AbortController().signal);

    expect(response.source).toBe('live');
    expect(response.data[0]).toMatchObject({ id: 'artist-1', slug: 'jayla-reign' });
    expect(fetchMock).toHaveBeenCalledWith('/api/search?q=Jayla&type=all&limit=8', expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('falls back to clearly labeled sample search data when local services are unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('database unavailable')));

    const response = await searchPreview('Jayla', new AbortController().signal);

    expect(response.source).toBe('sample');
    expect(response.data).toHaveLength(1);
    expect(response.data[0].name).toBe('Jayla Reign');
  });

  it('does not leak sample search data into the production experience', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('database unavailable')));

    const response = await searchPreview('Jayla', new AbortController().signal, false);

    expect(response).toEqual({ data: [], source: 'live' });
  });

  it('clamps map radius before calling the existing nearby-show API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ shows: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await loadNearbyShows({
      latitude: 42.331,
      longitude: -83.046,
      radiusKm: 900,
      signal: new AbortController().signal,
    });

    expect(response).toEqual({ data: [], source: 'live' });
    expect(fetchMock).toHaveBeenCalledWith('/api/shows/nearby?lat=42.25&lng=-83&radius=500', expect.any(Object));
  });

  it('never transmits a device-level GPS fix in a nearby-show URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ shows: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await loadNearbyShows({
      latitude: 42.331427,
      longitude: -83.045754,
      radiusKm: 35,
      signal: new AbortController().signal,
    });

    const requestedUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(requestedUrl).toContain('lat=42.25');
    expect(requestedUrl).toContain('lng=-83');
    expect(requestedUrl).not.toContain('42.331427');
    expect(requestedUrl).not.toContain('-83.045754');
  });


  it('maps live discovery seeds into playable experience tracks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      seeds: [{ id: 'media-db-id', hexId: 'abc123', title: 'City Lights', artistName: 'Jayla Reign', artistSlug: 'jayla-reign', artworkUrl: '/art.jpg', city: 'Detroit', genres: ['R&B'], reason: 'Fans like you also hype this' }],
    }), { status: 200 })));

    const tracks = await loadDiscoveryTracks(new AbortController().signal);

    expect(tracks[0]).toMatchObject({ mediaId: 'media-db-id', url: '/api/media/abc123', artist: 'Jayla Reign', scene: 'Detroit · R&B' });
  });

  it('records discovery decisions against the authenticated seed endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await recordDiscoveryDecision('media-db-id', 'save');

    expect(fetchMock).toHaveBeenCalledWith('/api/discover/seeds/media-db-id/save', expect.objectContaining({ method: 'POST', credentials: 'same-origin' }));
  });

  it('maps the radio catalog to same-origin playable tracks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tracks: [{ mediaId: 'media-db-id', hexId: 'abc123', title: 'Pressure', artistName: 'Milo Coast', url: '/api/media/abc123' }],
    }), { status: 200 })));

    const tracks = await loadRadioTracks(new AbortController().signal);

    expect(tracks[0]).toMatchObject({ mediaId: 'media-db-id', hexId: 'abc123', url: '/api/media/abc123' });
  });
});
