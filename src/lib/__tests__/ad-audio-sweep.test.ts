import { describe, expect, it } from 'vitest';
import { AD_AUDIO_SWEEP_MAX_DELETES, isReferencedBy, planAdAudioSweep } from '@/lib/ad-audio-sweep';

const NOW = new Date('2026-09-14T03:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

describe('planAdAudioSweep', () => {
  it('deletes an old object no campaign points at, and only that', () => {
    const plan = planAdAudioSweep(
      [
        { key: 'ads/audio/paid.mp3', uploaded: hoursAgo(72) },
        { key: 'ads/audio/parked.mp3', uploaded: hoursAgo(72) },
        { key: 'ads/audio/fresh.mp3', uploaded: hoursAgo(1) },
      ],
      ['https://ihype.org/cdn/ads/audio/paid.mp3'],
      NOW,
    );
    expect(plan.delete).toEqual(['ads/audio/parked.mp3']);
    expect(plan.keptReferenced).toBe(1);
    expect(plan.keptFresh).toBe(1);
  });

  it('matches a campaign by key suffix, whatever host the row holds', () => {
    expect(isReferencedBy('ads/audio/a.mp3', ['https://pub-123.r2.dev/ads/audio/a.mp3'])).toBe(true);
    expect(isReferencedBy('ads/audio/a.mp3', ['ads/audio/a.mp3'])).toBe(true);
    // A different file that merely shares a prefix is not a reference.
    expect(isReferencedBy('ads/audio/a.mp3', ['https://ihype.org/cdn/ads/audio/aa.mp3'])).toBe(false);
    expect(isReferencedBy('ads/audio/a.mp3', ['https://ihype.org/cdn/ads/audio/a.mp3?x=1'])).toBe(false);
  });

  it('keeps an object exactly at the grace boundary on the safe side', () => {
    const plan = planAdAudioSweep([{ key: 'ads/audio/edge.mp3', uploaded: hoursAgo(24) }], [], NOW);
    expect(plan.delete).toEqual(['ads/audio/edge.mp3']);
    const inside = planAdAudioSweep([{ key: 'ads/audio/edge.mp3', uploaded: new Date(hoursAgo(24).getTime() + 1) }], [], NOW);
    expect(inside.delete).toEqual([]);
    expect(inside.keptFresh).toBe(1);
  });

  it('touches nothing outside its prefix even if the listing hands it over', () => {
    const plan = planAdAudioSweep([{ key: 'artist-media/track.mp3', uploaded: hoursAgo(1000) }], [], NOW);
    expect(plan.delete).toEqual([]);
  });

  it('bounds one run', () => {
    const objects = Array.from({ length: AD_AUDIO_SWEEP_MAX_DELETES + 50 }, (_, i) => ({ key: `ads/audio/${i}.mp3`, uploaded: hoursAgo(100) }));
    expect(planAdAudioSweep(objects, [], NOW).delete).toHaveLength(AD_AUDIO_SWEEP_MAX_DELETES);
  });
});
