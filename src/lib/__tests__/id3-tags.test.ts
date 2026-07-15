import { describe, expect, it } from 'vitest';
import { parseId3Tags } from '@/lib/id3-tags';

function buildId3v2_3(frames: Array<{ id: string; text: string }>): Uint8Array {
  const frameBuffers = frames.map(({ id, text }) => {
    const textBytes = new TextEncoder().encode(text);
    const body = new Uint8Array(1 + textBytes.length);
    body[0] = 0x03; // UTF-8 encoding byte
    body.set(textBytes, 1);
    const header = new Uint8Array(10);
    header.set(new TextEncoder().encode(id), 0);
    // frame size (big-endian, not synchsafe, for v2.3)
    header[4] = (body.length >> 24) & 0xff;
    header[5] = (body.length >> 16) & 0xff;
    header[6] = (body.length >> 8) & 0xff;
    header[7] = body.length & 0xff;
    const full = new Uint8Array(header.length + body.length);
    full.set(header, 0);
    full.set(body, header.length);
    return full;
  });

  const framesTotalLength = frameBuffers.reduce((sum, f) => sum + f.length, 0);
  const header = new Uint8Array(10);
  header.set(new TextEncoder().encode('ID3'), 0);
  header[3] = 3; // major version
  header[4] = 0; // minor version
  header[5] = 0; // flags
  // synchsafe size
  header[6] = (framesTotalLength >> 21) & 0x7f;
  header[7] = (framesTotalLength >> 14) & 0x7f;
  header[8] = (framesTotalLength >> 7) & 0x7f;
  header[9] = framesTotalLength & 0x7f;

  const out = new Uint8Array(header.length + framesTotalLength);
  out.set(header, 0);
  let offset = header.length;
  for (const fb of frameBuffers) {
    out.set(fb, offset);
    offset += fb.length;
  }
  return out;
}

describe('parseId3Tags', () => {
  it('returns null for a file with no ID3v2 header', () => {
    expect(parseId3Tags(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeNull();
    expect(parseId3Tags(new Uint8Array([]))).toBeNull();
  });

  it('parses TPE1/TIT2/TCOP frames from a well-formed ID3v2.3 tag', () => {
    const bytes = buildId3v2_3([
      { id: 'TIT2', text: 'Midnight Drive' },
      { id: 'TPE1', text: 'Famous Commercial Act' },
      { id: 'TCOP', text: '2019 Big Label Records' },
    ]);
    const tags = parseId3Tags(bytes);
    expect(tags).not.toBeNull();
    expect(tags?.title).toBe('Midnight Drive');
    expect(tags?.artist).toBe('Famous Commercial Act');
    expect(tags?.copyright).toBe('2019 Big Label Records');
    expect(tags?.isrc).toBeNull();
  });

  it('returns null when the tag has no recognized frames', () => {
    const bytes = buildId3v2_3([{ id: 'COMM', text: 'just a comment' }]);
    expect(parseId3Tags(bytes)).toBeNull();
  });
});
