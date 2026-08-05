import { describe, expect, it } from 'vitest';
import { MMM_ME_ROLES, resolveAvailableRoles } from '@/lib/mmm-me';

describe('resolveAvailableRoles', () => {
  // BACKEND_REWRITE.md §1: "Every account holds `fan` from creation. It cannot
  // be removed." So it is unconditional and first, whatever else the account has.
  it('always includes fan, first, even with no profiles', () => {
    expect(resolveAvailableRoles([])).toEqual(['fan']);
    expect(resolveAvailableRoles(['VENUE'])[0]).toBe('fan');
  });

  it('adds a role only when the account holds a profile of that type', () => {
    expect(resolveAvailableRoles(['ARTIST'])).toEqual(['fan', 'artist']);
    expect(resolveAvailableRoles(['VENUE'])).toEqual(['fan', 'venue']);
    expect(resolveAvailableRoles(['ARTIST', 'VENUE'])).toEqual(['fan', 'artist', 'venue']);
  });

  it('never invents a promoter role — promoting needs no account type (§3)', () => {
    for (const types of [[], ['ARTIST'], ['VENUE'], ['ARTIST', 'VENUE'], ['DJ']]) {
      expect(resolveAvailableRoles(types)).not.toContain('promoter');
    }
  });

  // The DJ role is being removed from the product; a DJ profile must not grant a
  // dashboard role in the new shell.
  it('grants nothing for a DJ profile', () => {
    expect(resolveAvailableRoles(['DJ'])).toEqual(['fan']);
  });

  it('does not duplicate a role when two profiles share a type', () => {
    const roles = resolveAvailableRoles(['ARTIST', 'ARTIST']);
    expect(roles).toEqual(['fan', 'artist']);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it('only ever returns known roles', () => {
    for (const role of resolveAvailableRoles(['ARTIST', 'VENUE'])) {
      expect(MMM_ME_ROLES).toContain(role);
    }
  });
});
