import { describe, expect, it } from 'vitest';
import {
  decodedByteLength,
  dataUrlMimeType,
  extensionFor,
  isInlineValue,
} from '@/lib/media-backfill';

describe('isInlineValue', () => {
  it('recognises only a value still held in the database', () => {
    expect(isInlineValue('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    // Already migrated — a second pass must not pick these up again, which is
    // what makes re-running the backfill a no-op rather than a duplicate.
    expect(isInlineValue('https://ihype.org/cdn/profile/p1/a.png')).toBe(false);
    expect(isInlineValue('https://acct.r2.cloudflarestorage.com/b/a.png')).toBe(false);
    expect(isInlineValue(null)).toBe(false);
    expect(isInlineValue(undefined)).toBe(false);
    expect(isInlineValue('')).toBe(false);
  });
});

describe('decodedByteLength', () => {
  it('measures the bytes a payload actually occupies, not its base64 length', () => {
    // "hi" -> aGk= : 4 base64 chars, 2 real bytes.
    expect(decodedByteLength('data:text/plain;base64,aGk=')).toBe(2);
    expect(decodedByteLength('aGk=')).toBe(2);
  });

  it('accounts for padding', () => {
    expect(decodedByteLength('YQ==')).toBe(1);   // "a"
    expect(decodedByteLength('YWI=')).toBe(2);   // "ab"
    expect(decodedByteLength('YWJj')).toBe(3);   // "abc"
  });

  it('is close to the true size for a large payload', () => {
    const raw = Buffer.alloc(100_000, 7);
    const value = `data:application/octet-stream;base64,${raw.toString('base64')}`;
    expect(decodedByteLength(value)).toBe(100_000);
  });
});

describe('dataUrlMimeType', () => {
  it('reads the declared type', () => {
    expect(dataUrlMimeType('data:image/webp;base64,AAAA')).toBe('image/webp');
    expect(dataUrlMimeType('data:audio/mp4;base64,AAAA')).toBe('audio/mp4');
  });

  it('falls back rather than throwing on a malformed value', () => {
    expect(dataUrlMimeType('data:,plain')).toBe('application/octet-stream');
    expect(dataUrlMimeType('nonsense')).toBe('application/octet-stream');
  });
});

describe('extensionFor', () => {
  it('maps the types these uploads actually produce', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(extensionFor('audio/mpeg')).toBe('mp3');
    expect(extensionFor('audio/wav')).toBe('wav');
  });

  it('never produces a path-breaking extension for an unknown type', () => {
    expect(extensionFor('application/x-weird+thing')).toMatch(/^[a-z0-9]+$/i);
    expect(extensionFor('garbage')).toMatch(/^[a-z0-9]+$/i);
  });
});
