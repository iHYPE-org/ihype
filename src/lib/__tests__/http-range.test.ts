import { describe, expect, it } from 'vitest';

import { parseRangeHeader } from '@/lib/http-range';

/**
 * Byte ranges exist here for ONE reason: audio. A media element seeks by
 * asking for a range, so `/cdn/[...key]` serving whole objects meant a
 * listener scrubbing a 60 MB lossless master re-downloaded it from the top.
 *
 * The cases below are the ones a real player actually sends, plus the two
 * that are easy to get backwards. A suffix range is the notorious one: Safari
 * asks for `bytes=-N` to read a trailing atom, and reading it as "from 0 to N"
 * returns the wrong audio while still looking like a working 206 — a bug that
 * plays as a glitch nobody reports rather than an error anybody sees.
 */
const SIZE = 1000;

describe('parseRangeHeader', () => {
  it('serves the whole object when there is no Range header', () => {
    expect(parseRangeHeader(null, SIZE)).toEqual({ kind: 'full' });
  });

  // The probe every media element opens with.
  it('handles the opening probe', () => {
    expect(parseRangeHeader('bytes=0-1', SIZE)).toEqual({ kind: 'partial', start: 0, end: 1 });
  });

  it('handles an open-ended range as "to the end"', () => {
    expect(parseRangeHeader('bytes=500-', SIZE)).toEqual({ kind: 'partial', start: 500, end: 999 });
  });

  it('reads a suffix range from the END, not the start', () => {
    expect(parseRangeHeader('bytes=-500', SIZE)).toEqual({ kind: 'partial', start: 500, end: 999 });
  });

  it('clamps a stated end past the end rather than refusing it', () => {
    // Players routinely overshoot on the final chunk; RFC 9110 requires this.
    expect(parseRangeHeader('bytes=900-99999', SIZE)).toEqual({ kind: 'partial', start: 900, end: 999 });
  });

  it('reads the last byte', () => {
    expect(parseRangeHeader('bytes=999-', SIZE)).toEqual({ kind: 'partial', start: 999, end: 999 });
  });

  it('treats a start at or past the end as unsatisfiable', () => {
    expect(parseRangeHeader('bytes=1000-', SIZE)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=5000-6000', SIZE)).toEqual({ kind: 'unsatisfiable' });
  });

  it('treats a backwards range as unsatisfiable', () => {
    expect(parseRangeHeader('bytes=600-500', SIZE)).toEqual({ kind: 'unsatisfiable' });
  });

  it('refuses any range against a zero-length object', () => {
    // `bytes=0-` against nothing is unsatisfiable, not a whole-object read.
    expect(parseRangeHeader('bytes=0-', 0)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=-10', 0)).toEqual({ kind: 'unsatisfiable' });
  });

  it('treats a zero-length suffix as unsatisfiable', () => {
    expect(parseRangeHeader('bytes=-0', SIZE)).toEqual({ kind: 'unsatisfiable' });
  });

  /* Malformed is NOT unsatisfiable. Answering 416 to a header we merely could
     not parse would break a client sending something valid we did not
     anticipate — multipart ranges, or a unit other than bytes. Falling back to
     the whole object is always correct, just less efficient. */
  it.each([
    ['bytes=abc-def', 'non-numeric'],
    ['bytes=0-1, 5-6', 'multipart'],
    ['items=0-1', 'a unit other than bytes'],
    ['0-1', 'no unit'],
    ['bytes=-', 'no numbers at all'],
    ['', 'empty'],
  ])('falls back to the whole object for %s (%s)', (header) => {
    expect(parseRangeHeader(header, SIZE)).toEqual({ kind: 'full' });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseRangeHeader('  bytes=0-99  ', SIZE)).toEqual({ kind: 'partial', start: 0, end: 99 });
  });
});
