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
 *
 * ## `webcredentials` — and the half that was missing for the life of the app
 *
 * An associated domain is a TWO-SIDED claim and this file is the domain's
 * side of it. `App.entitlements` has claimed `webcredentials:ihype.org` since
 * it was written, with its own comment saying a passkey "cannot scope to a
 * domain inside WKWebView at all" without it — and this route emitted
 * `applinks` and nothing else, so the domain never granted the claim back.
 *
 * iOS therefore could not verify the association, WKWebView held no relying
 * party for `ihype.org`, and `navigator.credentials.get()` threw
 * `NotAllowedError` — surfaced to the member as "The request is not allowed by
 * the user agent or the platform in the current context, possibly because the
 * user denied permission". Nobody had denied anything. Reported from a real
 * handset on 2026-09-15; measured against production the same day, where the
 * served file carried `applinks` alone.
 *
 * **A passkey is one of only two ways into an account here**, so this took out
 * half of native sign-in — and it is invisible to every instrument that reads
 * this repository, because both files were individually correct. Only the
 * PAIRING was wrong, which is the same shape `audit:retired-claims` exists
 * for. `wiring-guards.test.ts` now reads the entitlement's claims and this
 * route's sections and fails when either side names a service the other does
 * not; `check:app-links` asserts the same thing against the live origin.
 *
 * `webcredentials` takes no paths — it is the whole domain or nothing, which
 * is why it carries an `apps` array and no `details`. It is deliberately NOT
 * gated behind a narrower env var: it needs exactly the Team ID the applinks
 * half already needs, so a deploy that can serve one can always serve both.
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
    /* The domain's half of `webcredentials:ihype.org` in App.entitlements.
       Without this key iOS cannot verify the association and every passkey
       ceremony inside the app fails as NotAllowedError. Read the docstring
       before removing it — it is not decoration, it is half of a contract. */
    webcredentials: {
      apps: [`${teamId}.${bundleId}`],
    },
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${bundleId}`,
          /**
           * An ALLOWLIST — a path absent from this array opens in Safari, so
           * paths are allowlisted, with explicit negative rules first for
           * the two security-sensitive surfaces that must always stay in
           * Safari even if a broader rule is added later:
           *
           *   · `/admin` and `/admin/*` — Cloudflare Access owns this surface.
           *   · `/cdn-cgi/access/*` — Cloudflare's one-use OAuth callbacks.
           *
           * The remaining exclusions are made by omission:
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
            // First match wins. Never hand Cloudflare Access state to the app.
            'NOT /admin',
            'NOT /admin/*',
            'NOT /cdn-cgi/access/*',
            '/shows/*',      // the URL that sells tickets, and the one people share
            '/artists/*', '/venues/*', '/fans/*', // redirect into the matching /app pane
            '/playlist/*',
            '/tickets',      // the wallet alias in sent email (a redirects() entry onto /app/tickets; Checkout returns to /shows/<slug>)
            /* One ticket: the "View ticket & QR code" link in every ticket
               email and the string every QR encodes (buildTicketVerificationUrl).
               The legacy `paths` format matches '/tickets' exactly and nothing
               under it, so on an iPhone with the app installed that link
               opened Safari, which has no session and none of the wallet's
               cached tickets (row 513). */
            '/tickets/*',
            /* Sign-up and sign-in (row 513). The access-approval email links
               /register, and a member with the TestFlight app installed then
               registered in Safari and had to sign in again inside the app,
               whose cookie store is its own. */
            '/register', '/login', '/join', '/invite/*',
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
