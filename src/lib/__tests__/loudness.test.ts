import { describe, expect, it } from 'vitest';

import { measureLoudness } from '@/lib/loudness';
import {
  MAX_ATTENUATION_DB,
  TARGET_LUFS,
  clampMeasuredLoudness,
  clampMeasuredPeak,
  trackGainDb,
  trackGainMultiplier,
} from '@/lib/track-gain';

/**
 * The compliance figure is the whole test. BS.1770 calibrates K-weighting so
 * that a 1 kHz sine reads its own dBFS level as LUFS — the filter's +0.691 dB
 * at 1 kHz cancels the -0.691 offset exactly. So a -20 dBFS 1 kHz tone in both
 * channels must measure -20 LUFS, and if the filter coefficients, the block
 * gating or the power averaging are wrong in any way that matters, that
 * number moves. A test written against our own output instead would have
 * passed on any of those mistakes.
 */
function sine(seconds: number, sampleRate: number, dbfs: number, hz = 1000): Float32Array {
  const amplitude = Math.pow(10, dbfs / 20);
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRate);
  }
  return out;
}

describe('measureLoudness', () => {
  it.each([44100, 48000, 96000])('reads a -20 dBFS 1 kHz tone as -20 LUFS at %i Hz', (rate) => {
    const tone = sine(3, rate, -20);
    const result = measureLoudness([tone, tone], rate);
    expect(result).not.toBeNull();
    expect(result!.integratedLufs).toBeCloseTo(-20, 1);
  });

  it('tracks level changes one for one', () => {
    const quiet = measureLoudness([sine(3, 48000, -30), sine(3, 48000, -30)], 48000)!;
    const loud = measureLoudness([sine(3, 48000, -10), sine(3, 48000, -10)], 48000)!;
    expect(loud.integratedLufs - quiet.integratedLufs).toBeCloseTo(20, 1);
  });

  it('reads mono 3 dB quieter than the same tone in both channels', () => {
    // Two identical channels sum to twice the power. A measurement that
    // averaged channels instead of summing them would report them equal.
    const tone = sine(3, 48000, -20);
    const mono = measureLoudness([tone], 48000)!;
    const stereo = measureLoudness([tone, tone], 48000)!;
    expect(mono.integratedLufs - stereo.integratedLufs).toBeCloseTo(-3.01, 1);
  });

  it('reports sample peak in dBFS', () => {
    const tone = sine(3, 48000, -6);
    expect(measureLoudness([tone, tone], 48000)!.peakDbfs).toBeCloseTo(-6, 1);
  });

  it('weights low frequency down, which is what K-weighting is for', () => {
    const bass = measureLoudness([sine(3, 48000, -20, 40), sine(3, 48000, -20, 40)], 48000)!;
    expect(bass.integratedLufs).toBeLessThan(-24);
  });

  it('ignores a silent passage rather than averaging it in', () => {
    // The relative gate exists so a long fade-out does not drag the
    // programme figure down. Three seconds of tone plus three of silence must
    // read as the tone.
    const rate = 48000;
    const tone = sine(3, rate, -20);
    const padded = new Float32Array(tone.length * 2);
    padded.set(tone, 0);
    /* Ungated this reads -23. The residue above -20 is the handful of 400 ms
       blocks straddling the cut, which are quieter than the tone but still
       above the relative gate — the standard behaves the same way, so the
       assertion is "the silence is gated out", not a tone-accurate figure. */
    const measured = measureLoudness([padded, padded], rate)!.integratedLufs;
    expect(measured).toBeGreaterThan(-20.5);
    expect(measured).toBeLessThan(-19.5);
  });

  it.each([
    ['no channels', [] as Float32Array[], 48000],
    ['a nonsense sample rate', [new Float32Array(48000)], 0],
    ['less than one 400 ms block', [new Float32Array(100)], 48000],
    ['digital silence', [new Float32Array(48000), new Float32Array(48000)], 48000],
  ])('returns null for %s', (_label, channels, rate) => {
    expect(measureLoudness(channels as Float32Array[], rate as number)).toBeNull();
  });
});

describe('trackGain', () => {
  it('turns a loud master down to the target', () => {
    expect(trackGainDb(-8)).toBeCloseTo(TARGET_LUFS - -8, 6);
    expect(trackGainDb(-8)).toBeLessThan(0);
  });

  it('never boosts a quiet one', () => {
    expect(trackGainDb(-20)).toBe(0);
    expect(trackGainMultiplier(-20)).toBe(1);
  });

  it('treats unmeasured exactly as it treats already-quiet', () => {
    // This equivalence is the reason a client-reported figure is safe: there
    // is nothing an under-report wins that silence about it does not.
    for (const missing of [null, undefined, Number.NaN, 'loud', {}]) {
      expect(trackGainDb(missing as never)).toBe(trackGainDb(-30));
    }
  });

  it('floors the attenuation so a broken reading cannot silence a track', () => {
    expect(trackGainDb(-1)).toBe(MAX_ATTENUATION_DB);
    expect(trackGainMultiplier(-1)).toBeGreaterThan(0.2);
  });

  it('multiplies rather than replaces, so 0 dB is exactly unity', () => {
    expect(trackGainMultiplier(TARGET_LUFS)).toBe(1);
  });

  it.each([
    [-99, 'below the plausible floor'],
    [7, 'above full scale'],
    [Number.POSITIVE_INFINITY, 'not finite'],
  ])('discards %s (%s)', (value) => {
    expect(clampMeasuredLoudness(value)).toBeNull();
  });

  it('accepts a peak above 0 dBFS, which a decoded float buffer really can hit', () => {
    expect(clampMeasuredPeak(1.5)).toBe(1.5);
    expect(clampMeasuredPeak(-3)).toBe(-3);
    expect(clampMeasuredPeak(50)).toBeNull();
  });
});
