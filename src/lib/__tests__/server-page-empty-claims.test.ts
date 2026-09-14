import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';
import { readList, readValue } from '../read-list';

/**
 * A server page must not discard the fact that a read failed.
 *
 * `promise.catch(() => [])` was the idiom on every member pane for a list
 * whose failure must not 500 the page, and `promise.catch(() => 0)` its twin
 * for a count. Each makes a query that found nothing and a query that never
 * ran the same value — so the panel below rendered its EMPTY sentence or a
 * confident 0 over both: "{name} has not published any releases yet",
 * "Nothing on the calendar yet", "You're all caught up", "No reports yet",
 * Users: 0. Each is a claim about the member, the artist or the platform made
 * on top of a read that never landed. DESIGN_SYNC row 408 wrote the rule for
 * the MUSIC tabs — an empty state is only ever rendered over reads that
 * actually succeeded — rows 327 and 337 had already made every COUNTER on the
 * profile panes distinguish (`null` renders as a dash, never 0), and
 * `analytics-engine.ts` and `admin-workbench.ts` state the same rule for the
 * console. The lists on the member panes (row 448) and the operator console's
 * own Overview and Finance tabs (row 449) were the halves nobody held to it.
 *
 * The scan is the negative half of the rule: a read in a server page goes
 * through `readList()` / `readValue()` (or `.catch(() => null)`), which keeps
 * the failure as `null`, and the render says "could not be read" instead of
 * "nothing here" or 0. Client pages are out of scope (row 408 covers the shell
 * tabs, and a client fetch has its own state shape). Every server entry under
 * `src/app` is in scope, the admin console included.
 */

const ROOT = join(__dirname, '..', '..', '..');
const APP = join(ROOT, 'src', 'app');
const SERVER_ENTRY = /^(page|layout)\.tsx$/;
const CATCH_TO_EMPTY = /\.catch\(\s*\(\)\s*=>\s*(\[\]|\(\{\}\)|\{\s*\}|0)\s*\)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SERVER_ENTRY.test(entry)) out.push(full);
  }
  return out;
}

function isClientFile(source: string): boolean {
  return /^\s*['"]use client['"]/.test(maskComments(source).trimStart());
}

export function catchToEmptySites(files: Array<{ path: string; source: string }>): string[] {
  const hits: string[] = [];
  for (const file of files) {
    if (isClientFile(file.source)) continue;
    const masked = maskComments(file.source);
    for (const match of masked.matchAll(CATCH_TO_EMPTY)) {
      const line = masked.slice(0, match.index).split('\n').length;
      hits.push(`${file.path}:${line}`);
    }
  }
  return hits;
}

describe('readList / readValue', () => {
  it('return the value when the read succeeds', async () => {
    await expect(readList(Promise.resolve([1, 2, 3]))).resolves.toEqual([1, 2, 3]);
    await expect(readList(Promise.resolve([]))).resolves.toEqual([]);
    await expect(readValue(Promise.resolve(0))).resolves.toBe(0);
  });

  it('return null — never an empty array or a zero — when the read fails', async () => {
    await expect(readList(Promise.reject(new Error('db down')))).resolves.toBeNull();
    await expect(readValue(Promise.reject(new Error('db down')))).resolves.toBeNull();
  });
});

describe('server pages never catch a read to an empty collection or a zero', () => {
  const files = walk(APP).map((path) => ({ path: relative(ROOT, path), source: readFileSync(path, 'utf8') }));

  it('scans a plausible number of server entry files', () => {
    // A renamed directory must break this test rather than pass it over nothing.
    expect(files.length).toBeGreaterThan(30);
  });

  it('finds no .catch(() => []) or .catch(() => 0) in a server page', () => {
    const hits = catchToEmptySites(files);
    expect(hits, 'route the read through readList()/readValue() and render a dash or an unavailable sentence when it is null').toEqual([]);
  });

  it('would catch every shape (negative proof), and does not read its own comments', () => {
    const probe = [
      { path: 'src/app/app/probe/page.tsx', source: "const rows = await db.thing.findMany({}).catch(() => []);\n" },
      { path: 'src/app/app/probe2/page.tsx', source: "const map = await db.thing.findFirst({}).catch(() => ({}));\n" },
      { path: 'src/app/admin/probe3/page.tsx', source: "const n = await db.thing.count().catch(() => 0);\n" },
      { path: 'src/app/app/client/page.tsx', source: "'use client';\nconst rows = await fetch('/x').then((r) => r.json()).catch(() => []);\n" },
      { path: 'src/app/app/commented/page.tsx', source: "// the old idiom was .catch(() => [])\nconst rows = await readList(db.thing.findMany({}));\n" },
      { path: 'src/app/app/nulled/page.tsx', source: "const rows = await db.thing.findMany({}).catch(() => null);\n" },
    ];
    expect(catchToEmptySites(probe)).toEqual([
      'src/app/app/probe/page.tsx:1',
      'src/app/app/probe2/page.tsx:1',
      'src/app/admin/probe3/page.tsx:1',
    ]);
  });
});
