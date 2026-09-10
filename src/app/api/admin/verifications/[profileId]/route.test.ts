import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/admin-confirmation', () => ({ requireRecentAdminReauth: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const notifyUser = vi.fn().mockResolvedValue(undefined);
const sendGenericEmail = vi.fn().mockResolvedValue({ mode: 'sent' });
vi.mock('@/lib/notify', () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));
vi.mock('@/lib/mailer', () => ({ sendGenericEmail: (...a: unknown[]) => sendGenericEmail(...a) }));

const profileFindUnique = vi.fn();
const transaction = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    profile: { findUnique: (...a: unknown[]) => profileFindUnique(...a), update: vi.fn() },
    adminAuditLog: { create: vi.fn() },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

import { auth } from '@/lib/auth';
import { PATCH } from './route';

const params = { params: Promise.resolve({ profileId: 'p1' }) };

function patch(body: Record<string, unknown>) {
  return new Request('https://ihype.org/api/admin/verifications/p1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@ihype.org', role: 'ADMIN' }, expires: '' } as never);
  profileFindUnique.mockResolvedValue({
    id: 'p1',
    verificationStatus: 'PENDING',
    verificationNotes: 'I own the lease, see attached.',
    slug: 'the-hall',
    ownerId: 'owner1',
    owner: { email: 'owner@example.com' },
  });
  transaction.mockResolvedValue([{ id: 'p1', name: 'The Hall', type: 'VENUE', verificationStatus: 'VERIFIED', verified: true, verificationReviewedAt: new Date() }]);
});

describe('a verification decision reaches the applicant', () => {
  /* Two onboarding wizards promise "we'll review within 48 hours and email
     you", and the workbench tracks that SLA — while this handler wrote a
     profile row and an audit row and told nobody. A rejected venue never
     learned it had been rejected, or why. */

  it('notifies and emails on an approval', async () => {
    const res = await PATCH(patch({ decision: 'VERIFIED' }), params);
    expect(res.status).toBe(200);
    expect(notifyUser).toHaveBeenCalledWith('owner1', expect.objectContaining({ type: 'verification-verified' }));
    expect(sendGenericEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.com' }));
  });

  it('notifies and emails on a rejection, carrying the reviewer’s reason', async () => {
    transaction.mockResolvedValue([{ id: 'p1', name: 'The Hall', type: 'VENUE', verificationStatus: 'REJECTED', verified: false, verificationReviewedAt: new Date() }]);
    await PATCH(patch({ decision: 'REJECTED', adminNote: 'The document names a different company.' }), params);
    const sent = sendGenericEmail.mock.calls[0][0] as { text: string };
    expect(sent.text).toContain('The document names a different company.');
  });

  it('appends the reviewer note instead of overwriting what the applicant wrote', async () => {
    await PATCH(patch({ decision: 'REJECTED', adminNote: 'Needs the lease itself.' }), params);
    /* The update payload is built before `$transaction` runs, so the claim is
       on what `profile.update` was handed. */
    const { db } = await import('@/lib/db');
    const update = vi.mocked(db.profile.update);
    const notes = (update.mock.calls[0][0] as { data: { verificationNotes?: string } }).data.verificationNotes;
    expect(notes).toContain('I own the lease, see attached.');
    expect(notes).toContain('Needs the lease itself.');
  });

  it('still records the decision when the notice cannot be sent', async () => {
    sendGenericEmail.mockRejectedValueOnce(new Error('Resend is down'));
    notifyUser.mockRejectedValueOnce(new Error('push is down'));
    const res = await PATCH(patch({ decision: 'VERIFIED' }), params);
    expect(res.status).toBe(200);
  });
});
