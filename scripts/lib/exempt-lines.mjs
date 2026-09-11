/*
  Resolves "this line is deliberately exempt" comment markers to the line
  numbers they actually excuse.

  WHY THIS IS SHARED, AND WHY IT IS NOT THE OBVIOUS ONE-LINER. Scanning
  UPWARD from the offending line is the natural first guess and it is wrong
  twice over, both measured while building `audit:untranslated`:

    - a one-line lookback misses a reason that runs to two lines, which is
      ordinary prose length;
    - a "walk back over the contiguous comment block" fix misses it too,
      because only the FIRST line of a JSX comment block starts with a
      comment token — its continuation lines start with whatever word the
      sentence had reached.

  So the rule runs the other way: find the marker, walk FORWARD to the end of
  its comment, and excuse the next line carrying anything at all.

  Having got that wrong twice in one scanner, a second scanner with its own
  copy is the same defect `mask-comments.mjs` exists to prevent — a rule this
  fiddly must have exactly one implementation. The author of the third
  scanner should import this, not rewrite it. (It was already rewritten once,
  by hand, in `audit-retired-claims.mjs`, and reproduced the original bug
  within the hour.)

  The marker always REQUIRES a reason — `<marker>:` followed by something.
  "Exempt" with no "why" is indistinguishable from a line somebody could not
  be bothered to fix, and an exemption nobody has to justify is a silence
  rather than a record.

  Takes RAW source, not masked: the marker lives in a comment, which is
  exactly what a masker blanks.
*/

/**
 * A WHOLE FILE can be exempt too, with `<marker>-file: <reason>`.
 *
 * Added because the line rule is right and was still the wrong tool three
 * times in a row: a ranking ledger whose every row discloses the same
 * unreachable branch, and a model prompt inside a multi-line template
 * literal, where a `//` is not a comment at all. Marking each line
 * separately there would be noise pretending to be precision.
 *
 * It is deliberately a DIFFERENT marker rather than a looser reading of the
 * same one, so "this whole file is out of scope" has to be said out loud —
 * it is the bigger claim and should be the harder one to make by accident.
 */
function fileExempt(raw, marker) {
  const fileMarker = new RegExp(marker.source.replace(/:/, '-file:'), marker.flags);
  return fileMarker.test(raw);
}

/**
 * @param {string} raw            the file's untouched source
 * @param {RegExp} marker         e.g. /i18n-exempt:\s*\S/i — must require a reason
 * @returns {(lineIndex: number) => boolean}  0-based, matching `raw.split('\n')`
 */
export function exemptLines(raw, marker) {
  if (fileExempt(raw, marker)) return () => true;
  const lines = raw.split('\n');
  const exempt = new Set();

  lines.forEach((line, i) => {
    if (!marker.test(line)) return;
    exempt.add(i);

    /* Where does this comment end? A run of line comments ends at the first
       line that is not one; a block comment ends at its closing delimiter. */
    let end = i;
    if (/^\s*\/\//.test(line)) {
      while (end + 1 < lines.length && /^\s*\/\//.test(lines[end + 1])) end += 1;
    } else {
      while (end < lines.length && !lines[end].includes('*/')) end += 1;
    }

    // …then the next line carrying anything at all is what it excuses.
    let next = end + 1;
    while (next < lines.length && lines[next].trim() === '') next += 1;
    exempt.add(next);
  });

  return (index) => exempt.has(index);
}
