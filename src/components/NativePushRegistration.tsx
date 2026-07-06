'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Capacitor } from '@capacitor/core';
import { resolveInternalPath } from '@/lib/deep-link';

/**
 * Native-shell-only glue, mounted once at the app root (AppProviders) — a
 * complete no-op on the website/PWA since every path here is gated on
 * `Capacitor.isNativePlatform()`. Two independent jobs:
 *
 * 1. Push token registration: on the real iOS/Android app, request
 *    permission, register with APNs/FCM, and POST the real device token to
 *    /api/push/register-device so notifyUser() (src/lib/notify.ts) can reach
 *    this device. Wrapped defensively — a device with no Firebase project
 *    configured yet (no google-services.json) can fail registration, and
 *    that must never be fatal to the app.
 * 2. Deep links: Universal Links (iOS) / App Links (Android) hand the shell
 *    a real https://ihype.org/... URL via `appUrlOpen`; resolve it to an
 *    internal path and navigate the SPA there instead of leaving the WebView
 *    on whatever it was showing. Tapping a push notification carries the
 *    same shape of `link` this session's other notification surfaces already
 *    use (a relative path, e.g. `/shows/my-show`), so it's handled the same
 *    way without needing the full URL parse.
 */
export function NativePushRegistration() {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    import('@capacitor/app')
      .then(({ App }) => {
        if (cancelled) return undefined;
        const listener = App.addListener('appUrlOpen', ({ url }) => {
          const path = resolveInternalPath(url);
          if (path) router.push(path);
        });
        return listener;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId) return;

    let cancelled = false;
    const listenerHandles: Promise<{ remove: () => void }>[] = [];

    import('@capacitor/push-notifications')
      .then(async ({ PushNotifications }) => {
        if (cancelled) return;

        listenerHandles.push(
          PushNotifications.addListener('registration', (token) => {
            fetch('/api/push/register-device', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() === 'ios' ? 'IOS' : 'ANDROID' }),
            }).catch(() => {
              // Registration is a side effect — a failed POST just means this
              // device won't receive native pushes until the next launch retries.
            });
          })
        );

        listenerHandles.push(
          PushNotifications.addListener('registrationError', () => {
            // Expected until a real Firebase project (google-services.json /
            // APNs auth key) is configured — never fatal to the app.
          })
        );

        listenerHandles.push(
          PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const link = action.notification.data?.link;
            if (typeof link === 'string' && link.startsWith('/')) router.push(link);
          })
        );

        const permission = await PushNotifications.checkPermissions().catch(() => null);
        const granted =
          permission?.receive === 'granted' ||
          (await PushNotifications.requestPermissions().catch(() => null))?.receive === 'granted';

        if (granted && !cancelled) {
          await PushNotifications.register().catch(() => {
            // No Firebase project configured yet, or the OS declined — safe to ignore.
          });
        }
      })
      .catch(() => {
        // @capacitor/push-notifications not usable on this platform/build — no-op.
      });

    return () => {
      cancelled = true;
      void Promise.allSettled(listenerHandles).then((results) => {
        for (const result of results) {
          if (result.status === 'fulfilled') result.value.remove();
        }
      });
    };
  }, [router, userId]);

  return null;
}
