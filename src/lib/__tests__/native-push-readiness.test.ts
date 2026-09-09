import { afterEach, describe, expect, it } from 'vitest';

import { getNativePushReadiness, isNativePushConfigured } from '@/lib/native-push';

/**
 * Native push has three legs and only one of them is code: the two Firebase
 * client config files (in the repository), the APNs auth key (uploaded in the
 * Firebase console), and these three Worker secrets.
 *
 * The secrets are the leg whose absence is SILENT. `sendNativePushNotification`
 * logs and returns, so the app registers real device tokens, rows land in
 * `NativeDeviceToken`, every console reads healthy, and nothing is ever
 * delivered. Before `getNativePushReadiness` existed, the only way to learn
 * that was a physical device — which is why it is reported in `/api/health`
 * and why it is tested here rather than assumed.
 *
 * What it deliberately does NOT claim: that a push arrives. FCM proxies to
 * APNs for iOS only once the auth key is uploaded, and that is Apple-side
 * state this codebase cannot read. A green reading means configured, not
 * working — see docs/runbooks/push-setup.md.
 */
const KEYS = ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'] as const;

function setAll() {
  process.env.FCM_PROJECT_ID = 'ihype-test';
  process.env.FCM_CLIENT_EMAIL = 'svc@ihype-test.iam.gserviceaccount.com';
  process.env.FCM_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n';
}

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('native push readiness', () => {
  it('is not ready when nothing is set, and names all three', () => {
    const { ready, blockers } = getNativePushReadiness();
    expect(ready).toBe(false);
    expect(blockers).toHaveLength(3);
    for (const key of KEYS) {
      expect(blockers.some((blocker) => blocker.includes(key)), `no blocker names ${key}`).toBe(true);
    }
  });

  it('is ready when all three are set', () => {
    setAll();
    expect(getNativePushReadiness()).toEqual({ ready: true, blockers: [] });
    expect(isNativePushConfigured()).toBe(true);
  });

  // Two of three is the state an operator lands in by pasting one secret
  // wrong, and it must not read as ready — a partial config fails exactly
  // like no config, with no extra signal.
  it.each(KEYS)('is not ready when only %s is missing', (missing) => {
    setAll();
    delete process.env[missing];

    const { ready, blockers } = getNativePushReadiness();
    expect(ready).toBe(false);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain(missing);
  });

  // An empty string is what a fumbled `wrangler secret put` leaves behind —
  // the secret exists, so a presence check on the key name would pass while
  // the value is unusable.
  it('treats an empty value as missing', () => {
    setAll();
    process.env.FCM_CLIENT_EMAIL = '';

    expect(isNativePushConfigured()).toBe(false);
  });
});
