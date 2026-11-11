import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: { profile: { findUnique: vi.fn(), update: vi.fn() } },
  withDbRetry: (operation: () => unknown) => operation(),
}));
vi.mock('@/lib/object-storage', () => ({ isStoredMediaUrl: vi.fn() }));

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { PATCH } from './route';

const profileId = 'ihype-preview-venue';
const profile = {
  id: profileId, ownerId: 'owner', type: 'VENUE',
  heroImage: null, avatarImage: null, logoImage: null, galleryImage: null,
};
const request = (body: unknown) => new Request('https://ihype.org/api/profile-editor', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: 'owner', role: 'VENUE' } } as never);
  vi.mocked(db.profile.findUnique).mockResolvedValue(profile as never);
  vi.mocked(db.profile.update).mockResolvedValue({ id: profileId, slug: 'ihype-preview-venue', type: 'VENUE' } as never);
});

describe('profile editor with existing opaque profile IDs', () => {
  it.each([
    { name: 'iHYPE Preview (Venue)', city: 'Portland' },
    { capacity: 300, roomType: 'Standing room' },
  ])('saves venue onboarding fields %j', async (fields) => {
    const response = await PATCH(request({ profileId, ...fields }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, profile: { id: profileId } });
    expect(db.profile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: profileId }, data: expect.objectContaining(fields),
    }));
  });

  it('requires a signed-in session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await PATCH(request({ profileId, city: 'Portland' }))).status).toBe(401);
    expect(db.profile.findUnique).not.toHaveBeenCalled();
    expect(db.profile.update).not.toHaveBeenCalled();
  });

  it('refuses writes to another member’s profile', async () => {
    vi.mocked(db.profile.findUnique).mockResolvedValue({ ...profile, ownerId: 'someone-else' } as never);
    expect((await PATCH(request({ profileId, city: 'Portland' }))).status).toBe(403);
    expect(db.profile.update).not.toHaveBeenCalled();
  });

  it('reports a missing profile without attempting a write', async () => {
    vi.mocked(db.profile.findUnique).mockResolvedValue(null);
    expect((await PATCH(request({ profileId, city: 'Portland' }))).status).toBe(404);
    expect(db.profile.update).not.toHaveBeenCalled();
  });
});
