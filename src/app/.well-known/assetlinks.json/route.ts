import { NextResponse } from 'next/server';

/**
 * Android App Links association file, served at exactly this path
 * (literal .json extension) over HTTPS. Android verifies this against the
 * signing certificate of the installed APK at install time — every intent
 * filter marked `android:autoVerify="true"` in AndroidManifest.xml then opens
 * directly in the app instead of the browser.
 *
 * Inert (empty `sha256_cert_fingerprints`) until ANDROID_CERT_SHA256_FINGERPRINTS
 * is set — that fingerprint comes from the real upload/signing keystore,
 * which doesn't exist yet (needs a Google Play Console account + keystore,
 * see DESIGN_SYNC.md row 111). Comma-separate multiple fingerprints (e.g.
 * both the Play "app signing" cert and a local upload cert) once available.
 */
export async function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((fp) => fp.trim())
    .filter(Boolean);

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
