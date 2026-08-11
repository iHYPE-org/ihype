import { describe, expect, it } from 'vitest';
import { canPromoteWithHypeLink } from '@/lib/role-capabilities';

describe('canPromoteWithHypeLink', () => {
  it.each([
    ['FAN', true],
    // No DJ row: the role was deleted 2026-08-06 and is out of both enums in
    // schema.prisma, so nothing can hold it.
    //
    // ARTIST and VENUE are false and that is now a KNOWN DIVERGENCE from the
    // charter, not a decision this file is making: Design System 8 states
    // "Promoters are Fans, Artists, or Venues who share a referral link", and
    // every account is supposed to earn from the 10% pool with nothing to sign
    // up for. Widening this set is a permissions change with server-route
    // consequences, so it is flagged rather than smuggled in behind a DJ
    // cleanup. Left as-is deliberately — see the note in role-capabilities.ts.
    ['ARTIST', false],
    ['VENUE', false],
    ['ADVERTISER', false],
    ['ADMIN', false],
    [null, false],
  ])('returns %s for role %s', (role, expected) => {
    expect(canPromoteWithHypeLink(role)).toBe(expected);
  });
});
