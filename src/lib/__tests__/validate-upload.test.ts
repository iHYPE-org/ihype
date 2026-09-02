import { describe, expect, it } from 'vitest';
import { PLAYABLE_AUDIO_FORMATS_LABEL, sniffAudio, validateAudioMagicBytes } from '@/lib/validate-upload';

const bytes = (...parts: (string | number[])[]) => {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') for (const ch of part) out.push(ch.charCodeAt(0));
    else out.push(...part);
  }
  while (out.length < 16) out.push(0);
  return new Uint8Array(out);
};

describe('sniffAudio (any format we can play; no video)', () => {
  it('accepts the four formats every iHYPE player decodes', () => {
    expect(sniffAudio(bytes('ID3', [3, 0, 0, 0, 0, 0, 0]))).toMatchObject({ format: 'mp3', playable: true });
    expect(sniffAudio(bytes([0xff, 0xfb, 0x90, 0x00]))).toMatchObject({ format: 'mp3', playable: true });
    expect(sniffAudio(bytes([0xff, 0xf1, 0x50, 0x80]))).toMatchObject({ format: 'aac', playable: true });
    expect(sniffAudio(bytes('RIFF', [0, 0, 0, 0], 'WAVE'))).toMatchObject({ format: 'wav', playable: true });
    expect(sniffAudio(bytes('fLaC', [0x00, 0x00, 0x00, 0x22]))).toMatchObject({ format: 'flac', playable: true });
    expect(sniffAudio(bytes([0, 0, 0, 0x18], 'ftyp', 'M4A '))).toMatchObject({ format: 'm4a', playable: true });
  });

  it('refuses what one of the two players cannot decode, and says which', () => {
    const ogg = sniffAudio(bytes('OggS', [0, 2, 0, 0]));
    expect(ogg?.playable).toBe(false);
    expect(ogg?.reason).toContain('iPhone');
    expect(ogg?.reason).toContain(PLAYABLE_AUDIO_FORMATS_LABEL);
    expect(sniffAudio(bytes('FORM', [0, 0, 0, 0], 'AIFF'))?.playable).toBe(false);
    expect(sniffAudio(bytes([0x1a, 0x45, 0xdf, 0xa3]))?.format).toBe('webm');
  });

  it('refuses video however it is dressed', () => {
    expect(sniffAudio(bytes([0, 0, 0, 0x14], 'ftyp', 'qt  '))).toMatchObject({ format: 'video', playable: false });
    // An MP4 with an audio brand but a video track handler in its head.
    const disguised = bytes([0, 0, 0, 0x18], 'ftyp', 'mp42', [0, 0, 0, 0], 'moov', [0, 0, 0, 0x20], 'hdlr', [0, 0, 0, 0, 0, 0, 0, 0], 'vide');
    expect(sniffAudio(disguised)).toMatchObject({ format: 'video', playable: false });
    expect(sniffAudio(bytes('RIFF', [0, 0, 0, 0], 'AVI '))).toMatchObject({ format: 'video', playable: false });
  });

  it('returns null for something that is not media at all', () => {
    expect(sniffAudio(bytes('%PDF-1.7', [0, 0, 0, 0]))).toBeNull();
    expect(sniffAudio(new Uint8Array(4))).toBeNull();
  });

  it('validateAudioMagicBytes is true only for playable audio', () => {
    expect(validateAudioMagicBytes(bytes('fLaC', [0, 0, 0, 0x22]))).toBe(true);
    expect(validateAudioMagicBytes(bytes('OggS', [0, 2, 0, 0]))).toBe(false);
    expect(validateAudioMagicBytes(bytes('%PDF', [0, 0, 0, 0]))).toBe(false);
  });
});
