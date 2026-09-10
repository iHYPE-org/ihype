# Runbook — Rotating the signing secret

**Owner:** admin@ihype.org · **Cadence:** on suspicion of exposure, on an operator leaving, or yearly · **Time needed:** two `wrangler secret put` calls a day apart

`AUTH_SECRET` signs the session cookie (a 12-hour JWT), the ad play token (a 12-hour receipt that a spot aired), the unsubscribe token in every email, and it is what the magic-link route refuses to run without. Until 2026-09-10 rotating it meant every member signed out at once, every play token in flight refused, and every unsubscribe link ever sent going dead. So it had never been rotated, which is the worse outcome.

## How the window works

Every signer reads the secret through `src/lib/signing-secrets.ts`, which follows the order `@auth/core` already uses for its own numbered secrets: `AUTH_SECRET_1` (then `_2`, `_3`) is the **newest** key and signs everything new; `AUTH_SECRET` is the **oldest** and only verifies. Sessions, play tokens and unsubscribe links signed with either key verify while both are set. `signing-secrets.test.ts` holds that nothing else in `src/` reads the variable directly, because one signer reading it by hand is one signer that fails to rotate.

**NextAuth has to be handed that list, and this is the part that will bite whoever changes it.** `next-auth` sets `config.secret` from bare `AUTH_SECRET` as a plain string, and only then calls `@auth/core`'s own assembly — which builds the numbered array **behind `if (!config.secret?.length)`**, a branch a non-empty string never enters. Left alone, next-auth verifies sessions with the OLD key while this app signs them with the new one, so step 2 below would sign every member out and stop anyone signing back in. `auth.config.ts` therefore passes `secret: orderSigningSecrets(process.env)` explicitly; `signing-secrets.test.ts` pins both halves of that library behaviour so a next-auth bump that changes it fails here rather than in production.

**The two sides read from different places, so check they agree.** The signers reach a Worker secret through the Cloudflare binding; NextAuth's list is built at module scope from `process.env`. A rotation secret visible to one and not the other is the same lockout by another route. `GET /api/health` reports `operations.signingSecrets` as `{ signer, verifier }` — two counts, never a key. **They must be equal before you go past step 3.**

## Procedure

1. Generate a new value: `openssl rand -base64 48`. Never paste it into a chat, an issue or a file in this repository.
2. `npx wrangler secret put AUTH_SECRET_1` and enter the new value. No deploy is needed; the Worker reads secrets at request time. From this moment new sessions and tokens are signed with the new key, and existing ones still verify.
3. Confirm, in this order:
   - `curl -s https://ihype.org/api/health | jq .operations.signingSecrets` must read `{ "signer": 2, "verifier": 2 }`. **If `verifier` is lower than `signer`, stop and roll back step 2** (`npx wrangler secret delete AUTH_SECRET_1`): the new key is invisible to the session verifier and every new sign-in would fail. Set it the same way `AUTH_SECRET` itself is set, then try again.
   - Sign in on one device (a new session, signed with the new key) and stay signed in on another that was signed in before step 2 (an old session, verified against the old key). Both must work.
4. Wait **at least 24 hours** — longer than the 12-hour session and the 12-hour play token. Anything signed with the old key has expired by then.
5. `npx wrangler secret put AUTH_SECRET` and enter the **same new value**, then `npx wrangler secret delete AUTH_SECRET_1`. One live secret again. (Order matters: put before delete, or there is a moment with no secret at all and every request signs out.)

## What a rotation costs

**Unsubscribe links in emails sent before step 5 stop working.** They never expire by design, so they can only ever be verified by the key that signed them. Two acceptable answers, and the choice is a judgement about why you are rotating:

- **A routine rotation** — keep the retired key as `AUTH_SECRET_2` for as long as old emails are likely to be opened (a quarter is reasonable). Links keep working; the retired key can no longer sign anything, and a session forged with it would still be a session, so do this only when the old key is not believed compromised.
- **A suspected exposure** — delete the old key at step 5 and accept the dead links. A member whose old link fails lands on the unsubscribe page's error and can manage notifications from Settings; that is the cost, and it is the right cost when the alternative is honouring a key an attacker may hold.

Also invalidated at step 5, deliberately: admin step-up state and passkey challenges are in KV, not signed, and are untouched; the magic link is a database token and is untouched.

## If something goes wrong

- Everyone signed out after step 2: either the new value is under 16 characters or blank and was ignored — `signing-secrets.ts` refuses a short key rather than signing with it — or `signingSecrets.verifier` did not rise with `signer`, which means NextAuth cannot see the new key. Both are undone by `npx wrangler secret delete AUTH_SECRET_1`; sessions return to the old key immediately.
- Play tokens refused (`bad_signature` on `/api/ads/impression`) after step 5: step 5 ran before 24 hours had passed. Nothing to recover; those impressions are lost delivery, which is the direction this system fails in on purpose.
- Everyone signed out after step 5: `AUTH_SECRET` was deleted rather than put, or put with a different value than `AUTH_SECRET_1`. Put the new value under `AUTH_SECRET` again.
