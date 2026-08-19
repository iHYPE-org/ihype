#!/usr/bin/env node
/**
 * Every theme's ink must be readable on every one of its own grounds.
 *
 * This exists because of a bug the console theme surfaced and no other check
 * could have caught: `--accent` measures 5.73:1 on the navy ground and
 * **2.48:1** on cream. A token that is a correct, tokenised, AA-passing colour
 * in one theme becomes a failing one in another, with no literal to grep for
 * and nothing for `audit:shell` to flag — it only inspects hardcoded values.
 *
 * The light theme has already been bitten by the same shape twice: `--ink-3`
 * was darkened after measuring 3.24:1 on light surfaces, and the alpha ramp
 * had to be restated per theme after composed-alpha surfaces painted
 * near-black over a light page. Both were found by eye, late.
 *
 * So: parse each `[data-theme]` block out of globals.css, pair every ink with
 * every ground, and fail below 4.5:1.
 */
import { readFile } from 'node:fs/promises';

const AA = 4.5;

/** Tokens that are deliberately not text and are exempt. */
const NOT_TEXT = new Set(['--ink-4']);
/** Tokens that are fills; their label contrast is checked separately. */
const FILLS = new Set(['--accent', '--accent-2', '--role-venue', '--role-fan',
  '--role-promoter', '--role-advertiser', '--warning', '--brass', '--brass-deep',
  '--walnut', '--walnut-2', '--lamp', '--heat-fire', '--heat-cold', '--map-void',
  '--accent-deep']);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const css = await readFile('src/app/globals.css', 'utf8');

/** Collect `--name: #hex;` pairs from one block. */
function tokensIn(body) {
  const out = new Map();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) out.set(m[1], m[2]);
  return out;
}

/* `:root` is the default (dark) theme; the rest are named.
 *
 * A named theme is MERGED over the default, because that is how the cascade
 * actually resolves it — a theme inherits every token it does not restate.
 * Checking a theme's own block in isolation is why the first version of this
 * script passed a theme whose accent was 2.48:1: the console block never
 * mentions `--accent`, so the lookup found nothing and skipped the check that
 * the whole script exists for. */
const rootStart = css.indexOf(':root {');
const base = tokensIn(css.slice(rootStart, css.indexOf('}', rootStart)));
const blocks = [['default', base]];
for (const m of css.matchAll(/\[data-theme="([\w-]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
  blocks.push([m[1], new Map([...base, ...tokensIn(m[2])])]);
}

const failures = [];
for (const [name, tokens] of blocks) {
  const grounds = [...tokens].filter(([k]) => /^--bg(-\d)?$/.test(k));
  const inks = [...tokens].filter(([k]) => /^--ink(-\d)?$/.test(k) && !NOT_TEXT.has(k));

  for (const [ik, iv] of inks) {
    for (const [gk, gv] of grounds) {
      const r = ratio(iv, gv);
      if (r < AA) failures.push(`${name}: ${ik} ${iv} on ${gk} ${gv} = ${r.toFixed(2)}:1`);
    }
  }

  // A fill's own label. `--ink-on-accent` is the label ON `--accent`, and it
  // is the token most likely to be inherited from the wrong theme.
  const accent = tokens.get('--accent');
  const onAccent = tokens.get('--ink-on-accent');
  if (accent && onAccent) {
    const r = ratio(onAccent, accent);
    if (r < AA) failures.push(`${name}: --ink-on-accent ${onAccent} on --accent ${accent} = ${r.toFixed(2)}:1`);
  }

  /* The accent as COPY. Checking that `--accent-text` merely EXISTS is not a
     test — every theme inherits one from :root. What matters is whether the
     inherited value still passes on THIS theme's ground, and a copy token
     tuned for navy does not survive a cream one. */
  const bg = tokens.get('--bg');
  const accentText = tokens.get('--accent-text');
  if (accentText && bg) {
    const r = ratio(accentText, bg);
    if (r < AA) {
      failures.push(`${name}: --accent-text ${accentText} on --bg ${bg} = ${r.toFixed(2)}:1`
        + ' — the theme inherits or sets a copy accent that fails on its own ground');
    }
  }

  /* The other two copy tokens, for exactly the same reason. --warning-text
     and --danger-text each pair with a translucent fill of their own hue, so
     the value is tuned to the ground behind that fill — an amber or a coral
     that reads on navy is barely there on cream, and both are already set per
     theme precisely because of that. Test them rather than trust them. */
  for (const token of ['--warning-text', '--danger-text', '--success-text']) {
    const value = tokens.get(token);
    if (!value || !bg || !value.startsWith('#')) continue;
    const r = ratio(value, bg);
    if (r < AA) failures.push(`${name}: ${token} ${value} on --bg ${bg} = ${r.toFixed(2)}:1`);
  }
}

if (failures.length) {
  console.error('Theme contrast failures:\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`Theme contrast passed: ${blocks.length} themes, every ink clears ${AA}:1 on every ground.`);
