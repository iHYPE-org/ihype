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
           *   · `/login`, `/register`, `/auth/*`, the rest of `/api/*` — a
           *     PASSKEY ceremony must finish in the browser that started it:
           *     handing an assertion to a WebView with no pending challenge
           *     strands the member.
           *   · `/.well-known/*` — fetched by the OS, never tapped.
           *
           * `/radio` was in this list and is a DELETED route (the always-on
           * station is a tab of `/app/music`), so it claimed a URL that 404s.
           *
           * ## `/api/auth/magic` IS included, reversing what this comment said
           *
           * The exclusion above used to cover the magic link too, on the
           * reasoning that it "hands the token to a WebView with no pending
           * challenge". That is true of a passkey and false of a magic link:
           * the token is a bearer secret consumed server-side by this GET, and
           * there is no challenge to be pending. Nothing was stranded by
           * including it — the opposite was true.
           *
           * What the exclusion actually cost is the whole of native sign-in.
           * A member taps Continue in the app, opens Mail, taps the link — it
           * opens SAFARI, the session cookie is set there, and the app they
           * started in stays signed out with no way forward. Magic link is one
           * of iHYPE's only two sign-ins and it could not complete inside the
           * app at all.
           *
           * Note Android was never in this state: `assetlinks.json` grants
           * `handle_all_urls`, which is all-or-nothing, so once verified every
           * ihype.org link already opens the app there — the magic link
           * included. iOS was the outlier, and this is the two platforms
           * agreeing rather than a new behaviour.
           *
           * The cost, stated because it is real: a member signing in from
           * mobile Safari with the app installed now lands in the APP rather
           * than back in the tab they started in. That is the better
           * destination for an app-first product, and it is the same trade
           * Android has always made.
           */
          paths: [
            '/shows/*',      // the URL that sells tickets, and the one people share
            '/artists/*', '/venues/*', '/fans/*', // redirect into the matching /app pane
            '/playlist/*',
            '/tickets',      // Stripe Checkout's success_url lands here
            '/h/*',          // HYPE short links
            '/app/*',        // every in-app destination, once signed in
            '/api/auth/magic', // sign-in must be able to FINISH in the app
          ],
        },
      ],
    },
  };

  return NextResponse.json(body, {
    headers: { 'Content-Type': 'application/json' }
  });
}
