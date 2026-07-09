import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { protectShowProductionPlan } from '@/lib/show-media-access';
import type { ShowProductionPlan } from '@/lib/show-composer';

const plan: ShowProductionPlan = {
  mediaItems: [
    {
      mediaId: '0xabc123',
      title: 'Private track',
      url: 'https://storage.example/private-track.mp3',
      artistProfileId: 'clx0000000000000000000000',
      artistName: 'Artist',
      mediaType: 'audio',
    },
  ],
  voiceOvers: [],
  samplePads: [],
  sequence: [{ id: 'one', kind: 'MEDIA', refId: '0xabc123', label: 'Track one' }],
  advertising: { enabled: false, scope: 'local', frequency: 3, clips: [] },
};

describe('protectShowProductionPlan', () => {
  it('replaces storage URLs with an entitlement-checking route', () => {
    const protectedPlan = protectShowProductionPlan(plan, 'show id');
    expect(protectedPlan.mediaItems[0]?.url).toBe('/api/shows/show%20id/media/0xabc123');
    expect(JSON.stringify(protectedPlan)).not.toContain('storage.example');
    expect(plan.mediaItems[0]?.url).toContain('storage.example');
  });
});
