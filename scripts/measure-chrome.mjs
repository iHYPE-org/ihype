#!/usr/bin/env node
/**
 * Measure the shell's chrome in a real browser, without a database.
 *
 * ## Why this exists
 *
 * Since 2026-09-22 the shell has two pieces of chrome and no bar: the SITE
 * HEADER, which carries the four destinations as text links and which the
 * frame starts beneath, and the NOW-PLAYING PILL, which floats over the bottom
 * of the frame only while a track is loaded and is the one thing a pane still
 * has to clear. (Owner: "The chrome button bottom nav is no longer the
 * direction we're going for the design of this app. You can remove those
 * components to save space" — the walnut dock this probe used to measure is
 * deleted; `git show 80aa5396:scripts/measure-dock.mjs` is that version.)
 *
 * Every figure in each is load-bearing on the panes. `SHELL_LOCK` is blunt about
 * the rule: change one figure and re-derive the rest, then MEASURE.
 *
 * `audit:mobile` is the real instrument for rendered geometry, but it needs a
 * built app and a signed-in session — `/app/*` is behind auth, and seeding a
 * session needs a database. This needs neither: it mounts the REAL
 * `AdaptiveSiteHeader` (signed in, on a MUSIC route) and the REAL
 * `MmmNowPlaying` inside a frame that takes `.mmm-frame`'s own rule, with the
 * app's own token layer and the real font files, sliced out of the stylesheets
 * at run time so the harness cannot drift from what ships. `next/navigation`,
 * `next/link` and `next-auth/react` are aliased to recording stubs.
 *
 * ## It measures BOTH states, and that is the point
 *
 * The pill is present exactly when a track is loaded, and its presence is what
 * moves `--mmm-chrome-size` off zero — through the one `:has()` rule in
 * `mmm.css` that is allowed to move it. A probe that only ever saw the idle
 * frame would pass while every list in the app hid its last row behind a
 * playing pill. So each width is driven twice.
 *
 * ## What it checks, and why each one is here
 *
 *   · **the header's height equals `--app-header-h`, and the frame starts at
 *     its bottom edge** — the header and the frame read the same token, and a
 *     gap or an overlap between them is the one thing this layout cannot
 *     tolerate: a gap is a strip of page ground above every pane, an overlap
 *     hides the first row of every list;
 *   · **the navigation is one row, unclipped, from 320px up** — four
 *     destinations share the header with the mark; a destination you cannot
 *     read is the failure a labelled navigation exists to avoid, so there is
 *     no width at which a clipped or wrapped link is acceptable;
 *   · **exactly one destination is lit, and it is "Listen"** — two would be a
 *     routing bug, none means a member cannot tell where they are, and the
 *     pathname parks the probe on MUSIC, whose tab label ("Listen") differs
 *     from its module name, so a header drawing `label` instead of `tabLabel`
 *     fails here rather than in production;
 *   · **every control clears 44x44** — MOBILE.md's floor, desktop included,
 *     measured as a rendered box rather than read off a stylesheet;
 *   · **the pill's height equals `--mmm-mini-h` and `--mmm-chrome-size` equals
 *     the pill plus its two gaps, in the playing state — and ZERO idle**;
 *   · **the pill holds one width and centres**: never wider than the frame
 *     minus two gaps, never wider than its own cap, centred in the frame;
 *   · **the transport is the pill's, three keys, and there is never a second
 *     one**; idle there is no key at all;
 *   · **the pill's title is not clipped** and its artwork box is square,
 *     because the fallback initial is centred in it.
 *
 * Usage: `npm run measure:chrome` · `--json` for the raw rows ·
 * `CHROME_SHOT=/path/prefix` also writes `<prefix>-<width>.png` screenshots.
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
const SHOT = process.env.CHROME_SHOT;

/** A slice of a real stylesheet, by its own landmarks — never a copy. */
function slice(file, from, to) {
  const css = readFileSync(path.join(root, file), 'utf8');
  const a = css.indexOf(from);
  if (a < 0) throw new Error(`${file}: "${from}" not found — the stylesheet moved, so this probe is measuring the wrong thing.`);
  const b = to ? css.indexOf(to, a) : css.length;
  if (b < 0) throw new Error(`${file}: "${to}" not found after "${from}".`);
  return css.slice(a, b);
}

const dir = await mkdtemp(path.join(tmpdir(), 'ihype-chrome-'));
await mkdir(path.join(dir, 'fonts'), { recursive: true });
await mkdir(path.join(dir, 'console'), { recursive: true });
for (const font of ['JetBrainsMono-Variable.woff2', 'BricolageGrotesque-Variable.woff2']) {
  await copyFile(path.join(root, 'src/app/fonts', font), path.join(dir, 'fonts', font));
}
/* The character themes' photographed textures, served the same way the app
   serves them; the default theme paints none of them. */
for (const tex of ['walnut-v3.png', 'grain.png', 'brushed.png', 'brass-turned.png']) {
  await copyFile(path.join(root, 'public/console', tex), path.join(dir, 'console', tex));
}

/* THE REAL STYLESHEETS, NOT A RESTATED LIST. The header is painted by
   globals.css — the whole file is loaded, because its header rules, its
   `.site-nav-link` block, its 768px breakpoint and its `:root` tokens are what
   ship, and slicing four regions out of it would be four chances to drift. The
   frame's geometry table and the pill's block are sliced out of mmm.css by
   their landmarks; the frame rule becomes the harness's `#frame`, so the
   tokens live where the app declares them and the `:has()` rule that moves
   `--mmm-chrome-size` still matches. */
const globals = readFileSync(path.join(root, 'src/app/globals.css'), 'utf8')
  .replaceAll("url('/console/", "url('console/");
const frame = slice('src/app/mmm.css', '.mmm-frame {', '/* ── Map layer').replace('.mmm-frame {', '#frame {');
const pill = slice('src/app/mmm.css', '/* ── The now-playing pill', '/* Reduced motion: the sheet settles instantly.')
  .replaceAll("url('/console/", "url('console/")
  .replaceAll('.mmm-frame:has(', '#frame:has(');

await writeFile(path.join(dir, 'probe.css'), `
@font-face { font-family: 'JB'; src: url('fonts/JetBrainsMono-Variable.woff2') format('woff2'); }
@font-face { font-family: 'BG'; src: url('fonts/BricolageGrotesque-Variable.woff2') format('woff2'); }
${globals}
:root {
  /* next/font sets these on <body> in the app; the probe points them at the
     copied files so the mark and the pill measure in the faces that ship. */
  --font-bricolage: 'BG'; --font-jb: 'JB';
}
/* mmm.css's document lock, restated because only two regions of that file are
   sliced: the frame is fixed and the page under it must not scroll. */
html, body { height: 100%; overflow: hidden; margin: 0; background: var(--bg); }
${frame}
${pill}
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

/* `next/link` pulls the whole App Router client in; an anchor is all the header
   uses it for, and an anchor is also what it renders in the browser. */
await writeFile(path.join(dir, 'link-stub.tsx'), `
import * as React from 'react';
export default function Link(props: React.ComponentProps<'a'> & { href: string }) {
  return <a {...props} />;
}
`);

/* A signed-in session, so the header draws its member branch — the one with
   the navigation. The name is what the account chip renders on a desk. */
await writeFile(path.join(dir, 'session-stub.ts'), `
export function useSession() {
  return { status: 'authenticated', data: { user: { name: 'Kestrel', email: 'kestrel@example.com', image: null } } };
}
`);

await writeFile(path.join(dir, 'entry.tsx'), `
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { AdaptiveSiteHeader } from '${root}/src/components/AdaptiveSiteHeader';
import { MmmNowPlaying } from '${root}/src/components/mmm/MmmNowPlaying';

/* The real components with the real manifest. The pathname parks the header on
   MUSIC, whose tab is the one whose label ("Listen") differs from its module
   name — so a header drawing \`label\` instead of \`tabLabel\` fails here rather
   than in production. The track is the longest title and artist the fixtures
   carry, because the pill's clipping is measured against real ink. */
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
    <>
      <AdaptiveSiteHeader inviteOnly={false} label="Primary site header" />
      <div id="frame">
        <MmmNowPlaying
          canTogglePlay={Boolean(track)}
          onExpand={() => {}}
          onNext={() => {}}
          onPlayFallback={() => {}}
          onPrev={() => {}}
          onTogglePlay={() => {}}
          playing={Boolean(track)}
          track={track}
        />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Probe />);
`);

await writeFile(path.join(dir, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="probe.css"><div id="root"></div><script src="bundle.js"></script>');

await build({
  entryPoints: [path.join(dir, 'entry.tsx')],
  outfile: path.join(dir, 'bundle.js'),
  bundle: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  /* Something on the components' import graph reads `process` beyond NODE_ENV;
     a browser page has no such global, so give it an empty one. */
  banner: { js: 'var process = process || { env: { NODE_ENV: "production" } };' },
  alias: {
    'next/navigation': path.join(dir, 'router-stub.ts'),
    'next/link': path.join(dir, 'link-stub.tsx'),
    'next-auth/react': path.join(dir, 'session-stub.ts'),
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
  const frame = document.getElementById('frame');
  const frameBox = frame.getBoundingClientRect();
  const header = document.querySelector('.adaptive-site-header');
  const headerBox = header.getBoundingClientRect();
  const nav = header.querySelector('.site-nav-links');
  const links = [...header.querySelectorAll('.site-nav-link')].map((link) => {
    const box = link.getBoundingClientRect();
    return {
      text: link.textContent ?? '',
      w: Math.round(box.width),
      h: Math.round(box.height),
      right: Math.round(box.right),
      on: link.getAttribute('data-on') === 'true',
      current: link.getAttribute('aria-current') === 'page',
      px: parseFloat(getComputedStyle(link).fontSize),
      /* +1: sub-pixel layout rounds scrollWidth up by a fraction on a box that
         fits exactly, and a probe that fails on 0.4px of nothing is a probe
         people learn to re-run rather than read. */
      clipped: Math.max(0, Math.round(link.scrollWidth - link.clientWidth) - 1),
    };
  });
  const logo = header.querySelector('.app-menu-logo');
  const logoBox = logo?.getBoundingClientRect();
  const resolve = (name, host) => {
    /* The stylesheet's own answer, resolved by the browser. */
    const probe = document.createElement('div');
    probe.style.height = `var(${name})`;
    host.appendChild(probe);
    const h = Math.round(probe.getBoundingClientRect().height);
    probe.remove();
    return h;
  };
  const mini = frame.querySelector('.mmm-mini');
  const miniBox = mini?.getBoundingClientRect();
  const miniTitle = frame.querySelector('.mmm-mini-title');
  const art = frame.querySelector('.mmm-mini-art');
  const artBox = art?.getBoundingClientRect();
  const keys = [...frame.querySelectorAll('.mmm-key')].map((key) => {
    const box = key.getBoundingClientRect();
    return { label: key.getAttribute('aria-label') ?? '', w: Math.round(box.width), h: Math.round(box.height) };
  });
  return {
    headerH: Math.round(headerBox.height),
    headerToken: resolve('--app-header-h', document.body),
    frameTop: Math.round(frameBox.top),
    headerBottom: Math.round(headerBox.bottom),
    frameW: Math.round(frameBox.width),
    frameBottom: Math.round(frameBox.bottom),
    frameCentre: frameBox.left + frameBox.width / 2,
    frameMax: resolve('--mmm-frame-max', frame),
    navRight: nav ? Math.round(nav.getBoundingClientRect().right) : 0,
    innerRight: Math.round(header.querySelector('.adaptive-site-header-inner').getBoundingClientRect().right),
    oneRow: (() => {
      const kids = links.length ? [...header.querySelectorAll('.site-nav-link')].map((l) => l.getBoundingClientRect()) : [];
      return kids.every((r) => r.top < kids[0].bottom && r.bottom > kids[0].top);
    })(),
    links,
    logo: logoBox ? [Math.round(logoBox.width), Math.round(logoBox.height)] : null,
    searchField: !!header.querySelector('.search-bar-desktop'),
    gear: !!header.querySelector('.app-settings-link'),
    hasMini: !!mini,
    miniH: miniBox ? Math.round(miniBox.height) : 0,
    miniW: miniBox ? Math.round(miniBox.width) : 0,
    miniCentred: miniBox ? Math.abs((miniBox.left + miniBox.width / 2) - (frameBox.left + frameBox.width / 2)) <= 1 : true,
    miniGapBottom: miniBox ? Math.round(frameBox.bottom - miniBox.bottom) : 0,
    miniH_token: resolve('--mmm-mini-h', frame),
    miniGap_token: resolve('--mmm-mini-gap', frame),
    /* NOT `scrollWidth - clientWidth`: a correctly ellipsised element always
       has more scroll than client, so that reads as a failure precisely when
       the truncation is working. What actually matters is whether the title
       escapes the pill, which is what an un-ellipsised one does. */
    miniTitleOverflow: miniTitle && miniBox
      ? Math.max(0, Math.round(miniTitle.getBoundingClientRect().right - miniBox.right))
      : 0,
    miniTitleEllipsis: miniTitle ? getComputedStyle(miniTitle).textOverflow === 'ellipsis' : false,
    art: artBox ? [Math.round(artBox.width), Math.round(artBox.height)] : null,
    keys,
    pageScrollW: document.documentElement.scrollWidth,
    chrome: resolve('--mmm-chrome-size', frame),
  };
};

const rows = [];
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 852 } });
  await page.goto(`file://${path.join(dir, 'index.html')}`);
  await page.waitForSelector('.adaptive-site-header .site-nav-link');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);

  for (const playing of [false, true]) {
    await page.evaluate((on) => (window).__setTrack(on), playing);
    await page.waitForTimeout(60);
    rows.push({ width, playing, ...await page.evaluate(MEASURE) });
  }
  if (SHOT) {
    await page.screenshot({ path: `${SHOT}-${width}.png` });
  }
  await page.close();
}
await browser.close();

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('\n  width  state    header  chrome  pill   links (label @ w x h)');
  for (const r of rows) {
    console.log(`  ${String(r.width).padStart(5)}  ${(r.playing ? 'playing' : 'idle').padEnd(7)}  ${String(r.headerH).padStart(6)}  ${String(r.chrome).padStart(6)}  ${String(r.miniH).padStart(4)}   `
      + r.links.map((l) => `${l.on ? '[' : ''}${l.text}${l.on ? ']' : ''} ${l.w}x${l.h}${l.clipped ? ` CLIP ${l.clipped}` : ''}`).join('  '));
  }
}

const problems = [];
for (const r of rows) {
  const at = `${r.width}px ${r.playing ? 'playing' : 'idle'}`;

  /* THE header check: its height is the token, and the frame starts where it
     ends. Both read `--app-header-h`; this is the reading that says so. */
  if (!r.headerToken) problems.push(`${at}: --app-header-h did not resolve — the header's height token moved, so this probe is measuring nothing.`);
  else if (r.headerH !== r.headerToken) problems.push(`${at}: the header measures ${r.headerH}px but --app-header-h says ${r.headerToken}px.`);
  if (r.frameTop !== r.headerBottom) problems.push(`${at}: the frame starts at ${r.frameTop}px and the header ends at ${r.headerBottom}px — the panes will sit under the header or leave a strip above them.`);
  if (!r.frameMax) problems.push(`${at}: --mmm-frame-max did not resolve — the frame's width token moved.`);
  else if (r.frameW !== Math.min(r.width, r.frameMax)) problems.push(`${at}: the frame measures ${r.frameW}px wide — it should be min(viewport, ${r.frameMax}).`);
  if (r.pageScrollW > r.width) problems.push(`${at}: the page scrolls sideways (${r.pageScrollW}px).`);

  /* The navigation: one row, inside the header, unclipped, one lit. */
  if (r.links.length !== 4) problems.push(`${at}: ${r.links.length} destination(s) in the header — MMM_NAV has four.`);
  if (!r.oneRow) problems.push(`${at}: the navigation wrapped onto two lines.`);
  if (r.navRight > r.innerRight + 1) problems.push(`${at}: the navigation runs ${r.navRight - r.innerRight}px past the header's inner edge.`);
  const lit = r.links.filter((l) => l.on);
  if (lit.length !== 1) problems.push(`${at}: ${lit.length} destination(s) lit — exactly one is current.`);
  else if (lit[0].text !== 'Listen') problems.push(`${at}: "${lit[0].text}" is lit on /app/music — the header is drawing the module name instead of its tab label.`);
  if (r.links.filter((l) => l.current).length !== 1) problems.push(`${at}: aria-current disagrees with data-on — a reader hears a different current destination than the one painted.`);
  for (const link of r.links) {
    if (link.h < 44) problems.push(`${at}: the "${link.text}" link is ${link.h}px tall — the floor is 44.`);
    if (link.w < 44) problems.push(`${at}: the "${link.text}" link is ${link.w}px wide — the floor is 44.`);
    if (link.clipped) problems.push(`${at}: "${link.text}" is clipped by ${link.clipped}px.`);
    /* A destination is a control's name, not metadata: it takes the 15px body
       floor and never the tracked-mono eyebrow exemption the old tab labels
       used to sit at 11px on. */
    if (link.px < 15) problems.push(`${at}: "${link.text}" is set at ${link.px}px — a header destination is content and takes the 15px floor.`);
  }
  if (!r.logo) problems.push(`${at}: the header lost its mark.`);
  else if (r.logo[1] < 44) problems.push(`${at}: the mark's link is ${r.logo[1]}px tall — the floor is 44.`);
  /* Inside the shell the header is slim on purpose: no field, no gear. */
  if (r.searchField) problems.push(`${at}: the header draws a search field inside the shell — Listen carries search; the slim header has no room for a second.`);
  if (r.gear) problems.push(`${at}: the header draws the settings gear inside the shell — Me carries Settings.`);

  /* The pill is present exactly when a track is loaded, and the chrome the
     panes clear is the pill's height plus its two gaps — or zero. */
  if (r.hasMini !== r.playing) {
    problems.push(r.playing
      ? `${at}: a track is loaded and there is no pill.`
      : `${at}: nothing is loaded and a pill is on screen — silence is chrome-free.`);
  }
  const expectedChrome = r.playing ? r.miniH_token + r.miniGap_token * 2 : 0;
  if (r.chrome !== expectedChrome) problems.push(`${at}: --mmm-chrome-size resolves to ${r.chrome}px; the pill and its gaps come to ${expectedChrome}px — the panes will clear the wrong height.`);
  if (r.playing) {
    if (r.miniH !== r.miniH_token) problems.push(`${at}: the pill measures ${r.miniH}px but --mmm-mini-h says ${r.miniH_token}px.`);
    if (r.miniGapBottom !== r.miniGap_token) problems.push(`${at}: the pill sits ${r.miniGapBottom}px off the frame's bottom edge; --mmm-mini-gap says ${r.miniGap_token}.`);
    const maxW = Math.min(r.frameW - r.miniGap_token * 2, 480);
    if (r.miniW > maxW) problems.push(`${at}: the pill is ${r.miniW}px wide — the cap here is ${maxW}.`);
    if (!r.miniCentred) problems.push(`${at}: the pill is not centred in the frame.`);
    if (r.keys.length !== 3) problems.push(`${at}: expected the pill's three keys, measured ${r.keys.length}.`);
    for (const key of r.keys) {
      if (key.h < 44 || key.w < 44) problems.push(`${at}: the "${key.label}" key is ${key.w}x${key.h} — the floor is 44x44.`);
    }
    if (r.miniTitleOverflow) problems.push(`${at}: the pill's title runs ${r.miniTitleOverflow}px past the pill.`);
    if (!r.miniTitleEllipsis) problems.push(`${at}: the pill's title does not ellipsise — a long song name will push the transport off the edge.`);
    if (!r.art) problems.push(`${at}: the pill has no artwork box.`);
    else if (r.art[0] !== r.art[1]) problems.push(`${at}: the artwork box is ${r.art.join('x')} — the fallback initial is centred in a square.`);
  } else if (r.keys.length !== 0) {
    problems.push(`${at}: nothing is loaded but ${r.keys.length} key(s) are on screen.`);
  }
}

if (problems.length) {
  console.error('\nChrome geometry problems:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
const idle = rows.find((r) => r.width === 393 && !r.playing);
const playing = rows.find((r) => r.width === 393 && r.playing);
console.log(`\n  Chrome geometry holds at every width, in both states — a ${idle?.headerH}px header, ${idle?.chrome}px of bottom chrome idle and ${playing?.chrome}px with a track loaded.\n`);
