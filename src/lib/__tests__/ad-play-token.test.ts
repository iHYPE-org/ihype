import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  AD_PLAY_TOKEN_TTL_MS,
  createAdPlayToken,
  marketplaceAdIdFromClipId,
  verifyAdPlayToken,
} from '@/lib/ad-play-token';

const SECRET = 'test-auth-secret-value-long-enough';
const OTHER = 'a-completely-different-secret-value';

let original: string | undefined;

beforeEach(() => {
  original = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = SECRET;
});

afterEach(() => {
  if (original === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = original;
});

describe('ad play token — the server\'s receipt that it served this spot', () => {
  it('round-trips the ad id for the member it was minted for', () => {
    const token = createAdPlayToken('ad_1', 'user_1');
    expect(token).toBeTruthy();
    expect(verifyAdPlayToken(token, 'user_1')).toEqual({ ok: true, adId: 'ad_1', subject: 'user_1' });
  });

  it('refuses a token minted for somebody else — a shared receipt buys refusals, not charges', () => {
    const token = createAdPlayToken('ad_1', 'user_1');
    expect(verifyAdPlayToken(token, 'user_2')).toEqual({ ok: false, reason: 'wrong_listener' });
    expect(verifyAdPlayToken(token, null)).toEqual({ ok: false, reason: 'wrong_listener' });
  });

  it('lets an anonymous token be redeemed by anyone, including a member who has since signed in', () => {
    const token = createAdPlayToken('ad_1', '');
    expect(verifyAdPlayToken(token, null)).toMatchObject({ ok: true, adId: 'ad_1' });
    expect(verifyAdPlayToken(token, 'user_9')).toMatchObject({ ok: true, adId: 'ad_1' });
  });

  it('rejects a forged payload — swapping the ad id invalidates the signature', () => {
    const token = createAdPlayToken('ad_1', 'user_1') as string;
    const [version, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ a: 'ad_expensive', s: 'user_1', x: 9_999_999_999 }), 'utf8').toString('base64url');
    expect(verifyAdPlayToken(`${version}.${forged}.${signature}`, 'user_1')).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = createAdPlayToken('ad_1', 'user_1');
    process.env.AUTH_SECRET = OTHER;
    expect(verifyAdPlayToken(token, 'user_1')).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('expires', () => {
    const minted = Date.now();
    const token = createAdPlayToken('ad_1', 'user_1', minted);
    expect(verifyAdPlayToken(token, 'user_1', minted + AD_PLAY_TOKEN_TTL_MS - 1000)).toMatchObject({ ok: true });
    expect(verifyAdPlayToken(token, 'user_1', minted + AD_PLAY_TOKEN_TTL_MS + 1000)).toEqual({ ok: false, reason: 'expired' });
  });

  it('reports missing and malformed apart, and never falls through to ok', () => {
    expect(verifyAdPlayToken(null, 'user_1')).toEqual({ ok: false, reason: 'missing' });
    expect(verifyAdPlayToken('', 'user_1')).toEqual({ ok: false, reason: 'missing' });
    expect(verifyAdPlayToken('v1.only-two-parts', 'user_1')).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyAdPlayToken('v2.a.b', 'user_1')).toEqual({ ok: false, reason: 'malformed' });
  });

  it('mints nothing and verifies nothing when the secret is unreadable — the safe direction is no charge', () => {
    const token = createAdPlayToken('ad_1', 'user_1');
    delete process.env.AUTH_SECRET;
    expect(createAdPlayToken('ad_1', 'user_1')).toBeNull();
    expect(verifyAdPlayToken(token, 'user_1')).toEqual({ ok: false, reason: 'unconfigured' });
  });

  it('reads the campaign out of a clip id only for a real marketplace spot', () => {
    expect(marketplaceAdIdFromClipId('mkt_ad_1')).toBe('ad_1');
    expect(marketplaceAdIdFromClipId('0xplaceholder')).toBeNull();
    expect(marketplaceAdIdFromClipId('mkt_')).toBeNull();
    expect(marketplaceAdIdFromClipId(null)).toBeNull();
  });
});
