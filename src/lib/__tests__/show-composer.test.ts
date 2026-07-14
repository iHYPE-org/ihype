import { describe, it, expect } from 'vitest';
import { buildResolvedSequence, sumProductionPlanDurationSecs, showAdClipSchema, type ShowProductionPlan } from '@/lib/show-composer';

function basePlan(overrides: Partial<ShowProductionPlan> = {}): ShowProductionPlan {
  return {
    mediaItems: [],
    voiceOvers: [],
    samplePads: [],
    sequence: [],
    advertising: { enabled: true, scope: 'local', frequency: 3, clips: [] },
    ...overrides
  };
}

describe('buildResolvedSequence', () => {
  it('resolves MEDIA items with their real duration', () => {
    const plan = basePlan({
      mediaItems: [
        { mediaId: '0xtrack1', title: 'Track One', url: '/api/media/0xtrack1', artistProfileId: 'cabc123456', artistName: 'DJ A', mediaType: 'audio', durationSeconds: 180 }
      ],
      sequence: [{ id: 's1', kind: 'MEDIA', refId: '0xtrack1', label: 'Track One' }]
    });

    const resolved = buildResolvedSequence(plan);
    expect(resolved).toEqual([
      expect.objectContaining({ id: 's1', kind: 'MEDIA', url: '/api/media/0xtrack1', durationSeconds: 180 })
    ]);
  });

  it('resolves VOICE_OVER and AD items with their own durations', () => {
    const plan = basePlan({
      voiceOvers: [{ id: 'vo1', title: 'Intro', script: 'Hello!', durationSeconds: 12 }],
      advertising: { enabled: true, scope: 'local', frequency: 3, clips: [{ clipId: '0xad1', title: 'Ad', url: '/audio/ads/a.wav', scope: 'local', mimeType: 'audio/wav', durationSeconds: 20 }] },
      sequence: [
        { id: 's1', kind: 'VOICE_OVER', refId: 'vo1', label: 'Intro' },
        { id: 's2', kind: 'AD', refId: '0xad1', label: 'Ad break' }
      ]
    });

    const resolved = buildResolvedSequence(plan);
    expect(resolved).toEqual([
      expect.objectContaining({ id: 's1', kind: 'VOICE_OVER', durationSeconds: 12 }),
      expect.objectContaining({ id: 's2', kind: 'AD', durationSeconds: 20 })
    ]);
  });

  it('skips sequence items whose ref no longer resolves', () => {
    const plan = basePlan({
      sequence: [{ id: 's1', kind: 'MEDIA', refId: '0xmissing', label: 'Gone' }]
    });

    expect(buildResolvedSequence(plan)).toEqual([]);
  });

  it('auto-injects ad breaks by frequency when no explicit AD cues are placed', () => {
    const plan = basePlan({
      mediaItems: [
        { mediaId: '0xt1', title: 'T1', url: '/1', artistProfileId: 'cabc123456', artistName: 'A', mediaType: 'audio' },
        { mediaId: '0xt2', title: 'T2', url: '/2', artistProfileId: 'cabc123456', artistName: 'A', mediaType: 'audio' }
      ],
      advertising: { enabled: true, scope: 'local', frequency: 2, clips: [{ clipId: '0xad1', title: 'Ad', url: '/a.wav', scope: 'local', mimeType: 'audio/wav', durationSeconds: 20 }] },
      sequence: [
        { id: 's1', kind: 'MEDIA', refId: '0xt1', label: 'T1' },
        { id: 's2', kind: 'MEDIA', refId: '0xt2', label: 'T2' }
      ]
    });

    const resolved = buildResolvedSequence(plan);
    expect(resolved.map((r) => r.kind)).toEqual(['MEDIA', 'MEDIA', 'AD']);
  });

  it('accepts a real marketplace ad clip id (mkt_ prefix) alongside the placeholder 0x format', () => {
    expect(showAdClipSchema.safeParse({
      clipId: 'mkt_clx1a2b3c4d5e6f7g8h9', title: 'Real ad', url: '/audio/real.mp3', scope: 'local', mimeType: 'audio/mpeg', durationSeconds: 20
    }).success).toBe(true);
    expect(showAdClipSchema.safeParse({
      clipId: 'not-a-valid-id', title: 'Bad ad', url: '/audio/bad.mp3', scope: 'local'
    }).success).toBe(false);
  });

  it('carries the ad clip id through so a player can tell a real marketplace ad apart from a placeholder', () => {
    const plan = basePlan({
      mediaItems: [{ mediaId: '0xt1', title: 'T1', url: '/1', artistProfileId: 'cabc123456', artistName: 'A', mediaType: 'audio' }],
      advertising: { enabled: true, scope: 'local', frequency: 1, clips: [{ clipId: 'mkt_realad1', title: 'Real ad', url: '/audio/real.mp3', scope: 'local', mimeType: 'audio/mpeg', durationSeconds: 20 }] },
      sequence: [
        { id: 's1', kind: 'MEDIA', refId: '0xt1', label: 'T1' },
        { id: 's2', kind: 'AD', refId: 'mkt_realad1', label: 'Ad break' }
      ]
    });

    const resolved = buildResolvedSequence(plan);
    const adItem = resolved.find((r) => r.kind === 'AD');
    expect(adItem?.adClipId).toBe('mkt_realad1');
  });

  it('carries the ad clip id through auto-injected ad breaks too', () => {
    const plan = basePlan({
      mediaItems: [{ mediaId: '0xt1', title: 'T1', url: '/1', artistProfileId: 'cabc123456', artistName: 'A', mediaType: 'audio' }],
      advertising: { enabled: true, scope: 'local', frequency: 1, clips: [{ clipId: 'mkt_realad2', title: 'Real ad', url: '/audio/real.mp3', scope: 'local', mimeType: 'audio/mpeg', durationSeconds: 20 }] },
      sequence: [{ id: 's1', kind: 'MEDIA', refId: '0xt1', label: 'T1' }]
    });

    const resolved = buildResolvedSequence(plan);
    const adItem = resolved.find((r) => r.kind === 'AD');
    expect(adItem?.adClipId).toBe('mkt_realad2');
  });

  it('does not double-inject ad breaks when the DJ already placed explicit AD cues', () => {
    const plan = basePlan({
      mediaItems: [{ mediaId: '0xt1', title: 'T1', url: '/1', artistProfileId: 'cabc123456', artistName: 'A', mediaType: 'audio' }],
      advertising: { enabled: true, scope: 'local', frequency: 1, clips: [{ clipId: '0xad1', title: 'Ad', url: '/a.wav', scope: 'local', mimeType: 'audio/wav', durationSeconds: 20 }] },
      sequence: [
        { id: 's1', kind: 'MEDIA', refId: '0xt1', label: 'T1' },
        { id: 's2', kind: 'AD', refId: '0xad1', label: 'Ad break' }
      ]
    });

    const resolved = buildResolvedSequence(plan);
    expect(resolved.filter((r) => r.kind === 'AD')).toHaveLength(1);
  });
});

describe('sumProductionPlanDurationSecs', () => {
  it('sums real durations across media, voiceover, and ad items', () => {
    const plan = basePlan({
      mediaItems: [{ mediaId: '0xt1', title: 'T1', url: '/1', artistProfileId: 'cabc123456', artistName: 'A', mediaType: 'audio', durationSeconds: 200 }],
      voiceOvers: [{ id: 'vo1', title: 'Intro', script: 'Hi', durationSeconds: 15 }],
      advertising: { enabled: true, scope: 'local', frequency: 5, clips: [{ clipId: '0xad1', title: 'Ad', url: '/a.wav', scope: 'local', mimeType: 'audio/wav', durationSeconds: 25 }] },
      sequence: [
        { id: 's1', kind: 'VOICE_OVER', refId: 'vo1', label: 'Intro' },
        { id: 's2', kind: 'MEDIA', refId: '0xt1', label: 'T1' },
        { id: 's3', kind: 'AD', refId: '0xad1', label: 'Ad break' }
      ]
    });

    expect(sumProductionPlanDurationSecs(plan)).toBe(200 + 15 + 25);
  });

  it('treats items with no known duration (e.g. sample pads) as contributing zero, never a guess', () => {
    const plan = basePlan({
      samplePads: [{ sampleId: '0xs1', title: 'Stab', url: '/s1.wav', assignedPad: 1 }],
      sequence: [{ id: 's1', kind: 'SAMPLE', refId: 'pad-1', label: 'Stab' }]
    });

    expect(sumProductionPlanDurationSecs(plan)).toBe(0);
  });

  it('returns 0 for an empty plan', () => {
    expect(sumProductionPlanDurationSecs(basePlan())).toBe(0);
  });
});
