// Pure-JS audio duration parser — no native modules, works in CF Workers.
// Supports WAV, FLAC, MP4/M4A (AAC, ALAC) and MPEG Layer 3 (MP3). Returns null
// for anything else: a null duration is "unknown", never a guess, because the
// station's ad-break cadence counts minutes of music with this number.

export function parseAudioDuration(bytes: Uint8Array): number | null {
  if (bytes.length < 12) return null;
  // WAV: "RIFF" + "WAVE"
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return parseWavDuration(bytes);
  }
  // FLAC: "fLaC"
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return parseFlacDuration(bytes);
  }
  // MP4 family: "ftyp" at offset 4
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return parseMp4Duration(bytes);
  }
  return parseMp3Duration(bytes);
}

/* FLAC: the STREAMINFO block is mandatory and first. After the 4-byte marker
   and the 4-byte block header, its layout is min/max block size (2+2), min/max
   frame size (3+3), then a packed field: 20 bits sample rate, 3 bits channels-1,
   5 bits bits-per-sample-1, 36 bits total samples. Total samples of 0 means
   "unknown", and so does this function then. */
function parseFlacDuration(b: Uint8Array): number | null {
  if (b.length < 26) return null;
  if ((b[4] & 0x7f) !== 0) return null; // first block must be STREAMINFO
  const sampleRate = (b[18] << 12) | (b[19] << 4) | (b[20] >> 4);
  const totalSamples = (b[21] & 0x0f) * 2 ** 32 + ((b[22] << 24) >>> 0) + (b[23] << 16) + (b[24] << 8) + b[25];
  if (sampleRate <= 0 || totalSamples <= 0) return null;
  return Math.round(totalSamples / sampleRate);
}

/* MP4/M4A: the movie header box ("mvhd") carries a timescale and a duration
   in that timescale. Found by scanning for the fourcc rather than walking the
   box tree, because `moov` may sit at the end of the file (a "non-faststart"
   encode) and a walk that stops at the first `mdat` would miss it. Version 0
   packs both as 32-bit; version 1 as 32-bit timescale and 64-bit duration. */
function parseMp4Duration(b: Uint8Array): number | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 4; i <= b.length - 24; i += 1) {
    if (b[i] === 0x6d && b[i + 1] === 0x76 && b[i + 2] === 0x68 && b[i + 3] === 0x64) { // "mvhd"
      const version = b[i + 4];
      if (version === 0) {
        if (i + 24 > b.length) return null;
        const timescale = view.getUint32(i + 16, false);
        const duration = view.getUint32(i + 20, false);
        return timescale > 0 && duration > 0 ? Math.round(duration / timescale) : null;
      }
      if (version === 1) {
        if (i + 36 > b.length) return null;
        const timescale = view.getUint32(i + 24, false);
        const duration = Number(view.getBigUint64(i + 28, false));
        return timescale > 0 && duration > 0 ? Math.round(duration / timescale) : null;
      }
      return null;
    }
  }
  return null;
}

function parseWavDuration(b: Uint8Array): number | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 44) return null;
  if (view.getUint32(8, false) !== 0x57415645) return null; // "WAVE"
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
    }
    if (id === 0x64617461 && byteRate > 0) { // "data"
      return Math.round(size / byteRate);
    }
    offset += 8 + size;
    if (size % 2 !== 0) offset++; // word-aligned
  }
  return null;
}

// MPEG1 Layer3 bitrate table (kbps, index 1-14)
const MP3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
// MPEG1 sample-rate table (Hz, index 0-2)
const MP3_SAMPLE_RATES = [44100, 48000, 32000];

function parseMp3Duration(b: Uint8Array): number | null {
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
          return Math.round(((b.length - offset) * 8) / bitrate);
        }
      }
    }
    offset++;
  }
  return null;
}
