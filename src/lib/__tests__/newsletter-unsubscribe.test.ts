import { afterEach, describe, expect, it } from 'vitest';
import { createNewsletterUnsubscribeToken, verifyNewsletterUnsubscribeToken } from '@/lib/newsletter-unsubscribe';

const OLD = 'old-secret-that-is-long-enough-00';
const NEW = 'new-secret-that-is-long-enough-00';
const before = { ...process.env };

afterEach(() => {
  process.env = { ...before };
});

describe('a newsletter subscriber can unsubscribe without an account', () => {
  /* They have no userId, so the member token cannot represent them — and
     before this there was no link in the footer, no List-Unsubscribe header,
     and no route anywhere that deletes a NewsletterSubscription outside
     account erasure, which needs the account they do not have. */

  it('round-trips the subscription id', () => {
    process.env.AUTH_SECRET = OLD;
    const token = createNewsletterUnsubscribeToken('sub_123');
    expect(verifyNewsletterUnsubscribeToken(token)).toBe('sub_123');
  });

  it('refuses a tampered id, a tampered signature and junk', () => {
    process.env.AUTH_SECRET = OLD;
    const token = createNewsletterUnsubscribeToken('sub_123');
    const [, signature] = token.split('.');
    expect(verifyNewsletterUnsubscribeToken(`sub_456.${signature}`)).toBeNull();
    expect(verifyNewsletterUnsubscribeToken('sub_123.deadbeef')).toBeNull();
    expect(verifyNewsletterUnsubscribeToken('nodot')).toBeNull();
    expect(verifyNewsletterUnsubscribeToken('')).toBeNull();
    expect(verifyNewsletterUnsubscribeToken(null)).toBeNull();
  });

  it('still resolves a link sent before the signing secret rotated', () => {
    /* The link in an old email is exactly the one most likely to be clicked
       after a rotation, and it never expires by design. */
    process.env.AUTH_SECRET = OLD;
    const issuedBefore = createNewsletterUnsubscribeToken('sub_789');

    process.env.AUTH_SECRET_1 = NEW;
    expect(verifyNewsletterUnsubscribeToken(issuedBefore)).toBe('sub_789');
    expect(verifyNewsletterUnsubscribeToken(createNewsletterUnsubscribeToken('sub_789'))).toBe('sub_789');
  });

  it('cannot be forged by naming a subscription', () => {
    process.env.AUTH_SECRET = OLD;
    expect(verifyNewsletterUnsubscribeToken('sub_123.')).toBeNull();
    expect(verifyNewsletterUnsubscribeToken('.abc')).toBeNull();
  });
});
