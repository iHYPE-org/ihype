#!/usr/bin/env node
/**
 * Measure the console dock in a real browser, without a database.
 *
 * ## Why this exists
 *
 * The dock is the app's whole navigation and its height is what every pane
 * clears, so a bar that measures anything other than `--mmm-chrome-size` means
 * content is sliding under it or floating above a gap. `SHELL_LOCK` is blunt
 * about the rule: change one figure and re-derive the rest, then MEASURE.
 *
 * `audit:mobile` is the real instrument for rendered geometry, but it needs a
 * built app and a signed-in session — `/app/*` is behind auth, and seeding a
 * session needs a database. This needs neither: it mounts the REAL `MmmDock`
 * with the app's own token layer and the real font files, sliced out of
 * `mmm.css` at run time so the harness cannot drift from what ships.
 * `next/navigation` and `next/link` are aliased to recording stubs.
 *
 * ## It measures BOTH states, and that is the point
 *
 * The dock has two heights (MIDDLE ROAD, 2026-09-04): 46px of tabs when nothing
 * is loaded, and that plus a 56px mini player when something is. Both are
 * derived from the geometry table — the second through the one `:has()` rule in
 * `mmm.css` that is allowed to move `--mmm-chrome-size` — and a probe that only
 * ever saw the idle bar would pass while every list on the app hid its last row
 * behind a playing mini player. So each width is driven twice.
 *
 * ## What it checks, and why each one is here
 *
 *   · **the bar's height equals the geometry table, in BOTH states** — see
 *     above; this is the check the whole file exists for;
 *   · **the transport is the mini player's, and there is never a second one** —
 *     it used to also check that an idle bar carried a "Radio" key, on the
 *     rule that the transport is universal. The owner removed that key on
 *     2026-09-04 ("remove radio tab on bottom it's already under listen"), so
 *     an idle bar now correctly has NO transport and this check would have
 *     failed the app for obeying the instruction. What it still refuses is
 *     TWO: a bar carrying both a mini player and a tab-row play key is the
 *     drift the console's own notes name;
 *   · **every control clears 44x44** — MOBILE.md's floor, desktop included,
 *     measured as a rendered box rather than read off a stylesheet;
 *   · **no tab label is clipped from 320px up** — four tabs share the full
 *     width now that the 58px transport is gone, so 320px leaves 80px a tab
 *     rather than 65px; "TICKETS" at 11px/.14em is still the
 *     longest. A destination you cannot read is the failure a labelled bar
 *     exists to avoid, so unlike the dial's drum this one has no excuse at any
 *     width;
 *   · **the bar is one row, the right width, and centred** — it holds ONE width
 *     on every screen (`--mmm-frame-max`, read from the CSS rather than
 *     restated here) and is an object on the desk, not a strip painted across;
 *   · **exactly one tab is lit** — two would be a routing bug and none means a
 *     member cannot tell where they are;
 *   · **the mini player's title is not clipped** and its artwork box is square,
 *     because the fallback initial is centred in it.
 *
 * Usage: `npm run measure:dock` · `--json` for the raw rows ·
 * `DOCK_SHOT=/path/prefix` also writes `<prefix>-<width>.png` screenshots.
 */
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtemp, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const WIDTHS = [320, 375, 393, 430, 768, 1280];
const JSON_OUT = process.argv.includes('--json');
const SHOT = process.env.DOCK_SHOT;

/** A slice of a real stylesheet, by its own landmarks — never a copy. */
function slice(file, from, to) {
  const css = readFileSync(path.join(root, file), 'utf8');
  const a = css.indexOf(from);
  if (a < 0) throw new Error(`${file}: "${from}" not found — the stylesheet moved, so this probe is measuring the wrong thing.`);
  const b = to ? css.indexOf(to, a) : css.length;
  if (b < 0) throw new Error(`${file}: "${to}" not found after "${from}".`);
  return css.slice(a, b);
}

const dir = await mkdtemp(path.join(tmpdir(), 'ihype-dock-'));
await mkdir(path.join(dir, 'fonts'), { recursive: true });
await mkdir(path.join(dir, 'console'), { recursive: true });
for (const font of ['JetBrainsMono-Variable.woff2', 'BricolageGrotesque-Variable.woff2']) {
  await copyFile(path.join(root, 'src/app/fonts', font), path.join(dir, 'fonts', font));
}
/* The dock's photographed textures, served the same way the app serves them. */
for (const tex of ['walnut-v3.png', 'grain.png', 'brushed.png', 'brass-turned.png']) {
  await copyFile(path.join(root, 'public/console', tex), path.join(dir, 'console', tex));
}

/* The tokens live on `.mmm-frame`, so the harness gives its root that rule
   rather than re-declaring the geometry — a re-declared table is the thing this
   whole file exists to catch. The dock slice's absolute `/console/` URLs become
   relative so `file://` can serve them. */
const frame = slice('src/app/mmm.css', '.mmm-frame {', '/* ── Map layer').replace('.mmm-frame {', '#root {');
const dock = slice('src/app/mmm.css', '/* ── The dock ', "/* The design system's ONE breakpoint")
  .replaceAll("url('/console/", "url('console/")
  /* The mini player's chrome-size override is keyed on the frame, and the
     harness's root IS the frame. Renaming only `.mmm-frame {` above left this
     rule matching nothing, so the probe measured a 111px bar against a 55px
     table and reported the app broken when it was the harness. */
  .replaceAll('.mmm-frame:has(', '#root:has(');

await writeFile(path.join(dir, 'probe.css'), `
@font-face { font-family: 'JB'; src: url('fonts/JetBrainsMono-Variable.woff2') format('woff2'); }
@font-face { font-family: 'BG'; src: url('fonts/BricolageGrotesque-Variable.woff2') format('woff2'); }
:root {
  --font-mono: 'JB', monospace; --font-display: 'BG', sans-serif;
  --bg: #f0dfb8; --ink: #1c1408; --ink-1: #1c1408;
  --accent: #ff5029; --accent-rgb: 255, 80, 41;
  --walnut: #6e4c2b; --walnut-2: #4e3418; --walnut-3: #331f0c;
  --brass: #c9a54e; --brass-deep: #8a6a2c; --lamp: #ff8f2d; --live: #c81f10;
  --rule-on-walnut: rgba(246, 236, 217, .22);
  --ease: cubic-bezier(.4, 0, .2, 1); --ease-in-out: cubic-bezier(.4, 0, .2, 1);
  --ease-spring: cubic-bezier(.34, 1.56, .64, 1);
  --duration-default: 200ms; --duration-medium: 320ms; --duration-slow: 420ms;
  --radius-panel: 3px; --z-sticky: 30;
}
/* globals.css sets this on every element in the app, and the probe slices only
   mmm.css - without it the tab's min-height sized its CONTENT box and every tab
   measured 56px against a 46px table. The bar was correct in the app and wrong
   here, which is the harness-drifts-from-the-app failure this file's own
   history records against PR #747. */
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); }
/* globals.css's phone-width button floor, restated here because the probe
   slices only mmm.css — its absence is how a floored 44px nameplate hanging
   over the dial passed this probe while failing the app (PR #747). */
@media (max-width: 768px) { .button, [role=button], button { min-height: 44px; min-width: 44px; } }
${frame}
${dock}
`);

await writeFile(path.join(dir, 'router-stub.ts'), `
export function useRouter() {
  return {
    push: (href: string) => { (window as unknown as { __pushes: string[] }).__pushes ??= []; (window as unknown as { __pushes: string[] }).__pushes.push(href); },
    replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {},
  };
}
export function usePathname() { return '/app/music/recommended'; }
export function useSearchParams() { return new URLSearchParams(); }
`);

/* `next/link` pulls the whole App Router client in; an anchor is all the dock
   uses it for, and an anchor is also what it renders in the browser. */
await writeFile(path.join(dir, 'link-stub.tsx'), `
import * as React from 'react';
export default function Link(props: React.ComponentProps<'a'> & { href: string }) {
  return <a {...props} />;
}
`);

await writeFile(path.join(dir, 'entry.tsx'), `
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { MmmDock } from '${root}/src/components/mmm/MmmDock';

/* The real component with the real manifest. The pathname parks it on MUSIC,
   whose tab is the one whose label ("Listen") differs from its module name —
   so a bar drawing \`label\` instead of \`tabLabel\` fails here rather than in
   production. The track is the longest title and artist the fixtures carry,
   because the mini player's clipping is measured against real ink. */
const TRACK = {
  title: 'Anchor Room Sessions, Volume Two',
  artist: 'Kestrel and the Long Way Round',
  initial: 'K',
  artworkUrl: null,
};

function Probe() {
  const [track, setTrack] = React.useState<typeof TRACK | null>(null);
  (window as unknown as { __setTrack: (on: boolean) => void }).__setTrack =
    (on) => setTrack(on ? TRACK : null);
  return (
    <MmmDock
      canTogglePlay={Boolean(track)}
      onExpand={() => {}}
      onNext={() => {}}
      onPlayFallback={() => {}}
      onPrev={() => {}}
      onTogglePlay={() => {}}
      pathname="/app/music/recommended"
      playing={Boolean(track)}
      track={track}
    />
  );
}

createRoot(document.getElementById('root')!).render(<Probe />);
`);

await writeFile(path.join(dir, 'index.html'),
  '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="probe.css"><div id="root"></div><script src="bundle.js"></script>');

await build({
  entryPoints: [path.join(dir, 'entry.tsx')],
  outfile: path.join(dir, 'bundle.js'),
  bundle: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  /* Something on MmmDock's import graph reads `process` beyond NODE_ENV; a
     browser page has no such global, so give it an empty one. */
  banner: { js: 'var process = process || { env: { NODE_ENV: "production" } };' },
  alias: {
    'next/navigation': path.join(dir, 'router-stub.ts'),
    'next/link': path.join(dir, 'link-stub.tsx'),
  },
  nodePaths: [path.join(root, 'node_modules')],
  logLevel: 'error',
});

/**
 * Launch Playwright's own browser, and only fall back to a path — the
 * hardcoded-default version of this failed CI from inside CI (see git history).
 */
async function launch() {
  const override = process.env.CHROMIUM_PATH;
  if (override) return chromium.launch({ executablePath: override });
  try {
    return await chromium.launch();
  } catch (error) {
    const fallback = '/opt/pw-browsers/chromium';
    if (!existsSync(fallback)) throw error;
    console.log(`  (Playwright could not resolve its own browser; using ${fallback})`);
    return chromium.launch({ executablePath: fallback });
  }
}

const browser = await launch();

/* The one measurement, run once per state. Everything it reads is a rendered
   box or a resolved custom property — never a number restated from the CSS,
   which is the mistake this file exists to catch. */
const MEASURE = () => {
  const dock = document.querySelector('.mmm-dock');
  const dockBox = dock.getBoundingClientRect();
  const bar = dock.querySelector('.mmm-tabs');
  const tabs = [...dock.querySelectorAll('.mmm-tab')].map((tab) => {
    const box = tab.getBoundingClientRect();
    const label = tab.querySelector('.mmm-tab-label');
    return {
      text: label?.textContent ?? '',
      w: Math.round(box.width),
      h: Math.round(box.height),
      on: tab.getAttribute('data-on') === 'true',
      radio: tab.classList.contains('mmm-tab-radio'),
      px: label ? parseFloat(getComputedStyle(label).fontSize) : 0,
      /* +1: sub-pixel layout rounds scrollWidth up by a fraction on a box that
         fits exactly, and a probe that fails on 0.4px of nothing is a probe
         people learn to re-run rather than read. */
      clipped: label ? Math.max(0, Math.round(label.scrollWidth - label.clientWidth) - 1) : 0,
      glyph: !!tab.querySelector('svg'),
    };
  });
  const mini = dock.querySelector('.mmm-mini');
  const miniTitle = dock.querySelector('.mmm-mini-title');
  const art = dock.querySelector('.mmm-mini-art');
  const artBox = art?.getBoundingClientRect();
  const keys = [...dock.querySelectorAll('.mmm-key')].map((key) => {
    const box = key.getBoundingClientRect();
    return { label: key.getAttribute('aria-label') ?? '', w: Math.round(box.width), h: Math.round(box.height) };
  });
  return {
    dockH: Math.round(dockBox.height),
    dockW: Math.round(dockBox.width),
    /* The cap the CSS itself resolves, so this probe never carries a second
       copy of the figure — the same rule as --mmm-chrome-size below. */
    frameMax: Math.round(parseFloat(
      getComputedStyle(document.getElementById('root')).getPropertyValue('--mmm-frame-max'),
    )) || 0,
    centred: Math.abs((dockBox.left + dockBox.width / 2) - window.innerWidth / 2) <= 1,
    oneRow: (() => {
      const kids = [...bar.children].map((child) => child.getBoundingClientRect());
      return kids.every((r) => r.top < kids[0].bottom && r.bottom > kids[0].top);
    })(),
    tabs,
    hasMini: !!mini,
    miniH: mini ? Math.round(mini.getBoundingClientRect().height) : 0,
    /* NOT `scrollWidth - clientWidth`: a correctly ellipsised element always
       has more scroll than client, so that reads as a failure precisely when
       the truncation is working. What actually matters is whether the title
       escapes the bar, which is what an un-ellipsised one does. */
    miniTitleOverflow: miniTitle
      ? Math.max(0, Math.round(miniTitle.getBoundingClientRect().right - dockBox.right))
      : 0,
    miniTitleEllipsis: miniTitle ? getComputedStyle(miniTitle).textOverflow === 'ellipsis' : false,
    art: artBox ? [Math.round(artBox.width), Math.round(artBox.height)] : null,
    keys,
    pageScrollW: document.documentElement.scrollWidth,
    chrome: (() => {
      /* The geometry table's own answer, resolved by the browser. */
      const probe = document.createElement('div');
      probe.style.height = 'var(--mmm-chrome-size)';
      document.getElementById('root').appendChild(probe);
      const h = Math.round(probe.getBoundingClientRect().height);
      probe.remove();
      return h;
    })(),
  };
};

const rows = [];
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 852 } });
  await page.goto(`file://${path.join(dir, 'index.html')}`);
  await page.waitForSelector('.mmm-dock .mmm-tabs');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);

  for (const playing of [false, true]) {
    await page.evaluate((on) => (window).__setTrack(on), playing);
    await page.waitForTimeout(60);
    rows.push({ width, playing, ...await page.evaluate(MEASURE) });
  }
if (SHOT) {
    await page.screenshot({ path: `${SHOT}-${width}.png`, clip: { x: 0, y: 852 - 140, width, height: 140 } });
  }
  await page.close();
}
await browser.close();

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('\n  width  state    dock  chrome  mini  tabs (label @ w x h)');
  for (const r of rows) {
    console.log(`  ${String(r.width).padStart(5)}  ${(r.playing ? 'playing' : 'idle').padEnd(7)}  ${String(r.dockH).padStart(4)}  ${String(r.chrome).padStart(6)}  ${String(r.miniH).padStart(4)}  `
      + r.tabs.map((t) => `${t.on ? '[' : ''}${t.text}${t.on ? ']' : ''} ${t.w}x${t.h}${t.clipped ? ` CLIP ${t.clipped}` : ''}`).join('  '));
  }
}

const problems = [];
for (const r of rows) {
  const at = `${r.width}px ${r.playing ? 'playing' : 'idle'}`;
  if (!r.oneRow) problems.push(`${at}: the tab row wrapped onto two lines.`);
  /* The console holds ONE width on every screen and centres above it: the
     dc.html's 430 doubled for a desk (owner, 2026-08-25), read from
     `--mmm-frame-max` rather than restated here. A phone is unaffected — the
     viewport is the smaller term long before the cap is. */
  if (!r.frameMax) problems.push(`${at}: --mmm-frame-max did not resolve — the frame's width token moved, so this probe is measuring nothing.`);
  else if (r.dockW !== Math.min(r.width, r.frameMax)) problems.push(`${at}: the bar measures ${r.dockW}px wide — it should be min(viewport, ${r.frameMax}).`);
  if (!r.centred) problems.push(`${at}: the bar is not centred.`);
  /* THE check. Both states, and the playing one only passes because of the
     single `:has()` rule in mmm.css that is allowed to move the token. */
  if (r.dockH !== r.chrome) problems.push(`${at}: the bar measures ${r.dockH}px but --mmm-chrome-size says ${r.chrome}px — the panes will clear the wrong height.`);
  if (r.pageScrollW > r.width) problems.push(`${at}: the page scrolls sideways (${r.pageScrollW}px).`);

  /* The mini player is present exactly when a track is loaded — the whole of
     the height saving depends on it being absent otherwise. */
  if (r.hasMini !== r.playing) {
    problems.push(r.playing
      ? `${at}: a track is loaded and there is no mini player.`
      : `${at}: nothing is loaded and the mini player is on screen — the idle bar is supposed to be tabs only.`);
  }

  /* Never two transports, and never a stray play key in the tab row.
     The idle bar carries NO transport by owner instruction (see the header) —
     that is the state, not a fault — so the only thing left to refuse is a
     second control for the same value. */
  const radio = r.tabs.filter((t) => t.radio).length;
  const keys = r.keys.length;
  if (radio !== 0) problems.push(`${at}: the tab row carries ${radio} play key(s) — the radio key was removed on 2026-09-04 and must not come back.`);
  if (r.playing && keys !== 3) problems.push(`${at}: expected the mini player's three keys, measured ${keys}.`);
  if (!r.playing && keys !== 0) problems.push(`${at}: nothing is loaded but ${keys} mini key(s) are on screen.`);

  /* Exactly one destination lit. Two is a routing bug; none means a member
     cannot tell where they are. */
  const lit = r.tabs.filter((t) => t.on);
  if (lit.length !== 1) problems.push(`${at}: ${lit.length} tab(s) lit — exactly one destination is current.`);
  else if (lit[0].text !== 'Listen') problems.push(`${at}: "${lit[0].text}" is lit on /app/music — the bar is drawing the module name instead of its tab label.`);

  for (const tab of r.tabs) {
    /* MOBILE.md's floor, desktop included, as a rendered box. */
    if (tab.h < 44) problems.push(`${at}: the "${tab.text}" control is ${tab.h}px tall — the floor is 44.`);
    if (tab.w < 44) problems.push(`${at}: the "${tab.text}" control is ${tab.w}px wide — the floor is 44.`);
    /* Unlike the dial's drum, a labelled bar has no width at which a clipped
       destination is acceptable: the label IS the affordance. */
    if (tab.clipped) problems.push(`${at}: "${tab.text}" is clipped by ${tab.clipped}px.`);
    if (tab.px > 12) problems.push(`${at}: "${tab.text}" is set at ${tab.px}px — a tab label takes the 11px tracked-mono floor.`);
    if (!tab.glyph) problems.push(`${at}: the "${tab.text}" control lost its glyph.`);
  }

  for (const key of r.keys) {
    if (key.h < 44 || key.w < 44) problems.push(`${at}: the "${key.label}" key is ${key.w}x${key.h} — the floor is 44x44.`);
  }
  if (r.playing) {
    if (r.miniTitleOverflow) problems.push(`${at}: the mini player's title runs ${r.miniTitleOverflow}px past the bar.`);
    if (!r.miniTitleEllipsis) problems.push(`${at}: the mini player's title does not ellipsise — a long song name will push the transport off the edge.`);
    if (!r.art) problems.push(`${at}: the mini player has no artwork box.`);
    else if (r.art[0] !== r.art[1]) problems.push(`${at}: the artwork box is ${r.art.join('x')} — the fallback initial is centred in a square.`);
  }
}

if (problems.length) {
  console.error('\nDock geometry problems:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
const idle = rows.find((r) => r.width === 393 && !r.playing);
const playing = rows.find((r) => r.width === 393 && r.playing);
console.log(`\n  Dock geometry holds at every width, in both states — ${idle?.dockH}px idle, ${playing?.dockH}px with a track loaded.\n`);
