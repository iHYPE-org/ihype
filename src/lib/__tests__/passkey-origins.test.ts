import { describe, expect, it } from 'vitest';
import { androidApkKeyHashOrigin } from '@/lib/android-fingerprints';
import { expectedPasskeyOrigins } from '@/lib/passkey';

/*
 * THE ANDROID APP'S PASSKEY ORIGIN (row 513).
 *
 * MainActivity turns on WebView's app-mode WebAuthn, and in that mode the
 * ceremony's `clientDataJSON.origin` is `android:apk-key-hash:<base64url>`,
 * not the page's origin. The server's expected-origin list has to carry it or
 * every passkey made or used in the app is refused after the device accepted
 * it. The digest below is bytes 0x00..0x1F, so the base64url is checkable by
 * hand.
 */
const FP = '00:01:02:03:04:05:06:07:08:09:0A:0B:0C:0D:0E:0F:10:11:12:13:14:15:16:17:18:19:1A:1B:1C:1D:1E:1F';

describe('passkey expected origins', () => {
  it('turns a SHA-256 certificate digest into the origin Android sends, unpadded', () => {
    expect(androidApkKeyHashOrigin(FP)).toBe('android:apk-key-hash:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8');
  });

  it('accepts the site and every app certificate the site vouches for', () => {
    const other = FP.replace(/^00/, 'FF');
    expect(expectedPasskeyOrigins('https://ihype.org', `${FP}, ${other}`)).toEqual([
      'https://ihype.org',
      'android:apk-key-hash:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
      androidApkKeyHashOrigin(other),
    ]);
  });

  it('is the site alone when no certificate is configured, and never trusts a SHA-1', () => {
    expect(expectedPasskeyOrigins('https://ihype.org', undefined)).toEqual(['https://ihype.org']);
    const sha1 = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD';
    expect(expectedPasskeyOrigins('https://ihype.org', sha1)).toEqual(['https://ihype.org']);
  });
});
