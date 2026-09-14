import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * `.env.example` describes the product that exists, in both directions.
 *
 * It is the first file a new developer copies (README, "Local setup", step 1)
 * and the operator's inventory of what production can be configured with, and
 * nothing compared it to the code. By 2026-09-14 it named six SMTP settings
 * (the mailer is Resend and has no SMTP path), an OpenAI key (AI is Workers
 * AI), a Vercel Blob token (media is R2 through the Worker binding), a Stripe
 * publishable key (checkout is Stripe-hosted; no Stripe.js) and the signing
 * secret of a webhook route deleted in July — while omitting CRON_SECRET,
 * which `/api/health` reports as a launch blocker when unset, and two
 * variables `npm run check:alpha` REQUIRES. `src/lib/env.ts` declared the same
 * dead names in its schema, and `check:alpha` told an operator to configure
 * OpenAI. Same class as `audit:doc-paths`: a documented name resolving to
 * nothing is not broken today and misdirects whoever reads it next.
 *
 * Three rules, each read from the artefacts:
 *   1. Every variable the app reads (`readRuntimeEnv('X')`, `process.env.X`
 *      in src/ and workers/, or a key of env.ts's schema) is declared — in
 *      `.env.example`, in `wrangler.toml`'s `[vars]`, or in the allowlist
 *      below, each entry of which says why a developer never sets it.
 *   2. Every variable `.env.example` names is read by something — the app,
 *      a script, the Prisma config, a workflow.
 *   3. env.ts's schema holds only the keys the mailer reads through the proxy
 *      and the two validations that fail a missing secret loudly.
 * Plus: every key `check:alpha` names is in `.env.example`, so the file an
 * operator copies and the check they run agree.
 */

const ROOT = process.cwd();

/** Read by the runtime and never set by hand; each carries its reason. */
const NEVER_SET_BY_HAND: Record<string, string> = {
  NODE_ENV: 'set by the runtime and the build',
  NEXT_PUBLIC_APP_VERSION: 'stamped by the deploy workflow from the commit',
  E2E_HARNESS: 'set by scripts/e2e-workerd.mjs for its own workerd child only',
  NEXTAUTH_URL: 'Auth.js v4 name, read only as a last fallback behind AUTH_URL',
};

/** Declared in wrangler.toml's [vars] and so present on every Worker. */
function wranglerVars(): Set<string> {
  const toml = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8');
  const start = toml.indexOf('\n[vars]');
  const end = toml.indexOf('\n[', start + 1);
  const block = toml.slice(start, end === -1 ? undefined : end);
  return new Set([...block.matchAll(/^([A-Z][A-Z0-9_]+)\s*=/gm)].map((match) => match[1]));
}

function exampleNames(): string[] {
  const text = readFileSync(join(ROOT, '.env.example'), 'utf8');
  /* Commented-out entries (`# LOG_LEVEL="info"`) count as documented: the
     file is an inventory, and a variable a developer should not set by
     default is still one they must be able to find. */
  return [...text.matchAll(/^#?\s?([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]);
}

function walk(dir: string, keep: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? entry.name === 'node_modules' ? [] : walk(join(dir, entry.name), keep)
      : keep(entry.name) ? [join(dir, entry.name)] : [],
  );
}

const READ_PATTERNS = [
  /readRuntimeEnv\(\s*'([A-Z][A-Z0-9_]+)'/g,
  /process\.env\.([A-Z][A-Z0-9_]+)/g,
  /process\.env\[\s*'([A-Z][A-Z0-9_]+)'\s*\]/g,
];

function readsIn(files: string[]): Map<string, string[]> {
  const reads = new Map<string, string[]>();
  for (const file of files) {
    const text = maskComments(readFileSync(file, 'utf8'));
    for (const pattern of READ_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        const list = reads.get(match[1]) ?? [];
        list.push(file.slice(ROOT.length + 1));
        reads.set(match[1], list);
      }
    }
  }
  return reads;
}

function schemaKeys(): string[] {
  const source = maskComments(readFileSync(join(ROOT, 'src/lib/env.ts'), 'utf8'));
  const start = source.indexOf('const envSchema = z.object({');
  const block = source.slice(start, source.indexOf('\n});', start));
  return [...block.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1]);
}

describe('.env.example', () => {
  const appFiles = [
    ...walk(join(ROOT, 'src'), (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)),
    ...walk(join(ROOT, 'workers'), (name) => /\.ts$/.test(name)),
  ];
  const appReads = readsIn(appFiles);
  const example = exampleNames();
  const declared = new Set([...example, ...wranglerVars(), ...Object.keys(NEVER_SET_BY_HAND)]);

  it('collected enough to judge', () => {
    expect(appFiles.length).toBeGreaterThan(200);
    expect(appReads.size).toBeGreaterThan(40);
    expect(example.length).toBeGreaterThan(30);
    expect(wranglerVars().has('R2_PUBLIC_BASE_URL')).toBe(true);
  });

  it('every variable the app reads is declared somewhere a developer can find it', () => {
    const undeclared = [...appReads.keys(), ...schemaKeys()]
      .filter((name) => !declared.has(name))
      .map((name) => `${name} (${(appReads.get(name) ?? ['src/lib/env.ts']).slice(0, 2).join(', ')})`);
    expect(undeclared, 'add each to .env.example (commented if not for local use) or to NEVER_SET_BY_HAND with a reason').toEqual([]);
  });

  it('every variable .env.example names is read by something', () => {
    const everything = readsIn([
      ...appFiles,
      ...walk(join(ROOT, 'scripts'), (name) => /\.(mjs|mts|ts)$/.test(name)),
      ...walk(join(ROOT, 'prisma'), (name) => /\.ts$/.test(name)),
      join(ROOT, 'prisma.config.ts'),
      join(ROOT, 'worker.js'),
    ].filter((file) => existsSync(file)));
    const workflows = walk(join(ROOT, '.github'), (name) => /\.ya?ml$/.test(name))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const stale = example.filter((name) => !everything.has(name) && !new RegExp(`\\b${name}\\b`).test(workflows));
    expect(stale, 'a name nothing reads is a claim about a vendor or a feature; delete it').toEqual([]);
  });

  it('env.ts declares only what the mailer reads through the proxy, plus the two loud validations', () => {
    const proxyReaders = appFiles.filter((file) => /import \{[^}]*\benv\b[^}]*\} from '@\/lib\/env'/.test(maskComments(readFileSync(file, 'utf8'))));
    const proxyReads = new Set<string>();
    for (const file of proxyReaders) {
      for (const match of maskComments(readFileSync(file, 'utf8')).matchAll(/(?<!process\.)\benv\.([A-Z][A-Z0-9_]+)/g)) proxyReads.add(match[1]);
    }
    expect(proxyReaders.map((file) => file.slice(ROOT.length + 1))).toEqual(['src/lib/mailer.ts']);
    const dead = schemaKeys().filter((key) => !proxyReads.has(key) && key !== 'DATABASE_URL' && key !== 'AUTH_SECRET');
    expect(dead, 'a schema key nothing reads through the proxy is a dead declaration').toEqual([]);
    for (const key of proxyReads) expect(schemaKeys(), `mailer reads env.${key} but the schema does not declare it`).toContain(key);
  });

  it('every key check:alpha names is in .env.example', () => {
    const check = maskComments(readFileSync(join(ROOT, 'scripts/beta-launch-check.mjs'), 'utf8'));
    const keys = [...check.matchAll(/key:\s*'([A-Z][A-Z0-9_]+)'/g)].map((match) => match[1]);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.filter((key) => !example.includes(key))).toEqual([]);
  });

  it('the scan refuses a probe it should catch (live in both directions)', () => {
    /* A ghost read would be reported: the allowlist is names, not a pattern. */
    expect(declared.has('GHOST_VARIABLE_NOBODY_DECLARES')).toBe(false);
    /* And the read patterns see all three shapes. */
    const probe = "readRuntimeEnv('ALPHA_X'); process.env.BETA_X; process.env['GAMMA_X']";
    const seen = READ_PATTERNS.flatMap((pattern) => [...probe.matchAll(pattern)].map((match) => match[1]));
    expect(seen.sort()).toEqual(['ALPHA_X', 'BETA_X', 'GAMMA_X']);
  });
});
