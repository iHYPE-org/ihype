import { NextResponse } from 'next/server';

import { readRuntimeEnv } from '@/lib/runtime-env';

/**
 * Android App Links association file, served at exactly this path over HTTPS.
 * Android verifies it against the signing certificate of the installed app, and
 * every intent filter marked `android:autoVerify="true"` then opens in the app
 * rather than the browser.
 *
 * ## 404 WHEN UNCONFIGURED — it used to answer 200 with an empty list
 *
 * Until 2026-09-04 this returned HTTP 200 carrying
 * `"sha256_cert_fingerprints": []` whenever the env var was unset, described in
 * its own comment as "inert". It is not inert. Google fetches the file, finds
 * no fingerprint matching the installed app, and **caches a verification
 * FAILURE** — the same outcome a malformed file produces, and one both
 * platforms hold for days.
 *
 * That is precisely the hazard `CLAUDE.md` records for the generator script:
 * "a placeholder is worse than an absent file, because with no file links
 * simply open in the browser while a malformed one is cached as a verification
 * FAILURE". The rule was written down and then contradicted by a route serving
 * the placeholder shape at the same URL.
 *
 * So: no fingerprints, no file. An absent file degrades honestly — links open
 * in the browser, which is the pre-App-Links behaviour and costs nothing.
 *
 * ## Where the fingerprint comes from
 *
 * Play Console → your app → Test and release → **App integrity** → App signing
 * key certificate → the **SHA-256** line. It only exists after the first bundle
 * is uploaded, because Play generates the app signing key itself. Take the
 * SHA-256, never the SHA-1 shown directly above it on the same screen.
 *
 * Set BOTH once you have them, comma-separated: the Play app-signing
 * certificate AND your upload certificate. A build installed from a locally
 * signed APK carries the upload cert, so with only the Play fingerprint your
 * own test installs fail verification while store installs pass — a difference
 * that reads as flakiness.
 *
 *     npx wrangler secret put ANDROID_CERT_SHA256_FINGERPRINTS
 *
 * ## No path filtering, deliberately noted
 *
 * Unlike Apple's file, `delegate_permission/common.handle_all_urls` is
 * all-or-nothing: once verified, EVERY ihype.org link opens the app, including
 * `/api/auth/magic?token=…`. That is a real asymmetry with the Apple file,
 * which excludes the auth paths — if magic-link sign-in must stay in the
 * browser on Android too, that has to be solved in the intent filters in
 * AndroidManifest.xml, not here.
 */
export async function GET() {
  // Via readRuntimeEnv, same reason as the Apple association route: this
  // arrives as a Worker secret and is invisible to process.env on workerd.
  const fingerprints = (readRuntimeEnv('ANDROID_CERT_SHA256_FINGERPRINTS') ?? '')
    .split(',')
    .map((fp) => fp.trim())
    .filter(Boolean);

  if (fingerprints.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.ihype.app',
        sha256_cert_fingerprints: fingerprints
      }
    }
  ];

  return NextResponse.json(body, {
    headers: { 'Content-Type': 'application/json' }
  });
}
