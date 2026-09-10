import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { orderSigningSecrets } from '@/lib/signing-secrets';

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

describe('nothing reads the signing secret except signing-secrets.ts', () => {
  /* One signer reading `AUTH_SECRET` by hand is one signer that fails to
     rotate: it keeps signing with the old key after every other surface moved,
     and the mismatch presents as members logged out or receipts refused. The
     three allowed readers only test for PRESENCE (is anything configured?),
     never sign or verify. */
  const allowed = new Set([
    'src/lib/signing-secrets.ts',
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
      const source = readFileSync(file, 'utf8');
      return /readRuntimeEnv\('AUTH_SECRET'\)|env\.AUTH_SECRET\b|process\.env\.AUTH_SECRET\b/.test(source);
    });
    expect(readers, 'these read AUTH_SECRET directly — go through signing-secrets.ts').toEqual([]);
  });
});
