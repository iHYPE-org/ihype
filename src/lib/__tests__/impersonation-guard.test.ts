import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { refuseCredentialChangeWhileImpersonating } from '@/lib/impersonation-guard';

/**
 * A credential made while impersonating outlives the impersonation: a passkey
 * the operator registers on a member's account keeps working after "stop
 * impersonating", and syncs to the member's devices. So every credential write
 * refuses an impersonated session.
 */
describe('refuseCredentialChangeWhileImpersonating', () => {
  it('refuses an impersonated session with 403 IMPERSONATING', async () => {
    const res = refuseCredentialChangeWhileImpersonating({ user: { impersonatorId: 'admin-1' } });
    expect(res?.status).toBe(403);
    expect(await res?.json()).toMatchObject({ code: 'IMPERSONATING' });
  });

  it('lets an ordinary session through', () => {
    expect(refuseCredentialChangeWhileImpersonating({ user: { impersonatorId: null } })).toBeNull();
    expect(refuseCredentialChangeWhileImpersonating({ user: {} })).toBeNull();
    expect(refuseCredentialChangeWhileImpersonating({ user: { impersonatorId: '' } })).toBeNull();
    expect(refuseCredentialChangeWhileImpersonating(null)).toBeNull();
  });

  it.each([
    ['src/app/api/auth/passkey/register/route.ts', ['GET', 'POST']],
    ['src/app/api/auth/passkey/[id]/route.ts', ['DELETE']],
    ['src/app/api/me/email/route.ts', ['POST']],
  ])('%s refuses before it writes', (file, methods) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    for (const method of methods) {
      const start = source.indexOf(`export async function ${method}(`);
      expect(start, `${method} in ${file}`).toBeGreaterThan(-1);
      const next = source.indexOf('export async function ', start + 1);
      const body = source.slice(start, next === -1 ? undefined : next);
      const guard = body.indexOf('refuseCredentialChangeWhileImpersonating(session)');
      expect(guard, `${method} in ${file} calls the guard`).toBeGreaterThan(-1);
      for (const write of ['db.', 'verifyPasskeyRegistration(', 'getPasskeyRegistrationOptions(']) {
        const at = body.indexOf(write);
        if (at !== -1) expect(guard, `${method} guards before ${write}`).toBeLessThan(at);
      }
    }
  });
});
