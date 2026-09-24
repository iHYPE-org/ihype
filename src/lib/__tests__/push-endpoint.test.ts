/**
 * A Web Push endpoint is a URL the server POSTs to on every notice, so only a
 * real push service is accepted (2026-09-24, DESIGN_SYNC row 513).
 */
import { describe, expect, it } from 'vitest';
import { isKnownPushEndpoint } from '@/lib/push-endpoint';

describe('isKnownPushEndpoint', () => {
  it('accepts the browser push services', () => {
    for (const url of [
      'https://fcm.googleapis.com/fcm/send/abc:def',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
      'https://web.push.apple.com/QGuQ',
      'https://wns2-by3p.notify.windows.com/w/?token=abc',
    ]) {
      expect(isKnownPushEndpoint(url), url).toBe(true);
    }
  });

  it('refuses any other host, plain http, ports and look-alikes', () => {
    for (const url of [
      'https://example.com/hook',
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com:8443/fcm/send/abc',
      'https://fcm.googleapis.com.evil.test/x',
      'https://evilnotify.windows.com.attacker.test/x',
      'https://127.0.0.1/x',
      'not a url',
    ]) {
      expect(isKnownPushEndpoint(url), url).toBe(false);
    }
  });
});
