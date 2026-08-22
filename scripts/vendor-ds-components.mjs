#!/usr/bin/env node
/**
 * Vendor the design system's console components into `src/components/ds/`.
 *
 * ## Why this exists
 *
 * `design/handoff-console-2026-08-21/README.md` is unusually direct about the
 * one habit that causes visual drift:
 *
 *   > Almost all visual drift in a handoff comes from one habit: reading a
 *   > spec, then writing a fresh `Button` or `Card` that approximates it. Every
 *   > approximation is a small divergence, and they compound. If you find
 *   > yourself writing a component that already exists in `_ds_bundle.js`, stop
 *   > and mount the existing one instead. ... **Do not port the components by
 *   > hand.**
 *
 * It is right, and this repository has the receipts: the shipped `TunerDial`
 * and the design system's are now two different controls (three stations on the
 * face vs one, step keys inside the lit face vs flanking hardware) because both
 * were written from the same description at different times.
 *
 * So the components are not ported. They are GENERATED from the handoff's own
 * sources on every run, and `--check` fails the build if what is checked in
 * differs from what the handoff would produce. Editing a file in
 * `src/components/ds/` is therefore not a merge conflict waiting to happen —
 * it is reverted by the next run, on purpose.
 *
 * ## Why not load `_ds_bundle.js` directly
 *
 * The README's fastest path is a `<script src="_ds_bundle.js">` tag, and that
 * is genuinely the whole integration for a plain React page. It is not
 * available here, for three reasons that are all properties of this app rather
 * than of the bundle:
 *
 *   1. It is an IIFE that reads `React`/`ReactDOM` off `window`. This app is
 *      Next.js with server components; there is no global React, and the
 *      Cloudflare Worker renders on the server where there is no `window` at
 *      all.
 *   2. It EXECUTES its UI kits on load — the tail of the file mounts an `ops`
 *      kit into `#root` — so importing it for one knob runs several demo apps.
 *   3. It is 731KB, and the Worker bundle is budgeted.
 *
 * `component-source/` is the same code before compilation, and the README
 * names it the truth ("those files are the truth, this README is only a summary
 * of them"). Generating from it keeps the values literal, which is the point of
 * the instruction, without shipping a second React runtime.
 *
 * ## What is transformed, and nothing else
 *
 * The bodies are copied byte-for-byte apart from these, each of which is
 * recorded in the report:
 *
 *   · a module header, `'use client'`, and `import * as React from 'react'` —
 *     the sources assume a global `React`;
 *   · `export function X(` becomes `function XImpl(`, re-exported with the
 *     props type from the matching `.d.ts`, so call sites are type-checked;
 *   · `\u25c0` and `\u25b6` gain U+FE0E, VARIATION SELECTOR-15. Both carry an
 *     emoji variant, and iOS picks the colour glyph: the joystick rendered its
 *     prev hint, next hint and play nub as three blue squares on a real iPhone
 *     while the two triangles with no emoji variant came through correctly.
 *     FE0E requests TEXT presentation, so it is the opposite of the FE0F that
 *     DS8's no-emoji rule and `audit:design` are about;
 *   · every inline `fontSize` px value becomes `rem`. This app cannot ship
 *     inline px type (`--ihype-text-scale` is applied to the root font size, so
 *     rem follows the reader's Text size setting and px cannot), and
 *     `lint-source.mjs` fails the build on it. Values below the design system's
 *     OWN floor — ADHERENCE.md rule 3, 15px content / 11px tracked-mono
 *     eyebrow — are raised to it and listed in the report, because the fix
 *     belongs upstream in the design system and a silent raise here is a fix
 *     nobody upstream ever hears about.
 *
 * Usage: `npm run vendor:ds` (write) · `npm run guard:ds` (verify)
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const HANDOFF = 'design/handoff-console-2026-08-21';
const SOURCE_DIR = `${HANDOFF}/component-source`;
const OUT_DIR = 'src/components/ds';
const REPORT = `${HANDOFF}/VENDOR_REPORT.md`;
const CHECK = process.argv.includes('--check');

/* The design system's own floors, from ADHERENCE.md rule 3. `lint-source.mjs`
   enforces exactly these two numbers and decides between them the same way. */
const BODY_FLOOR_PX = 15;
const EYEBROW_FLOOR_PX = 11;
const MONO_FAMILY = /--f-m\b|--font-mono\b|monospace|JetBrains|\bfm\b/i;
const TRACKING_EM = /letter-?[sS]pacing: *'?(-?\.?[0-9.]+)em/;

/**
 * Notes attached to a specific component, and every one is a reason NOT to
 * mount it somewhere without reading first. They are carried into the generated
 * file's header so the warning is where the code is, not in a document.
 */
const NOTES = {
  TicketQR: [
    'DO NOT use this for a real ticket. Its own docstring says so: it draws a',
    'QR-SHAPED matrix deterministically from the code string and is "a',
    'representation of the door credential, not an encoder". Rendering it on a',
    'ticket produces a block a scanner cannot read. The shipped ticket QR is',
    'generated from the signed wallet payload; this is for layout only.',
  ],
  RotaryNav: [
    'Not adoptable as-is. Its cap readout is 8.5px, which the design system\'s',
    'own 15px content floor forbids (ADHERENCE.md rule 3 names "a dial readout"',
    'as content) — and at 15px the word MUSIC does not fit the 40px cap of a',
    '74px knob. That needs a design decision upstream, not a workaround here.',
    'Note also that this handoff disagrees with itself about the nav model:',
    'README.md replaces the arc nav with this knob, while ADHERENCE.md rule 6',
    'still describes the logo trigger and arc as the shell\'s only chrome.',
  ],
  HypeButton: [
    'Reads `active` as `#ff5029` copy, which is 2.48:1 on the cream board and',
    'fails AA — the design system\'s own rule 2 ("--accent is a fill, never',
    'text"). It is legible on walnut, where the component was drawn. Pass',
    '`roleColor` with an accent-as-copy value on any board surface.',
  ],
};

/**
 * The literal font families in the design system's components, mapped to this
 * app's type tokens.
 *
 * This is not a preference — without it the components render in the browser's
 * default serif and monospace. There is no `@font-face` anywhere in this app's
 * CSS: every face is loaded by `next/font/local` under a GENERATED family name
 * and reached through a custom property (`--font-serif`, `--font-jb`), which
 * `globals.css` wires to `--f-s` / `--f-m`. A hardcoded `'Instrument Serif'`
 * matches nothing but a font the reader happens to have installed, so the dial's
 * engraved station name — the console's signature — silently falls back.
 *
 * The tokens carry the same literal names as their own fallbacks, so this is
 * value-preserving anywhere the faces ARE installed, and correct here.
 */
const FONT_FAMILIES = new Map(Object.entries({
  "'Instrument Serif',serif": 'var(--f-s)',
  "'Instrument Serif', serif": 'var(--f-s)',
  "'JetBrains Mono',monospace": 'var(--f-m)',
  "'JetBrains Mono', monospace": 'var(--f-m)',
  "'Work Sans',sans-serif": 'var(--f-b)',
  "'Work Sans', sans-serif": 'var(--f-b)',
}));

/** Swap the literal families for tokens, recording each one. */
function convertFontFamilies(source, componentFile, fonts) {
  let out = source;
  for (const [literal, token] of FONT_FAMILIES) {
    if (!out.includes(literal)) continue;
    const count = out.split(literal).length - 1;
    out = out.split(literal).join(token);
    fonts.push({ componentFile, from: literal, to: token, count });
  }
  return out;
}

/**
 * Glyphs the design system writes as bare text that iOS renders as EMOJI.
 *
 * U+25C0 ◀ and U+25B6 ▶ carry Emoji=Yes (an emoji variant exists) even though
 * their default is text presentation, and WebKit picks the colour glyph from
 * Apple Color Emoji anyway. On a real iPhone the joystick therefore rendered
 * its prev hint, its next hint and its play nub as three blue rounded squares
 * in a row, while U+25B2 ▲ and U+25BC ▼ — which have no emoji variant — came
 * through as the intended engraved triangles. Reported from a phone; a desktop
 * browser shows the design's own glyphs and cannot see it.
 *
 * The fix is U+FE0E, VARIATION SELECTOR-15, which requests text presentation
 * explicitly. It is the opposite of U+FE0F, so this does NOT make these
 * emoji under DS8's no-emoji rule or under `audit:design`'s check — that one
 * flags U+2600–27BF only when followed by FE0F, and for exactly this reason.
 *
 * Applied here rather than in `src/components/ds/` because that directory is
 * generated and the next run would revert it, and not in a wrapper because the
 * glyphs are string literals inside the component body. Recorded in
 * VENDOR_REPORT.md and in UPSTREAM_FIXES.md: the design system should carry
 * the selector itself, at which point this transform finds nothing.
 */
const TEXT_PRESENTATION = ['\\u25c0', '\\u25b6'];

function requestTextPresentation(source, componentFile, glyphs) {
  let out = source;
  for (const escape of TEXT_PRESENTATION) {
    if (!out.includes(escape)) continue;
    /* The source writes these as the six-character TEXT `\u25c0`, not as the
       character itself, so the backslash has to be escaped for the regex —
       unescaped, `\u25c0` in a pattern means the glyph and matches nothing
       here. The lookahead keeps the transform idempotent: a run over
       already-converted source finds no unselected glyph and reports zero. */
    const literal = escape.replace('\\', '\\\\');
    const pattern = new RegExp(`${literal}(?!\\\\ufe0[ef])`, 'gi');
    const count = (out.match(pattern) ?? []).length;
    if (!count) continue;
    out = out.replace(pattern, `${escape}\\ufe0e`);
    glyphs.push({ componentFile, glyph: escape, count });
  }
  return out;
}

/** The innermost `{ … }` around an index — the same scan `lint-source.mjs` uses. */
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

function floorFor(block) {
  if (!MONO_FAMILY.test(block)) return BODY_FLOOR_PX;
  const tracking = TRACKING_EM.exec(block);
  const tracked = Boolean(tracking) && Math.abs(Number(tracking[1])) >= 0.14;
  return tracked ? EYEBROW_FLOOR_PX : BODY_FLOOR_PX;
}

/** Read one `fontSize:` value — to the comma or brace that closes it. */
function readValue(source, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (c === quote && source[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { quote = c; continue; }
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) {
      if (depth === 0) return { value: source.slice(from, i), end: i };
      depth -= 1;
    } else if (c === ',' && depth === 0) return { value: source.slice(from, i), end: i };
  }
  return { value: source.slice(from), end: source.length };
}

/**
 * px -> rem for every inline `fontSize`, floored at the design system's own
 * minimum. Static values are converted here; anything computed at runtime is
 * routed through `dsFontSize`, which applies the same floor with the same
 * numbers.
 */
function convertFontSizes(source, componentFile, raises, converted) {
  let out = '';
  let cursor = 0;
  let usesRuntime = false;
  const needle = 'fontSize:';
  for (;;) {
    const at = source.indexOf(needle, cursor);
    if (at < 0) break;
    const valueStart = at + needle.length;
    const { value, end } = readValue(source, valueStart);
    const raw = value.trim();
    const floor = floorFor(enclosingBlock(source, at));
    const line = source.slice(0, at).split('\n').length;

    const px = /^'([0-9.]+)px'$/.exec(raw)?.[1]
      ?? (/^[0-9.]+$/.test(raw) ? raw : null);
    const rem = /^'([0-9.]+)rem'$/.exec(raw)?.[1] ?? null;

    let replacement;
    if (px !== null || rem !== null) {
      const asPx = px !== null ? Number(px) : Number(rem) * 16;
      const finalPx = Math.max(floor, asPx);
      if (finalPx !== asPx) {
        raises.push({ componentFile, line, from: asPx, to: finalPx, floor });
      } else if (px !== null) {
        converted.push({ componentFile, line, from: `${asPx}px`, to: `${finalPx / 16}rem` });
      }
      replacement = ` '${finalPx / 16}rem'`;
    } else {
      usesRuntime = true;
      const floorArg = floor === BODY_FLOOR_PX ? '' : `, ${floor}`;
      replacement = ` dsFontSize(${raw}${floorArg})`;
      converted.push({ componentFile, line, from: raw, to: `dsFontSize(${raw}${floorArg})` });
    }

    out += source.slice(cursor, at) + needle + replacement;
    cursor = end;
  }
  out += source.slice(cursor);
  return { source: out, usesRuntime };
}

/** The prop interfaces from the matching `.d.ts`, minus its `declare` line. */
function typesFromDeclaration(declaration, componentName) {
  const unresolved = [];
  let body = declaration
    .split('\n')
    .filter((line) => !/^export declare function/.test(line.trim()))
    .join('\n')
    .trim();

  /* A type this handoff does not ship — `FullPlayer` names `PlayerTrack` from
     `PlayerPill.d.ts`, which is compiled into the bundle but not included as
     source. Declared as an open record rather than guessed at: a shape invented
     here would be a fiction the compiler then enforces. */
  body = body.replace(/^import type \{([^}]+)\} from '([^']+)';?\s*$/gm, (_match, names, from) => {
    const declared = names.split(',').map((n) => n.trim()).filter(Boolean);
    unresolved.push({ names: declared, from });
    return declared
      .map((name) => `/* \`${name}\` is declared by \`${from}\`, which this handoff does not ship as\n   source. Vendored as an open record rather than an invented shape. */\ntype ${name} = Record<string, any>;`)
      .join('\n\n');
  });

  const returns = /export declare function \w+\([^)]*\): ([^;]+);/.exec(declaration)?.[1]?.trim()
    ?? 'JSX.Element';
  const propsType = new RegExp(`export interface (${componentName}Props)\\b`).exec(declaration)?.[1]
    ?? null;
  return { body, returns: returns.replace(/\bJSX\.Element\b/g, 'React.JSX.Element'), propsType, unresolved };
}

function header({ componentName, sourcePath, notes }) {
  const lines = [
    '/**',
    ` * ${componentName} — VENDORED FROM THE DESIGN SYSTEM. Do not edit.`,
    ' *',
    ` * Generated by \`npm run vendor:ds\` from \`${HANDOFF}/${'component-source'}\``,
    ` * (\`${sourcePath}\` in the design system's own tree). \`npm run guard:ds\``,
    ' * fails if this file and that source have drifted apart, so a change made here',
    ' * is reverted rather than merged: the design system is the source of truth for',
    ' * these components, per its README ("Do not port the components by hand").',
    ' *',
    ' * The only edits the generator makes are the client directive, the React import,',
    " * the typed re-export, and px type sizes converted to rem at the design system's",
    ' * own floor (ADHERENCE.md rule 3). Every conversion is listed in',
    ` * \`${REPORT}\`.`,
  ];
  if (notes) {
    lines.push(' *', ' * READ BEFORE MOUNTING:');
    for (const note of notes) lines.push(` * ${note}`);
  }
  lines.push(' */');
  return lines.join('\n');
}

/**
 * Hardcoded colour in a design-system component.
 *
 * These are a real defect and the reason `src/components/ds/` is exempt from
 * `audit:shell`'s colour check: the components paint brand colour as literals
 * (`#ff5029`, `rgba(255,80,41,…)`, white sheens) instead of reading the tokens
 * the same design system publishes, so a component cannot follow the ground it
 * is dropped onto. The exemption is not a silence — this list is, and it is
 * what goes back to Claude Design.
 *
 * Comment lines are skipped: these files explain their own colour choices in
 * prose, and counting the prose would make the number rise as the
 * documentation improved.
 */
function colourLiterals(source) {
  const hits = new Map();
  for (const [index, line] of source.split('\n').entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    for (const match of line.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\( *\d+ *, *\d+ *, *\d+/g)) {
      const value = match[0].replace(/\s+/g, '');
      const seen = hits.get(value) ?? { value, count: 0, firstLine: index + 1 };
      seen.count += 1;
      hits.set(value, seen);
    }
  }
  return [...hits.values()];
}

const files = (await readdir(path.join(root, SOURCE_DIR)))
  .filter((name) => name.endsWith('.jsx.txt'))
  .sort();

const raises = [];
const converted = [];
const colours = [];
const fonts = [];
const glyphs = [];
const unresolvedTypes = [];
const generated = [];

for (const file of files) {
  const sourcePath = file.replace(/\.jsx\.txt$/, '.jsx').split('__').join('/');
  const componentName = path.basename(sourcePath, '.jsx');
  const jsx = await readFile(path.join(root, SOURCE_DIR, file), 'utf8');
  const declarationFile = file.replace(/\.jsx\.txt$/, '.d.ts.txt');
  const declaration = await readFile(path.join(root, SOURCE_DIR, declarationFile), 'utf8')
    .catch(() => '');

  for (const literal of colourLiterals(jsx)) colours.push({ componentFile: sourcePath, ...literal });

  const withText = requestTextPresentation(jsx, sourcePath, glyphs);
  const withFonts = convertFontFamilies(withText, sourcePath, fonts);
  const { source: withRem, usesRuntime } = convertFontSizes(withFonts, sourcePath, raises, converted);
  const { body: types, returns, propsType, unresolved } = typesFromDeclaration(declaration, componentName);
  for (const entry of unresolved) unresolvedTypes.push({ componentName, ...entry });

  const implName = `${componentName}Impl`;
  const bodyOut = withRem.replace(
    new RegExp(`^export function ${componentName}\\(`, 'm'),
    `function ${implName}(`,
  );
  if (!bodyOut.includes(`function ${implName}(`)) {
    throw new Error(`${file}: could not find \`export function ${componentName}(\` to re-export.`);
  }

  const out = [
    header({ componentName, sourcePath, notes: NOTES[componentName] }),
    '',
    /* Before `'use client'`, not after: `@ts-nocheck` has to precede all code in
       the file, and a directive prologue is code. A comment is not, so the
       header above and these lines are fine where they are. */
    '/* eslint-disable */',
    '// @ts-nocheck',
    '// The body below is the design system\'s own JavaScript, copied verbatim.',
    '// Type-checking it would mean editing it, which is the one thing this',
    '// directory exists to prevent. The public surface IS checked: the typed',
    "// re-export at the bottom carries the props interface from the design",
    '// system\'s `.d.ts`, so every call site is checked as usual.',
    '',
    "'use client';",
    '',
    "import * as React from 'react';",
    usesRuntime ? "import { dsFontSize } from './_ds-runtime';" : null,
    '',
    types || null,
    types ? '' : null,
    bodyOut.trim(),
    '',
    propsType
      ? `export const ${componentName}: (props: ${propsType}) => ${returns} = ${implName};`
      : `export const ${componentName} = ${implName};`,
    '',
  ].filter((part) => part !== null).join('\n');

  generated.push({ componentName, file: `${OUT_DIR}/${componentName}.tsx`, out });
}

const index = [
  '/**',
  ' * The design system\'s console components, vendored. GENERATED — see',
  ' * `./README.md` and `npm run vendor:ds`.',
  ' */',
  '',
  ...generated.map(({ componentName }) => `export { ${componentName} } from './${componentName}';`),
  '',
].join('\n');
generated.push({ componentName: 'index', file: `${OUT_DIR}/index.ts`, out: index });

const report = [
  '# Vendor report — console components',
  '',
  '**Generated by `npm run vendor:ds`. Do not edit by hand — re-run it.**',
  '',
  `Source: \`${SOURCE_DIR}\` · Output: \`${OUT_DIR}\``,
  '',
  'This records every difference between the design system\'s component sources',
  'and the files this repository ships, so "vendored verbatim" is a claim that can',
  'be checked rather than a hope.',
  '',
  '## Components',
  '',
  '| Component | Generated file | Notes in the file header |',
  '|---|---|---|',
  ...generated.filter((g) => g.componentName !== 'index').map(({ componentName, file }) =>
    `| \`${componentName}\` | \`${file}\` | ${NOTES[componentName] ? 'yes — read before mounting' : '—'} |`),
  '',
  '## Type sizes raised to the design system\'s own floor',
  '',
  'ADHERENCE.md rule 3: content has a 15px floor; the single exception is the',
  'tracked-mono eyebrow at 11px. These values in the design system\'s components',
  'sit below the floor the design system publishes, so the generator raises them',
  '**and lists them here** — the fix belongs upstream in Claude Design, and a',
  'silent raise in this repository is a fix nobody upstream ever hears about.',
  '',
  raises.length ? '| Source | Line | Design system | Shipped | Floor applied |' : '_None._',
  raises.length ? '|---|---|---|---|---|' : null,
  ...raises.map((r) => `| \`${r.componentFile}\` | ${r.line} | ${r.from}px | ${r.to}px | ${r.floor}px |`),
  '',
  '## px -> rem conversions (value unchanged at 100% text size)',
  '',
  `${converted.length} inline sizes were converted. \`px\` cannot follow Settings ->`,
  'Accessibility -> Text size, which is applied to the root font size; `rem` can.',
  'Sizes computed at runtime are routed through `dsFontSize`, which applies the',
  'same floor.',
  '',
  '| Source | Line | Design system | Shipped |',
  '|---|---|---|---|',
  ...converted.map((c) => `| \`${c.componentFile}\` | ${c.line} | \`${c.from}\` | \`${c.to}\` |`),
  '',
  '## Font families pointed at the app\'s type tokens',
  '',
  'The components hardcode family names — `\'Instrument Serif\',serif` — and this',
  'app has **no `@font-face` at all**: every face is loaded by `next/font/local`',
  'under a generated family name and reached through a custom property, which',
  '`globals.css` wires to `--f-s` / `--f-m` / `--f-b`. Left literal, the dial\'s',
  'engraved station name falls back to the browser\'s default serif. The tokens',
  'carry the same literal names as their own fallbacks, so this is',
  'value-preserving where the faces are installed and correct where they are not.',
  '',
  fonts.length ? '| Source | Literal | Token | Occurrences |' : '_None._',
  fonts.length ? '|---|---|---|---|' : null,
  ...fonts.map((f) => `| \`${f.componentFile}\` | \`${f.from}\` | \`${f.to}\` | ${f.count} |`),
  '',
  '## Glyphs given text presentation (U+FE0E)',
  '',
  '`\\u25c0` and `\\u25b6` have `Emoji=Yes` — an emoji variant exists — even though',
  'their default is text presentation, and WebKit serves the colour glyph from',
  'Apple Color Emoji anyway. On a real iPhone `JoystickTransport` therefore drew',
  'its prev hint, its next hint and its play nub as three blue rounded squares in',
  'a row, while `\\u25b2` and `\\u25bc` (no emoji variant) came through as the',
  'intended engraved triangles. A desktop browser shows the design\'s own glyphs',
  'and cannot see it.',
  '',
  'U+FE0E is VARIATION SELECTOR-15 and requests text presentation, the opposite of',
  'the U+FE0F that DS8\'s no-emoji rule and `audit:design`\'s check are about.',
  'The design system should carry the selector itself; then this finds nothing.',
  '',
  glyphs.length ? '| Source | Glyph | Occurrences |' : '_None._',
  glyphs.length ? '|---|---|---|' : null,
  ...glyphs.map((g) => `| \`${g.componentFile}\` | \`${g.glyph}\` | ${g.count} |`),
  '',
  '## Hardcoded colour in the design system\'s components',
  '',
  'These components paint brand colour as literals rather than reading the tokens',
  'the same design system publishes, so a component cannot follow the ground it is',
  'dropped onto — `#ff5029` is `--accent`, and a copy of the hex is a copy that',
  'stops tracking it. This is why `src/components/ds/` is exempt from',
  '`audit:shell`\'s colour check: the fix belongs upstream, and correcting the',
  'values here would be reverted by the next `vendor:ds` run. The exemption is not',
  'a silence — this table is the record.',
  '',
  '| Source | First line | Literal | Occurrences |',
  '|---|---|---|---|',
  ...colours
    .slice()
    .sort((a, b) => a.componentFile.localeCompare(b.componentFile) || a.firstLine - b.firstLine)
    .map((c) => `| \`${c.componentFile}\` | ${c.firstLine} | \`${c.value}\` | ${c.count} |`),
  '',
  '## Types the handoff does not ship as source',
  '',
  unresolvedTypes.length
    ? unresolvedTypes.map((u) => `- \`${u.componentName}\` imports \`${u.names.join(', ')}\` from \`${u.from}\` — declared locally as an open record rather than guessed at.`).join('\n')
    : '_None._',
  '',
].filter((line) => line !== null).join('\n');
generated.push({ componentName: 'report', file: REPORT, out: report });

if (CHECK) {
  const drifted = [];
  for (const { file, out } of generated) {
    const current = await readFile(path.join(root, file), 'utf8').catch(() => null);
    if (current !== out) drifted.push(file);
  }
  if (drifted.length) {
    console.error('guard:ds — these files no longer match what the vendored design system produces:\n');
    for (const file of drifted) console.error(`  ${file}`);
    console.error('\nRun `npm run vendor:ds`. If the difference is deliberate, it belongs in the');
    console.error('design system (Claude Design) and then in a re-vendored handoff — not here:');
    console.error('an edit in src/components/ds/ is reverted by the next run.');
    process.exit(1);
  }
  console.log(`guard:ds — ${generated.length} vendored files match ${SOURCE_DIR}.`);
} else {
  await mkdir(path.join(root, OUT_DIR), { recursive: true });
  for (const { file, out } of generated) await writeFile(path.join(root, file), out, 'utf8');
  console.log(`vendor:ds — wrote ${generated.length} files from ${files.length} design-system components.`);
  console.log(`  ${raises.length} type sizes raised to the design system's own floor (see ${REPORT}).`);
  console.log(`  ${converted.length} px sizes converted to rem.`);
  console.log(`  ${glyphs.reduce((n, g) => n + g.count, 0)} emoji-capable glyphs given text presentation.`);
}
