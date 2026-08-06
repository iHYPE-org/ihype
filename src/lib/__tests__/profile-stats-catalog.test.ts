import { describe, expect, it } from 'vitest';
import { STAT_CATALOG, statOptionsForRole } from '@/lib/profile-stats-catalog';

describe('profile-stats STAT_CATALOG', () => {
  it('never includes financial or booking-pipeline data — those stay owner-only via ProfileInsights', () => {
    const sensitive = ['revenue', 'earning', 'booking', 'payout'];
    for (const def of Object.values(STAT_CATALOG)) {
      const haystack = `${def.key} ${def.label}`.toLowerCase();
      for (const word of sensitive) {
        expect(haystack.includes(word), `${def.key} looks like it exposes sensitive data`).toBe(false);
      }
    }
  });

  it('every catalog entry lists at least one role', () => {
    for (const def of Object.values(STAT_CATALOG)) {
      expect(def.roles.length).toBeGreaterThan(0);
    }
  });
});

describe('statOptionsForRole', () => {
  it('gives Artist the creator-facing options', () => {
    // Was "Artist and DJ". DJ is not a profile type any more
    // (docs/dj-role-removal-scope.md step 4), so there is no second role to
    // compare against — what still matters is that Artist keeps the full set.
    const artistKeys = statOptionsForRole('ARTIST').map((s) => s.key).sort();
    expect(artistKeys).toContain('hypeTotal');
    expect(artistKeys).toContain('monthlyListeners');
    expect(statOptionsForRole('DJ')).toEqual([]);
  });

  it('gives Venue ticket stats but not fan-only stats', () => {
    const keys = statOptionsForRole('VENUE').map((s) => s.key);
    expect(keys).toContain('ticketsSold');
    expect(keys).not.toContain('ticketsBought');
    expect(keys).not.toContain('monthlyListeners');
  });

  it('gives Fan (LISTENER) profiles fan-only stats, not creator stats', () => {
    const keys = statOptionsForRole('LISTENER').map((s) => s.key);
    expect(keys).toContain('showsAttended');
    expect(keys).toContain('artistsHyped');
    expect(keys).toContain('ticketsBought');
    expect(keys).toContain('followerCount');
    expect(keys).not.toContain('hypeTotal');
    expect(keys).not.toContain('ticketsSold');
  });

  it('returns an empty list for an unknown profile type rather than throwing', () => {
    expect(statOptionsForRole('SOMETHING_UNKNOWN')).toEqual([]);
  });
});
