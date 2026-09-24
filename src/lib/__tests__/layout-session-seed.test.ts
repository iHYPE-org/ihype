/**
 * The root layout seeds next-auth's SessionProvider with the session it
 * rendered (2026-09-24, DESIGN_SYNC row 513).
 *
 * Unseeded, the provider starts in `loading` and fetches /api/auth/session on
 * mount, so every document load painted the header without its four
 * destinations and waited a round trip for them. The seed must also never cost
 * a page: a failed read hands the provider `undefined`, which fetches as
 * before.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/app/layout.tsx', 'utf8');
const providers = readFileSync('src/components/AppProviders.tsx', 'utf8');

describe('root layout session seed', () => {
  it('hands the server session to AppProviders, and AppProviders hands it to SessionProvider', () => {
    expect(layout).toMatch(/<AppProviders[^>]*session=\{session\}/);
    expect(providers).toMatch(/<SessionProvider session=\{session\}>/);
  });

  it('reads the session through a helper that turns a failure into undefined, never a thrown page', () => {
    const helper = layout.slice(layout.indexOf('async function readLayoutSession'), layout.indexOf('export default async function RootLayout'));
    expect(helper).toMatch(/try \{\s*return await auth\(\);\s*\} catch \{\s*return undefined;/);
    expect(layout).not.toMatch(/const session = await auth\(\)/);
  });
});
