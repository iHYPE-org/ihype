import { describe, expect, it } from 'vitest';
import { vetFreeUseSample, vetTrackAudioContent } from '@/lib/media-vetting';

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
