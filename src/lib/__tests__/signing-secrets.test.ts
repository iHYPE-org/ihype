import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { orderSigningSecrets } from '@/lib/signing-secrets';
import { maskComments } from '../../../scripts/lib/mask-comments.mjs';

const long = (tag: string) => `${tag}-secret-that-is-long-enough-0000`;

describe('orderSigningSecrets — Auth.js’s order, so one rotation procedure serves every signer', () => {
  it('returns the base secret alone when nothing is rotating', () => {
    expect(orderSigningSecrets({ AUTH_SECRET: long('base') })).toEqual([long('base')]);
  });

  it('puts the numbered (newer) secret FIRST, as @auth/core does, so it signs and the old one still verifies', () => {
    expect(orderSigningSecrets({ AUTH_SECRET: long('old'), AUTH_SECRET_1: long('new') })).toEqual([long('new'), long('old')]);
    expect(orderSigningSecrets({ AUTH_SECRET: long('a'), AUTH_SECRET_1: long('b'), AUTH_SECRET_2: long('c') })).toEqual([long('c'), long('b'), long('a')]);
  });

  it('ignores a short or blank value rather than signing with it', () => {
    expect(orderSigningSecrets({ AUTH_SECRET: long('base'), AUTH_SECRET_1: 'short' })).toEqual([long('base')]);
    expect(orderSigningSecrets({ AUTH_SECRET: '   ' })).toEqual([]);
    expect(orderSigningSecrets({})).toEqual([]);
  });

  it('matches @auth/core’s own assembly of the same variables', () => {
    // The dependency's source is the reference: if its order ever changes, this
    // fails here rather than as sessions signed with one key and tokens with another.
    const core = readFileSync('node_modules/@auth/core/lib/utils/env.js', 'utf8');
    expect(core).toContain('AUTH_SECRET_${i}');
    expect(core).toContain('config.secret.unshift(secret)');
  });
});

describe('NextAuth is handed the whole key list, because it will not build one', () => {
  /* THE BUG THIS PINS. `next-auth/lib/env.js` does
     `config.secret ??= process.env.AUTH_SECRET`, a STRING, before delegating
     to `@auth/core`'s `setEnvDefaults` — which only assembles AUTH_SECRET_1..3
     behind `if (!config.secret?.length)`. A non-empty string has a length, so
     that branch never runs under next-auth and the numbered secrets are never
     read. Sessions would then be signed with the newest key and verified
     against the oldest: every member signed out, nobody able to sign back in,
     on the only auth path this product has. */

  it('next-auth still assigns a bare string, so relying on it would break a rotation', () => {
    const wrapper = readFileSync('node_modules/next-auth/lib/env.js', 'utf8');
    expect(wrapper).toContain('process.env.AUTH_SECRET');
    const core = readFileSync('node_modules/@auth/core/lib/utils/env.js', 'utf8');
    expect(core).toContain('if (!config.secret?.length)');
  });

  it('authConfig carries every configured key, newest first', async () => {
    const before = { ...process.env };
    process.env.AUTH_SECRET = long('old');
    process.env.AUTH_SECRET_1 = long('new');
    vi.resetModules();
    const { authConfig } = await import('@/lib/auth.config');
    expect(Array.isArray(authConfig.secret)).toBe(true);
    expect(authConfig.secret).toEqual([long('new'), long('old')]);
    process.env = before;
    vi.resetModules();
  });

  it('is unchanged from today when nothing is rotating', async () => {
    const before = { ...process.env };
    process.env.AUTH_SECRET = long('only');
    delete process.env.AUTH_SECRET_1;
    delete process.env.AUTH_SECRET_2;
    delete process.env.AUTH_SECRET_3;
    vi.resetModules();
    const { authConfig } = await import('@/lib/auth.config');
    expect(authConfig.secret).toEqual([long('only')]);
    process.env = before;
    vi.resetModules();
  });
});

describe('nothing reads the signing secret except signing-secrets.ts', () => {
  /* One signer reading `AUTH_SECRET` by hand is one signer that fails to
     rotate: it keeps signing with the old key after every other surface moved,
     and the mismatch presents as members logged out or receipts refused. The
     three allowed readers only test for PRESENCE (is anything configured?),
     never sign or verify. */
  const allowed = new Set([
    'src/lib/signing-secrets.ts',
    'src/lib/signing-secret-order.ts', // the ordering rule itself, imported by both readers
    'src/lib/env.ts',            // the zod schema declares it
    'src/lib/health.ts',         // "Set AUTH_SECRET for session signing." — presence only
    'src/app/api/auth/magic/route.ts', // refuses to run with none configured — presence only
    'src/app/status/page.tsx',   // shows whether it is configured
  ]);

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === '__tests__' || name === 'node_modules') continue;
        walk(full, out);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        out.push(full);
      }
    }
    return out;
  }

  it('holds', () => {
    const readers = walk('src').filter((file) => {
      if (allowed.has(file)) return false;
      /* Comments are masked first. A file that EXPLAINS the rule names the
         variable in prose — `auth.config.ts` documents why NextAuth must be
         handed the list — and matching that prose flags the one file that
         got the rule right. The same blindness had `audit-css.mjs` deleting
         live exemptions and the i18n extractor inventing a phantom key, so
         the masker is shared rather than re-written a third time. */
      const source = maskComments(readFileSync(file, 'utf8'));
      return /readRuntimeEnv\('AUTH_SECRET'\)|env\.AUTH_SECRET\b|process\.env\.AUTH_SECRET\b/.test(source);
    });
    expect(readers, 'these read AUTH_SECRET directly — go through signing-secrets.ts').toEqual([]);
  });
});
