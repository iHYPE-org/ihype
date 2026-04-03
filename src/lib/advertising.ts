import type { AdvertisingScope, ShowAdClip } from '@/lib/show-composer';

export const advertisingScopes: AdvertisingScope[] = ['local', 'regional', 'national', 'global'];

const adClipCatalog: Record<AdvertisingScope, ShowAdClip[]> = {
  local: [
    {
      clipId: '0xa1d1000000000001',
      title: 'Local venue spotlight',
      url: '/audio/samples/signal-chime.wav',
      scope: 'local',
      mimeType: 'audio/wav',
      durationSeconds: 8,
      notes: 'Placeholder local sponsorship clip until sales uploads a city-specific ad.'
    }
  ],
  regional: [
    {
      clipId: '0xa1d1000000000002',
      title: 'Regional sponsor break',
      url: '/audio/samples/sweep-rise.wav',
      scope: 'regional',
      mimeType: 'audio/wav',
      durationSeconds: 9,
      notes: 'Placeholder regional audio break.'
    }
  ],
  national: [
    {
      clipId: '0xa1d1000000000003',
      title: 'National campaign break',
      url: '/audio/samples/club-stab.wav',
      scope: 'national',
      mimeType: 'audio/wav',
      durationSeconds: 7,
      notes: 'Placeholder national campaign clip.'
    }
  ],
  global: [
    {
      clipId: '0xa1d1000000000004',
      title: 'Global partner break',
      url: '/audio/samples/impact-hit.wav',
      scope: 'global',
      mimeType: 'audio/wav',
      durationSeconds: 6,
      notes: 'Placeholder global partner clip.'
    }
  ]
};

export function getAdvertisingClipsForScope(scope: AdvertisingScope) {
  return adClipCatalog[scope] ?? [];
}

