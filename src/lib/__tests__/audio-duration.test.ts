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

describe('parseAudioDuration for the lossless and AAC containers', () => {
  it('reads a FLAC STREAMINFO: 44.1 kHz, 10,584,000 samples is 240 seconds', () => {
    const b = new Uint8Array(64);
    b.set([0x66, 0x4c, 0x61, 0x43], 0); // fLaC
    b[4] = 0x00; b[5] = 0; b[6] = 0; b[7] = 34; // STREAMINFO, length 34
    // bytes 8..17: block/frame sizes (irrelevant here)
    // sample rate 44100 = 0x0AC44 in 20 bits → bytes 18,19 and high nibble of 20
    b[18] = 0x0a; b[19] = 0xc4; b[20] = 0x40 | 0x02; // channels-1 = 1 (stereo) in the next 3 bits
    b[21] = 0x0f & 0x00; // bps low bits + top 4 bits of total samples = 0
    const total = 10_584_000; // 240 s
    b[22] = (total >>> 24) & 0xff; b[23] = (total >>> 16) & 0xff; b[24] = (total >>> 8) & 0xff; b[25] = total & 0xff;
    expect(parseAudioDuration(b)).toBe(240);
  });

  it('reads an M4A movie header, version 0: timescale 1000, duration 183,500 is 184 seconds', () => {
    const b = new Uint8Array(96);
    const view = new DataView(b.buffer);
    b.set([0, 0, 0, 0x18], 0); b.set([0x66, 0x74, 0x79, 0x70], 4); b.set([0x4d, 0x34, 0x41, 0x20], 8); // ftyp M4A
    const at = 40;
    view.setUint32(at - 4, 108, false);
    b.set([0x6d, 0x76, 0x68, 0x64], at); // mvhd
    b[at + 4] = 0; // version 0
    view.setUint32(at + 16, 1000, false);
    view.setUint32(at + 20, 183_500, false);
    expect(parseAudioDuration(b)).toBe(184);
  });

  it('returns null rather than a guess when the container carries no duration', () => {
    const flacNoTotal = new Uint8Array(64);
    flacNoTotal.set([0x66, 0x4c, 0x61, 0x43], 0);
    flacNoTotal[18] = 0x0a; flacNoTotal[19] = 0xc4; flacNoTotal[20] = 0x40;
    expect(parseAudioDuration(flacNoTotal)).toBeNull();
    const m4aNoMvhd = new Uint8Array(64);
    m4aNoMvhd.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20], 0);
    expect(parseAudioDuration(m4aNoMvhd)).toBeNull();
  });
});
