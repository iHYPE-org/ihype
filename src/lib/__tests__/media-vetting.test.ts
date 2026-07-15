import { describe, expect, it } from 'vitest';
import { runTrackScanPipeline, vetFreeUseSample, vetId3Metadata, vetTrackAudioContent } from '@/lib/media-vetting';

// No Workers AI binding exists in this test environment (no CF context) —
// every vetting call must fail open (cleared: true) rather than block an
// upload just because the AI binding is unavailable, matching the
// documented contract of every vetting function in this codebase.
describe('vetFreeUseSample', () => {
  it('fails open when the AI binding is unavailable', async () => {
    const result = await vetFreeUseSample({
      title: 'Test Track', notes: null, fileName: 'test.mp3', artistName: 'Test Artist', durationSecs: 180
    });
    expect(result.cleared).toBe(true);
    expect(result.requiresManualReview).toBe(false);
  });
});

describe('vetTrackAudioContent', () => {
  it('fails open when transcription is unavailable (no AI binding)', async () => {
    const result = await vetTrackAudioContent(new Uint8Array([1, 2, 3, 4]), 'Test Track', 'Test Artist');
    expect(result.cleared).toBe(true);
    expect(result.requiresManualReview).toBe(false);
    expect(result.reasoning).toMatch(/unavailable|no transcribable/i);
  });
});

describe('vetId3Metadata', () => {
  it('clears a file with no ID3v2 tag at all', () => {
    const result = vetId3Metadata(new Uint8Array([1, 2, 3, 4]), 'My Real Name');
    expect(result.cleared).toBe(true);
    expect(result.requiresManualReview).toBe(false);
  });
});

describe('runTrackScanPipeline', () => {
  it('returns all 4 layers, with 1 & 2 marked unconfigured, and clears when nothing flags', async () => {
    const result = await runTrackScanPipeline(new Uint8Array([1, 2, 3, 4]), {
      title: 'Test Track', notes: null, fileName: 'test.mp3', artistName: 'Test Artist', durationSecs: 180,
    });
    expect(result.layers).toHaveLength(4);
    expect(result.layers.map((l) => l.layer)).toEqual([0, 1, 2, 3]);
    expect(result.layers[1].configured).toBe(false);
    expect(result.layers[2].configured).toBe(false);
    expect(result.layers[0].configured).toBe(true);
    expect(result.layers[3].configured).toBe(true);
    // No AI binding + no ID3 tag in this sandbox: every layer fails open, so
    // the aggregate result clears.
    expect(result.cleared).toBe(true);
  });
});
