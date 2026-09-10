import { describe, expect, it } from 'vitest';
import { buildAlphaBlockers, evaluateRestoreDrill, parseAutomatedDrillAt } from '../alpha-readiness';

describe('alpha readiness', () => {
  it('requires recent restore evidence', () => {
    const now = Date.parse('2026-08-01T12:00:00Z');
    expect(evaluateRestoreDrill(undefined, now).ready).toBe(false);
    expect(evaluateRestoreDrill('2026-07-15T12:00:00Z', now)).toMatchObject({ ready: true, ageDays: 17 });
    expect(evaluateRestoreDrill('2026-06-01T12:00:00Z', now)).toMatchObject({ ready: false, ageDays: 61 });
  });

  it('takes the nightly drill’s pass as evidence, and the newer of the two sources wins', () => {
    const now = Date.parse('2026-09-11T12:00:00Z');
    const lastNight = Date.parse('2026-09-11T03:45:00Z');
    expect(evaluateRestoreDrill(undefined, now, lastNight)).toMatchObject({ ready: true, ageDays: 0, source: 'automated' });
    // An operator stamp from six weeks ago is stale; last night's automated pass is not.
    expect(evaluateRestoreDrill('2026-07-25T12:00:00Z', now, lastNight)).toMatchObject({ ready: true, source: 'automated' });
    // And the other way round: a hand drill yesterday beats a machine pass from last month.
    expect(evaluateRestoreDrill('2026-09-10T12:00:00Z', now, Date.parse('2026-08-01T03:45:00Z'))).toMatchObject({ ready: true, ageDays: 1, source: 'operator' });
    // A future or garbage key is no evidence at all.
    expect(evaluateRestoreDrill(undefined, now, now + 60_000).ready).toBe(false);
    expect(evaluateRestoreDrill(undefined, now, Number.NaN).ready).toBe(false);
  });

  it('reads the drill key as the number the workflow writes', () => {
    expect(parseAutomatedDrillAt(1757559900000)).toBe(1757559900000);
    expect(parseAutomatedDrillAt('1757559900000')).toBe(1757559900000);
    expect(parseAutomatedDrillAt('not a time')).toBeNull();
    expect(parseAutomatedDrillAt(null)).toBeNull();
    expect(parseAutomatedDrillAt(0)).toBeNull();
  });

  it('reports human resilience and real-content gaps separately from deployment health', () => {
    const blockers = buildAlphaBlockers({
      administrators: 1,
      discoverableArtists: 2,
      discoverableVenues: 1,
      upcomingEvents: 0,
      inviteOnlySignup: true,
      restoreDrillReady: false,
    });

    expect(blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('second administrator'),
      expect.stringContaining('restore drill'),
    ]));
    // No minimum number of uploads (owner, 2026-09-02): a track count is
    // reported, never a blocker.
    expect(blockers.some((b) => /playable/.test(b))).toBe(false);
  });

  it('passes when the alpha cohort and operational evidence are ready', () => {
    expect(buildAlphaBlockers({
      administrators: 2,
      discoverableArtists: 5,
      discoverableVenues: 2,
      upcomingEvents: 2,
      inviteOnlySignup: true,
      restoreDrillReady: true,
    })).toEqual([]);
  });
});
