// Pure-JS audio header parser — no native modules, works in CF Workers.
// Supports WAV, FLAC, MP4/M4A (AAC, ALAC) and MPEG Layer 3 (MP3). Returns null
// for anything else: a null duration is "unknown", never a guess, because the
// station's ad-break cadence counts minutes of music with this number.
//
// THE SHAPE FIELDS ARE FREE AND WERE BEING THROWN AWAY. Duration is computed
// FROM sample rate, channel count and byte rate in every format here — the
// parsers read them, divided, and returned only the seconds. `describeAudio`
// keeps them. That matters because every decision about audio quality needs
// them: which uploads are lossless and want a streaming copy, whether a file
// is mono when the artist thinks it is stereo, and what to tell an artist
// their upload was accepted as. Adding the reads later would have meant
// fetching every object back out of R2 to re-parse a header we had already
// read once.

export type AudioShape = {
  /** Container/codec family as sniffed from the magic bytes. */
  codec: 'wav' | 'flac' | 'mp4' | 'mp3';
  durationSecs: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  /** Null for lossy codecs, where "bit depth" is not a property of the file. */
  bitDepth: number | null;
};

/**
 * Read what the header says about the audio. Every field is independently
 * nullable: a truncated or unusual file can yield a codec and nothing else,
 * and a null is always "the header did not say", never a default.
 */
export function describeAudio(bytes: Uint8Array): AudioShape | null {
  if (bytes.length < 12) return null;
  // WAV: "RIFF" + "WAVE"
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return describeWav(bytes);
  }
  // FLAC: "fLaC"
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return describeFlac(bytes);
  }
  // MP4 family: "ftyp" at offset 4
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return describeMp4(bytes);
  }
  return describeMp3(bytes);
}

/* Kept as the narrow entry point because 40-odd call sites want only the
   seconds. It delegates rather than parsing again: two parsers over the same
   bytes is exactly how the WAV byteRate bug below survived as long as it did. */
export function parseAudioDuration(bytes: Uint8Array): number | null {
  return describeAudio(bytes)?.durationSecs ?? null;
}

/* FLAC: the STREAMINFO block is mandatory and first. After the 4-byte marker
   and the 4-byte block header, its layout is min/max block size (2+2), min/max
   frame size (3+3), then a packed field: 20 bits sample rate, 3 bits channels-1,
   5 bits bits-per-sample-1, 36 bits total samples. Total samples of 0 means
   "unknown", and so does this function then. */
function describeFlac(b: Uint8Array): AudioShape {
  const shape: AudioShape = { codec: 'flac', durationSecs: null, sampleRateHz: null, channels: null, bitDepth: null };
  if (b.length < 26) return shape;
  if ((b[4] & 0x7f) !== 0) return shape; // first block must be STREAMINFO

  const sampleRate = (b[18] << 12) | (b[19] << 4) | (b[20] >> 4);
  /* The three fields after the sample rate share bytes 20 and 21: 3 bits of
     channels-1, then 5 bits of bits-per-sample-1. Both are stored minus one,
     so a raw 0 means mono / 1-bit, never "absent". */
  const channels = ((b[20] >> 1) & 0x07) + 1;
  const bitDepth = (((b[20] & 0x01) << 4) | (b[21] >> 4)) + 1;
  const totalSamples = (b[21] & 0x0f) * 2 ** 32 + ((b[22] << 24) >>> 0) + (b[23] << 16) + (b[24] << 8) + b[25];

  if (sampleRate > 0) shape.sampleRateHz = sampleRate;
  shape.channels = channels;
  shape.bitDepth = bitDepth;
  // Total samples of 0 means "unknown" in FLAC, and so does a null here.
  if (sampleRate > 0 && totalSamples > 0) shape.durationSecs = Math.round(totalSamples / sampleRate);
  return shape;
}

/* MP4/M4A: the movie header box ("mvhd") carries a timescale and a duration
   in that timescale. Found by scanning for the fourcc rather than walking the
   box tree, because `moov` may sit at the end of the file (a "non-faststart"
   encode) and a walk that stops at the first `mdat` would miss it. Version 0
   packs both as 32-bit; version 1 as 32-bit timescale and 64-bit duration. */
function describeMp4(b: Uint8Array): AudioShape {
  const shape: AudioShape = { codec: 'mp4', durationSecs: null, sampleRateHz: null, channels: null, bitDepth: null };
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);

  for (let i = 4; i <= b.length - 24; i += 1) {
    if (b[i] === 0x6d && b[i + 1] === 0x76 && b[i + 2] === 0x68 && b[i + 3] === 0x64) { // "mvhd"
      const version = b[i + 4];
      if (version === 0 && i + 24 <= b.length) {
        const timescale = view.getUint32(i + 16, false);
        const duration = view.getUint32(i + 20, false);
        if (timescale > 0 && duration > 0) shape.durationSecs = Math.round(duration / timescale);
      } else if (version === 1 && i + 36 <= b.length) {
        const timescale = view.getUint32(i + 24, false);
        const duration = Number(view.getBigUint64(i + 28, false));
        if (timescale > 0 && duration > 0) shape.durationSecs = Math.round(duration / timescale);
      }
      break;
    }
  }

  /* Sample rate and channels live in the audio sample entry, not in `mvhd`,
     so they need their own scan. From the fourcc: 6 reserved + 2 data ref
     index + 8 reserved puts channelcount at +20, and samplerate is 16.16
     fixed-point at +28, of which only the integer half is wanted. `mp4a`
     covers AAC; `alac` is the lossless entry and has the same header shape at
     these offsets. Bit depth is left null for `mp4a` — samplesize at +22 is a
     template field that AAC encoders fill with 16 whatever the source was, so
     reporting it would be inventing a fact. */
  for (let i = 4; i <= b.length - 32; i += 1) {
    const isMp4a = b[i] === 0x6d && b[i + 1] === 0x70 && b[i + 2] === 0x34 && b[i + 3] === 0x61;
    const isAlac = b[i] === 0x61 && b[i + 1] === 0x6c && b[i + 2] === 0x61 && b[i + 3] === 0x63;
    if (!isMp4a && !isAlac) continue;

    const channels = view.getUint16(i + 20, false);
    const sampleRate = view.getUint16(i + 28, false);
    if (channels > 0 && channels <= 8) shape.channels = channels;
    if (sampleRate > 0) shape.sampleRateHz = sampleRate;
    if (isAlac) {
      const samplesize = view.getUint16(i + 22, false);
      if (samplesize > 0 && samplesize <= 32) shape.bitDepth = samplesize;
    }
    break;
  }

  return shape;
}

function describeWav(b: Uint8Array): AudioShape {
  const shape: AudioShape = { codec: 'wav', durationSecs: null, sampleRateHz: null, channels: null, bitDepth: null };
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 44) return shape;
  if (view.getUint32(8, false) !== 0x57415645) return shape; // "WAVE"
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= b.length) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    if (id === 0x666d7420 && offset + 20 <= b.length) { // "fmt "
      /* byteRate lives at +16, NOT +12 — +12 is sampleRate, and reading it
         there made every 16-bit file report double its length (measured
         2026-08-31: a real 20s 22.05kHz mono WAV came back as 40s). The error
         is a factor of bytes-per-sample x channels, so ordinary 16-bit stereo
         reads 4x too long: a 15-second spot was refused as 60s, which made WAV
         ad uploads impossible to get past the 30s gate. It also stored wrong
         durations for uploaded WAV tracks, which is what the station's
         ad-break cadence counts minutes of music with.

         fmt chunk layout from `offset`:
           +0 id · +4 size · +8 audioFormat · +10 channels
           +12 sampleRate · +16 byteRate · +20 blockAlign · +22 bitsPerSample */
      byteRate = view.getUint32(offset + 16, true);
      const channels = view.getUint16(offset + 10, true);
      const sampleRate = view.getUint32(offset + 12, true);
      if (channels > 0 && channels <= 8) shape.channels = channels;
      if (sampleRate > 0) shape.sampleRateHz = sampleRate;
      if (offset + 24 <= b.length) {
        const bits = view.getUint16(offset + 22, true);
        // 0 is what a compressed WAV writes here; it is absent, not 0-bit.
        if (bits > 0 && bits <= 64) shape.bitDepth = bits;
      }
    }
    if (id === 0x64617461 && byteRate > 0) { // "data"
      shape.durationSecs = Math.round(size / byteRate);
      return shape;
    }
    offset += 8 + size;
    if (size % 2 !== 0) offset++; // word-aligned
  }
  // A `fmt ` with no `data` still describes the audio; only the length is lost.
  return shape;
}

// MPEG1 Layer3 bitrate table (kbps, index 1-14)
const MP3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
// MPEG1 sample-rate table (Hz, index 0-2)
const MP3_SAMPLE_RATES = [44100, 48000, 32000];

function describeMp3(b: Uint8Array): AudioShape {
  const shape: AudioShape = { codec: 'mp3', durationSecs: null, sampleRateHz: null, channels: null, bitDepth: null };
  let offset = 0;
  // Skip ID3v2 tag
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 && b.length > 10) { // "ID3"
    const sz =
      ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
    offset = sz + 10;
  }
  // Scan for first valid MPEG1 Layer3 sync frame
  while (offset < b.length - 4) {
    if (b[offset] === 0xff && (b[offset + 1] & 0xe0) === 0xe0) {
      const h1 = b[offset + 1];
      const h2 = b[offset + 2];
      const version = (h1 >> 3) & 0x3;    // 0x3 = MPEG1
      const layer = (h1 >> 1) & 0x3;      // 0x1 = Layer3
      const bitrateIdx = (h2 >> 4) & 0xf;
      const srIdx = (h2 >> 2) & 0x3;
      if (version === 3 && layer === 1 && bitrateIdx > 0 && bitrateIdx < 15 && srIdx < 3) {
        const bitrate = MP3_BITRATES[bitrateIdx] * 1000;
        if (bitrate > 0) {
          shape.sampleRateHz = MP3_SAMPLE_RATES[srIdx];
          // Channel mode 3 is single-channel; the other three are two-channel
          // (stereo, joint stereo, dual mono) however they pack the signal.
          shape.channels = ((b[offset + 3] >> 6) & 0x3) === 3 ? 1 : 2;
          // Bit depth stays null: it is not a property of a lossy stream.
          shape.durationSecs = Math.round(((b.length - offset) * 8) / bitrate);
          return shape;
        }
      }
    }
    offset++;
  }
  return shape;
}
