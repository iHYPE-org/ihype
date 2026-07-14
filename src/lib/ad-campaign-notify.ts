import { sendEmailToUser } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

const STATUS_EMAIL_COPY: Record<'APPROVED' | 'REJECTED' | 'PENDING', { subject: string; body: string }> = {
  APPROVED: { subject: 'Your iHYPE ad campaign is live', body: 'passed automated vetting and is now live, running as scheduled.' },
  REJECTED: { subject: 'Your iHYPE ad campaign was not approved', body: 'did not meet the music-industry supporter policy and was not approved.' },
  PENDING: { subject: 'Your iHYPE ad campaign is under review', body: 'is queued for manual review — we\'ll follow up within 48 hours.' },
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
  status: 'APPROVED' | 'REJECTED' | 'PENDING',
  reasoning: string
) {
  if (!email) return;
  const copy = STATUS_EMAIL_COPY[status];
  sendEmailToUser(userId, {
    to: email,
    subject: copy.subject,
    text: `Your campaign "${title}" ${copy.body}\n\nReasoning: ${reasoning}\n\nView your campaigns: ${getBaseUrl()}/advertise/dashboard`,
    html: `<p>Your campaign <strong>${title}</strong> ${copy.body}</p><p>Reasoning: ${reasoning}</p><p><a href="${getBaseUrl()}/advertise/dashboard">View your campaigns</a></p>`,
  }).catch(() => {});
}
