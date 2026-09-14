import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';
import { readList } from '../read-list';

/**
 * A server page must not discard the fact that a list read failed.
 *
 * `promise.catch(() => [])` was the idiom on every member pane for a list
 * whose failure must not 500 the page, and it makes an empty result and a
 * failed read the same value — so the panel below rendered its EMPTY
 * sentence over both: "{name} has not published any releases yet", "Nothing
 * on the calendar yet", "You're all caught up". Each is a claim about the
 * member or the artist made on top of a query that never ran. DESIGN_SYNC row
 * 408 wrote the rule for the MUSIC tabs — an empty state is only ever rendered
 * over reads that actually succeeded — and rows 337 and 327 had already made
 * every COUNTER on the same pages distinguish (`null` renders as a dash, never
 * 0). The lists were the half nobody held to it (row 448).
 *
 * The scan is the negative half of the rule: a list read in a member-facing
 * server page goes through `readList()`, which keeps the failure as `null`,
 * and the render says "could not be loaded" instead of "nothing here". Client
 * pages are out of scope (row 408 covers the shell tabs, and a client fetch
 * has its own state shape); the admin console is out of scope because it is
 * the operator's surface and its queues are read through `admin-workbench.ts`,
 * which already reports an unreadable queue as such — its remaining
 * `.catch(() => [])` sites are recorded in row 448, not exempted silently.
 */

const ROOT = join(__dirname, '..', '..', '..');
const APP = join(ROOT, 'src', 'app');
const SERVER_ENTRY = /^(page|layout)\.tsx$/;
const CATCH_TO_EMPTY = /\.catch\(\s*\(\)\s*=>\s*(\[\]|\(\{\}\)|\{\s*\})\s*\)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'admin') continue; // the operator console — see the docblock
      walk(full, out);
    } else if (SERVER_ENTRY.test(entry)) {
      out.push(full);
    }
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

describe('readList', () => {
  it('returns the rows when the read succeeds', async () => {
    await expect(readList(Promise.resolve([1, 2, 3]))).resolves.toEqual([1, 2, 3]);
    await expect(readList(Promise.resolve([]))).resolves.toEqual([]);
  });

  it('returns null — never an empty array — when the read fails', async () => {
    await expect(readList(Promise.reject(new Error('db down')))).resolves.toBeNull();
  });
});

describe('member-facing server pages never catch a list read to an empty collection', () => {
  const files = walk(APP).map((path) => ({ path: relative(ROOT, path), source: readFileSync(path, 'utf8') }));

  it('scans a plausible number of server entry files', () => {
    // A renamed directory must break this test rather than pass it over nothing.
    expect(files.length).toBeGreaterThan(30);
  });

  it('finds no .catch(() => []) in a member-facing server page', () => {
    const hits = catchToEmptySites(files);
    expect(hits, 'route the read through readList() and render an unavailable sentence when it is null').toEqual([]);
  });

  it('would catch the idiom (negative proof), and does not read its own comments', () => {
    const probe = [
      { path: 'src/app/app/probe/page.tsx', source: "const rows = await db.thing.findMany({}).catch(() => []);\n" },
      { path: 'src/app/app/probe2/page.tsx', source: "const map = await db.thing.findFirst({}).catch(() => ({}));\n" },
      { path: 'src/app/app/client/page.tsx', source: "'use client';\nconst rows = await fetch('/x').then((r) => r.json()).catch(() => []);\n" },
      { path: 'src/app/app/commented/page.tsx', source: "// the old idiom was .catch(() => [])\nconst rows = await readList(db.thing.findMany({}));\n" },
    ];
    expect(catchToEmptySites(probe)).toEqual(['src/app/app/probe/page.tsx:1', 'src/app/app/probe2/page.tsx:1']);
  });
});
