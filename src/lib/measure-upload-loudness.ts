/**
 * Measure an upload's loudness in the uploader's own browser.
 *
 * This is the only part of the loudness path that touches the platform;
 * `src/lib/loudness.ts` holds the arithmetic and stays pure so the unit suite
 * can drive it against the standard's own compliance figures.
 *
 * EVERY failure here returns null, and null is a safe state: an unmeasured
 * track plays at unity, exactly like a track already at target
 * (`src/lib/track-gain.ts`). So no browser without Web Audio, no unusual
 * codec, and no out-of-memory decode can cost a member their upload — the
 * worst case is that this one track is not levelled.
 */

import { measureLoudness } from '@/lib/loudness';

/** Decode at one rate rather than the file's own. Halves the PCM a 96 kHz
 *  master would otherwise put in a phone's memory, and K-weighting is derived
 *  per rate so the reading is unaffected. */
const DECODE_SAMPLE_RATE = 48000;

/** Past this, the decoded buffer is large enough to be a real risk to the
 *  tab, and no track this product plays is anywhere near it. Skipping is
 *  free; crashing the upload form is not. */
const MAX_MEASURED_SECONDS = 15 * 60;

type AudioContextCtor = new (...args: never[]) => BaseAudioContext;

export type MeasuredLoudness = { loudnessLufs: number; peakDbfs: number };

export async function measureFileLoudness(file: Blob): Promise<MeasuredLoudness | null> {
  if (typeof window === 'undefined') return null;

  const OfflineCtor = (window as unknown as { OfflineAudioContext?: AudioContextCtor; webkitOfflineAudioContext?: AudioContextCtor })
    .OfflineAudioContext
    ?? (window as unknown as { webkitOfflineAudioContext?: AudioContextCtor }).webkitOfflineAudioContext;
  if (!OfflineCtor) return null;

  let context: BaseAudioContext;
  try {
    // Length 1: nothing is rendered, the context exists only to decode.
    context = new (OfflineCtor as unknown as new (channels: number, length: number, rate: number) => BaseAudioContext)(
      2,
      1,
      DECODE_SAMPLE_RATE,
    );
  } catch {
    return null;
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = await context.decodeAudioData(bytes);
    if (buffer.duration > MAX_MEASURED_SECONDS) return null;

    const channels: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      channels.push(buffer.getChannelData(c));
    }

    const measured = measureLoudness(channels, buffer.sampleRate);
    if (!measured || !Number.isFinite(measured.integratedLufs) || !Number.isFinite(measured.peakDbfs)) {
      return null;
    }
    return { loudnessLufs: measured.integratedLufs, peakDbfs: measured.peakDbfs };
  } catch {
    return null;
  }
}
