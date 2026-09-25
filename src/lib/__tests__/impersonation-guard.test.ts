import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A credential made while impersonating outlives the impersonation: a passkey
 * the operator registers on a member's account keeps working after "stop
 * impersonating", and syncs to the member's devices. So every credential write
 * refuses an impersonated session, and the refusal is written under the
 * operator's id. The route-level proofs are in impersonation-credential-routes.test.ts.
 */
const recordAuditEvent = vi.fn(async () => {});
vi.mock('@/lib/audit', () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...(args as [])) }));

beforeEach(() => recordAuditEvent.mockClear());

describe('refuseCredentialChangeWhileImpersonating', () => {
  it('refuses an impersonated session with 403 IMPERSONATING and records the operator', async () => {
    const { refuseCredentialChangeWhileImpersonating } = await import('@/lib/impersonation-guard');
    const res = await refuseCredentialChangeWhileImpersonating(
      { user: { id: 'member-1', impersonatorId: 'admin-1' } },
      'passkey.register',
    );
    expect(res?.status).toBe(403);
    expect(await res?.json()).toMatchObject({ code: 'IMPERSONATING' });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'credential_change_refused_impersonating',
        entityId: 'member-1',
        metadata: { attempted: 'passkey.register' },
      }),
    );
  });

  it('lets an ordinary session through and records nothing', async () => {
    const { refuseCredentialChangeWhileImpersonating } = await import('@/lib/impersonation-guard');
    for (const session of [{ user: { impersonatorId: null } }, { user: {} }, { user: { impersonatorId: '' } }, null]) {
      expect(await refuseCredentialChangeWhileImpersonating(session, 'passkey.delete')).toBeNull();
    }
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
