import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * A client component must not claim emptiness over a fetch that failed.
 *
 * The server half of this rule is `server-page-empty-claims.test.ts` (rows
 * 448-449). On the client the idiom is `.catch(() => {})` — or worse, a catch
 * that MANUFACTURES an empty dataset, `.catch(() => setData({ myProfiles: []
 * … }))` — followed by a render that reads the still-initial `[]` and says "No
 * pages yet", "No comments yet — be the first", "No payment method on file",
 * "No tracks are available to vote on yet" (DESIGN_SYNC row 450). The MUSIC
 * tabs were held to this in row 408 with network-faulting e2e tests; this is
 * the static half for every other client component.
 *
 * Two checks, deliberately different in strength:
 *
 * 1. A catch that manufactures an empty collection is refused outright — there
 *    is no reading of `.catch(() => setRows([]))` that is not this defect.
 * 2. A client component that BOTH swallows a fetch failure AND renders an
 *    empty-state sentence must declare a failure state (`loadFailed`,
 *    `…Error`, `…Unavailable`) so the render has something to branch on. This
 *    is a heuristic; its allowlist names the components whose empty sentence
 *    is not a fetched list, each with the reason, so a new false positive is
 *    written down rather than silenced.
 */

const ROOT = join(__dirname, '..', '..', '..');
const MANUFACTURED_EMPTY = /\.catch\(\s*\(\)\s*=>\s*set\w+\(\s*(?:\[\]|\{[^)]*\[\][^)]*\})\s*\)\s*\)/g;
const SWALLOW = /\.catch\(\s*\(\)\s*=>\s*(?:\{\s*\}|null|undefined)\s*\)/;
const EMPTY_SENTENCE = /t\('[\w.]+',\s*'(?:No |Nothing|You have no|None |Empty|Your \w+ (?:is|are) empty|has not |hasn)/;
const FAILURE_STATE = /\[\s*\w*(?:[fF]ailed|[eE]rror|[uU]navailable)\w*\s*,\s*set\w+\s*\]\s*=\s*useState/;

/** Components whose empty sentence is not a fetched list — reasons, not silence. */
const NOT_A_FETCHED_LIST: Record<string, string> = {
  'src/components/FanPlaylistManager.tsx': '"No current track" is the player\'s own state, set by playback, not by the fetch this file swallows',
  'src/components/mmm/MmmMe.tsx': 'the empty sentences are over `data.activity`, a SERVER prop whose failed read is `null` and renders its own unavailable line (row 513); the one swallowed fetch is the listening card, which renders nothing at all on failure rather than a claim',
  'src/components/ShowSequencePlayer.tsx': 'the sequence is a prop resolved from the show\'s production plan; the swallowed catches are on media.play(), not on a fetch',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (/^(admin|__tests__|ds)$/.test(entry)) continue; // console is English-only and its reads are the server test's; ds is vendored
      walk(full, out);
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function isClientFile(source: string): boolean {
  return /^\s*['"]use client['"]/.test(maskComments(source).trimStart());
}

export function manufacturedEmptySites(files: Array<{ path: string; source: string }>): string[] {
  const hits: string[] = [];
  for (const file of files) {
    const masked = maskComments(file.source);
    for (const match of masked.matchAll(MANUFACTURED_EMPTY)) {
      hits.push(`${file.path}:${masked.slice(0, match.index).split('\n').length}`);
    }
  }
  return hits;
}

export function swallowsWithoutFailureState(files: Array<{ path: string; source: string }>): string[] {
  const hits: string[] = [];
  for (const file of files) {
    if (!isClientFile(file.source)) continue;
    const masked = maskComments(file.source);
    if (!SWALLOW.test(masked) || !EMPTY_SENTENCE.test(masked)) continue;
    if (FAILURE_STATE.test(masked)) continue;
    if (NOT_A_FETCHED_LIST[file.path]) continue;
    hits.push(file.path);
  }
  return hits;
}

describe('client components never claim emptiness over a failed fetch', () => {
  const files = [...walk(join(ROOT, 'src', 'components')), ...walk(join(ROOT, 'src', 'app'))]
    .map((path) => ({ path: relative(ROOT, path), source: readFileSync(path, 'utf8') }));

  it('scans a plausible number of components', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no catch manufactures an empty collection', () => {
    expect(manufacturedEmptySites(files)).toEqual([]);
  });

  it('every client component that swallows a fetch failure beside an empty sentence declares a failure state', () => {
    expect(swallowsWithoutFailureState(files)).toEqual([]);
  });

  it('every allowlisted component still exists and still needs its entry', () => {
    for (const [path, reason] of Object.entries(NOT_A_FETCHED_LIST)) {
      expect(reason.length, path).toBeGreaterThan(20);
      const file = files.find((f) => f.path === path);
      expect(file, `${path} is allowlisted but gone — remove the entry`).toBeDefined();
      const masked = maskComments(file!.source);
      expect(SWALLOW.test(masked) && EMPTY_SENTENCE.test(masked), `${path} no longer trips the heuristic — remove the entry`).toBe(true);
    }
  });

  it('would catch both shapes (negative proof) and reads no comments', () => {
    const probe = [
      { path: 'src/components/A.tsx', source: "'use client';\nfetch('/x').then(r => r.json()).then(setRows).catch(() => setRows([]));\n" },
      { path: 'src/components/B.tsx', source: "'use client';\nfetch('/x').then(r => r.json()).then(setData).catch(() => setData({ myProfiles: [], following: [] }));\n" },
      { path: 'src/components/C.tsx', source: "'use client';\nconst [rows, setRows] = useState([]);\nfetch('/x').then(r => r.json()).then(setRows).catch(() => {});\n<p>{t('c.empty', 'No rows yet.')}</p>\n" },
      { path: 'src/components/D.tsx', source: "'use client';\nconst [loadFailed, setLoadFailed] = useState(false);\nfetch('/x').catch(() => {});\n<p>{t('d.empty', 'No rows yet.')}</p>\n" },
      { path: 'src/components/E.tsx', source: "'use client';\n// old: .catch(() => setRows([]))\nfetch('/x').catch(() => setLoadFailed(true));\n" },
    ];
    expect(manufacturedEmptySites(probe)).toEqual(['src/components/A.tsx:2', 'src/components/B.tsx:2']);
    expect(swallowsWithoutFailureState(probe)).toEqual(['src/components/C.tsx']);
  });
});
