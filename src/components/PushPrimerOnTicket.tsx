'use client';

import { useEffect } from 'react';
import { PermissionPrimerSheet, usePermissionPrimer } from '@/components/PermissionPrimerSheet';

/**
 * The push ask, at the moment the design names for it.
 *
 * `PERMISSION_PRIMERS.push.moment` is "Fires after first ticket · not
 * onboarding", and `NativePushRegistration`'s own comment says the same thing
 * from the other side: it deliberately calls `checkPermissions()` only, because
 * it mounts at the app root and asking there spends the one OS dialog an
 * install gets on a launch screen with no context.
 *
 * What was missing is the other half. Nothing anywhere called
 * `requestPermissions()`, and `PermissionPrimerSheet` was mounted on no page —
 * so the OS prompt could never appear, push could never be granted, and every
 * notification the product sends stayed inside the in-app centre. This is the
 * component that closes it: a fan holding a ticket is looking at the exact
 * thing the reminders are about.
 *
 * Three states, as MOBILE.md requires. The primer is ours and asks in our own
 * words; only an accept reaches the OS; a decline is remembered per device and
 * never re-asked, and costs nothing — the notice still lands in the centre.
 * Renders nothing on the web, where the Capacitor plugin is not usable.
 */
export function PushPrimerOnTicket() {
  const primer = usePermissionPrimer('push');

  useEffect(() => {
    let cancelled = false;
    void import('@capacitor/push-notifications')
      .then(async ({ PushNotifications }) => {
        // Already answered by the OS — ours would be theatre, and re-asking a
        // member who granted or denied it is the nagging the sheet exists to
        // avoid.
        const current = await PushNotifications.checkPermissions().catch(() => null);
        if (cancelled || !current || current.receive !== 'prompt') return;
        primer.ask();
      })
      .catch(() => {
        // Not a native build. No plugin, no prompt, no sheet.
      });
    return () => { cancelled = true; };
    // Asked once per mount of a ticket. `primer.ask` is stable and re-checks
    // the stored decision itself, so a second ticket view is a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PermissionPrimerSheet
      id="push"
      onAccept={() => {
        primer.close();
        void import('@capacitor/push-notifications')
          .then(async ({ PushNotifications }) => {
            const result = await PushNotifications.requestPermissions();
            // A refusal at the OS dialog is a real answer and not an error:
            // the in-app centre is the fallback and it already works.
            if (result.receive === 'granted') await PushNotifications.register();
          })
          .catch(() => {});
      }}
      onDecline={primer.close}
      open={primer.open}
    />
  );
}
