import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: {
    user: { update: vi.fn() },
    profile: { findFirst: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('@/lib/revoke-profile-videos', () => ({
  revokeProfileVideoPlayback: vi.fn(),
  VIDEO_REVOKE_WARNING: 'Some public video links could not be revoked.',
}));

import { PATCH } from './route';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revokeProfileVideoPlayback } from '@/lib/revoke-profile-videos';

const req = (discoverable: boolean) => new Request('https://ihype.org/api/me', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ discoverable }),
});

describe('member Settings creator visibility and Mux privacy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'owner-1' } });
    vi.mocked(db.user.update).mockResolvedValue({} as never);
    vi.mocked(db.profile.findFirst).mockResolvedValue({ id: 'artist-1' } as never);
    vi.mocked(db.profile.update).mockResolvedValue({} as never);
    vi.mocked(revokeProfileVideoPlayback).mockResolvedValue({ failed: 0 });
  });

  it('hides creator profile before revoking linked public Mux video IDs', async () => {
    const res = await PATCH(req(false));
    expect(res.status).toBe(200);
    expect(db.profile.update).toHaveBeenCalledWith({
      where: { id: 'artist-1' }, data: { discoverable: false },
    });
    expect(revokeProfileVideoPlayback).toHaveBeenCalledWith('artist-1');
  });

  it('does not revoke public playback when enabling discovery', async () => {
    const res = await PATCH(req(true));
    expect(res.status).toBe(200);
    expect(revokeProfileVideoPlayback).not.toHaveBeenCalled();
  });

  it('reports Mux cleanup failure without undoing already-private profile state', async () => {
    vi.mocked(revokeProfileVideoPlayback).mockResolvedValueOnce({ failed: 1 });
    const res = await PATCH(req(false));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true, warning: 'Some public video links could not be revoked.',
    });
    expect(db.profile.update).toHaveBeenCalledWith({
      where: { id: 'artist-1' }, data: { discoverable: false },
    });
  });

  it('does not touch Mux without a session', async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await PATCH(req(false));
    expect(res.status).toBe(401);
    expect(revokeProfileVideoPlayback).not.toHaveBeenCalled();
    expect(db.profile.update).not.toHaveBeenCalled();
  });
});
