import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { value: undefined as string | undefined };
const profiles: Array<{ id: string; name: string; hexId: string }> = [
  { id: 'p_link', name: 'Ada', hexId: 'abc123' },
  { id: 'p_direct', name: 'Blue Room', hexId: 'def456' },
];

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'ihype_ref' && cookieStore.value ? { value: cookieStore.value } : undefined) }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    profile: {
      // Honours `select`, because the real query does: returning the whole row
      // would let a caller read a field production never sends it.
      findFirst: async ({ where }: { where: { id?: string; hexId?: string } }) => {
        const found = profiles.find((p) => (where.id ? p.id === where.id : p.hexId === where.hexId));
        return found ? { id: found.id, name: found.name } : null;
      },
    },
  },
}));

const { resolveAffiliatePromoter } = await import('../referral-attribution');

describe('promoter attribution', () => {
  beforeEach(() => { cookieStore.value = undefined; });

  it('credits the HYPE link that was followed to this page', async () => {
    expect(await resolveAffiliatePromoter({ refHexId: 'abc123' })).toEqual({ id: 'p_link', name: 'Ada' });
  });

  /**
   * The journey the 10% pool exists to pay for: follow a friend's link, make an
   * account, buy a ticket. Signup and its redirect strip the query string, so
   * without the cookie the promoter gets nothing for the sale they created.
   */
  it('still credits the link after signup has stripped the query string', async () => {
    cookieStore.value = 'abc123';
    expect(await resolveAffiliatePromoter({})).toEqual({ id: 'p_link', name: 'Ada' });
  });

  it('prefers an explicit parameter over a cookie set days earlier', async () => {
    cookieStore.value = 'abc123';
    // A link shared with ?ref= on this show is a more precise statement of
    // intent than whatever cookie is lying around.
    expect(await resolveAffiliatePromoter({ refHexId: 'def456' })).toEqual({ id: 'p_direct', name: 'Blue Room' });
    expect(await resolveAffiliatePromoter({ affiliateId: 'p_direct' })).toEqual({ id: 'p_direct', name: 'Blue Room' });
  });

  it('falls through to the cookie when a parameter names nobody', async () => {
    cookieStore.value = 'abc123';
    // A stale or mistyped ref must not cancel a real one.
    expect(await resolveAffiliatePromoter({ refHexId: 'not-a-code' })).toEqual({ id: 'p_link', name: 'Ada' });
  });

  it('returns null when nothing resolves, which is the normal case', async () => {
    expect(await resolveAffiliatePromoter({})).toBeNull();
    expect(await resolveAffiliatePromoter({ refHexId: 'nope' })).toBeNull();
  });
});
