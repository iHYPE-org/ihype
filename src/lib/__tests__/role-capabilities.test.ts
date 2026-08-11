import { describe, expect, it } from 'vitest';
import { canPromoteWithHypeLink } from '@/lib/role-capabilities';

describe('canPromoteWithHypeLink', () => {
  // Every account promotes. The 10% pool is money, not a role — see the note
  // on the function. The only false case is "no account".
  it.each([
    ['FAN', true],
    ['ARTIST', true],
    ['VENUE', true],
    ['ADVERTISER', true],
    ['ADMIN', true],
    [null, false],
    [undefined, false],
    ['', false],
  ])('returns %s for role %s', (role, expected) => {
    expect(canPromoteWithHypeLink(role)).toBe(expected);
  });
});
