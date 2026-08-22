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
 *   · **the cap fits** — the design system draws the module readout at 8.5px,
 *     which its own floor forbids; at the floor "MUSIC" overflowed a 74px knob's
 *     cap by 10px, which is why `mmm.css` corrects it;
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
import { readFileSync } from 'node:fs';
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
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
      /* Letter-spacing adds space AFTER the last glyph, so 1px of overflow on a
         tracked cap is that trailing space and clips no ink. */
      capOverflow: Math.round(cap.scrollWidth - cap.clientWidth),
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
      + `"${r.cap}" ${r.capPx}px${r.capOverflow > 1 ? ` OVER ${r.capOverflow}` : ''}`.padEnd(15)
      + `  "${r.station}" ${r.stationPx}px${r.stationClipped ? ` CLIPPED ${r.stationClipped}` : ''}`.padEnd(27)
      + `  ${r.chevrons.join(' / ')}`);
  }
}

const problems = [];
for (const r of rows) {
  if (!r.oneRow) problems.push(`${r.width}px: the dock wrapped onto two rows.`);
  if (r.knobs[0] !== r.knobs[1]) problems.push(`${r.width}px: the knobs disagree (${r.knobs.join(' vs ')}) — the handoff says matched.`);
  if (r.capOverflow > 1) problems.push(`${r.width}px: the knob cap overflows by ${r.capOverflow}px on "${r.cap}".`);
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
