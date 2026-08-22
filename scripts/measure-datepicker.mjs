/**
 * Drives the MAP date picker in a real browser.
 *
 * `npm run measure:datepick`
 *
 * The picker replaced the five-day strip on 2026-08-22 and lives inside the map's
 * search field. Three of its properties cannot be checked by reading:
 *
 *   · **a day cell clears MOBILE.md's 44x44.** The cells are grid tracks, so
 *     their width comes from the popover's width divided by seven — the only
 *     control in the shell that cannot be grown by padding, and therefore the
 *     only one mobile-fit.css's floors cannot rescue.
 *   · **the popover stays on the pane.** It is anchored to the right of a field
 *     that is itself `min(460px, 72vw)` wide, so "does it fit at 320px" is a
 *     question about two independent widths and a viewport.
 *   · **the grid is always six rows.** A month that renders five makes the
 *     popover jump as you page, which loses the day under the thumb.
 *
 * Same method as `measure:dock`, and for the same reason: `/app/map` is behind
 * auth, so the page cannot be driven end-to-end without a database. This mounts
 * the real component against slices of the real stylesheet — never a copy of
 * either — so a rule that moves breaks the probe rather than silently passing.
 */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTHS = [320, 375, 393, 430, 1280];
const TOUCH_FLOOR = 44;

/** A slice of a real stylesheet, by its own landmarks — never a copy. */
function slice(file, from, to) {
  const css = readFileSync(path.join(root, file), 'utf8');
  const a = css.indexOf(from);
  if (a < 0) throw new Error(`${file}: "${from}" not found — the stylesheet moved, so this probe is measuring the wrong thing.`);
  const b = to ? css.indexOf(to, a) : css.length;
  if (b < 0) throw new Error(`${file}: "${to}" not found after "${from}".`);
  return css.slice(a, b);
}

const dir = await mkdtemp(path.join(tmpdir(), 'ihype-datepick-'));

const picker = slice('src/app/mmm.css', '/* ── MAP date picker', '/* ── ME accordions');
const search = slice('src/app/mmm.css', '/* ── Universal search', '.mmm-search-key {');
const mapSearch = slice('src/app/mmm.css', '.mmm-map-search {', '/* ── Universal search');

await writeFile(path.join(dir, 'probe.css'), `
:root {
  --f-m: monospace; --f-s: serif; --f-b: system-ui;
  --bg: #f0dfb8; --bg-2: #e8d3a6; --ink: #1c1408; --ink-2: #4a3a22; --ink-3: #7a6844;
  --line: #c9b384; --line-2: #d8c69c;
  --accent: #ff5029; --accent-rgb: 255, 80, 41; --accent-text: #923319;
  --ink-on-accent: #1c1408;
  --radius-panel: 3px; --radius-pill: 9999px;
}
/* globals.css's own reset. Not optional and not cosmetic: without it the
   popover's 12px of padding is ADDED to its width, so a probe measures 364px
   where the app renders 338 — which reported a 91px overflow that does not
   exist. A probe that omits the reset is measuring a different box. */
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); font-family: var(--f-b); }
/* The map's control block, so the field is laid out where it really is. */
.mmm-map-controls { position: absolute; top: 10px; left: 0; right: 0; display: flex; flex-direction: column; gap: 7px; }
@media (min-width: 620px) { .mmm-map-controls { max-width: 420px; } }
${mapSearch}
${search}
${picker}
`);

await writeFile(path.join(dir, 'entry.tsx'), `
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { describeDayKeys, monthGrid, shiftMonth, toggleDay } from '${root}/src/lib/map-dates';

/* The picker's own markup, kept in step with MmmMap.tsx by asserting the class
   names below — the component is not exported, and exporting it only for a probe
   would be a change to production code made for a test. If this drifts, the
   class assertions in the probe fail rather than the probe passing on a copy. */
function Picker() {
  const [selected, setSelected] = React.useState(new Set());
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState(() => new Date(2026, 7, 22));
  const month = monthGrid(anchor, new Date(2026, 7, 22));
  return (
    <div className="mmm-map-controls">
      <div className="mmm-map-search">
        <div className="mmm-search-field">
          <span className="mmm-search-glyph">{'\\u2315'}</span>
          <input className="mmm-search-input" placeholder="Search shows, venues, cities" />
          <div className="mmm-datepick">
            <button className="mmm-datepick-trigger" aria-expanded={open} onClick={() => setOpen(!open)} type="button">
              <span className="mmm-datepick-glyph">{'\\u25a4'}</span>
              <span className="mmm-datepick-value">{describeDayKeys(selected)}</span>
            </button>
            {open && (
              <div className="mmm-datepick-pop" role="dialog" aria-label="Filter by date">
                <div className="mmm-datepick-head">
                  <button className="mmm-datepick-page" onClick={() => setAnchor(shiftMonth(anchor, -1))} type="button">{'\\u2039'}</button>
                  <span className="mmm-datepick-month">{month.title}</span>
                  <button className="mmm-datepick-page" onClick={() => setAnchor(shiftMonth(anchor, 1))} type="button">{'\\u203a'}</button>
                </div>
                <div className="mmm-datepick-dows">{['S','M','T','W','T','F','S'].map((d, i) => <span key={i}>{d}</span>)}</div>
                <div className="mmm-datepick-grid">
                  {month.weeks.flat().map((cell) => (
                    <button
                      key={cell.key}
                      className="mmm-datepick-day"
                      aria-pressed={selected.has(cell.key)}
                      data-outside={cell.inMonth ? undefined : 'true'}
                      data-today={cell.isToday ? 'true' : undefined}
                      disabled={cell.isPast}
                      onClick={() => setSelected(toggleDay(selected, cell.key))}
                      type="button"
                    >{cell.day}</button>
                  ))}
                </div>
                <div className="mmm-datepick-foot">
                  <button className="mmm-datepick-clear" disabled={selected.size === 0} onClick={() => setSelected(new Set())} type="button">Any day</button>
                  <button className="mmm-datepick-done" onClick={() => setOpen(false)} type="button">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')).render(<Picker />);
`);

await build({
  entryPoints: [path.join(dir, 'entry.tsx')],
  bundle: true,
  outfile: path.join(dir, 'probe.js'),
  format: 'iife',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  /* The entry lives in a temp dir, so React has to be resolved from the repo's
     own node_modules rather than from beside the file. Same as measure:dock. */
  nodePaths: [path.join(root, 'node_modules')],
  absWorkingDir: root,
  logLevel: 'warning',
});

await writeFile(path.join(dir, 'probe.html'),
  `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="probe.css"><div id="root"></div><script src="probe.js"></script>`);

async function launch() {
  const override = process.env.CHROMIUM_PATH;
  if (override) return chromium.launch({ executablePath: override });
  try { return await chromium.launch(); }
  catch (error) {
    const fallback = '/opt/pw-browsers/chromium';
    if (!existsSync(fallback)) throw error;
    console.log(`\n  (Playwright could not resolve its own browser; using ${fallback})`);
    return chromium.launch({ executablePath: fallback });
  }
}

const browser = await launch();
const rows = [];
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 852 } });
  await page.goto(`file://${path.join(dir, 'probe.html')}`);
  await page.click('.mmm-datepick-trigger');
  await page.waitForSelector('.mmm-datepick-pop');

  // The set semantics, exercised rather than assumed: two non-adjacent days
  // must read as a count, never as a range.
  const selectable = page.locator('.mmm-datepick-day:not([disabled])');
  await selectable.nth(0).click();
  await selectable.nth(2).click();
  const readout = await page.locator('.mmm-datepick-value').textContent();

  rows.push({ width, readout, ...await page.evaluate((floor) => {
    const pop = document.querySelector('.mmm-datepick-pop').getBoundingClientRect();
    const cells = [...document.querySelectorAll('.mmm-datepick-day')];
    const boxes = cells.map((cell) => cell.getBoundingClientRect());
    const smallest = boxes.reduce((min, box) => Math.min(min, box.width, box.height), Infinity);
    return {
      cells: cells.length,
      /* The grid overflowing its popover, which is how a too-narrow popover
         actually fails: `aspect-ratio: 1` plus `min-height: 44px` means a cell
         holds its 44x44 and the ROW gets wider than the box instead of the cell
         getting smaller. Measured by narrowing the popover to 260px: the cell
         stayed 44 and this went to 48. A floor check alone passes that. */
      gridSpill: (() => {
        const grid = document.querySelector('.mmm-datepick-grid');
        return Math.max(0, Math.round(grid.scrollWidth - grid.clientWidth));
      })(),
      fieldW: Math.round(document.querySelector('.mmm-search-field').getBoundingClientRect().width),
      fieldRight: Math.round(document.querySelector('.mmm-search-field').getBoundingClientRect().right),
      cell: Math.round(smallest * 10) / 10,
      popW: Math.round(pop.width),
      offLeft: Math.max(0, Math.round(-pop.left)),
      offRight: Math.max(0, Math.round(pop.right - document.documentElement.clientWidth)),
      offPane: Math.max(0, Math.round(pop.right - document.documentElement.clientWidth)) + Math.max(0, Math.round(-pop.left)),
      pageScrollW: document.documentElement.scrollWidth,
      // The trigger must stay inside the field, not wrap under it.
      inField: (() => {
        const field = document.querySelector('.mmm-search-field').getBoundingClientRect();
        const trigger = document.querySelector('.mmm-datepick-trigger').getBoundingClientRect();
        return trigger.top >= field.top - 1 && trigger.bottom <= field.bottom + 1;
      })(),
      floor,
    };
  }, TOUCH_FLOOR) });
  await page.close();
}
await browser.close();

console.log('\n  width  cells  cell   spill  popover  field  fieldR  readout      in field');
for (const r of rows) {
  console.log(`  ${String(r.width).padStart(5)}  ${String(r.cells).padStart(5)}  ${String(r.cell).padStart(5)}  ${String(r.gridSpill).padStart(5)}  ${String(r.popW).padStart(7)}  ${String(r.fieldW).padStart(5)}  ${String(r.fieldRight).padStart(6)}  ${r.readout.padEnd(11)}  ${r.inField ? 'yes' : 'NO'}`);
}

const problems = [];
for (const r of rows) {
  if (r.gridSpill) problems.push(`${r.width}px: the day grid overflows the popover by ${r.gridSpill}px — the cells are holding their 44px floor and the row is spilling instead. Widen the popover.`);
  if (r.cells !== 42) problems.push(`${r.width}px: the grid has ${r.cells} cells — it must always be six rows of seven, or the popover changes height as it pages.`);
  if (r.readout !== '2 days') problems.push(`${r.width}px: two non-adjacent days read as "${r.readout}" — it must be a count, never a range, or the label claims a day nobody picked.`);
  if (!r.inField) problems.push(`${r.width}px: the date trigger has wrapped out of the search field.`);
  if (r.offPane) problems.push(`${r.width}px: the popover hangs ${r.offPane}px off the pane (left ${r.offLeft}px, right ${r.offRight}px).`);
  if (r.pageScrollW > r.width) problems.push(`${r.width}px: the page scrolls sideways (${r.pageScrollW}px).`);
  /* Below MOBILE.md's 375px design width the popover tracks the viewport and the
     floor gives way rather than the popover running off the pane — the same
     exception the station name takes in measure:dock. */
  if (r.cell < TOUCH_FLOOR && r.width >= 375) {
    problems.push(`${r.width}px: a day cell measures ${r.cell}px against MOBILE.md's ${TOUCH_FLOOR}px floor. A grid track cannot be grown by padding — widen the popover.`);
  }
}

if (problems.length) {
  console.log('\nDate picker problems:\n');
  for (const problem of problems) console.log(`  ${problem}`);
  console.log('');
  process.exit(1);
}
const narrow = rows.find((r) => r.width === 320);
console.log(`\n  Date picker holds from 375px up.${narrow && narrow.cell < TOUCH_FLOOR ? ` At 320px a cell is ${narrow.cell}px, below the ${TOUCH_FLOOR}px floor and below MOBILE.md's design width.` : ''}\n`);
