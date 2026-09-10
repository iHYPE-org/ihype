import { createHmac } from 'crypto';
import { constantTimeEqual } from '@/lib/secret-compare';
import { currentSigningSecret, readSigningSecrets } from '@/lib/signing-secrets';

/**
 * The unsubscribe token for someone who has no account.
 *
 * `unsubscribe.ts` signs a userId, which is the right key for a member — and
 * it cannot represent a newsletter subscriber at all, because subscribing
 * needs no account. So a fan who confirmed updates from a venue on a public
 * page had NO way out: no link in the footer (the fan-mail route deliberately
 * omitted one rather than point at a Settings page they cannot reach), no
 * `List-Unsubscribe` header, and no route anywhere that deletes a
 * `NewsletterSubscription` — the only deletion lived inside account erasure,
 * which requires the account they do not have. The address received that
 * profile's broadcasts permanently.
 *
 * Same shape and the same reasoning as the member token: HMAC over the row's
 * id, no database lookup to verify, **never expires** because a link in an
 * old email must keep working, and verification tries every key in the
 * rotation window so a link sent before a rotation still resolves after it.
 *
 * The id and not the address: an address is guessable and a token over one
 * would let anyone unsubscribe anyone they can name. A row id is not enough
 * on its own either, which is why it is signed.
 */
const PURPOSE = 'newsletter-unsubscribe';

function sign(subscriptionId: string, key: string): string {
  return createHmac('sha256', key).update(`${subscriptionId}:${PURPOSE}`).digest('hex');
}

export function createNewsletterUnsubscribeToken(subscriptionId: string): string {
  const key = currentSigningSecret();
  if (!key) throw new Error('AUTH_SECRET is not configured.');
  return `${subscriptionId}.${sign(subscriptionId, key)}`;
}

/** The subscription id when the signature is valid, otherwise null. Constant-time. */
export function verifyNewsletterUnsubscribeToken(token: string | null | undefined): string | null {
  if (typeof token !== 'string' || token.length === 0) return null;

  const separator = token.lastIndexOf('.');
  if (separator <= 0 || separator === token.length - 1) return null;

  const subscriptionId = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  return readSigningSecrets().some((key) => constantTimeEqual(signature, sign(subscriptionId, key)))
    ? subscriptionId
    : null;
}

/** The link that goes in the footer and the `List-Unsubscribe` header. */
export function newsletterUnsubscribeUrl(subscriptionId: string): string {
  return `https://ihype.org/api/newsletter/unsubscribe?token=${encodeURIComponent(createNewsletterUnsubscribeToken(subscriptionId))}`;
}
