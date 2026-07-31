import { describe, expect, it } from 'vitest';
import { canPromoteWithHypeLink } from '@/lib/role-capabilities';

describe('canPromoteWithHypeLink', () => {
  it.each([
    ['FAN', true],
    ['DJ', true],
    ['ARTIST', false],
    ['VENUE', false],
    ['ADVERTISER', false],
    ['ADMIN', false],
    [null, false],
  ])('returns %s for role %s', (role, expected) => {
    expect(canPromoteWithHypeLink(role)).toBe(expected);
  });
});
