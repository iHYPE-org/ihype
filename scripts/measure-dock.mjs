#!/usr/bin/env node
/**
 * Measure the console dock in a real browser, without a database.
 *
 * ## Why this exists
 *
 * The dock is the app's whole navigation and every figure in it is load-bearing
 * on the others — the knob drives the bar's height, the bar's height is what the
 * panes clear, and the dial gets whatever is left over. `SHELL_LOCK` is blunt
 * about the consequence: change one and re-derive the rest, then MEASURE.
 *
 * `audit:mobile` is the real instrument for rendered geometry, but it needs a
 * built app and a signed-in session — `/app/*` is behind auth, and seeding a
 * session needs a database. This needs neither: it mounts the REAL `MmmDock`
 * (the hardware translated from `Console Dock.dc.html`) with the app's own
 * token layer and the real font files, sliced out of `mmm.css` at run time so
 * the harness cannot drift from what ships. `next/navigation` is aliased to a
 * recording stub — the component is a client component and the router is its
 * only Next dependency.
 *
 * ## What it checks, and why each one is here
 *
 *   · **the bar's height equals the geometry table** — `--mmm-chrome-size` is
 *     what every pane clears, so a bar that measures anything else means
 *     content is sliding under the dock or floating above a gap;
 *   · **the two knobs match at 74px** — the design: "both knobs are 74px,
 *     matched … if one is smaller the dock looks broken";
 *   · **the module readout fits its brass cap** — the engraved legend takes
 *     the 11px tracked-mono floor, and "MUSIC" must fit the 48px cap;
 *   · **the station name is not clipped from 375px up** — a destination you
 *     cannot read is the exact failure the dial exists to fix. The drum's
 *     neighbours slide out of the window by design (the window clips the
 *     cylinder), so THEY may clip; the centre name may not;
 *   · **both step affordances take their own taps** — they are the keyboard's
 *     and Playwright's only way to turn the dial;
 *   · **the nameplate's tap target clears 44px** — the visible badge is 17px
 *     of brass; the floor is met by an invisible skirt, and a skirt is exactly
 *     the kind of thing that silently stops working;
 *   · **the needle, the pilot bead and the tick card are rendered** — the
 *     instrument parts of the meter, each one structural DOM this harness
 *     would otherwise not notice losing.
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
  .replaceAll("url('/console/", "url('console/");

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
html, body { margin: 0; height: 100%; background: var(--bg); }
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
`);

await writeFile(path.join(dir, 'entry.tsx'), `
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { MmmDock } from '${root}/src/components/mmm/MmmDock';

/* The real component with the real manifests: pathname puts the dial on the
   MUSIC set, parked on "Recommended" — the longest station name the app
   ships, and the whole reason the width rules exist. */
createRoot(document.getElementById('root')!).render(
  <MmmDock
    canTogglePlay={false}
    layer={null}
    onCollapse={() => {}}
    onExpand={() => {}}
    onNext={() => {}}
    onPlayFallback={() => {}}
    onPrev={() => {}}
    onTogglePlay={() => {}}
    pathname="/app/music/recommended"
    playing={false}
  />,
);
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
  alias: { 'next/navigation': path.join(dir, 'router-stub.ts') },
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
const rows = [];
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 852 } });
  await page.goto(`file://${path.join(dir, 'index.html')}`);
  await page.waitForSelector('.mmm-dock .mmm-knob');
  await page.evaluate(() => document.fonts.ready);
  /* Let the boot strike finish so the screenshot is the lit dial, not the
     dark one, and the label spring has settled. */
  await page.waitForTimeout(1600);
  rows.push({ width, ...await page.evaluate(() => {
    const dock = document.querySelector('.mmm-dock');
    const dockBox = dock.getBoundingClientRect();
    const plate = dock.querySelector('.mmm-dock-plate');
    const kids = [...plate.children].map((child) => child.getBoundingClientRect());
    const knob = dock.querySelector('.mmm-knob').getBoundingClientRect();
    const gate = dock.querySelector('.mmm-gate').getBoundingClientRect();
    const readout = dock.querySelector('.mmm-knob-readout');
    const dialNode = dock.querySelector('.mmm-hifi-dial');
    const dial = dialNode.getBoundingClientRect();
    const stationsRow = dock.querySelector('.mmm-dial-stations').getBoundingClientRect();
    const station = dock.querySelector('.mmm-dial-station[role="tab"]');
    const stationBox = station.getBoundingClientRect();
    const wings = [...dock.querySelectorAll('.mmm-dial-station[aria-hidden="true"]')].map((wing) => {
      const box = wing.getBoundingClientRect();
      return {
        text: wing.textContent,
        px: parseFloat(getComputedStyle(wing).fontSize),
        opacity: parseFloat(getComputedStyle(wing).opacity),
        /* Some of a neighbour must be IN the window — a wing entirely outside
           it is a hint nobody can see. Ink sliding past the window's edge is
           the drum metaphor working, so partial is fine. */
        inWindow: box.right > stationsRow.left && box.left < stationsRow.right,
      };
    });
    const badge = dock.querySelector('.mmm-dock-badge');
    const badgeBox = badge.getBoundingClientRect();
    const badgeCx = badgeBox.left + badgeBox.width / 2;
    const badgeCy = badgeBox.top + badgeBox.height / 2;
    const hits = (x, y) => document.elementFromPoint(x, y) === badge;
    const at = (x) => {
      const el = document.elementFromPoint(x, dial.top + dial.height / 2);
      return el?.getAttribute('aria-label') ?? el?.className ?? 'nothing';
    };
    return {
      dockH: Math.round(dockBox.height),
      oneRow: kids.every((r) => r.top < kids[0].bottom && r.bottom > kids[0].top),
      knobs: [Math.round(knob.width), Math.round(gate.width)],
      dialW: Math.round(dial.width),
      readout: readout.textContent,
      readoutPx: parseFloat(getComputedStyle(readout).fontSize),
      /* The engraved legend against the brass cap circle (knob inset 13 each
         side). Proud of the cap reads as broken hardware. Measured as the
         TEXT's own box via a Range — the readout div spans the whole knob, so
         its scrollWidth is the div, not the ink. */
      readoutSpill: (() => {
        const range = document.createRange();
        range.selectNodeContents(readout);
        return Math.max(0, Math.round(range.getBoundingClientRect().width - (knob.width - 26)));
      })(),
      station: station.textContent,
      stationPx: parseFloat(getComputedStyle(station).fontSize),
      /* The centre name against the window — the row clips, the label doesn't. */
      stationClipped: Math.max(0, Math.round(stationBox.width - stationsRow.width)),
      wings,
      steps: [at(dial.left + 8), at(dial.right - 8)],
      /* The nameplate's effective target: probe the skirt's reach. */
      badge44: hits(badgeCx, badgeCy - 21) && hits(badgeCx, badgeCy + 21) && hits(badgeCx - 21, badgeCy) && hits(badgeCx + 21, badgeCy),
      instrument: {
        needle: !!dock.querySelector('.mmm-dial-needle'),
        pilot: !!dock.querySelector('.mmm-dial-pilot'),
        card: (() => {
          const card = dock.querySelector('.mmm-dial-card');
          return card ? Math.round(card.getBoundingClientRect().width) : 0;
        })(),
      },
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
  }) });
  if (SHOT) {
    await page.screenshot({ path: `${SHOT}-${width}.png`, clip: { x: 0, y: 852 - 140, width, height: 140 } });
  }
  await page.close();
}
await browser.close();

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('\n  width  dock  chrome  knobs   dial   readout          station                     wings');
  for (const r of rows) {
    console.log(`  ${String(r.width).padStart(5)}  ${String(r.dockH).padStart(4)}  ${String(r.chrome).padStart(6)}  ${`${r.knobs[0]}/${r.knobs[1]}`.padEnd(6)}  ${String(r.dialW).padStart(4)}   `
      + `"${r.readout}" ${r.readoutPx}px${r.readoutSpill ? ` SPILLS ${r.readoutSpill}` : ''}`.padEnd(16)
      + `  "${r.station}" ${r.stationPx}px${r.stationClipped ? ` CLIPPED ${r.stationClipped}` : ''}`.padEnd(27)
      + `  ${r.wings.map((wing) => `${wing.text || '·'}@${wing.px}px${wing.inWindow ? '' : ' OUT'}`).join(' | ')}`);
  }
}

const problems = [];
for (const r of rows) {
  if (!r.oneRow) problems.push(`${r.width}px: the dock wrapped onto two rows.`);
  if (r.dockH !== r.chrome) problems.push(`${r.width}px: the bar measures ${r.dockH}px but --mmm-chrome-size says ${r.chrome}px — the panes will clear the wrong height.`);
  if (r.knobs[0] !== 74 || r.knobs[1] !== 74) problems.push(`${r.width}px: the knobs measure ${r.knobs.join('/')} — the design says 74, matched.`);
  if (r.readoutSpill) problems.push(`${r.width}px: "${r.readout}" spills ${r.readoutSpill}px past the brass cap.`);
  if (r.readoutPx > 12) problems.push(`${r.width}px: the cap legend is ${r.readoutPx}px — it takes the 11px tracked-mono floor.`);
  if (r.pageScrollW > r.width) problems.push(`${r.width}px: the page scrolls sideways (${r.pageScrollW}px).`);
  if (!r.steps.every((hit) => /station/i.test(hit))) problems.push(`${r.width}px: a step affordance is covered (${r.steps.join(', ')}).`);
  if (!r.badge44) problems.push(`${r.width}px: the nameplate's tap target is under 44px — its invisible skirt has stopped hit-testing.`);
  if (!r.instrument.needle || !r.instrument.pilot) problems.push(`${r.width}px: the meter lost its ${!r.instrument.needle ? 'needle' : 'pilot bead'}.`);
  if (r.instrument.card !== 840) problems.push(`${r.width}px: the tick card measures ${r.instrument.card}px — the compass disc geometry moved.`);
  /* 320px is below MOBILE.md's design width and clips the longest MUSIC name.
     Reported, not failed — the alternative is a name below the type floor. */
  if (r.stationClipped && r.width >= 375) problems.push(`${r.width}px: "${r.station}" is clipped by ${r.stationClipped}px.`);
  if (r.width >= 375) {
    if (r.wings.length !== 2) problems.push(`${r.width}px: expected two drum neighbours, measured ${r.wings.length}.`);
    for (const wing of r.wings) {
      if (!wing.text) problems.push(`${r.width}px: a drum neighbour rendered empty.`);
      if (wing.opacity <= 0.05) problems.push(`${r.width}px: the "${wing.text}" neighbour is invisible.`);
      if (!wing.inWindow) problems.push(`${r.width}px: the "${wing.text}" neighbour sits entirely outside the window.`);
      if (wing.px < 14.9) problems.push(`${r.width}px: the "${wing.text}" neighbour is ${wing.px}px — a resting neighbour is content and takes the 15px floor.`);
    }
  }
}

if (problems.length) {
  console.error('\nDock geometry problems:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
const narrow = rows.find((r) => r.width === 320);
console.log(`\n  Dock geometry holds from 375px up.${narrow?.stationClipped ? ` At 320px "${narrow.station}" clips by ${narrow.stationClipped}px, which is below MOBILE.md's design width.` : ''}\n`);
