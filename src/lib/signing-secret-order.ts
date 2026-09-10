/**
 * The rotation ORDER, alone, with no imports — so the edge bundle can have it.
 *
 * `signing-secrets.ts` is the module every signer reads, and it pulls in
 * `runtime-env` to reach a Worker secret. `auth.config.ts` cannot: it is
 * imported by middleware and must stay free of Node-only reach. Both need the
 * same ordering rule, and a second copy of it is exactly how the signer and
 * the verifier end up disagreeing about which key is current — so the rule
 * lives here once and both import it.
 *
 * Newest first: `[AUTH_SECRET_3?, AUTH_SECRET_2?, AUTH_SECRET_1?, AUTH_SECRET]`,
 * mirroring `@auth/core`'s own `setEnvDefaults`. The first entry signs; every
 * entry can verify.
 */

/* Shorter than this is a typo or a placeholder, not a key. Refusing it here
   means a mistyped rotation secret is ignored rather than becoming the key
   everything is signed with. */
export const MIN_SIGNING_SECRET_LENGTH = 16;

/** Newest first, mirroring `@auth/core`'s `setEnvDefaults` exactly. Pure over an env map. */
export function orderSigningSecrets(env: Record<string, string | undefined>): string[] {
  const usable = (value: string | undefined) =>
    typeof value === 'string' && value.trim().length >= MIN_SIGNING_SECRET_LENGTH ? value.trim() : null;

  const secrets: string[] = [];
  const base = usable(env.AUTH_SECRET);
  if (base) secrets.push(base);
  for (const i of [1, 2, 3]) {
    const rotated = usable(env[`AUTH_SECRET_${i}`]);
    if (rotated) secrets.unshift(rotated);
  }
  return secrets;
}
