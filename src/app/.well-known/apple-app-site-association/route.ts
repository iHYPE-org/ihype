import { NextResponse } from 'next/server';

import { readRuntimeEnv } from '@/lib/runtime-env';

/**
 * iOS Universal Links association file. No file extension, exactly this path,
 * HTTPS, and **no redirect** — iOS fetches it once per install and caches it.
 *
 * ## It was answering HTTP 307 to /login, so it could never have worked
 *
 * Measured on production 2026-09-04. `isStaticAsset()` in
 * `src/lib/auth-redirects.ts` calls a path static when its last segment
 * contains a dot; `apple-app-site-association` has no extension, so
 * default-deny caught it. Apple's CDN does not follow redirects — it records
 * the domain as unverified and stops. The route was correct the whole time and
 * served correct JSON to anyone already signed in, which is why nothing here
 * noticed. `.well-known` is now a public prefix by name, with a test.
 *
 * ## 404 when unconfigured, same reason as the Android file
 *
 * This used to return 200 with `details: []`. An absent file means "no
 * association" and links simply open in Safari; a file present and empty is a
 * claim that no app handles this domain, which is a worse thing to have cached.
 *
 * ## The team ID
 *
 * developer.apple.com → Account → Membership details → Team ID: ten uppercase
 * alphanumerics. `npx wrangler secret put APPLE_TEAM_ID`.
 *
 * The iOS target also needs the Associated Domains capability
 * (`applinks:ihype.org`) on the App ID AND in the app's entitlements, or the
 * file is served to nobody. Both halves, or neither works.
 */
export async function GET() {
  // Via readRuntimeEnv: APPLE_TEAM_ID is not in wrangler.toml's [vars], so it
  // arrives as a Worker secret, which never lands on process.env.
  const teamId = readRuntimeEnv('APPLE_TEAM_ID');
  const bundleId = 'com.ihype.app';

  if (!teamId) {
    return new NextResponse('Not found', { status: 404 });
  }

  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${bundleId}`,
          /**
           * An ALLOWLIST — a path absent from this array opens in Safari, so
           * the exclusions that matter are made by omission and are listed
           * here so the omission reads as a decision:
           *
           *   · `/api/*`, `/login`, `/register`, `/auth/*` — the magic-link
           *     and passkey ceremonies must finish in the browser that STARTED
           *     them. A magic link that opens the app hands the token to a
           *     WebView with no pending challenge and strands the member.
           *   · `/.well-known/*` — fetched by the OS, never tapped.
           *
           * `/radio` was in this list and is a DELETED route (the always-on
           * station is a tab of `/app/music`), so it claimed a URL that 404s.
           */
          paths: [
            '/shows/*',      // the URL that sells tickets, and the one people share
            '/artists/*', '/venues/*', '/fans/*', // redirect into the matching /app pane
            '/playlist/*',
            '/tickets',      // Stripe Checkout's success_url lands here
            '/h/*',          // HYPE short links
            '/app/*',        // every in-app destination, once signed in
          ],
        },
      ],
    },
  };

  return NextResponse.json(body, {
    headers: { 'Content-Type': 'application/json' }
  });
}
