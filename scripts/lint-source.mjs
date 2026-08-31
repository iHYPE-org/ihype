#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];

async function text(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

async function walk(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(relative)));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(relative);
  }
  return files;
}

const sourceFiles = await walk('src');

/*
 * Inline `fontSize` in px does not scale.
 *
 * Settings → Accessibility → Text size writes `--ihype-text-scale`, and
 * `mmm-workflows.css` applies it as `:root { font-size: calc(100% * var(...)) }` — so
 * `rem` follows it and `px` cannot. 691 inline px sizes across 77 files were
 * therefore invisible to that control, which is an accessibility setting that
 * silently did nothing on most of the app.
 *
 * px is still correct in three places and they are exempt: Satori /
 * ImageResponse surfaces (OG cards, QR, posters) have no root font size at
 * all, email HTML does not carry our stylesheet, and the EPK is a print
 * document sized for paper.
 */
const PX_FONT_SIZE_EXEMPT = [
  'opengraph-image', 'api/og/', 'qr/route', 'poster/route', 'card/route',
  'src/lib/', 'epk/',
];
const inlinePxFontSize = /fontSize: (?:'\d+(?:\.\d+)?px'|\d+(?:\.\d+)?)(?=[,}\s])/;

/*
 * The same rule, for the OTHER syntax that carries type in this codebase.
 *
 * 29 pages ship a `<style>` block inside the .tsx rather than a class in a
 * stylesheet, and the rule above cannot see them: it matches the JSX prop
 * `fontSize:`, while a style block writes CSS `font-size:`. 247 px sizes were
 * sitting in those blocks across 31 files, immune to Text size for exactly the
 * reason the comment above gives — which made the accessibility setting look
 * like it worked (most of the app moved) while a page built this way did not.
 */
const styleBlockPxFontSize = /font-size: *\d+(?:\.\d+)?px/;

/*
 * And the THIRD syntax, for px this time.
 *
 * `remFontSizes()` below already reads the `font:` shorthand, because that is
 * where 14 rem sizes were hiding from a `font-size:` search. The px rules did
 * not, so `font: 600 12px/1.5 var(--font-mono)` was invisible to every check
 * in this file — which is how the signup page's privacy line shipped at a
 * fixed 12px, immune to the Text size setting, directly under a comment
 * explaining that px cannot follow it.
 */
const shorthandPxFontSize = /font: *(?:[a-z0-9-]+ +)*?\d+(?:\.\d+)?px[ /]/;

/*
 * `--accent` is a FILL. It must never be a word.
 *
 * On the navy ground #ff5029 measures 5.73:1 as copy, so using it for an
 * eyebrow or a link passed. On the console theme's cream board it is 2.48:1,
 * and every one of those uses inverted from passing to failing the moment the
 * theme was applied — 149 of them, across 67 files, none of which would look
 * wrong in a diff. `--accent-text` is the copy form and is defined per theme
 * (#ff6a44 dark, #9c2707 light, #923319 console); `--ink-on-accent` is the
 * label ON the fill. Same trap the #5a5048 grey set after the DS8 repaint.
 */
// The `var(--accent, …)` fallback form counts: two of these hid behind it.
const ACCENT_AS_TEXT = /(?:^|[{,;\s])color: *'?var\(--accent[,)]/;

/*
 * The inverse of the trap above, and the one that survived it.
 *
 * `--accent` as a FILL is correct. Hardcoding the label on top of it is not:
 * white measures 3.27:1 on #ff5029 and fails AA in every theme, including the
 * two it was written for. `--ink-on-accent` is the token, and in the console
 * theme it resolves to dark ink — the opposite of what a hardcoded #fff
 * assumes, which is why this could not be found by looking for something that
 * changed. Found by measuring rendered colour on /login: the primary
 * "Continue" button and the skip link were both painting white on orange.
 *
 * Block-scoped rather than line-scoped, because the fill and the label are two
 * declarations in the same rule and neither is wrong on its own.
 */
const ACCENT_FILL = /background(?:-color)?: *[^;{}]*var\(--accent[,)]/g;
const WHITE_LITERAL = /(?:^|[{;\s])(?:-webkit-text-fill-)?color: *'?(?:#fff(?:f{3})?\b|white\b|rgba?\( *255 *, *255 *, *255)/i;

/*
 * Walnut is a DARK material in every theme. The page's ink is not.
 *
 * `.walnut-panel` paints the cabinet face — a three-stop brown gradient —
 * whichever theme is active, so a rule that also sets `--ink*` on that surface
 * puts the console theme's DARK ink on dark timber. That is not hypothetical:
 * it is precisely what `.site-dock` was doing before the material existed,
 * with `background: rgba(9,8,6,.96)` and `color: var(--ink-1)`, and it was
 * invisible to every page scan because the dock only renders while something
 * is playing.
 *
 * The ramp is --ink-on-walnut / -2 / -3, measured against the LIGHTEST stop.
 */
const WALNUT_SURFACE = /\.walnut-panel\b|walnut-panel/;
const PAGE_INK_AS_COLOR = /(?:^|[{;\s])color: *'?var\(--ink(?:-[1-4]|-a\d\d)?\)/;

/** Rules inside a walnut block that reach for the page's ink ramp. */
function pageInkOnWalnut(source) {
  const hits = [];
  for (const match of source.matchAll(/\.walnut-panel[^{]*\{/g)) {
    const block = enclosingBlock(source, match.index + match[0].length - 1);
    if (PAGE_INK_AS_COLOR.test(block)) hits.push(match.index);
  }
  return hits;
}
void WALNUT_SURFACE;

/** Rules that fill with the accent and then hardcode a white label on it. */
function whiteOnAccent(source) {
  const hits = [];
  for (const match of source.matchAll(ACCENT_FILL)) {
    const block = enclosingBlock(source, match.index);
    if (WHITE_LITERAL.test(block)) hits.push(match.index);
  }
  return hits;
}

/*
 * The floor, in source rather than in a browser.
 *
 * `audit:mobile` measures rendered boxes and is the real instrument, but it is
 * deliberately not in CI (it drives Chromium). This catches the common case
 * statically, and it encodes the distinction that actually went wrong:
 * Design System 8's MOBILE.md exempts the tracked mono eyebrow scale (9-12px,
 * 0.14-0.22em) because "it is metadata, never content" — and that exemption
 * leaked onto sentences, so error messages and hints were shipping at 9-10px.
 * A size under the body floor is therefore allowed only where the surrounding
 * style really is a tracked mono run, tested the same way audit:mobile tests
 * it: monospace family AND tracking >= 0.14em.
 */
/* Both floors were RAISED on 2026-08-19, and the reason is worth keeping.
 *
 * 12.5px was Design System 8's minimum, and after PR #727 raised everything up
 * to it, it quietly became the DESIGN: 536 of 1406 type sizes in the codebase
 * sat at exactly 12.5px and 1003 of them were 14px or smaller. A floor that
 * everything piles onto is not a floor, it is a default — and the reader this
 * work started with, who could not read the small text, was being handed a
 * whole app set one pixel above "violation".
 *
 * 15px is the content floor now. 979 sizes moved.
 *
 * The tracked-mono eyebrow exemption survives, because metadata really is a
 * different thing from prose, but its floor moved 9px -> 11px: 9px is legible
 * only if you already know what it says, which makes it decoration wearing a
 * label's clothes. 85 sizes moved. */
const BODY_FLOOR_REM = 15 / 16;
const EYEBROW_FLOOR_REM = 11 / 16;
/* `\bfm\b` is here for `src/components/ds/`, and it is the narrowest change that
   works. The design system's own components name their families through a local
   alias — `const _FP = { fm: "'JetBrains Mono',monospace" }`, then
   `fontFamily: _FP.fm` — so the literal family never appears in the style block
   the scan reads. Without this, a real tracked eyebrow in vendored code is
   indistinguishable from a sentence and gets raised to the 15px content floor,
   which is a fidelity loss the design system would be right to reject. It only
   loosens where a block ALSO tracks >= .14em, which is the eyebrow test itself. */
const MONO_FAMILY = /--f-m\b|--font-mono\b|monospace|JetBrains|\bfm\b/i;
const TRACKING_EM = /letter-?[sS]pacing: *'?(-?\.?[0-9.]+)em/;

/** The innermost `{ … }` around an index — a JSX style object or a CSS rule. */
function enclosingBlock(source, index) {
  let depth = 0;
  let start = -1;
  for (let i = index; i >= 0; i -= 1) {
    const c = source[i];
    if (c === '}') depth += 1;
    else if (c === '{') {
      if (depth === 0) { start = i; break; }
      depth -= 1;
    }
  }
  if (start < 0) return '';
  depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

function isTrackedMono(block) {
  if (!MONO_FAMILY.test(block)) return false;
  const tracking = TRACKING_EM.exec(block);
  return Boolean(tracking) && Math.abs(Number(tracking[1])) >= 0.14;
}

/**
 * Every rem type size in a file, in all THREE syntaxes.
 *
 * The third one is the trap: the `font:` shorthand carries the size as a bare
 * length among the other components, so a check written against `font-size:`
 * cannot see it. 14 sizes were hiding there, including the homepage's own
 * "Sign in" link and the sentence under it — and they went on hiding through a
 * sweep that fixed both other syntaxes. For a `clamp()` size the MINIMUM is
 * what matters here, because that is what a narrow phone actually gets.
 */
function remFontSizes(source) {
  const hits = [];
  for (const re of [/fontSize: '([0-9.]+)rem'/g, /font-size: ([0-9.]+)rem/g]) {
    for (const m of source.matchAll(re)) hits.push({ rem: Number(m[1]), index: m.index });
  }
  for (const m of source.matchAll(/font: *[^;{}]*?(?:clamp\( *([0-9.]+)rem|([0-9.]+)rem)/g)) {
    hits.push({ rem: Number(m[1] ?? m[2]), index: m.index });
  }
  return hits;
}

/**
 * No emoji in the UI (Design System 8, ADHERENCE rule 29).
 *
 * The rule is precise and the precision matters: **Unicode glyphs are fine**
 * — `▶ ❚❚ ♥ ♡ ✕ ✓ ★ ⚑ ⬟ ♪` are the system's own vocabulary — while
 * pictographic emoji (`🔥 🎤 🏛 🎟`) are not. So this matches only the
 * pictographic blocks, not the whole symbol range. A rule that flagged `✓`
 * would be wrong and would be turned off within a week.
 *
 * Why a rule rather than review: 40 of these had accumulated across 20 files,
 * including one (`\u{1F8ED}`) that is an unassigned codepoint and rendered as
 * tofu in the privacy panel for nobody knows how long. Emoji arrive one at a
 * time, in a hurry, and each one looks harmless on its own.
 *
 * Comment lines are skipped — this file and the design docs have to be able to
 * name the characters they forbid.
 */
const PICTOGRAPHIC_EMOJI = /[\u{1F000}-\u{1FAFF}]/u;
const EMOJI_EXEMPT = [
  // Reaction sets are content the member picks, not chrome the system draws;
  // the stored `ShowCommentReaction.emoji` values are these exact strings.
  'ShowComments.tsx',
];


/**
 * `◀` and `▶` without a text-presentation selector.
 *
 * Both carry `Emoji=Yes` — an emoji variant exists — even though their default
 * is text presentation, and WebKit serves the colour glyph from Apple Color
 * Emoji anyway. On a real iPhone every one of these renders as a BLUE ROUNDED
 * SQUARE, which is how the console dock's joystick shipped drawing three of
 * them in a row, and how four play buttons across the app shipped as blue
 * emoji on a walnut-and-brass surface. `▲` and `▼` have no emoji
 * variant and are unaffected — which is exactly why the bug looked arbitrary.
 *
 * The fix is to follow the glyph with U+FE0E, VARIATION SELECTOR-15, which
 * requests text presentation. That is the OPPOSITE of the U+FE0F this file's
 * sibling emoji rules and `audit:design` are about, so it does not make these
 * emoji under DS8 §29.
 *
 * A desktop browser cannot see this, no test can assert a font choice, and the
 * glyphs are correct-looking in source. A lint rule is the only thing that
 * catches it, and `vendor:ds` applies the same transform to the generated
 * components so both halves of the app are covered.
 */
const EMOJI_CAPABLE_GLYPH = /[◀▶](?![︎️])/;

/**
 * Comments collapsed to NEWLINES, not to nothing.
 *
 * Scoped this way because the glyph rule above is about what RENDERS, and these
 * files describe the joystick's own directions in prose — `MmmDock.tsx`'s
 * docstring names all four, and a comment does not need a variation selector.
 *
 * Newlines rather than a space, so a reported line number still points at the
 * line it was found on. `audit:retro` collapsed block comments to a single
 * space and silently lost every `design-exempt` marker to the resulting
 * off-by-N; the same mistake is available here.
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, lead) => lead);
}

for (const file of sourceFiles) {
  const content = await text(file);
  if (/\beval\s*\(/.test(content)) fail(file, 'eval() is forbidden.');
  if (/\bnew\s+Function\s*\(/.test(content)) fail(file, 'new Function() is forbidden.');

  const portable = file.split(path.sep).join('/');
  if (portable.endsWith('.tsx') && !PX_FONT_SIZE_EXEMPT.some((x) => portable.includes(x))) {
    if (inlinePxFontSize.test(content)) {
      fail(file, 'inline fontSize in px ignores the Text size accessibility setting — use rem (px / 16).');
    }
    if (styleBlockPxFontSize.test(content)) {
      fail(file, 'font-size in px inside a <style> block ignores the Text size accessibility setting — use rem (px / 16).');
    }
    if (shorthandPxFontSize.test(content)) {
      fail(file, 'a px size in the `font:` shorthand ignores the Text size accessibility setting — use rem (px / 16).');
    }
    if (EMOJI_CAPABLE_GLYPH.test(withoutComments(content))) {
      fail(file, 'a bare ◀ or ▶ renders as a blue emoji square on iOS — follow it with \\ufe0e (VARIATION SELECTOR-15) to request text presentation.');
    }
    if (ACCENT_AS_TEXT.test(content)) {
      fail(file, '--accent is a fill, not copy: 2.48:1 on the console ground. Use --accent-text for a word, --ink-on-accent for a label on the fill.');
    }
    for (const index of whiteOnAccent(content)) {
      const line = content.slice(0, index).split('\n').length;
      fail(file, `line ${line}: white hardcoded on an --accent fill is 3.27:1 and fails AA. Use var(--ink-on-accent), which is dark ink in the console theme.`);
      break;
    }
    for (const hit of remFontSizes(content)) {
      const block = enclosingBlock(content, hit.index);
      const floor = isTrackedMono(block) ? EYEBROW_FLOOR_REM : BODY_FLOOR_REM;
      if (hit.rem < floor) {
        const line = content.slice(0, hit.index).split('\n').length;
        fail(file, `line ${line}: ${(hit.rem * 16).toFixed(2)}px type is below the ${(floor * 16).toFixed(1)}px floor. `
          + 'Design System 8 exempts the tracked mono eyebrow scale (monospace + letter-spacing >= .14em) down to 9px; '
          + 'everything else is content and must clear 12.5px.');
        break;
      }
    }
  }

  if (portable.endsWith('.tsx') && !EMOJI_EXEMPT.some((x) => portable.includes(x))) {
    for (const [index, line] of content.split('\n').entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
      const match = PICTOGRAPHIC_EMOJI.exec(line);
      if (match) {
        fail(file, `line ${index + 1}: emoji ${match[0]} — Design System 8 allows Unicode glyphs (▶ ✓ ★ ⬟) but no emoji.`);
        break;
      }
    }
  }
}

/*
 * The same type floor, over the stylesheets.
 *
 * `walk('src')` collects only .ts/.tsx/.js/.mjs, so every rule in globals.css,
 * mmm.css and the rest was outside every check above — and that is where a
 * third of the sub-floor type was living, including the auth card's 9-10px
 * labels on the platform's only sign-in path. A ratchet that cannot see the
 * stylesheets would have let all of it grow straight back.
 *
 * @media print is skipped: paper has no root font size to scale against, and
 * px is the correct unit there.
 */
async function walkStyles(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkStyles(relative)));
    else if (entry.name.endsWith('.css')) files.push(relative);
  }
  return files;
}

/** Character range of a file's @media print block, or null. */
function printRange(source) {
  const open = /@media\s+print\s*\{/.exec(source);
  if (!open) return null;
  let depth = 0;
  for (let i = open.index + open[0].length - 1; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return [open.index, i];
    }
  }
  return [open.index, source.length];
}

for (const file of await walkStyles('src')) {
  const content = await text(file);
  const portable = file.split(path.sep).join('/');
  const print = printRange(content);

  if (styleBlockPxFontSize.test(content.replace(/@media\s+print\s*\{[\s\S]*?\n\}/, ''))) {
    fail(file, 'font-size in px ignores the Text size accessibility setting — use rem (px / 16).');
  }
  if (shorthandPxFontSize.test(content.replace(/@media\s+print\s*\{[\s\S]*?\n\}/, ''))) {
    fail(file, 'a px size in the `font:` shorthand ignores the Text size accessibility setting — use rem (px / 16).');
  }
  if (ACCENT_AS_TEXT.test(content)) {
    fail(file, '--accent is a fill, not copy: 2.48:1 on the console ground. Use --accent-text for a word, --ink-on-accent for a label on the fill.');
  }
  for (const index of whiteOnAccent(content)) {
    const line = content.slice(0, index).split('\n').length;
    fail(file, `line ${line}: white hardcoded on an --accent fill is 3.27:1 and fails AA. Use var(--ink-on-accent), which is dark ink in the console theme.`);
    break;
  }

  for (const index of pageInkOnWalnut(content)) {
    const line = content.slice(0, index).split('\n').length;
    fail(file, `line ${line}: the page ink ramp on a .walnut-panel surface — walnut is dark in every theme, so --ink is dark-on-dark under console. Use var(--ink-on-walnut), -2 or -3.`);
    break;
  }

  for (const hit of remFontSizes(content)) {
    if (print && hit.index >= print[0] && hit.index <= print[1]) continue;
    const block = enclosingBlock(content, hit.index);
    const floor = isTrackedMono(block) ? EYEBROW_FLOOR_REM : BODY_FLOOR_REM;
    if (hit.rem < floor) {
      const line = content.slice(0, hit.index).split('\n').length;
      fail(file, `line ${line}: ${(hit.rem * 16).toFixed(2)}px type is below the ${(floor * 16).toFixed(1)}px floor. `
        + 'Design System 8 exempts the tracked mono eyebrow scale (monospace + letter-spacing >= .14em) down to 9px; '
        + 'everything else is content and must clear 12.5px.');
      break;
    }
  }
  void portable;
}

const readme = await text('README.md');
if (readme.includes('cite')) fail('README.md', 'internal rendered citation tokens must not be committed.');

const environmentExample = await text('.env.example');
if (/BETA_INVITE_CODES=.*\b(?:IHYPE|HYPE2026|BETA|LISTEN)\b/i.test(environmentExample)) {
  fail('.env.example', 'predictable beta invite codes are forbidden.');
}
if (!/FEATURE_ENABLE_TICKET_PAYMENTS="false"/.test(environmentExample)) {
  fail('.env.example', 'paid ticketing must default to disabled.');
}

// THE ASSERTION HAS CHANGED SHAPE TWICE, and each turn is the point.
//
// 2026-07-19: required "true" (501c3 and a live Stripe account confirmed).
// 2026-08-27: inverted to require "false", because neither of those
// established that anyone could be PAID — Stripe Connect had never been
// signed up for, so `createPayoutTransfer()` had no destination and a sale
// would have left every AccountsPayableEntry PENDING forever with no fault
// reported anywhere, because nothing is faulty.
// 2026-08-31: the prerequisite that inversion named is met —
// docs/runbooks/money-path-rehearsal.md walked to the end (Connect signed up
// 2026-08-27; step 1 25/25 across all three settlement modes; step 2 against
// the real worker with real transfers to real onboarded destinations and the
// payout cron run TWICE showing `released: 0`; the venue-direct refund defect
// fixed and re-proven; the dispute walk measured 8/8) — so the flag flipped
// to "true" and this guard turned with it, per its own instruction.
//
// What it asserts now: the flag stays an EXPLICIT declaration in
// wrangler.toml, whichever way it points. Deleting the line (so the runtime
// silently falls back to undefined/off) is the failure mode left — an
// emergency kill-switch flip to "false" must never fight the linter, but a
// flag that quietly stops being declared is dashboard residue by another
// name. Charging still additionally requires the live
// STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET Worker secrets, which this repo
// never touches — see getPaymentProcessingReadiness(), which fails closed if
// either is missing or the key is sk_test_ in production, and the post-deploy
// smoke, which fails the deploy on any blocker other than the flag itself.
const wranglerConfig = await text('wrangler.toml');
if (!/FEATURE_ENABLE_TICKET_PAYMENTS\s*=\s*"(?:true|false)"/.test(wranglerConfig)) {
  fail(
    'wrangler.toml',
    'FEATURE_ENABLE_TICKET_PAYMENTS must be declared explicitly ("true" or "false") — '
    + 'paid ticketing is a deliberate configuration, never an absent default.',
  );
}

// The rehearsal escape hatch may never be configured for the deployed Worker.
// STRIPE_ALLOW_TEST_MODE_REHEARSAL lets the money-path rehearsal accept a
// sk_test_ key inside a production BUILD running locally against a scratch
// database; defined in wrangler.toml it would let production accept one too.
if (/STRIPE_ALLOW_TEST_MODE_REHEARSAL/.test(wranglerConfig)) {
  fail(
    'wrangler.toml',
    'STRIPE_ALLOW_TEST_MODE_REHEARSAL is a local rehearsal-only variable and must never be set for the deployed Worker.',
  );
}

const payments = await text('src/lib/payments.ts');
if (!payments.includes('FEATURE_ENABLE_TICKET_PAYMENTS')) {
  fail('src/lib/payments.ts', 'payment readiness must require the explicit launch flag.');
}
if (!payments.includes("NODE_ENV === 'production'") || !payments.includes("startsWith('sk_test_')")) {
  fail('src/lib/payments.ts', 'production payment readiness must reject Stripe test credentials.');
}

// The token-issuing logic lives in src/lib/magic-link.ts (shared by
// /api/auth/magic-link and /api/advertise/register) rather than duplicated
// inline in the route — check the shared helper for the hashing invariant.
const magicLinkIssue = await text('src/lib/magic-link.ts');
if (!magicLinkIssue.includes('token: tokenHash')) {
  fail('src/lib/magic-link.ts', 'magic-link bearer tokens must be hashed at rest.');
}

const magicLinkConsume = await text('src/app/api/auth/magic/route.ts');
if (!magicLinkConsume.includes('updateMany') || !magicLinkConsume.includes('used: false')) {
  fail('src/app/api/auth/magic/route.ts', 'magic-link consumption must use a conditional atomic update.');
}

const scanRoute = await text('src/app/api/tickets/[serializedId]/scan/route.ts');
if (!scanRoute.includes('updateMany') || !scanRoute.includes("status: 'VALID'")) {
  fail('src/app/api/tickets/[serializedId]/scan/route.ts', 'ticket scanning must be a conditional atomic transition.');
}

const middleware = await text('src/middleware.ts');
const scriptDirective = middleware.match(/script-src[^`\n]*/)?.[0] ?? '';
if (scriptDirective.includes("'unsafe-inline'")) {
  fail('src/middleware.ts', 'script-src must not allow unsafe-inline scripts.');
}
if (!middleware.includes("'nonce-${nonce}'")) {
  fail('src/middleware.ts', 'script-src must include a per-request nonce.');
}

const nextConfig = await text('next.config.mjs');
if (/key:\s*['"]Content-Security-Policy['"]/.test(nextConfig)) {
  fail(
    'next.config.mjs',
    "must not set Content-Security-Policy — it's set exclusively by src/middleware.ts (a static header here applies to the same routes and silently wins over middleware's per-request nonce, making the CSP script-src check above meaningless in practice)."
  );
}

for (const webhookFile of [
  'src/app/api/stripe/webhook/route.ts',
  'src/app/api/webhooks/resend/route.ts',
]) {
  const content = await text(webhookFile);
  if (!content.includes('db.$transaction')) {
    fail(webhookFile, 'webhook business logic and idempotency marker must share a transaction.');
  }
}

const firstPasskeyRoute = await text('src/app/api/auth/passkey/register-first/route.ts');
if (firstPasskeyRoute.includes("jar.get('pk_reg_first_uid')")) {
  fail('src/app/api/auth/passkey/register-first/route.ts', 'raw user-ID cookies must not authorize passkey bootstrap.');
}
if (!firstPasskeyRoute.includes('passkeyBootstrapToken.updateMany')) {
  fail('src/app/api/auth/passkey/register-first/route.ts', 'passkey bootstrap capabilities must be consumed atomically.');
}

const showPage = await text('src/app/shows/[slug]/page.tsx');
const showPageIsAlias = showPage.includes("redirect(`/app/shows/");
if (!showPageIsAlias && (showPage.includes('void canWatch') || !showPage.includes('protectShowProductionPlan'))) {
  fail('src/app/shows/[slug]/page.tsx', 'ticketed production plans must be entitlement-gated and URL-protected.');
}

const privacyExport = await text('src/app/api/privacy/export/route.ts');
for (const relation of ['issuedTickets', 'followers', 'receivedBookingRequests']) {
  const broadRelationLoad = new RegExp(`^\\s{10}${relation}: true,`, 'm');
  if (broadRelationLoad.test(privacyExport)) {
    fail('src/app/api/privacy/export/route.ts', `third-party relation records must not be exported: ${relation}`);
  }
}

// Windows cannot create files or directories named after DOS device names
// (aux, con, nul, ...), so one such path segment makes `git clone` fail to
// check out the tree on every Windows machine. src/app/aux once did exactly
// that — it now lives at src/app/aux-queue behind a /aux rewrite.
const WINDOWS_RESERVED = /^(?:aux|con|prn|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
async function walkAllPaths(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const relative = directory ? path.join(directory, entry.name) : entry.name;
    if (WINDOWS_RESERVED.test(entry.name) || /[. ]$/.test(entry.name)) {
      fail(relative, 'path segment is not checkout-safe on Windows (reserved device name or trailing dot/space).');
    }
    if (entry.isDirectory()) await walkAllPaths(relative);
  }
}
await walkAllPaths('');

for (const workflowFile of ['.github/workflows/ci.yml', '.github/workflows/deploy-production.yml']) {
  const workflow = await text(workflowFile);
  for (const line of workflow.split('\n')) {
    const match = line.match(/uses:\s+([^@\s]+)@([^#\s]+)/);
    if (match && !/^[a-f0-9]{40}$/.test(match[2])) {
      fail(workflowFile, `GitHub Action must be pinned to a full commit SHA: ${line.trim()}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Source policy lint failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Source policy lint passed for ${sourceFiles.length} source files.`);
