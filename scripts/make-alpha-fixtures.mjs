/**
 * Generates the media the alpha walk uploads, with no dependencies.
 *
 * The walk insists on REAL files because both upload routes validate magic
 * bytes and read duration out of the container — a buffer of zeros would only
 * prove the validator can be fooled. But the assets used by hand are a real
 * song and real cover art, which do not belong in the repository: one is
 * 4.7 MB and neither is ours to redistribute. So CI synthesises its own, in
 * the same formats, with genuine headers.
 *
 * Everything here is written byte by byte (zlib for the PNG, a RIFF header for
 * the WAVs) rather than through an image or audio library, so the generator
 * cannot fail on a machine where an optional native dependency did not build.
 *
 * Usage: node scripts/make-alpha-fixtures.mjs [outputDirectory]
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A real RGB PNG — an orange/cream gradient, so it is visibly not a blank. */
function png(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      raw[offset++] = 0xff - Math.floor((x / width) * 0x30);
      raw[offset++] = 0x50 + Math.floor((y / height) * 0x80);
      raw[offset++] = 0x29 + Math.floor((x / width) * 0x40);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Real PCM audio — two alternating tones, so duration parsing has something true to read. */
function wav(seconds, { sampleRate = 22050 } = {}) {
  const frames = seconds * sampleRate;
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const tone = t % 2 < 1 ? 440 : 587.33;
    const envelope = Math.min(1, t * 4) * Math.min(1, (seconds - t) * 4) * 0.28;
    data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * tone * t) * envelope * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);            // PCM
  header.writeUInt16LE(1, 22);            // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate: 16-bit mono
  header.writeUInt16LE(2, 32);            // block align
  header.writeUInt16LE(16, 34);           // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const out = process.argv[2] ?? 'e2e/fixtures/media';
mkdirSync(out, { recursive: true });

const files = {
  // A song, not a spot: long enough that nothing mistakes it for one.
  'alpha-song.wav': wav(90),
  // Under the 30-second advertising limit.
  'alpha-ad-spot.wav': wav(20),
  'alpha-graphic.png': png(1200, 900),
};

for (const [name, bytes] of Object.entries(files)) {
  const path = join(out, name);
  writeFileSync(path, bytes);
  console.log(`  ${path} — ${(bytes.length / 1024).toFixed(0)} KB`);
}
