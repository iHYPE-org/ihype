import { sendEmailToUser } from '@/lib/mailer';
import { escapeHtml } from '@/lib/html-escape';
import { getBaseUrl } from '@/lib/utils';

type NotifyStatus = 'APPROVED' | 'REJECTED' | 'PENDING' | 'AWAITING_PAYMENT' | 'PAYMENT_FAILED' | 'SETTLED';

const STATUS_EMAIL_COPY: Record<NotifyStatus, { subject: string; body: string }> = {
  APPROVED: { subject: 'Your iHYPE ad campaign is live', body: 'is paid and now live, running as scheduled. Whatever part of your budget is not spent by the end of the run is refunded to your card.' },
  REJECTED: { subject: 'Your iHYPE ad campaign was not approved', body: 'did not meet the music-industry supporter policy and was not approved.' },
  PENDING: { subject: 'Your iHYPE ad campaign is under review', body: 'is queued for manual review — we\'ll follow up within 48 hours.' },
  AWAITING_PAYMENT: { subject: 'Pay to launch your iHYPE ad campaign', body: 'passed vetting — pay for your campaign to go live. Your card is charged the full budget now, and whatever is not spent by the end of the run is refunded automatically.' },
  PAYMENT_FAILED: { subject: 'Payment failed for your iHYPE ad campaign', body: 'passed vetting, but the payment failed or was abandoned — the campaign was cancelled. Submit a new campaign to try again.' },
  SETTLED: { subject: 'Your iHYPE ad campaign has ended — here is what happened to your budget', body: 'has ended and its budget has been settled.' },
};

/**
 * Transactional email on a self-serve radio ad campaign's status change —
 * fired both from the initial AI vetting (POST /api/advertise/campaigns)
 * and an admin's manual decision (PATCH /api/admin/ads). Callers that do not
 * block on delivery must register this promise with deferWork().
 */
export async function notifyAdvertiser(
  userId: string,
  email: string | null | undefined,
  title: string,
  status: NotifyStatus,
  reasoning: string,
  checkoutUrl?: string,
  idempotencyKey?: string,
) {
  if (!email) return;
  const copy = STATUS_EMAIL_COPY[status];
  const ctaUrl = status === 'AWAITING_PAYMENT' && checkoutUrl ? checkoutUrl : `${getBaseUrl()}/advertise/dashboard`;
  const ctaLabel = status === 'AWAITING_PAYMENT' && checkoutUrl ? 'Pay for your campaign' : 'View your campaigns';
  // A settlement sentence is a statement of money moved, not a vetting verdict.
  const detailLabel = status === 'SETTLED' ? 'Settlement' : 'Reasoning';
  await sendEmailToUser(userId, {
    idempotencyKey,
    to: email,
    subject: copy.subject,
    text: `Your campaign "${title}" ${copy.body}\n\n${detailLabel}: ${reasoning}\n\n${ctaLabel}: ${ctaUrl}`,
    html: `<p>Your campaign <strong>${escapeHtml(title)}</strong> ${copy.body}</p><p>${detailLabel}: ${escapeHtml(reasoning)}</p><p><a href="${escapeHtml(ctaUrl)}">${ctaLabel}</a></p>`,
  });
}
