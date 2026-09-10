import { readRuntimeEnv } from '@/lib/runtime-env';

/**
 * The signing secret, with a rotation window — the ONE place it is read.
 *
 * `AUTH_SECRET` signs the session JWT, the ad play token, the unsubscribe
 * token and the magic-link confirmation. Until this module, rotating it meant
 * every session ending at once, every play token in flight refused, and every
 * unsubscribe link in every email ever sent going dead — so it was never
 * rotated, which is the worse outcome.
 *
 * THE ORDER IS AUTH.JS'S, NOT OURS, and that is the load-bearing decision.
 * `@auth/core` already reads `AUTH_SECRET_1`, `_2`, `_3` beside `AUTH_SECRET`
 * and builds `[AUTH_SECRET_3?, AUTH_SECRET_2?, AUTH_SECRET_1?, AUTH_SECRET]`:
 * the FIRST entry signs new sessions and every entry can verify an old one
 * (its own docs: "the newer secret should be added to the start"). So on
 * Auth.js's convention the NEW secret goes into the highest numbered slot
 * and `AUTH_SECRET` becomes the old one. Every signer in this repository
 * follows the same rule, read from this same function, so a rotation is one
 * procedure rather than two that disagree about which key is current:
 *
 *   1. `wrangler secret put AUTH_SECRET_1` with the NEW value. From the next
 *      request, sessions and tokens are signed with it; anything signed with
 *      the old `AUTH_SECRET` still verifies.
 *   2. After the longest-lived thing signed by the old key has expired — the
 *      12 h session, the 12 h play token — `wrangler secret put AUTH_SECRET`
 *      with the same new value, then `wrangler secret delete AUTH_SECRET_1`.
 *      One live secret again.
 *
 * Unsubscribe tokens never expire (an old email's link must keep working), so
 * a rotation costs the links in emails sent before it — the same cost any
 * rotation of a non-expiring HMAC has; docs/runbooks/secret-rotation.md says
 * when that is acceptable and when to keep the old key in `AUTH_SECRET_2`
 * for longer.
 *
 * Nothing else may read `AUTH_SECRET` directly; `wiring-guards.test.ts` holds
 * that, because one signer reading the env by hand is one signer that fails
 * to rotate.
 */

const MIN_LENGTH = 16;

/** Newest first, mirroring `@auth/core`'s `setEnvDefaults` exactly. Pure over an env map. */
export function orderSigningSecrets(env: Record<string, string | undefined>): string[] {
  const usable = (value: string | undefined) => (typeof value === 'string' && value.trim().length >= MIN_LENGTH ? value.trim() : null);
  const secrets: string[] = [];
  const base = usable(env.AUTH_SECRET);
  if (base) secrets.push(base);
  for (const i of [1, 2, 3]) {
    const rotated = usable(env[`AUTH_SECRET_${i}`]);
    if (rotated) secrets.unshift(rotated);
  }
  return secrets;
}

/** Every secret a token may have been signed with, newest first. */
export function readSigningSecrets(): string[] {
  return orderSigningSecrets({
    AUTH_SECRET: readRuntimeEnv('AUTH_SECRET'),
    AUTH_SECRET_1: readRuntimeEnv('AUTH_SECRET_1'),
    AUTH_SECRET_2: readRuntimeEnv('AUTH_SECRET_2'),
    AUTH_SECRET_3: readRuntimeEnv('AUTH_SECRET_3'),
  });
}

/** The secret new signatures are made with, or null when none is configured. */
export function currentSigningSecret(): string | null {
  return readSigningSecrets()[0] ?? null;
}
