#!/usr/bin/env node
/**
 * Does the map's basemap actually load?
 *
 * ## Why this exists
 *
 * On 2026-09-03 `/app/map` drew as bare parchment for about nine hours. Our own
 * `connect-src` refused the vector STYLE document — `*.basemaps.cartocdn.com`
 * stands in for one or more labels and the style lives on the apex — so
 * MapLibre got nothing, `load` never fired, and the ground and ruled grid that
 * `mmm.css` paints OVER the canvas made a completely dead basemap look
 * pixel-for-pixel like a quiet region with no pins. **It was reported by the
 * owner, not by anything here**, and the test that was supposed to cover it
 * asserted the CSP list CONTAINED the wildcard string — true throughout the
 * outage.
 *
 * The deeper problem was structural: the map is the landing surface of the
 * whole app and **no instrument touched it**. `csp-routes.test.ts` now checks
 * host-source semantics, which stops that exact bug; it cannot see a key that
 * expired, a style that moved, a sprite host that changed, or a policy the
 * SERVER is actually sending that disagrees with the source. This walks the
 * real dependency graph.
 *
 * ## What it does
 *
 *   1. Reads the style URL out of `MmmMap.tsx` — never restated here, because a
 *      copy is a second thing to keep in sync and this file exists because two
 *      things drifted.
 *   2. Reads `MAP_TILE_HOSTS` out of `src/lib/csp-routes.ts`, or, with
 *      `--base=<origin>`, the `content-security-policy` header that origin is
 *      really serving. The second is the one that would have caught the
 *      outage: it compares what the server sends against what the map needs.
 *   3. Fetches the style, then follows it — `sprite`, `glyphs`, and every
 *      source's `url` (a TileJSON, which is followed one more hop to the tile
 *      template).
 *   4. For each resulting URL, checks it against `connect-src` under real host-
 *      source semantics and then FETCHES it.
 *
 * A URL that CSP refuses fails even if it fetches, because the browser never
 * gets that far — CSP refuses before any connection, which is also why this
 * check is meaningful from a sandbox.
 *
 * Usage:
 *   node scripts/check-basemap.mjs                 # against the source list
 *   node scripts/check-basemap.mjs --base=https://ihype.org
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const baseArg = process.argv.find((a) => a.startsWith('--base='));
const BASE = baseArg ? baseArg.slice('--base='.length).replace(/\/$/, '') : null;
const JSON_OUT = process.argv.includes('--json');

/* ── the style URL, read from the component that builds it ─────────────── */
const mapSource = readFileSync(path.join(root, 'src/components/mmm/MmmMap.tsx'), 'utf8');
const keyMatch = mapSource.match(/NEXT_PUBLIC_CARTO_BASEMAP_KEY[\s\S]{0,240}?\|\|\s*'([^']+)'/);
const styleMatch = mapSource.match(/const CARTO_STYLE_URL = `([^`]+)`/);
if (!styleMatch) {
  console.error('  MmmMap.tsx no longer declares CARTO_STYLE_URL — this probe is measuring nothing.');
  process.exit(2);
}
const KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY || keyMatch?.[1] || '';
const STYLE_URL = styleMatch[1].replace('${CARTO_BASEMAP_KEY}', KEY);
if (!KEY) {
  console.error('  No basemap key resolved — MmmMap.tsx changed shape, or the default was removed.');
  process.exit(2);
}

/* ── the policy: the source list, or what the origin really serves ─────── */
async function connectSources() {
  if (!BASE) {
    const csp = readFileSync(path.join(root, 'src/lib/csp-routes.ts'), 'utf8');
    const block = csp.match(/MAP_TILE_HOSTS[^=]*=\s*\[([\s\S]*?)\]/);
    const hosts = block ? [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
    if (hosts.length === 0) {
      console.error('  MAP_TILE_HOSTS parsed to nothing — the list moved, so this probe is measuring nothing.');
      process.exit(2);
    }
    return { origin: 'src/lib/csp-routes.ts', sources: ["'self'", ...hosts] };
  }
  const response = await fetch(`${BASE}/app/map`, { redirect: 'manual' });
  const header = response.headers.get('content-security-policy');
  if (!header) {
    console.error(`  ${BASE} served no content-security-policy header on /app/map.`);
    process.exit(2);
  }
  const directive = header.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src'));
  if (!directive) {
    console.error(`  ${BASE} serves a CSP with no connect-src — every fetch falls back to default-src.`);
    process.exit(1);
  }
  return { origin: `${BASE} (live header)`, sources: directive.split(/\s+/).slice(1) };
}

/**
 * Real host-source semantics, and the wildcard rule is the whole point: `*.a.b`
 * stands in for ONE OR MORE labels and never matches the bare `a.b`. Getting
 * this wrong in the opposite direction is what the outage was.
 */
function allowed(url, sources) {
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  return sources.some((source) => {
    const match = /^(https?):\/\/(.+)$/.exec(source);
    if (!match) return false;
    const [, scheme, pattern] = match;
    if (`${scheme}:` !== parsed.protocol) return false;
    const host = pattern.replace(/\/.*$/, '').replace(/:\d+$/, '');
    if (!host.startsWith('*.')) return parsed.hostname === host;
    return parsed.hostname.endsWith(`.${host.slice(2)}`);
  });
}

/** A glyph/tile template made concrete, so it can actually be fetched. */
function concrete(template) {
  return template
    .replace('{fontstack}', 'Open%20Sans%20Regular')
    .replace('{range}', '0-255')
    .replace('{z}', '10').replace('{x}', '303').replace('{y}', '378')
    .replace('{ratio}', '');
}

const { origin, sources } = await connectSources();
const rows = [];

async function probe(role, url) {
  const ok = allowed(url, sources);
  let status = 0;
  let note = '';
  if (ok) {
    try {
      const response = await fetch(url, { headers: { Referer: 'https://ihype.org/app/map' } });
      status = response.status;
      return { role, url, allowed: ok, status, note, body: response.ok ? await response.text() : '' };
    } catch (error) {
      note = error instanceof Error ? error.message : String(error);
    }
  } else {
    note = 'refused by connect-src before any request';
  }
  return { role, url, allowed: ok, status, note, body: '' };
}

const style = await probe('style', STYLE_URL);
rows.push(style);

if (style.body) {
  let parsed;
  try { parsed = JSON.parse(style.body); } catch { parsed = null; }
  if (!parsed) {
    rows.push({ role: 'style', url: STYLE_URL, allowed: true, status: style.status, note: 'not JSON', body: '' });
  } else {
    if (parsed.sprite) rows.push(await probe('sprite', concrete(`${parsed.sprite}.json`)));
    if (parsed.glyphs) rows.push(await probe('glyphs', concrete(parsed.glyphs)));
    for (const [name, source] of Object.entries(parsed.sources ?? {})) {
      if (source.url) {
        const tileJson = await probe(`source:${name}`, source.url);
        rows.push(tileJson);
        /* One more hop. The style names a TileJSON, and the TILES it lists can
           be on a different host again — which is exactly the shape of failure
           this whole file exists for. */
        if (tileJson.body) {
          try {
            const meta = JSON.parse(tileJson.body);
            for (const template of meta.tiles ?? []) rows.push(await probe(`tile:${name}`, concrete(template)));
          } catch { /* a TileJSON we cannot parse is reported by its own row */ }
        }
      }
      for (const template of source.tiles ?? []) rows.push(await probe(`tile:${name}`, concrete(template)));
    }
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify(rows.map(({ body, ...rest }) => rest), null, 2));
} else {
  console.log(`\n  Basemap dependency walk · policy from ${origin}\n`);
  for (const row of rows) {
    const verdict = !row.allowed ? 'CSP REFUSED' : row.status >= 200 && row.status < 300 ? `${row.status} ok` : row.status ? `${row.status}` : 'no response';
    console.log(`  ${verdict.padEnd(12)} ${row.role.padEnd(14)} ${row.url.replace(KEY, '<key>').slice(0, 92)}`);
    if (row.note) console.log(`  ${' '.repeat(12)} ${' '.repeat(14)} ${row.note}`);
  }
}

const problems = rows.filter((row) => !row.allowed || row.status < 200 || row.status >= 300);
if (rows.length < 3) {
  console.error('\n  The walk collected fewer than three dependencies — the style did not resolve, so nothing was proved.\n');
  process.exit(1);
}
if (problems.length) {
  console.error(`\n  The basemap cannot load: ${problems.length} of ${rows.length} dependencies fail.\n`);
  for (const problem of problems) {
    console.error(`    ${problem.role}: ${!problem.allowed ? 'refused by connect-src' : `HTTP ${problem.status || 'none'}`}${problem.note ? ` — ${problem.note}` : ''}`);
  }
  console.error('');
  process.exit(1);
}
console.log(`\n  Basemap healthy: ${rows.length} dependencies, all permitted by connect-src and all answering 2xx.\n`);
