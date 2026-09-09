import { describe, expect, it } from 'vitest';

import { describeAudio } from '@/lib/audio-duration';

/**
 * The shape fields are the ones duration was already computed FROM — sample
 * rate, channels, byte rate — and which the parser used to divide and discard.
 * They are tested separately from duration because they answer a different
 * question: not "how long", but "what is this, and does it need a streaming
 * copy". A 96 kHz 24-bit stereo master and a 44.1 kHz mono phone recording
 * both play; only one of them should be sent to a listener on cellular.
 *
 * Each fixture lays the header out the way a real encoder would, byte for
 * byte, because that is the only way a header parser can be wrong in a way a
 * rounder test would miss — see the WAV byteRate offset the duration tests
 * exist for.
 */

function wav({
  seconds = 1,
  sampleRate = 44100,
  channels = 2,
  bits = 16,
}: { seconds?: number; sampleRate?: number; channels?: number; bits?: number } = {}) {
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

/** FLAC STREAMINFO. Channels and bit depth are stored MINUS ONE and share
 *  bytes 20-21 with the sample rate's low nibble, which is the part worth
 *  covering: an off-by-one here reports stereo as mono and 24-bit as 23. */
function flac({ sampleRate = 44100, channels = 2, bits = 16, totalSamples = 44100 } = {}) {
  const b = new Uint8Array(64);
  b.set([0x66, 0x4c, 0x61, 0x43], 0); // "fLaC"
  b[4] = 0x00; b[7] = 34; // STREAMINFO, length 34

  b[18] = (sampleRate >> 12) & 0xff;
  b[19] = (sampleRate >> 4) & 0xff;
  b[20] = ((sampleRate & 0x0f) << 4) | (((channels - 1) & 0x07) << 1) | (((bits - 1) >> 4) & 0x01);
  b[21] = (((bits - 1) & 0x0f) << 4) | ((Math.floor(totalSamples / 2 ** 32)) & 0x0f);
  b[22] = (totalSamples >>> 24) & 0xff;
  b[23] = (totalSamples >>> 16) & 0xff;
  b[24] = (totalSamples >>> 8) & 0xff;
  b[25] = totalSamples & 0xff;
  return b;
}

/** An MP4 carrying an `mp4a` sample entry. Sample rate is 16.16 fixed point,
 *  so only the integer half at +28 is read. */
function mp4a({ sampleRate = 44100, channels = 2 } = {}) {
  const b = new Uint8Array(160);
  const view = new DataView(b.buffer);
  b.set([0, 0, 0, 0x18], 0);
  b.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
  b.set([0x4d, 0x34, 0x41, 0x20], 8); // M4A

  const mvhd = 40;
  b.set([0x6d, 0x76, 0x68, 0x64], mvhd);
  b[mvhd + 4] = 0;
  view.setUint32(mvhd + 16, 1000, false);
  view.setUint32(mvhd + 20, 2000, false); // 2 seconds

  const entry = 96;
  b.set([0x6d, 0x70, 0x34, 0x61], entry); // "mp4a"
  view.setUint16(entry + 20, channels, false);
  view.setUint16(entry + 22, 16, false); // template samplesize, deliberately ignored
  view.setUint16(entry + 28, sampleRate, false);
  return b;
}

/** A bare MPEG1 Layer 3 frame header. Channel mode lives in the top two bits
 *  of the fourth byte: 0b11 is single-channel, everything else is two. */
function mp3({ srIdx = 0, mode = 0 } = {}) {
  const b = new Uint8Array(4096);
  b[0] = 0xff;
  b[1] = 0xfb;                               // MPEG1, Layer 3
  b[2] = (0x09 << 4) | (srIdx << 2);         // bitrate index 9 = 128 kbps
  b[3] = (mode & 0x3) << 6;
  return b;
}

describe('describeAudio — WAV', () => {
  it('reads sample rate, channels and bit depth from the fmt chunk', () => {
    expect(describeAudio(wav({ sampleRate: 48000, channels: 2, bits: 24 }))).toEqual({
      codec: 'wav',
      durationSecs: 1,
      sampleRateHz: 48000,
      channels: 2,
      bitDepth: 24,
    });
  });

  it('reads a mono 8-bit file without confusing it for stereo', () => {
    const shape = describeAudio(wav({ sampleRate: 22050, channels: 1, bits: 8 }));
    expect(shape).toMatchObject({ sampleRateHz: 22050, channels: 1, bitDepth: 8 });
  });

  it('describes a studio master', () => {
    expect(describeAudio(wav({ sampleRate: 96000, channels: 2, bits: 24 }))).toMatchObject({
      sampleRateHz: 96000,
      bitDepth: 24,
    });
  });
});

describe('describeAudio — FLAC', () => {
  it('unpacks channels and bit depth from the bits they share with the sample rate', () => {
    expect(describeAudio(flac({ sampleRate: 44100, channels: 2, bits: 16, totalSamples: 44100 }))).toEqual({
      codec: 'flac',
      durationSecs: 1,
      sampleRateHz: 44100,
      channels: 2,
      bitDepth: 16,
    });
  });

  it('reads 24-bit at 96 kHz, where the packing is most easily got wrong', () => {
    expect(describeAudio(flac({ sampleRate: 96000, channels: 2, bits: 24, totalSamples: 96000 }))).toMatchObject({
      sampleRateHz: 96000,
      channels: 2,
      bitDepth: 24,
      durationSecs: 1,
    });
  });

  it('reads mono', () => {
    expect(describeAudio(flac({ channels: 1 }))).toMatchObject({ channels: 1 });
  });

  it('still reports the shape when total samples is 0 — only the length is unknown', () => {
    const shape = describeAudio(flac({ totalSamples: 0 }));
    expect(shape).toMatchObject({ durationSecs: null, sampleRateHz: 44100, channels: 2, bitDepth: 16 });
  });
});

describe('describeAudio — MP4', () => {
  it('reads the sample entry, not just the movie header', () => {
    expect(describeAudio(mp4a({ sampleRate: 44100, channels: 2 }))).toEqual({
      codec: 'mp4',
      durationSecs: 2,
      sampleRateHz: 44100,
      channels: 2,
      bitDepth: null,
    });
  });

  it('leaves bit depth null for AAC rather than reporting the template 16', () => {
    // Encoders write 16 into samplesize whatever the source was, so echoing it
    // back would be inventing a fact about the recording.
    expect(describeAudio(mp4a())?.bitDepth).toBeNull();
  });
});

describe('describeAudio — MP3', () => {
  it('reads the sample rate from the frame header', () => {
    expect(describeAudio(mp3({ srIdx: 0 }))).toMatchObject({ codec: 'mp3', sampleRateHz: 44100 });
    expect(describeAudio(mp3({ srIdx: 1 }))).toMatchObject({ sampleRateHz: 48000 });
    expect(describeAudio(mp3({ srIdx: 2 }))).toMatchObject({ sampleRateHz: 32000 });
  });

  it('reads mono only from channel mode 3', () => {
    expect(describeAudio(mp3({ mode: 3 }))?.channels).toBe(1);
    for (const mode of [0, 1, 2]) {
      expect(describeAudio(mp3({ mode }))?.channels).toBe(2);
    }
  });

  it('leaves bit depth null, because a lossy stream does not have one', () => {
    expect(describeAudio(mp3())?.bitDepth).toBeNull();
  });
});

describe('describeAudio — refusals', () => {
  it('returns null for something too short to be audio', () => {
    expect(describeAudio(new Uint8Array(4))).toBeNull();
  });

  it('never invents a field it could not read', () => {
    // A RIFF header with no fmt chunk: the codec is known, nothing else is.
    const b = new Uint8Array(64);
    b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    b.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
    expect(describeAudio(b)).toEqual({
      codec: 'wav',
      durationSecs: null,
      sampleRateHz: null,
      channels: null,
      bitDepth: null,
    });
  });
});
