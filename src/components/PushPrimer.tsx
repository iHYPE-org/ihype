'use client';

import { useEffect, useState } from 'react';
import { PermissionPrimerSheet, usePermissionPrimer } from '@/components/PermissionPrimerSheet';

/**
 * Asks for push at the moment the design names: **after a first ticket, never
 * at onboarding.** Mounted by `/tickets` and rendered only when the member
 * actually holds one, so the sheet arrives when "we'll remind you before doors"
 * means something concrete.
 *
 * `NativePushRegistration` deliberately no longer requests anything — it only
 * registers a permission that is already granted. This is the one place in the
 * app allowed to raise the OS push dialog, and it only does so after an
 * explicit accept on our own sheet.
 *
 * Both platforms are handled because both exist: the native shell goes through
 * Capacitor, the installed PWA through `Notification.requestPermission`. A
 * browser with neither simply never opens the sheet.
 */
export function PushPrimer() {
  const [osDecided, setOsDecided] = useState(true); // Assume decided until proven otherwise.
  const primer = usePermissionPrimer('push', osDecided);

  useEffect(() => {
    let cancelled = false;

    async function resolveState() {
      // Native first: on a Capacitor build `Notification` may exist in the
      // WebView but the real permission lives with the OS plugin.
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          const current = await PushNotifications.checkPermissions().catch(() => null);
          if (!cancelled) setOsDecided(current?.receive !== 'prompt');
          return;
        }
      } catch {
        // Not a native build, or the plugin is unavailable — fall through.
      }
      if (typeof Notification === 'undefined') return;
      if (!cancelled) setOsDecided(Notification.permission !== 'default');
    }

    void resolveState();
    return () => { cancelled = true; };
  }, []);

  // Separate effect so the ask runs once `osDecided` has actually been read,
  // rather than against its pessimistic initial value.
  useEffect(() => { if (!osDecided) primer.ask(); }, [osDecided, primer]);

  const accept = async () => {
    primer.close();
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const result = await PushNotifications.requestPermissions().catch(() => null);
        if (result?.receive === 'granted') await PushNotifications.register().catch(() => undefined);
        return;
      }
    } catch {
      // Fall through to the web path.
    }
    if (typeof Notification !== 'undefined') {
      await Notification.requestPermission().catch(() => undefined);
    }
  };

  return (
    <PermissionPrimerSheet
      id="push"
      onAccept={() => { void accept(); }}
      onDecline={primer.close}
      open={primer.open}
    />
  );
}
