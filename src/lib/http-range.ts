/**
 * Parse one HTTP `Range` header for a byte-serving response.
 *
 * WHY THIS EXISTS. `/cdn/[...key]` served whole objects and advertised no
 * `Accept-Ranges`, which is survivable for an image and wrong for audio: a
 * media element seeks by asking for a byte range, so without this a listener
 * scrubbing a 60 MB lossless master re-downloads it from the top, and some
 * players will not begin at all until they can probe the first bytes.
 *
 * DELIBERATELY NARROW. Only a single `bytes=` range is honoured. Multipart
 * ranges are legal HTTP, need a `multipart/byteranges` body, and no media
 * element asks for one — supporting them would be code that never runs on a
 * path that matters. An unsatisfiable or malformed header is reported
 * distinctly rather than lumped together, because RFC 9110 wants a 416 whose
 * `Content-Range` gives the total size for the first, and a plain 200 for the
 * second, and answering 416 to a header we merely failed to parse would break
 * a client that sent something valid we did not anticipate.
 *
 * (That header's unsatisfiable form is not spelled out here on purpose: the
 * literal ends a block comment, which is how the first draft of this file
 * turned its own docstring into code.)
 */

export type RangeRequest =
  /** No `Range` header, or one this parser does not handle: serve the whole object with 200. */
  | { kind: 'full' }
  /** A satisfiable single range: serve 206 with these inclusive byte offsets. */
  | { kind: 'partial'; start: number; end: number }
  /** Syntactically valid but outside the object: RFC 9110 wants 416. */
  | { kind: 'unsatisfiable' };

/**
 * `size` is the object's total length in bytes. A zero-length object can
 * satisfy no range at all, which is why it short-circuits: `bytes=0-` against
 * an empty object is unsatisfiable, not a whole-object read.
 */
export function parseRangeHeader(header: string | null, size: number): RangeRequest {
  if (!header) return { kind: 'full' };

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return { kind: 'full' };

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return { kind: 'full' };
  if (size <= 0) return { kind: 'unsatisfiable' };

  let start: number;
  let end: number;

  if (rawStart === '') {
    /* A suffix range: `bytes=-500` means the LAST 500 bytes, not "from 0 to
       500". Reading it the other way serves the wrong audio and still looks
       like a working 206, which is the kind of bug nobody reports. */
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return { kind: 'unsatisfiable' };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    if (!Number.isFinite(start) || start >= size) return { kind: 'unsatisfiable' };
    /* An open-ended `bytes=N-` runs to the end. A stated end past the end is
       clamped rather than refused — RFC 9110 requires that, and media elements
       routinely ask for more than is there on the final chunk. */
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
    if (!Number.isFinite(end) || end < start) return { kind: 'unsatisfiable' };
  }

  return { kind: 'partial', start, end };
}
