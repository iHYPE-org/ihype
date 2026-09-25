import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The credential routes, driven with an IMPERSONATED session (DESIGN_SYNC row 519).
 *
 * An impersonation session is an ordinary session for the TARGET member plus
 * the operator's id (`buildAuthSessionCookie(target, operatorId)`, surfaced as
 * `session.user.impersonatorId`). Attestation is 'none', so without a refusal
 * an operator could enrol their own authenticator on the member's account —
 * a credential that outlives the impersonation and leaves no trace. Each
 * handler below must answer 403 before it issues options, verifies,
 * deletes, or sends a code.
 */

let session: { user: { id: string; impersonatorId?: string | null } } | null = null;
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => session) }));

const recordAuditEvent = vi.fn(async (_input: Record<string, unknown>) => {});
vi.mock('@/lib/audit', () => ({ recordAuditEvent: (input: Record<string, unknown>) => recordAuditEvent(input) }));

const passkeyLib = {
  getPasskeyRegistrationOptions: vi.fn(async () => ({ challenge: 'challenge-1' })),
  verifyPasskeyRegistration: vi.fn(async () => true),
};
vi.mock('@/lib/passkey', () => passkeyLib);
vi.mock('@/lib/passkey-challenge', () => ({ claimPasskeyChallenge: vi.fn(async () => 'fresh') }));
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock('@/lib/email-verification', () => ({
  createEmailVerificationCode: vi.fn(async () => '123456'),
  sendVerificationEmail: vi.fn(async () => {}),
  verifyEmailCode: vi.fn(async () => true),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => (name === 'pk_reg_challenge' ? { value: 'challenge-1' } : undefined) })),
}));

const db = {
  user: {
    findUnique: vi.fn(async () => ({ username: 'member', email: null })),
    update: vi.fn(async () => ({})),
    findFirst: vi.fn(async () => null),
  },
  passkey: {
    findUnique: vi.fn(async () => ({ userId: 'member-1' })),
    delete: vi.fn(async () => ({})),
  },
};
vi.mock('@/lib/db', () => ({ db }));

const IMPERSONATED = { user: { id: 'member-1', impersonatorId: 'admin-1' } };
const OWN = { user: { id: 'member-1', impersonatorId: null } };

beforeEach(() => {
  vi.clearAllMocks();
  session = null;
});

function refusedAudit(attempted: string) {
  expect(recordAuditEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      actorUserId: 'admin-1',
      action: 'credential_change_refused_impersonating',
      entityId: 'member-1',
      metadata: { attempted },
    }),
  );
}

describe('passkey registration under impersonation', () => {
  it('GET refuses 403 and issues no options', async () => {
    session = IMPERSONATED;
    const { GET } = await import('@/app/api/auth/passkey/register/route');
    const res = await GET(new Request('http://localhost/api/auth/passkey/register'));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'IMPERSONATING' });
    expect(passkeyLib.getPasskeyRegistrationOptions).not.toHaveBeenCalled();
    refusedAudit('passkey.register');
  });

  it('POST refuses 403 and verifies nothing', async () => {
    session = IMPERSONATED;
    const { POST } = await import('@/app/api/auth/passkey/register/route');
    const res = await POST(new Request('http://localhost/api/auth/passkey/register', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(403);
    expect(passkeyLib.verifyPasskeyRegistration).not.toHaveBeenCalled();
    refusedAudit('passkey.register');
  });

  it('the member\'s own session still registers, and the new credential is audited', async () => {
    session = OWN;
    const { POST } = await import('@/app/api/auth/passkey/register/route');
    const res = await POST(
      new Request('http://localhost/api/auth/passkey/register', { method: 'POST', body: JSON.stringify({ id: 'cred', _name: 'Phone' }) }),
    );
    expect(res.status).toBe(200);
    expect(passkeyLib.verifyPasskeyRegistration).toHaveBeenCalledOnce();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'member-1', action: 'passkey_registered', entityId: 'member-1', metadata: { name: 'Phone' } }),
    );
  });
});

describe('passkey deletion under impersonation', () => {
  it('DELETE refuses 403 and deletes nothing', async () => {
    session = IMPERSONATED;
    const { DELETE } = await import('@/app/api/auth/passkey/[id]/route');
    const res = await DELETE(new Request('http://localhost/api/auth/passkey/pk-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'pk-1' }),
    });
    expect(res.status).toBe(403);
    expect(db.passkey.delete).not.toHaveBeenCalled();
    refusedAudit('passkey.delete');
  });

  it('the member\'s own deletion is audited', async () => {
    session = OWN;
    const { DELETE } = await import('@/app/api/auth/passkey/[id]/route');
    const res = await DELETE(new Request('http://localhost/api/auth/passkey/pk-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'pk-1' }),
    });
    expect(res.status).toBe(200);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'passkey_deleted', metadata: { passkeyId: 'pk-1' } }));
  });
});

describe('recovery email under impersonation', () => {
  it('POST refuses 403 and sends no code', async () => {
    session = IMPERSONATED;
    const emailLib = await import('@/lib/email-verification');
    const { POST } = await import('@/app/api/me/email/route');
    const res = await POST(
      new Request('http://localhost/api/me/email', {
        method: 'POST',
        body: JSON.stringify({ action: 'send', email: 'operator@example.com' }),
      }),
    );
    expect(res.status).toBe(403);
    expect(emailLib.sendVerificationEmail).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    refusedAudit('recovery_email.add');
  });
});
