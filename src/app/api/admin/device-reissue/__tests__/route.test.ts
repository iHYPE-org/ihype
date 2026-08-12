import { beforeEach, describe, expect, it, vi } from 'vitest';

// Same auto-mocked-Prisma pattern as the other route tests: every model
// resolves to inert defaults, each test programs only what it needs.
vi.mock('@/lib/db', () => {
  const models = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const makeModel = () => ({
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  });
  const db = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (!models.has(prop)) models.set(prop, makeModel());
      return models.get(prop);
    },
  });
  return { db };
});

const auth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: () => auth() }));

const sendGenericEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/mailer', () => ({ sendGenericEmail: (input: unknown) => sendGenericEmail(input) }));

const consumeAdminSetupRateLimit = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
vi.mock('@/lib/admin-setup-rate-limit', () => ({
  consumeAdminSetupRateLimit: () => consumeAdminSetupRateLimit(),
}));

vi.mock('@/lib/admin-device', () => ({ createDeviceOtp: () => 'otp.token.value' }));
vi.mock('@/lib/runtime-env', () => ({ readRuntimeEnv: () => 'device-secret' }));
vi.mock('@/lib/utils', () => ({ getBaseUrl: () => 'https://ihype.org' }));
vi.mock('@/lib/request-meta', () => ({ readClientAddress: () => '1.2.3.4' }));
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { POST } from '@/app/api/admin/device-reissue/route';
import { recordAuditEvent } from '@/lib/audit';

const request = () => new Request('https://ihype.org/api/admin/device-reissue', { method: 'POST' }) as never;

const ADMIN = { user: { id: 'u1', role: 'ADMIN', email: 'admin@ihype.org' } };

beforeEach(() => {
  vi.clearAllMocks();
  sendGenericEmail.mockResolvedValue(undefined);
  consumeAdminSetupRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
});

describe('POST /api/admin/device-reissue', () => {
  it('emails the link to a signed-in administrator', async () => {
    auth.mockResolvedValue(ADMIN);
    const res = await POST(request());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, sentTo: 'admin@ihype.org' });
    expect(sendGenericEmail).toHaveBeenCalledTimes(1);
    const sent = sendGenericEmail.mock.calls[0][0] as { to: string; text: string };
    expect(sent.to).toBe('admin@ihype.org');
    expect(sent.text).toContain('https://ihype.org/admin/device-register?token=');
  });

  it('refuses anyone who is not signed in', async () => {
    auth.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(sendGenericEmail).not.toHaveBeenCalled();
  });

  it('refuses a signed-in non-admin', async () => {
    auth.mockResolvedValue({ user: { id: 'u2', role: 'LISTENER', email: 'fan@example.com' } });
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(sendGenericEmail).not.toHaveBeenCalled();
  });

  // The role alone is not enough. If a row somehow acquired role ADMIN — a bad
  // migration, a restored backup — the link must not follow it to that inbox.
  it('refuses an ADMIN role held by an address outside the allowlist', async () => {
    auth.mockResolvedValue({ user: { id: 'u3', role: 'ADMIN', email: 'attacker@example.com' } });
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(sendGenericEmail).not.toHaveBeenCalled();
  });

  it('reports a send failure instead of claiming success', async () => {
    auth.mockResolvedValue(ADMIN);
    sendGenericEmail.mockRejectedValue(new Error('resend down'));
    const res = await POST(request());
    expect(res.status).toBe(502);
    // No audit row saying a link was sent, because none was.
    expect(recordAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_device_reissue_sent' }),
    );
  });

  it('rate limits before sending anything', async () => {
    auth.mockResolvedValue(ADMIN);
    consumeAdminSetupRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 1800 });
    const res = await POST(request());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1800');
    expect(sendGenericEmail).not.toHaveBeenCalled();
  });

  it('never puts the one-time token in the audit trail', async () => {
    auth.mockResolvedValue(ADMIN);
    await POST(request());
    for (const call of vi.mocked(recordAuditEvent).mock.calls) {
      expect(JSON.stringify(call)).not.toContain('otp.token.value');
    }
  });
});
