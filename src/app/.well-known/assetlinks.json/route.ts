import { NextResponse } from 'next/server';

import { readRuntimeEnv } from '@/lib/runtime-env';
import { parseAndroidFingerprints } from '@/lib/android-fingerprints';
import { log } from '@/lib/logger';

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
 * Play Console → **Protected with Play → App signing** (the `/keymanagement`
 * page) → **App signing key certificate** → the **SHA-256** line. It only
 * exists after the first bundle is uploaded, because Play generates the app
 * signing key itself. Take the SHA-256, never the SHA-1 beside it.
 *
 * This said "Test and release → App integrity" until 2026-09-08, and that page
 * now renders nothing but "App Integrity settings have moved" — which cost a
 * real operator four wrong turns. Google has relocated this three times; if the
 * path here is wrong again, `/keymanagement` is the durable part of the URL.
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
 *
 * ## The passkey relation, and the question it answered (2026-09-24, row 513)
 *
 * Read the section below as the reasoning up to that date. The scan found
 * the other half the question was missing: `MainActivity` never turned on
 * WebView WebAuthn (`WebSettingsCompat.setWebAuthenticationSupport`), so a
 * ceremony could not have worked with or without this grant. With the app
 * side in place the grant is the documented pairing, not a speculative one,
 * and it is served. A handset reading is still owed.
 *
 * ## (History) No passkey relation here, and that is a QUESTION rather than a fix
 *
 * The iOS association file gained a `webcredentials` section on 2026-09-15,
 * because the app claimed `webcredentials:ihype.org` and the domain never
 * granted it back, so every passkey inside the WebView failed as
 * `NotAllowedError`. The Android counterpart of that grant is a second
 * relation, `delegate_permission/common.get_login_creds`, and this file does
 * not carry it. That much is measured.
 *
 * What is NOT measured from here is whether adding it would change anything.
 * The Android app is a WebView pointed at ihype.org, and passkey support in a
 * plain `android.webkit.WebView` is not the same question as support in a
 * native activity using Credential Manager — so the relation could be a real
 * missing half, or it could be the served side of a contract the platform
 * cannot honour in a WebView regardless. Nothing in this repository can tell
 * those apart, and no Android handset has been driven against it.
 *
 * So the relation is deliberately NOT added speculatively: a grant published
 * for a capability that cannot work is the same defect in the other
 * direction. Settle it on a real device — does "Sign in with passkey" throw
 * the same `NotAllowedError` in the Android app? — and then either add the
 * relation with that reading recorded, or record that the button should not
 * be offered there at all.
 */
export async function GET() {
  // Via readRuntimeEnv, same reason as the Apple association route: this
  // arrives as a Worker secret and is invisible to process.env on workerd.
  /* VALIDATED, not merely split. The docstring above says "take the SHA-256,
     never the SHA-1 shown directly above it on the same screen" — and this
     used to accept any non-empty string, so following that screen's SHA-1 row
     produced a served, well-formed, permanently-failing association file. A
     wrong fingerprint is worse than none, because Google caches the failure;
     an instruction in a comment is not a check. */
  const { valid, rejected } = parseAndroidFingerprints(
    readRuntimeEnv('ANDROID_CERT_SHA256_FINGERPRINTS'),
  );

  if (rejected.length > 0) {
    /* Named, with the length, because the SHA-1 mistake is invisible by eye:
       both are colon-separated uppercase hex and only the count differs. A
       certificate digest is not a secret — it is published in this very file
       — so logging it costs nothing and saves a day of "why won't it
       verify". */
    log.error(
      '[assetlinks]',
      { rejected: rejected.map((fp) => `${fp} (${fp.replace(/:/g, '').length} hex chars, expected 64)`) },
      'ANDROID_CERT_SHA256_FINGERPRINTS contains entries that are not SHA-256 digests',
    );
  }

  if (valid.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const fingerprints = valid;

  const body = [
    {
      // `get_login_creds` since 2026-09-24 (row 513): MainActivity now turns
      // on WebView passkeys for this app, and Credential Manager asks the
      // domain to grant the app its credentials, as the iOS file's
      // `webcredentials` section does.
      relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
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
