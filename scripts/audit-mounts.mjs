#!/usr/bin/env node
/**
 * Components that exist and are rendered by nothing.
 *
 * ## Why this is not covered by anything else
 *
 * `audit:routes` counts surfaces a member can reach. `audit:shell` and
 * `audit:retro` ask whether a component is NAMED and PAINTED correctly. None of
 * them can see a component that is written, styled, tested, backed by a live
 * API route — and imported by no page at all. TypeScript cannot either: an
 * unused module is not an error, it is just a module.
 *
 * That gap cost this project ten features at once (2026-09-03). Among them the
 * offline wallet, the free-use crate, the community roadmap board, and the
 * owner's broadcast to their own followers. Every one had a real route behind
 * it and every one was dark, some for months, because the surface they used to
 * live on was retired and nothing failed when they were left behind.
 *
 * A retired page takes its mounts with it silently. This is the check that
 * makes that loud.
 *
 * ## What counts as a mount
 *
 * Being REACHABLE from a page, layout or route handler under `src/app/`,
 * following imports transitively. Reachability rather than "is imported by
 * something" on purpose: a barrel that re-exports a component is not a mount,
 * and neither is a component imported only by another component nobody renders.
 * Both would otherwise vouch for each other forever.
 *
 * A file only NAMED in a comment does not count either — that is exactly how
 * `ArtistMediaPlaylist` and `BookingRequestInbox` read as live while being
 * mounted nowhere.
 *
 * ## The ratchet
 *
 * `--max=N` is the number of unmounted components tolerated. It reached 0 on
 * 2026-09-03 and is a gate rather than a countdown. **Never raise it.** The way
 * to satisfy this check is to mount the component or delete it; a component
 * nobody renders is either a missing surface or dead code, and both have a fix.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const maxArg = process.argv.find((arg) => arg.startsWith('--max='));
const max = maxArg ? Number.parseInt(maxArg.slice('--max='.length), 10) : Number.POSITIVE_INFINITY;

if (!existsSync('src/components')) {
  console.error('audit:mounts found no src/components — run it from the repository root.');
  process.exit(1);
}

/**
 * Deliberately unmounted, with the reason. An exemption here is a RECORD that
 * someone decided this, not a way to quiet the check.
 */
const EXEMPT = [
  {
    prefix: 'src/components/ds/',
    why:
      'Generated from the design system by `vendor:ds` and guarded by `guard:ds`. '
      + 'CLAUDE.md: the console dock is a translation of the dc.html and NOTHING MOUNTS '
      + 'the vendored trio — their own JSX rebuilds break at 74px. They are kept so the '
      + 'generator has something to check against, not to render.',
  },
];

function exemptionFor(file) {
  return EXEMPT.find((entry) => file.startsWith(entry.prefix)) ?? null;
}

const components = execSync("find src/components -name '*.tsx'", { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

/* A format change that makes this list empty must fail rather than report a
   triumphant zero — the same reason `audit:routes` exits 1 on zero entries. */
if (components.length === 0) {
  console.error('audit:mounts collected no component files. That is a bug in this script, not a clean repo.');
  process.exit(1);
}

const sources = execSync(
  "find src -type f \\( -name '*.ts' -o -name '*.tsx' \\)",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean);

/** Comments stripped: a component named in prose is not a mount. */
function code(file) {
  try {
    return readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '\n')
      .replace(/(^|[^:])\/\/.*/g, '$1');
  } catch { return ''; }
}

const bodies = new Map(sources.map((file) => [file, code(file)]));

/** Every module specifier an `import`/`export … from`/`import()` names. */
function specifiers(body) {
  const found = [];
  for (const match of body.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) found.push(match[1]);
  return found;
}

/** A specifier resolved to a file in this repo, or null for a package. */
function resolve(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) {
    const dir = fromFile.split('/').slice(0, -1).join('/');
    base = new URL(spec, `file:///${dir}/`).pathname.replace(/^\//, '');
  } else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (bodies.has(candidate)) return candidate;
  }
  return null;
}

/* Roots: anything the router itself renders or runs. */
const roots = sources.filter((file) =>
  /^src\/app\/.*\/(page|layout|template|loading|error|not-found|route|default|opengraph-image|icon)\.tsx?$/.test(file)
  || /^src\/app\/(layout|page|error|global-error|not-found|loading|robots|sitemap|opengraph-image)\.tsx?$/.test(file)
  || file === 'src/middleware.ts');

if (roots.length === 0) {
  console.error('audit:mounts found no routable entry points under src/app. That is a bug in this script.');
  process.exit(1);
}

const reachable = new Set();
const queue = [...roots];
while (queue.length) {
  const file = queue.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  for (const spec of specifiers(bodies.get(file) ?? '')) {
    const target = resolve(file, spec);
    if (target && !reachable.has(target)) queue.push(target);
  }
}

const unmounted = [];
const exempted = [];
for (const file of components) {
  if (reachable.has(file)) continue;
  const exemption = exemptionFor(file);
  if (exemption) exempted.push(file);
  else unmounted.push(file);
}

console.log(
  `${components.length} component file(s) · ${roots.length} routable entry point(s) · `
  + `${unmounted.length} rendered by nothing` + (exempted.length ? ` · ${exempted.length} exempt` : '') + '\n',
);
for (const file of unmounted) console.log(`  ${file}`);
if (exempted.length) {
  console.log(`\n  Exempt (${exempted.length}): ${EXEMPT.map((entry) => entry.prefix).join(', ')}`);
  for (const entry of EXEMPT) console.log(`    ${entry.prefix} — ${entry.why}`);
}

if (unmounted.length > max) {
  console.error(
    `\nFAIL: ${unmounted.length} component(s) no route can reach, budget ${max}.`
    + '\nMount it on the surface it was written for, or delete it. A component'
    + '\nnobody renders is either a missing surface or dead code.',
  );
  process.exit(1);
}
if (Number.isFinite(max)) console.log(`\nOK — within the budget of ${max}.`);
