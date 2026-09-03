#!/usr/bin/env node
/**
 * Every ink must be readable on every ground it can land on.
 *
 * This exists because of a bug no other check could have caught: `--accent`
 * measures 5.73:1 on the old navy ground and **2.48:1** on cream. A token that
 * is a correct, tokenised, AA-passing colour against one ground becomes a
 * failing one against another, with no literal to grep for and nothing for
 * `audit:shell` to flag — it only inspects hardcoded values.
 *
 * There is ONE theme now, which removes most of the ways that can happen and
 * is a large part of why the themes were dropped. It does not remove all of
 * them, because there are still two grounds in the product:
 *
 *   1. the page — `--bg`..`--bg-4`, read by `--ink`..`--ink-3`
 *   2. the WALNUT MATERIAL — the player dock and the station, deliberately
 *      dark, read by `--ink-on-walnut`..`-3`
 *
 * (2) is now the whole risk surface: it is dark furniture standing on a light
 * page, so the page's ink ramp is exactly wrong on it and vice versa. That is
 * not hypothetical — it is what `.site-dock` shipped, dark ink on a near-black
 * bar. `lint-source.mjs` stops the ramps being crossed; this measures that
 * each ramp actually clears AA on its own ground.
 *
 * Walnut is measured against `--walnut`, the LIGHTEST stop of the gradient:
 * copy can land anywhere on a gradient, so the worst case is the only one
 * that means anything.
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

/* Comments are stripped FIRST, and that is not tidiness.
 *
 * The block scan below finds `:root {` and reads to the next `}`. A `}` inside
 * a comment ends it early — and one does: a comment quoting a template
 * literal (`${color}22`) sits ~10KB into :root, so everything past it was
 * silently invisible to this script. It "passed" for as long as the tokens it
 * needed happened to be declared above that line, and reported a token as
 * UNDEFINED the moment one was declared below it. */
const css = (await readFile('src/app/globals.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');

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

/* The walnut material, IN EVERY THEME.

   Its ink ramp is checked against the lightest stop of its gradient — see the
   header. --ink-on-walnut-3 is the dimmest rank a WORD may use, so it is in;
   the --rule-on-walnut pair are hairlines and are not.

   This used to read --walnut from :root ALONE, which was correct only while the
   cabinet did not theme. Since 2026-08-26 it does (owner: "Themes should adjust
   console graphics, map graphic, buttons, and fonts as well"), and a check
   pinned to :root would have gone on passing while five themed cabinets carried
   whatever ink they liked — precisely the silent-gate failure this file exists
   to prevent.

   `blocks` is already merged over :root, and that is what makes this strict for
   free: a theme that restates --walnut and forgets its ink resolves to the base
   CREAM on, say, steel, and fails here. Inheriting is not a defence. */
{
  const inks = ['--ink-on-walnut', '--ink-on-walnut-2', '--ink-on-walnut-3'];
  if (!base.get('--walnut')) {
    failures.push('walnut: --walnut is not defined in :root — the material lost its ground');
  }
  for (const [name, tokens] of blocks) {
    const walnut = tokens.get('--walnut');
    if (!walnut) continue;
    for (const ink of inks) {
      const value = tokens.get(ink);
      if (!value) { failures.push(`walnut [${name}]: ${ink} is not defined`); continue; }
      const r = ratio(value, walnut);
      if (r < AA) {
        failures.push(`walnut [${name}]: ${ink} ${value} on --walnut ${walnut} = ${r.toFixed(2)}:1`);
      }
    }
    /* The two controls the material paints: brass disc, dark glyph. */
    for (const [fill, label] of [['--brass', '--walnut-3'], ['--lamp', '--walnut-3']]) {
      const f = tokens.get(fill), l = tokens.get(label);
      if (!f || !l) continue;
      const r = ratio(l, f);
      if (r < AA) failures.push(`walnut [${name}]: ${label} on ${fill} = ${r.toFixed(2)}:1`);
    }
  }
}

/* THE PLATE, IN EVERY THEME — same discipline as the walnut block above, for
   the same reason. `.mmm-card` is now a plate: a gradient body carrying the
   theme's own --ink, ringed in brass, with an engraved brass header carrying
   --ink-on-brass.

   Two worst cases, and both are the DARKER stop rather than the lighter one,
   which is the opposite of the walnut rule directly above: there the copy is
   light on a dark material, so the lightest stop is worst; here the plate
   holds dark-on-light in three themes and light-on-dark in the other three,
   and the header always holds a dark glyph. So the plate is measured at
   --plate-2 and the header at --brass-edge.

   --brass-edge exists ONLY because of this check. Running the header
   --brass -> --brass-deep put the glyph at 3.2-4.0:1 in five of six themes,
   and on `street` nothing reaches AA on --brass-deep at all — pure black
   measures 3.6:1 there. A header that stops short is the fix; a lighter glyph
   would have inverted the nameplate. */
{
  for (const [name, tokens] of blocks) {
    const plate = tokens.get('--plate-2');
    const ink = tokens.get('--ink');
    if (!plate) { failures.push(`plate [${name}]: --plate-2 is not defined`); continue; }
    if (ink) {
      const r = ratio(ink, plate);
      if (r < AA) failures.push(`plate [${name}]: --ink ${ink} on --plate-2 ${plate} = ${r.toFixed(2)}:1`);
    }
    /* A field carries --ink too, and it is its own face rather than a tint of
       the plate, so the plate's ratio says nothing about it. */
    const field = tokens.get('--field');
    if (!field) { failures.push(`plate [${name}]: --field is not defined`); continue; }
    if (ink) {
      const rf = ratio(ink, field);
      if (rf < AA) failures.push(`plate [${name}]: --ink ${ink} on --field ${field} = ${rf.toFixed(2)}:1`);
    }
    const edge = tokens.get('--brass-edge');
    const glyph = tokens.get('--ink-on-brass');
    if (!edge) { failures.push(`plate [${name}]: --brass-edge is not defined`); continue; }
    if (!glyph) { failures.push(`plate [${name}]: --ink-on-brass is not defined`); continue; }
    const r = ratio(glyph, edge);
    if (r < AA) {
      failures.push(`plate [${name}]: --ink-on-brass ${glyph} on --brass-edge ${edge} = ${r.toFixed(2)}:1`);
    }
  }
}

if (failures.length) {
  console.error('Theme contrast failures:\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`Contrast passed: ${blocks.length} themes, each with its own cabinet, every ink clears ${AA}:1 on its own ground.`);
