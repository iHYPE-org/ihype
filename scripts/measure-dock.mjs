#!/usr/bin/env node
/**
 * Measure the console dock in a real browser, without a database.
 *
 * ## Why this exists
 *
 * The dock is the app's whole navigation and every figure in it is load-bearing
 * on the others — the knob drives the bar's height, the bar's height is what the
 * panes clear, and the dial gets whatever is left over. `SHELL_LOCK` is blunt
 * about the consequence: change one and re-derive the rest, then MEASURE. Both
 * bugs that came out of adding the tuner to the old chrome were dependents
 * nobody re-derived, and neither was visible in the source.
 *
 * `audit:mobile` is the real instrument for rendered geometry, but it needs a
 * built app and a signed-in session — `/app/*` is behind auth, and seeding a
 * session needs a database. This needs neither: it mounts the three vendored
 * controls with the app's own token layer, the dock's own rules and the real
 * font files, sliced out of `mmm.css` and `globals.css` at run time so the
 * harness cannot drift from what ships.
 *
 * What it cannot see: anything above the dock (panes, the map, the full player),
 * and any rule that only exists in the app's cascade. It is a geometry probe for
 * one bar, not a substitute for driving the app.
 *
 * ## The four things it checks, and why each one is here
 *
 *   · **the two knobs match** — the handoff: "both knobs are 74px, matched …
 *     if one is smaller the dock looks broken";
 *   · **the cap readout is not cut off and stays inside its knob** — the design
 *     system draws it at 8.5px, which its own floor forbids, and at the floor
 *     "MUSIC" needed 52px in a 42px cap, which is why `mmm.css` takes it to the
 *     tracked-mono floor instead. Note what is NOT asserted: a few px of
 *     overhang past the cap circle. The cap hides no overflow, so that is a
 *     visible label sitting proud of the brass rather than a clipped one, and
 *     its exact value is a function of font rasterisation — it differs between
 *     this sandbox and a CI runner, so gating on it gates on the machine;
 *   · **the station name is not clipped** — a destination you cannot read is the
 *     exact failure the dial exists to fix;
 *   · **the chevrons still take their own taps** — the correction above widens
 *     the name toward them.
 *
 * Usage: `npm run measure:dock` · `--json` for the raw rows.
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
for (const font of ['JetBrainsMono-Variable.woff2', 'InstrumentSerif-400.woff2']) {
  await copyFile(path.join(root, 'src/app/fonts', font), path.join(dir, 'fonts', font));
}

/* The tokens live on `.mmm-frame`, so the harness gives its root that rule
   rather than re-declaring the geometry — a re-declared table is the thing this
   whole file exists to catch. */
const frame = slice('src/app/mmm.css', '.mmm-frame {', '/* ── Map layer').replace('.mmm-frame {', '#root {');
const dock = slice('src/app/mmm.css', '/* ── The dock ', "/* The design system's ONE breakpoint");
const tuner = slice('src/app/globals.css', '/* ── The tuner dial', '.tuner-step {');

await writeFile(path.join(dir, 'probe.css'), `
@font-face { font-family: 'JB'; src: url('fonts/JetBrainsMono-Variable.woff2') format('woff2'); }
@font-face { font-family: 'IS'; src: url('fonts/InstrumentSerif-400.woff2') format('woff2'); }
:root {
  --f-m: 'JB', monospace; --f-s: 'IS', serif; --f-b: system-ui;
  --font-mono: var(--f-m); --font-display: var(--f-b);
  --bg: #f0dfb8; --ink: #1c1408; --ink-1: #1c1408;
  --accent: #ff5029; --accent-rgb: 255, 80, 41;
  --walnut: #4a2b16; --walnut-2: #34200f; --walnut-3: #1a1206;
  --brass: #c9a54e; --brass-deep: #8a6a2c; --lamp: #ffb84a;
  --radius-panel: 3px; --duration-slow: 420ms; --z-sticky: 30;
}
html, body { margin: 0; height: 100%; background: var(--bg); }
${frame}
${dock}
${tuner}
`);

await writeFile(path.join(dir, 'entry.tsx'), `
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { RotaryNav } from '${root}/src/components/ds/RotaryNav';
import { JoystickTransport } from '${root}/src/components/ds/JoystickTransport';
import { TunerDial } from '${root}/src/components/ds/TunerDial';
import { MMM_MUSIC_TABS, MMM_NAV } from '${root}/src/lib/mmm-nav';

/* The real manifests, so the longest label this app actually ships is the one
   being measured — "Recommended" is the whole reason the station rule exists. */
function Dock() {
  const [module, setModule] = React.useState('music');
  const [station, setStation] = React.useState(
    [...MMM_MUSIC_TABS].sort((a, b) => b.label.length - a.label.length)[0].id,
  );
  return (
    <div className="mmm-dock">
      <RotaryNav
        activeModule={module}
        modules={MMM_NAV.map((m) => ({ id: m.id, label: m.label }))}
        onNavigate={(m) => setModule(m.id)}
        size={74}
      />
      <div className="mmm-tuner-mount">
        <TunerDial active={station} onChange={setStation} stations={[...MMM_MUSIC_TABS]} />
      </div>
      <JoystickTransport playing={false} size={74} />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Dock />);
`);

await writeFile(path.join(dir, 'index.html'),
  '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="probe.css"><div id="root"></div><script src="bundle.js"></script>');

await build({
  entryPoints: [path.join(dir, 'entry.tsx')],
  outfile: path.join(dir, 'bundle.js'),
  bundle: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(root, 'node_modules')],
  logLevel: 'error',
});

/**
 * Launch Playwright's own browser, and only fall back to a path.
 *
 * This used to pass `executablePath: '/opt/pw-browsers/chromium'` as the
 * DEFAULT, which is the pre-installed Chromium in one particular sandbox. On a
 * GitHub runner `playwright install` puts its browser under
 * `~/.cache/ms-playwright`, so the default launch is the correct one there and
 * the hardcoded path does not exist — which is exactly how this script, added to
 * CI to protect the dock, became the thing that failed CI and kept the dock from
 * shipping. Try Playwright's resolution first; fall back only if it cannot
 * resolve a browser and a known-good binary is on disk.
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
  await page.waitForSelector('.mmm-dock button');
  await page.evaluate(() => document.fonts.ready);
  rows.push({ width, ...await page.evaluate(() => {
    const dock = document.querySelector('.mmm-dock');
    const kids = [...dock.children].map((child) => child.getBoundingClientRect());
    const cap = dock.querySelector('button[aria-label^="Module:"] > span:last-child');
    const station = dock.querySelector('[role="tab"][aria-selected="true"]');
    const dial = document.querySelector('.tuner-dial').getBoundingClientRect();
    const at = (x) => {
      const el = document.elementFromPoint(x, dial.top + dial.height / 2);
      return el?.getAttribute('aria-label') ?? el?.tagName ?? 'nothing';
    };
    return {
      dockH: Math.round(dock.getBoundingClientRect().height),
      oneRow: kids.every((r) => r.top < kids[0].bottom && r.bottom > kids[0].top),
      knobs: [Math.round(kids[0].width), Math.round(kids[kids.length - 1].width)],
      dialW: Math.round(kids[1].width),
      cap: cap.textContent,
      capPx: parseFloat(getComputedStyle(cap).fontSize),
      /* Two different questions, and the first one is the one that matters.
 
         CLIPPED: is any ink actually cut off? Only if something between the text
         and the knob hides its overflow. The vendored cap sets no `overflow`, so
         a label wider than the cap overhangs the brass circle — visible, not
         cut. Asserting on the raw scrollWidth delta instead measured font
         RASTERISATION: the same cap reports 1px in one sandbox and 3px on a
         GitHub runner, so a threshold tuned on one machine fails on the other,
         which is exactly the trap the Lighthouse budgets in this repo already
         document. This is an absolute measure instead.
 
         SPILL: does the readout escape the knob it belongs to? That is the real
         geometric limit — a legend running out over the dock is broken whether
         or not it is clipped. */
      capClipped: (() => {
        let node = cap;
        while (node && node !== dock) {
          const { overflowX } = getComputedStyle(node);
          if (overflowX === 'hidden' || overflowX === 'clip') {
            return Math.max(0, Math.round(node.scrollWidth - node.clientWidth));
          }
          node = node.parentElement;
        }
        return 0;
      })(),
      capSpill: Math.max(0, Math.round(cap.scrollWidth - kids[0].width)),
      capOverhang: Math.round(cap.scrollWidth - cap.clientWidth),
      station: station.textContent,
      stationPx: parseFloat(getComputedStyle(station).fontSize),
      stationClipped: Math.round(station.scrollWidth - station.clientWidth),
      chevrons: [at(dial.left + 8), at(dial.right - 8)],
      pageScrollW: document.documentElement.scrollWidth,
    };
  }) });
  await page.close();
}
await browser.close();

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('\n  width  dock  knobs      dial   cap            station                    chevrons');
  for (const r of rows) {
    console.log(`  ${String(r.width).padStart(5)}  ${String(r.dockH).padStart(4)}  ${`${r.knobs[0]}/${r.knobs[1]}`.padEnd(9)}  ${String(r.dialW).padStart(4)}   `
      + `"${r.cap}" ${r.capPx}px${r.capClipped ? ` CLIPPED ${r.capClipped}` : r.capSpill ? ` SPILLS ${r.capSpill}` : ''}`.padEnd(15)
      + `  "${r.station}" ${r.stationPx}px${r.stationClipped ? ` CLIPPED ${r.stationClipped}` : ''}`.padEnd(27)
      + `  ${r.chevrons.join(' / ')}`);
  }
}

const problems = [];
for (const r of rows) {
  if (!r.oneRow) problems.push(`${r.width}px: the dock wrapped onto two rows.`);
  if (r.knobs[0] !== r.knobs[1]) problems.push(`${r.width}px: the knobs disagree (${r.knobs.join(' vs ')}) — the handoff says matched.`);
  if (r.capClipped) problems.push(`${r.width}px: "${r.cap}" is cut off in the knob cap by ${r.capClipped}px.`);
  if (r.capSpill) problems.push(`${r.width}px: "${r.cap}" spills ${r.capSpill}px outside the knob.`);
  /* The overhang past the cap circle, tolerated in PROPORTION TO THE TYPE rather
     than as a fixed px. The defect this check exists for was "MUSIC" at the 15px
     content floor needing 52px in a 42px cap — 10px proud of the brass, which
     reads as broken. The noise it must not fail on is font rasterisation: the
     same 11px cap measures 1px of overhang in one sandbox and 3px on a CI
     runner. 0.4em separates them (4.4px at 11px, 6px at 15px) and scales with
     whatever size the design system settles on, so this cannot be re-tuned into
     a machine-specific threshold again. */
  const overhangBudget = r.capPx * 0.4;
  if (r.capOverhang > overhangBudget) {
    problems.push(`${r.width}px: "${r.cap}" sits ${r.capOverhang}px proud of the knob cap (budget ${overhangBudget.toFixed(1)}px at ${r.capPx}px type).`);
  }
  if (r.pageScrollW > r.width) problems.push(`${r.width}px: the page scrolls sideways (${r.pageScrollW}px).`);
  if (!r.chevrons.every((hit) => /station/i.test(hit))) problems.push(`${r.width}px: a step chevron is covered (${r.chevrons.join(', ')}).`);
  /* 320px is below MOBILE.md's design width and ellipsises the longest of the
     five MUSIC names. Reported, not failed — the alternative is a name at a size
     the type floor forbids. */
  if (r.stationClipped && r.width >= 375) problems.push(`${r.width}px: "${r.station}" is clipped by ${r.stationClipped}px.`);
}

if (problems.length) {
  console.error('\nDock geometry problems:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
const narrow = rows.find((r) => r.width === 320);
console.log(`\n  Dock geometry holds from 375px up.${narrow?.stationClipped ? ` At 320px "${narrow.station}" ellipsises by ${narrow.stationClipped}px, which is below MOBILE.md's design width.` : ''}\n`);
