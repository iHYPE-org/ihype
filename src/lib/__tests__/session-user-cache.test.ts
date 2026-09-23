import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetSessionUser, readSessionUser, resetSessionUserCache, SESSION_USER_TTL_MS } from '@/lib/session-user-cache';

describe('session-user-cache', () => {
  beforeEach(() => resetSessionUserCache());

  it('reads the row once inside the TTL and again after it', async () => {
    let clock = 1_000;
    const load = vi.fn(async () => ({ userSecurityVersion: 3, email: 'a@example.com' }));
    expect(await readSessionUser('u1', load, () => clock)).toEqual({ userSecurityVersion: 3, email: 'a@example.com' });
    clock += SESSION_USER_TTL_MS - 1;
    await readSessionUser('u1', load, () => clock);
    expect(load).toHaveBeenCalledTimes(1);
    clock += 2;
    await readSessionUser('u1', load, () => clock);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('memoises a missing user too, and keeps users apart', async () => {
    const load = vi.fn(async (id: string) => (id === 'gone' ? null : { userSecurityVersion: 1, email: null }));
    expect(await readSessionUser('gone', load)).toBeNull();
    expect(await readSessionUser('gone', load)).toBeNull();
    expect(await readSessionUser('here', load)).toEqual({ userSecurityVersion: 1, email: null });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('forgetSessionUser forces the next read to hit the loader', async () => {
    const load = vi.fn(async () => ({ userSecurityVersion: 1, email: null }));
    await readSessionUser('u1', load);
    forgetSessionUser('u1');
    await readSessionUser('u1', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('propagates the loader failure and memoises nothing for it', async () => {
    const load = vi.fn(async () => { throw new Error('db down'); });
    await expect(readSessionUser('u1', load)).rejects.toThrow('db down');
    const ok = vi.fn(async () => ({ userSecurityVersion: 1, email: null }));
    expect(await readSessionUser('u1', ok)).toEqual({ userSecurityVersion: 1, email: null });
  });
});
