import { sendEmailToUser } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

type NotifyStatus = 'APPROVED' | 'REJECTED' | 'PENDING' | 'AWAITING_PAYMENT' | 'PAYMENT_FAILED' | 'SETTLED';

const STATUS_EMAIL_COPY: Record<NotifyStatus, { subject: string; body: string }> = {
  APPROVED: { subject: 'Your iHYPE ad campaign is live', body: 'is authorized and now live, running as scheduled.' },
  REJECTED: { subject: 'Your iHYPE ad campaign was not approved', body: 'did not meet the music-industry supporter policy and was not approved.' },
  PENDING: { subject: 'Your iHYPE ad campaign is under review', body: 'is queued for manual review — we\'ll follow up within 48 hours.' },
  AWAITING_PAYMENT: { subject: 'Pay to launch your iHYPE ad campaign', body: 'passed vetting — authorize payment to go live. Nothing is captured until your campaign actually runs; you\'re only ever charged for what actually airs.' },
  PAYMENT_FAILED: { subject: 'Payment failed for your iHYPE ad campaign', body: 'passed vetting, but the payment authorization failed or was abandoned — the campaign was cancelled. Submit a new campaign to try again.' },
  SETTLED: { subject: 'Your iHYPE ad campaign has ended', body: 'has ended.' },
};

/**
 * Transactional email on a self-serve radio ad campaign's status change —
 * fired both from the initial AI vetting (POST /api/advertise/campaigns)
 * and an admin's manual decision (PATCH /api/admin/ads). Fire-and-forget;
 * callers should not await failure here to block the response.
 */
export function notifyAdvertiser(
  userId: string,
  email: string | null | undefined,
  title: string,
  status: NotifyStatus,
  reasoning: string,
  checkoutUrl?: string,
) {
  if (!email) return;
  const copy = STATUS_EMAIL_COPY[status];
  const ctaUrl = status === 'AWAITING_PAYMENT' && checkoutUrl ? checkoutUrl : `${getBaseUrl()}/advertise/dashboard`;
  const ctaLabel = status === 'AWAITING_PAYMENT' && checkoutUrl ? 'Authorize payment' : 'View your campaigns';
  sendEmailToUser(userId, {
    to: email,
    subject: copy.subject,
    text: `Your campaign "${title}" ${copy.body}\n\nReasoning: ${reasoning}\n\n${ctaLabel}: ${ctaUrl}`,
    html: `<p>Your campaign <strong>${title}</strong> ${copy.body}</p><p>Reasoning: ${reasoning}</p><p><a href="${ctaUrl}">${ctaLabel}</a></p>`,
  }).catch(() => {});
}
