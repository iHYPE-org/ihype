import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * Every exported HTTP method on every API route has a caller that uses it.
 *
 * `audit:mounts` asks whether a component is rendered by a page; nothing asked
 * whether a route handler is fetched by anything. DESIGN_SYNC row 446 did the
 * census by hand and found `PATCH /api/shows/[showId]` — a real, careful
 * handler that no page, component, script or spec had ever called, which is
 * why an organiser could not correct a show without cancelling it. A handler
 * with no caller is the same defect as a component with no importer, and it
 * is invisible to the type system in the same way. This is the census as an
 * instrument (row 453).
 *
 * How a call site's method is read, in order:
 *   1. a JSON helper names it (`postJson(`, `patchJson(`, …);
 *   2. a `fetch(` call names it in its own options object (`method: 'PATCH'`,
 *      scanned inside THAT call's parentheses, never a window of text — a
 *      window attributed the next fetch's POST to a GET two lines above);
 *   3. `<form action=…>` is a POST; an href, a `new URL`, `window.location`, a
 *      Playwright `page.goto`, a cron job table and a bare string constant are
 *      GETs (a constant assigned and fetched elsewhere is recorded as GET; if
 *      that is ever wrong the route lands in the residue and gets a reason).
 *   4. a Playwright `request.<verb>(` names it.
 * A template segment in a caller (`/api/map/${layer}`) stands for any route
 * segment in that position, which is how the map's three layer routes are
 * reached (row 422's lesson: a template is invisible to a literal scan).
 *
 * Routes only an outside system calls are listed with the caller named, so a
 * new webhook or mail link is written down rather than silently passing.
 */

const ROOT = join(__dirname, '..', '..', '..');
const API_ROOT = join(ROOT, 'src', 'app', 'api');
const CALLER_ROOTS = ['src', 'scripts', 'e2e', 'workers', 'public'];
const SOURCE_EXT = /\.(?:ts|tsx|mts|mjs|js)$/;
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
const METHODS: Method[] = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

/** Routes an outside system calls; each names who. (A catch-all such as
 *  Auth.js's `[...nextauth]` needs no entry: its pattern is satisfied by any
 *  deeper `/api/auth/…` call, which is also how Next resolves it — the more
 *  specific route wins and the catch-all's coverage is whatever is left.) */
export const EXTERNAL_CALLERS: Record<string, string> = {
  'POST /api/webhooks/resend': 'Resend delivers bounce and complaint events; the smoke script probes it',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

export function exportedMethods(source: string): Method[] {
  const masked = maskComments(source);
  const found = new Set<Method>();
  for (const m of masked.matchAll(/^export (?:async )?function (GET|POST|PATCH|PUT|DELETE)\b/gm)) found.add(m[1] as Method);
  for (const m of masked.matchAll(/^export const (GET|POST|PATCH|PUT|DELETE)\b/gm)) found.add(m[1] as Method);
  for (const m of masked.matchAll(/^export (?:const )?\{([^}]*)\}/gm)) {
    // `export { a as GET }` and Auth.js's `export const { GET, POST } = handlers`
    for (const name of m[1].split(',')) {
      const verb = name.trim().split(/\s+as\s+/).pop()?.trim();
      if (verb && (METHODS as string[]).includes(verb)) found.add(verb as Method);
    }
  }
  return METHODS.filter((x) => found.has(x));
}

/** A regex matching this route's path as a caller would write it, template segments included. */
export function routePathPattern(routePath: string): RegExp {
  const TEMPLATE = String.raw`\$\{[^}]*\}`;
  const segs = routePath.split('/').filter(Boolean).map((seg) => {
    if (seg.startsWith('[...')) return String.raw`(?:[^'"\x60\s?]+)`;
    if (seg.startsWith('[')) return String.raw`(?:${TEMPLATE}|[^/'"\x60\s?]+)`;
    return String.raw`(?:${seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${TEMPLATE})`;
  });
  /* Group 1 is the boundary before the path: a quote, a template `${base}`
     closing brace, or a bare origin (`https://ihype.org/api/…` in an email
     link) — never a word or a slash, or `/foo/api/x` would match. (A group
     rather than a lookbehind: a variable-length lookbehind over a 10 MB blob
     ran five times slower.) After the path: a quote, a query, a template
     continuation, whitespace or a closing bracket — never a slash, or
     `/api/things` would match inside `/api/things/${id}`. */
  return new RegExp(String.raw`([^\w/]|\.org|\.test|\.com|\.local)/${segs.join('/')}(?=['"\x60?\s)}$,])`, 'g');
}

function closingParen(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return text.length;
}

/** Every HTTP verb written as a literal inside a `method:` expression, conditional included. */
function methodLiterals(expr: string): Method[] {
  const found = new Set<Method>();
  for (const m of expr.matchAll(/['"](GET|POST|PATCH|PUT|DELETE)['"]/gi)) found.add(m[1].toUpperCase() as Method);
  return METHODS.filter((x) => found.has(x));
}

/** The HTTP method(s) a call site uses, read from the site itself. */
export function methodAtSite(text: string, pathStart: number, pathEnd: number): Method[] | 'ANY' {
  const before = text.slice(Math.max(0, pathStart - 160), pathStart);
  const helper = /(post|patch|put|delete|get)Json\s*(?:<[^>]*>)?\(\s*['"\x60]$/i.exec(before);
  if (helper) return [helper[1].toUpperCase() as Method];
  const pw = /request\.(get|post|patch|put|delete)\(\s*['"\x60]$/i.exec(before);
  if (pw) return [pw[1].toUpperCase() as Method];
  if (/action=\s*['"\x60]$/.test(before)) return ['POST'];
  if (/(?:href=|\.href\s*=|new URL\(|goto\(|location\.assign\()\s*['"\x60]$/.test(before)) return ['GET'];
  // The nearest enclosing call whose parentheses contain the path: its own
  // arguments name the method, or it is a GET. `fetch(` and any wrapper alike.
  const open = before.lastIndexOf('(');
  if (open !== -1 && /\w\s*$/.test(before.slice(0, open))) {
    const absOpen = pathStart - (before.length - open);
    const close = closingParen(text, absOpen);
    if (close > pathEnd) {
      const args = text.slice(pathEnd, close);
      const m = /method:\s*([^,}\n]+)/i.exec(args);
      if (m) return methodLiterals(m[1]);
      if (/jsonPatch\(/.test(args)) return ['PATCH'];
      if (/jsonPost\(/.test(args)) return ['POST'];
      return ['GET'];
    }
  }
  // A bare string — a constant, a table entry — is fetched somewhere else
  // with a method this scan cannot see. Indirect satisfies any verb.
  return 'ANY';
}

export function methodsCalled(routePath: string, sources: string[], skip: { start: number; end: number } | null = null): Set<Method> {
  const pattern = routePathPattern(routePath);
  const called = new Set<Method>();
  for (const text of sources) {
    for (const m of text.matchAll(pattern)) {
      const pathStart = m.index + m[1].length;
      if (skip && pathStart >= skip.start && pathStart < skip.end) continue;
      const methods = methodAtSite(text, pathStart, m.index + m[0].length);
      (methods === 'ANY' ? METHODS : methods).forEach((x) => called.add(x));
    }
  }
  return called;
}

describe('every exported API method has a caller that uses it', () => {
  const routeFiles = walk(API_ROOT).filter((f) => /\/route\.ts$/.test(f));
  const routes = routeFiles.map((file) => ({
    file,
    path: '/' + relative(join(ROOT, 'src', 'app'), file).replace(/\/route\.ts$/, '').split('\\').join('/'),
    methods: exportedMethods(readFileSync(file, 'utf8')),
  }));
  /* Route files are callers too — the Connect onboarding route builds the
     return and refresh URLs, the subscribe route builds the confirm link —
     but a route never counts as its own caller, so each route's scan skips
     the byte range its own file occupies. Comments are masked, so a docblock
     naming a verb is not a call. One blob, one regex pass per route: 185
     routes over ~930 files took ten seconds as a file-by-file scan and about
     two as a single pass. */
  const sourceFiles = CALLER_ROOTS.flatMap((root) => walk(join(ROOT, root)))
    .filter((f) => SOURCE_EXT.test(f) && !/\.test\.tsx?$/.test(f));
  const SEP = '\n\u0000\n';
  const ranges = new Map<string, { start: number; end: number }>();
  let blob = '';
  for (const file of sourceFiles) {
    const text = maskComments(readFileSync(file, 'utf8'));
    ranges.set(file, { start: blob.length, end: blob.length + text.length });
    blob += text + SEP;
  }
  const sources = [blob];
  const skipping = (routeFile: string) => ranges.get(routeFile) ?? null;

  it('scans a plausible corpus', () => {
    expect(routes.length).toBeGreaterThan(100);
    expect(sourceFiles.length).toBeGreaterThan(300);
  });

  it('finds no exported method without a caller (or a named external caller)', { timeout: 60_000 }, () => {
    const orphans: string[] = [];
    for (const route of routes) {
      const called = methodsCalled(route.path, sources, skipping(route.file));
      for (const method of route.methods) {
        const key = `${method} ${route.path}`;
        if (called.has(method) || EXTERNAL_CALLERS[key]) continue;
        orphans.push(key);
      }
    }
    expect(orphans, 'a handler with no caller is a component with no importer: wire it, delete it, or name its outside caller').toEqual([]);
  });

  it('every external-caller entry still names a handler that exists and has no in-repo caller', { timeout: 60_000 }, () => {
    for (const [key, reason] of Object.entries(EXTERNAL_CALLERS)) {
      expect(reason.length, key).toBeGreaterThan(20);
      const [method, path] = key.split(' ') as [Method, string];
      const route = routes.find((r) => r.path === path);
      expect(route, `${key}: route is gone — remove the entry`).toBeDefined();
      expect(route!.methods, `${key}: method no longer exported — remove the entry`).toContain(method);
      expect(methodsCalled(path, sources, skipping(route!.file)).has(method), `${key}: an in-repo caller exists now — remove the entry`).toBe(false);
    }
  });

  it('reads the method from the call site (negative proof)', () => {
    const src = [
      "await postJson('/api/things', body);",
      "await fetch(`/api/things/${id}`, { headers: h, method: 'PATCH' });",
      "const r = await fetch('/api/other'); // no method: GET",
      "<form action=\"/api/things\">",
      "await fetch(`/api/map/${layer}?x=1`);",
      "await request.delete('/api/things/abc');",
      "await albumRequest(`/api/things/${id}/art`, { method: 'DELETE' });",
      "const TABLE = ['/api/table'];",
      "fetch('/api/toggle', { method: on ? 'DELETE' : 'POST' });",
    ].join('\n');
    expect(methodsCalled('/api/things', [src])).toEqual(new Set(['POST']));
    expect(methodsCalled('/api/things/[id]', [src])).toEqual(new Set(['PATCH', 'DELETE']));
    expect(methodsCalled('/api/other', [src])).toEqual(new Set(['GET']));
    expect(methodsCalled('/api/map/artists', [src])).toEqual(new Set(['GET']));
    expect(methodsCalled('/api/things/[id]/art', [src])).toEqual(new Set(['DELETE']));
    expect(methodsCalled('/api/table', [src])).toEqual(new Set(METHODS));
    expect(methodsCalled('/api/toggle', [src])).toEqual(new Set(['POST', 'DELETE']));
    expect(methodsCalled('/api/nothing', [src]).size).toBe(0);
  });
});
