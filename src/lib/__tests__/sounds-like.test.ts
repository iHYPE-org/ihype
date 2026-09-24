/**
 * "Sounds like" on the artist pane's Bio tab (2026-09-24, DESIGN_SYNC row 513):
 * the pane passes the profile it already read, so no second read by slug, and a
 * model slower than the deadline costs the row its ranking, never the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const findMany = vi.fn();
const runAI = vi.fn();

vi.mock('@/lib/db', () => ({ db: { profile: { findUnique: (...a: unknown[]) => findUnique(...a), findMany: (...a: unknown[]) => findMany(...a) } } }));
vi.mock('@/lib/ai', () => ({ runAI: (...a: unknown[]) => runAI(...a) }));

const candidates = [
  { name: 'Alpha', slug: 'alpha', genres: ['indie'], avatarImage: null, type: 'ARTIST' },
  { name: 'Beta', slug: 'beta', genres: ['indie'], avatarImage: null, type: 'ARTIST' },
];

describe('getSimilarArtists', () => {
  beforeEach(() => {
    findUnique.mockReset();
    findMany.mockReset().mockResolvedValue(candidates);
    runAI.mockReset();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('uses the profile the pane already read instead of reading it again', async () => {
    runAI.mockResolvedValue('{"similar":["beta"]}');
    const { getSimilarArtists } = await import('@/lib/sounds-like');
    const out = await getSimilarArtists('me', 6, { name: 'Me', genres: ['indie'], bio: null });
    expect(findUnique).not.toHaveBeenCalled();
    expect(out.map((a) => a.slug)).toEqual(['beta']);
  });

  it('never selects the candidates\' bios, which the prompt does not read', async () => {
    runAI.mockResolvedValue(null);
    const { getSimilarArtists } = await import('@/lib/sounds-like');
    await getSimilarArtists('me', 6, { name: 'Me', genres: ['indie'], bio: null });
    const select = (findMany.mock.calls[0]![0] as { select: Record<string, unknown> }).select;
    expect(select.bio).toBeUndefined();
  });

  it('falls back to the hype-ranked candidates when the model is slower than the deadline', async () => {
    vi.useFakeTimers();
    runAI.mockReturnValue(new Promise(() => { /* never answers */ }));
    const { getSimilarArtists, SIMILAR_ARTISTS_AI_DEADLINE_MS } = await import('@/lib/sounds-like');
    const pending = getSimilarArtists('me', 6, { name: 'Me', genres: ['indie'], bio: null });
    await vi.advanceTimersByTimeAsync(SIMILAR_ARTISTS_AI_DEADLINE_MS + 1);
    const out = await pending;
    expect(out.map((a) => a.slug)).toEqual(['alpha', 'beta']);
  });
});
