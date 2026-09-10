/*
  Blanks out JavaScript/TypeScript comments so a scanner cannot match inside
  one, while keeping every byte offset and line number intact.

  WHY THIS EXISTS. `extract-i18n-keys.mjs` matches `t('key', 'English')` over
  raw source, and two components carry a COMMENT that documents that exact
  shape — the prose explaining why a label must be translated at the draw. The
  extractor read the example as a real call and invented a key literally named
  `key`, with the fallback `English`, that no code will ever look up. It had
  not yet reached a dictionary, but the applier's own safety rule ("refuse any
  key not actually called in the source tree") consults this same extractor, so
  the phantom would have passed review and sat in eleven dictionaries forever.

  This is the second time this repository has been bitten by a scanner reading
  its own documentation: `audit-css.mjs` collapsed block comments and lost the
  line numbers its exemption markers were written against. Same class, sibling
  tool — which is why the fix lives in `scripts/lib/` rather than inside one
  script.

  Comment bytes become spaces and newlines are preserved, so offsets, line
  numbers and `matchAll` indices are all unchanged.

  KNOWN LIMIT. Deciding whether `/` opens a regex literal or a comment needs a
  parser; this uses the usual heuristic (a regex may only start where an
  operand may). A regex in a position the heuristic does not expect could have
  its trailing `//` read as a comment, blanking the rest of that line. That
  direction is the safe one for the caller — a dropped match is reported, never
  silent — and the extractor prints every match it skips for exactly this
  reason.
*/

/* A `/` here opens a regex, not a division: after any of these, an operand is
   expected. Whitespace before it is skipped by the caller. */
const REGEX_MAY_FOLLOW = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '\n',
]);

/**
 * @param {string} src
 * @returns {string} the same length and line structure, with comment bytes replaced by spaces
 */
export function maskComments(src) {
  const out = src.split('');
  let i = 0;
  let lastMeaningful = '\n';

  const blank = (from, to) => {
    for (let j = from; j < to && j < src.length; j += 1) {
      if (src[j] !== '\n') out[j] = ' ';
    }
  };

  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];

    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i);
      blank(i, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
      continue;
    }

    if (c === '/' && n === '*') {
      const close = src.indexOf('*/', i + 2);
      const end = close === -1 ? src.length : close + 2;
      blank(i, end);
      i = end;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      i = skipQuoted(src, i, c);
      lastMeaningful = c;
      continue;
    }

    if (c === '/' && REGEX_MAY_FOLLOW.has(lastMeaningful)) {
      i = skipRegex(src, i);
      lastMeaningful = '/';
      continue;
    }

    if (!/\s/.test(c)) lastMeaningful = c;
    else if (c === '\n') lastMeaningful = '\n';
    i += 1;
  }

  return out.join('');
}

/* Template literals may nest `${ ... }` containing anything, including more
   strings and comments; tracking brace depth is enough for our purpose because
   a comment inside an interpolation is still a comment and blanking it is
   correct. */
function skipQuoted(src, start, quote) {
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (quote === '`' && c === '$' && src[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') depth -= 1;
        else if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
          i = skipQuoted(src, i, src[i]);
          continue;
        }
        i += 1;
      }
      continue;
    }
    if (c === quote) return i + 1;
    if (c === '\n' && quote !== '`') return i; // unterminated: do not swallow the file
    i += 1;
  }
  return i;
}

function skipRegex(src, start) {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '\n') return start + 1; // not a regex after all; resume as code
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) return i + 1;
    i += 1;
  }
  return i;
}
