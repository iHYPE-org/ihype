import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

/**
 * The browser Sentry SDK is wired through an entry point Next actually loads,
 * with a DSN the deploy actually inlines (DESIGN_SYNC row 443).
 *
 * Until 2026-09-14 the client init lived in a root `sentry.client.config.ts`,
 * which is bundled only by `withSentryConfig` — a plugin this build does not
 * use, because its server half crashed the Worker and `worker.js` wraps the
 * handler with `@sentry/cloudflare` instead. So the file was loaded by
 * nothing, its literals appeared in no client chunk, and the deploy never set
 * `NEXT_PUBLIC_SENTRY_DSN`, so `src/middleware.ts` put no ingest origin into
 * `connect-src`. Row 107 had marked "is the DSN set?" resolved by finding the
 * SERVER variable. Every event the project ever recorded was server-side.
 *
 * Three facts hold it together and each is pinned here because each can be
 * undone by a tidy-looking edit: the entry point is the one Next loads; the
 * deploy inlines the browser DSN at BUILD (a NEXT_PUBLIC_ value set only at
 * deploy time reaches nothing); and the browser DSN is the same Sentry project
 * as the Worker's, so a browser error and the server error it caused land in
 * one place.
 */

const ROOT = process.cwd();
const read = (rel: string) => maskComments(readFileSync(join(ROOT, rel), 'utf8'));

describe('browser Sentry wiring', () => {
  it('the client init lives in the entry point Next loads, and nowhere else', () => {
    expect(existsSync(join(ROOT, 'src/instrumentation-client.ts'))).toBe(true);
    const entry = read('src/instrumentation-client.ts');
    expect(entry).toMatch(/process\.env\.NEXT_PUBLIC_SENTRY_DSN/);
    /* The SDK is a DYNAMIC import (row 511): a static one put 564 KB into the
       chunk every page evaluates before hydration. The router hook must still
       be exported, and must reach the loaded module rather than a static
       binding — a static `Sentry.` reference here is the whole bundle back. */
    expect(entry).toContain("import('@sentry/nextjs')");
    expect(entry).not.toMatch(/^import \* as Sentry from '@sentry\/nextjs'/m);
    expect(entry).toMatch(/export function onRouterTransitionStart\(/);
    expect(entry).toMatch(/captureRouterTransitionStart\(href, navigationType\)/);
    /* The wizard's root files are entry points only under withSentryConfig,
       which next.config.mjs must not adopt (see worker.js). Their return
       would be a second, dead copy of this init. */
    expect(existsSync(join(ROOT, 'sentry.client.config.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'sentry.server.config.ts'))).toBe(false);
    expect(read('next.config.mjs')).not.toMatch(/withSentryConfig/);
  });

  it('the deploy inlines the browser DSN at build, and it is the Worker\'s project', () => {
    const deploy = readFileSync(join(ROOT, '.github/workflows/deploy-production.yml'), 'utf8');
    const buildStep = deploy.slice(deploy.indexOf('name: Build for Cloudflare Workers'), deploy.indexOf('- name:', deploy.indexOf('name: Build for Cloudflare Workers') + 10));
    const inlined = buildStep.match(/NEXT_PUBLIC_SENTRY_DSN:\s*"?(https:\/\/[^"\s]+)"?/);
    expect(inlined, 'the build step must set NEXT_PUBLIC_SENTRY_DSN, or the browser SDK and connect-src both go silent').not.toBeNull();
    const workerDsn = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8').match(/^SENTRY_DSN\s*=\s*"([^"]+)"/m);
    expect(workerDsn).not.toBeNull();
    expect(inlined![1]).toBe(workerDsn![1]);
    expect(new URL(inlined![1]).hostname).toMatch(/\.ingest\.[a-z]+\.sentry\.io$/);
  });

  it('the CSP reads the same variable, so the report can leave the page', () => {
    const middleware = read('src/middleware.ts');
    expect(middleware).toMatch(/process\.env\.NEXT_PUBLIC_SENTRY_DSN/);
    expect(middleware).toMatch(/connect-src[^\n]*sentryIngestOrigin\(\)/);
  });

  it('reports App Router root render failures from the global error boundary', () => {
    const boundary = read('src/app/global-error.tsx');
    expect(boundary).toContain("import('@sentry/nextjs')");
    expect(boundary).toContain('Sentry.captureException(error)');
  });
});
