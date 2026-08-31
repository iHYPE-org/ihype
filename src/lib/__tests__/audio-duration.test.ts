import { describe, expect, it } from 'vitest';
import { parseAudioDuration } from '@/lib/audio-duration';

/**
 * Builds a real RIFF/WAVE header over `seconds` of PCM.
 *
 * The parser reads the container's own fields, so the test has to lay them out
 * exactly as an encoder would — which is the point: it once read byteRate from
 * the sampleRate slot and every 16-bit file came back at double length.
 */
function wav({
  seconds,
  sampleRate = 44100,
  channels = 2,
  bits = 16,
}: { seconds: number; sampleRate?: number; channels?: number; bits?: number }) {
  const bytesPerFrame = (bits / 8) * channels;
  const byteRate = sampleRate * bytesPerFrame;
  const dataSize = seconds * byteRate;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(bytesPerFrame, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return new Uint8Array(buf);
}

describe('parseAudioDuration — WAV', () => {
  it('reads the true duration of 16-bit stereo, the ordinary case', () => {
    // Read from the sampleRate slot this came back as 60, and a 15-second ad
    // spot was refused for exceeding a 30-second limit.
    expect(parseAudioDuration(wav({ seconds: 15 }))).toBe(15);
  });

  it('is independent of channel count and bit depth', () => {
    for (const shape of [
      { channels: 1, bits: 16 },
      { channels: 2, bits: 16 },
      { channels: 1, bits: 8 },
      { channels: 2, bits: 24 },
    ]) {
      expect(parseAudioDuration(wav({ seconds: 20, ...shape })), JSON.stringify(shape)).toBe(20);
    }
  });

  it('is independent of sample rate', () => {
    expect(parseAudioDuration(wav({ seconds: 30, sampleRate: 22050 }))).toBe(30);
    expect(parseAudioDuration(wav({ seconds: 30, sampleRate: 48000 }))).toBe(30);
  });

  it('puts a 30-second spot exactly on the advertising limit, not over it', () => {
    expect(parseAudioDuration(wav({ seconds: 30 }))).toBeLessThanOrEqual(30);
  });

  it('returns null for something that is not audio', () => {
    expect(parseAudioDuration(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(parseAudioDuration(new Uint8Array(64))).toBeNull();
  });
});
