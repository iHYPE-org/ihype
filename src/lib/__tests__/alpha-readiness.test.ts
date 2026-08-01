import { describe, expect, it } from 'vitest';
import { buildAlphaBlockers, evaluateRestoreDrill } from '../alpha-readiness';

describe('alpha readiness', () => {
  it('requires recent restore evidence', () => {
    const now = Date.parse('2026-08-01T12:00:00Z');
    expect(evaluateRestoreDrill(undefined, now).ready).toBe(false);
    expect(evaluateRestoreDrill('2026-07-15T12:00:00Z', now)).toMatchObject({ ready: true, ageDays: 17 });
    expect(evaluateRestoreDrill('2026-06-01T12:00:00Z', now)).toMatchObject({ ready: false, ageDays: 61 });
  });

  it('reports human resilience and real-content gaps separately from deployment health', () => {
    const blockers = buildAlphaBlockers({
      administrators: 1,
      playableTracks: 3,
      discoverableArtists: 2,
      discoverableVenues: 1,
      upcomingEvents: 0,
      scheduledRadioShows: 0,
      inviteOnlySignup: true,
      restoreDrillReady: false,
    });

    expect(blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('second administrator'),
      expect.stringContaining('restore drill'),
      expect.stringContaining('10 playable local tracks'),
    ]));
  });

  it('passes when the alpha cohort and operational evidence are ready', () => {
    expect(buildAlphaBlockers({
      administrators: 2,
      playableTracks: 10,
      discoverableArtists: 5,
      discoverableVenues: 2,
      upcomingEvents: 2,
      scheduledRadioShows: 1,
      inviteOnlySignup: true,
      restoreDrillReady: true,
    })).toEqual([]);
  });
});
