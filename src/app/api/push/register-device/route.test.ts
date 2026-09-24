/** A native push token follows whoever is signed in on the phone (row 513). */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
const upsert = vi.fn().mockResolvedValue({});
const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
vi.mock('@/lib/db', () => ({
  db: {
    nativeDeviceToken: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn(),
      delete: vi.fn(),
      upsert: (...a: unknown[]) => upsert(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

import { auth } from '@/lib/auth';
import { DELETE, POST } from './route';

const req = (method: string, body: unknown) =>
  new Request('https://ihype.org/api/push/register-device', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: 'second-account' } } as never);
});

describe('native device registration', () => {
  it('re-homes a token another account registered, rather than refusing it', async () => {
    const res = await POST(req('POST', { token: 'tok', platform: 'ANDROID' }));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ userId: 'second-account' }) }));
  });

  it('sign-out removes only the caller’s own binding', async () => {
    const res = await DELETE(req('DELETE', { token: 'tok' }));
    expect(res.status).toBe(200);
    expect(deleteMany).toHaveBeenCalledWith({ where: { token: 'tok', userId: 'second-account' } });
  });

  it('refuses a DELETE with no token', async () => {
    expect((await DELETE(req('DELETE', {}))).status).toBe(400);
  });
});
