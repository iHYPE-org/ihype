import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const isRegisteredAdminDevice = vi.fn();
const registerAdminDevice = vi.fn();
const markAdminReauth = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock('@/lib/admin-device-store', () => ({ isRegisteredAdminDevice, registerAdminDevice }));
vi.mock('@/lib/admin-confirmation', () => ({ markAdminReauth }));
vi.mock('@/lib/audit', () => ({ recordAuditEvent }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/admin-device', () => ({
  generateDeviceToken: () => 'tok_new',
  getDeviceCookieName: () => 'admin_device_token',
  signDeviceCookieValue: (token: string) => `${token}.sig`,
}));

const { bindAdminDeviceAfterPasskey, adminDeviceLabel } = await import('@/lib/admin-passkey-signin');

const admin = { id: 'u_admin', role: 'ADMIN', email: 'admin@ihype.org' };
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';

beforeEach(() => {
  vi.clearAllMocks();
  isRegisteredAdminDevice.mockResolvedValue(false);
  registerAdminDevice.mockResolvedValue(undefined);
});

describe('a passkey sign-in opens the admin console on this device', () => {
  it('binds a new device for an allowlisted administrator and arms the step-up window', async () => {
    const cookie = await bindAdminDeviceAfterPasskey({ user: admin, existingDeviceCookie: null, userAgent: iphone });
    expect(cookie).toMatchObject({ name: 'admin_device_token', value: 'tok_new.sig', httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(registerAdminDevice).toHaveBeenCalledWith('u_admin', 'tok_new', 'iPhone (passkey sign-in)');
    expect(markAdminReauth).toHaveBeenCalledWith('u_admin');
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_device_registered_passkey' }));
  });

  it('does not mint a second row for a device that is already registered', async () => {
    isRegisteredAdminDevice.mockResolvedValue(true);
    expect(await bindAdminDeviceAfterPasskey({ user: admin, existingDeviceCookie: 'tok_old.sig', userAgent: iphone })).toBeNull();
    expect(registerAdminDevice).not.toHaveBeenCalled();
  });

  it('does nothing for a member, or an ADMIN role outside the allowlist', async () => {
    expect(await bindAdminDeviceAfterPasskey({ user: { ...admin, role: 'LISTENER' }, existingDeviceCookie: null, userAgent: iphone })).toBeNull();
    expect(await bindAdminDeviceAfterPasskey({ user: { ...admin, email: 'someone@example.com' }, existingDeviceCookie: null, userAgent: iphone })).toBeNull();
    expect(registerAdminDevice).not.toHaveBeenCalled();
    expect(markAdminReauth).not.toHaveBeenCalled();
  });

  it('never fails the sign-in when the binding cannot be written', async () => {
    registerAdminDevice.mockRejectedValue(new Error('db down'));
    await expect(bindAdminDeviceAfterPasskey({ user: admin, existingDeviceCookie: null, userAgent: iphone })).resolves.toBeNull();
  });

  it('labels the device from its user agent', () => {
    expect(adminDeviceLabel(iphone)).toBe('iPhone');
    expect(adminDeviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mac');
    expect(adminDeviceLabel('')).toBe('Unknown device');
  });
});

describe('only the passkey sign-in binds — never the magic link', () => {
  const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
  it('is called from the passkey route and from no magic-link route', () => {
    expect(read('src/app/api/auth/passkey/auth/route.ts')).toContain('bindAdminDeviceAfterPasskey(');
    expect(read('src/app/api/auth/magic/route.ts')).not.toContain('bindAdminDeviceAfterPasskey');
  });
});
