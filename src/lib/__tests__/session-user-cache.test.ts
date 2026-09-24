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

  it('shares one in-flight load between concurrent calls of the same request (row 513)', async () => {
    let resolveLoad: (row: { userSecurityVersion: number; email: string | null }) => void = () => {};
    const load = vi.fn(() => new Promise<{ userSecurityVersion: number; email: string | null }>((r) => { resolveLoad = r; }));
    const scope = {};
    const a = readSessionUser('u1', load, Date.now, scope);
    const b = readSessionUser('u1', load, Date.now, scope);
    resolveLoad({ userSecurityVersion: 2, email: null });
    expect(await a).toEqual({ userSecurityVersion: 2, email: null });
    expect(await b).toEqual({ userSecurityVersion: 2, email: null });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never shares a pending load across two requests', async () => {
    const load = vi.fn(async () => ({ userSecurityVersion: 1, email: null }));
    await Promise.all([
      readSessionUser('u1', load, Date.now, {}),
      readSessionUser('u1', load, Date.now, {}),
    ]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not memoise a row that was being read when the version was bumped', async () => {
    let resolveLoad: (row: { userSecurityVersion: number; email: string | null }) => void = () => {};
    const slow = vi.fn(() => new Promise<{ userSecurityVersion: number; email: string | null }>((r) => { resolveLoad = r; }));
    const pending = readSessionUser('u1', slow, Date.now, {});
    forgetSessionUser('u1');
    resolveLoad({ userSecurityVersion: 1, email: null });
    await pending;
    const fresh = vi.fn(async () => ({ userSecurityVersion: 2, email: null }));
    expect(await readSessionUser('u1', fresh)).toEqual({ userSecurityVersion: 2, email: null });
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});
