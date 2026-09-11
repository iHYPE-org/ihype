import { describe, it, expect } from 'vitest';
import { bucketHypePositionIndex, computeShowDurationSecs } from '../hype-position';

describe('bucketHypePositionIndex', () => {
  it('buckets the very start of a show into bucket 0', () => {
    expect(bucketHypePositionIndex(0, 900)).toBe(0);
    expect(bucketHypePositionIndex(89, 900)).toBe(0);
  });

  it('buckets the very end of a show into the last bucket', () => {
    expect(bucketHypePositionIndex(899, 900)).toBe(9);
  });

  it('buckets the midpoint into the middle bucket', () => {
    expect(bucketHypePositionIndex(450, 900)).toBe(5);
  });

  it('supports a custom bucket count', () => {
    expect(bucketHypePositionIndex(0, 100, 4)).toBe(0);
    expect(bucketHypePositionIndex(99, 100, 4)).toBe(3);
  });

  it('clamps a position at or past the known duration into the final bucket instead of overflowing', () => {
    expect(bucketHypePositionIndex(900, 900)).toBe(9);
    expect(bucketHypePositionIndex(1200, 900)).toBe(9);
  });

  it('returns null when duration is unknown', () => {
    expect(bucketHypePositionIndex(30, 0)).toBeNull();
    expect(bucketHypePositionIndex(30, -5)).toBeNull();
  });
});

describe('computeShowDurationSecs', () => {
  /* The `radioTracks` arm of this formula went with the radio-show feature
     (2026-09-11) — it summed `RadioShowTrack` rows and won whenever the sum
     was non-zero. The production plan is the only stored duration left. */
  it('uses the production plan duration', () => {
    const plan = {
      mediaItems: [{
        mediaId: '0xabc123',
        title: 'Track One',
        url: 'https://example.com/track.mp3',
        artistProfileId: 'clh1234567890123456789012',
        artistName: 'Test Artist',
        durationSeconds: 200,
      }],
      voiceOvers: [],
      samplePads: [],
      sequence: [{ id: 's1', kind: 'MEDIA' as const, refId: '0xabc123', label: 'Track One' }],
      advertising: { enabled: false, scope: 'local' as const, frequency: 3, clips: [] },
    };
    expect(computeShowDurationSecs({ productionPlan: plan })).toBe(200);
  });

  it('falls back to the 3600s default when nothing else is known', () => {
    expect(computeShowDurationSecs({ productionPlan: null })).toBe(3600);
  });

  it('falls back to the default rather than trusting an unparseable plan', () => {
    expect(computeShowDurationSecs({ productionPlan: { nonsense: true } })).toBe(3600);
  });
});
