import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getNativePushReadiness } from '@/lib/native-push';
import { sendPushToAllDevices } from '@/lib/notify';
import { isAdminSession } from '@/lib/permissions';

/**
 * Send the calling administrator a push, to their own devices only.
 *
 * WHY THIS EXISTS. Nothing in the product could push to you on purpose.
 * Every real sender notifies somebody else and the nearest one —
 * `POST /api/hype` — explicitly skips self-hype (`creatorId !== session.user.id`),
 * which is correct product behaviour and makes it useless as a test. So
 * proving push end to end meant a second account, an invite code for it, a
 * show owned by the first, and a hype from the second. Four steps of setup to
 * answer one yes/no question, which is why nobody was going to re-run it after
 * the first time. Push is also the one subsystem where every layer fails
 * quietly, so "nobody checks it" and "it silently stopped working" are the
 * same state.
 *
 * ADMIN-ONLY AND SELF-ONLY, and both halves matter. Admin-only because an
 * open endpoint that makes a phone buzz is an abuse vector with no upside.
 * Self-only — the recipient is `session.user.id` and is not a parameter —
 * because a target id would make this a tool for pushing arbitrary text to any
 * member from an admin session, which is a much larger thing than a test
 * button and is not what this is for.
 *
 * IT REPORTS WHAT IT FOUND, NOT JUST THAT IT TRIED. `sendPushToAllDevices` is
 * best-effort by design and resolves the same way whether it reached a phone,
 * found no devices, or bailed on unset secrets — so a bare "sent" would be the
 * exact false green this endpoint exists to prevent. The response separates
 * the three, because they have three different fixes: no registered device
 * means the app never called register-device (leg 1, or the permission was
 * declined), unset secrets mean leg 3, and devices plus configuration plus
 * silence on an iPhone means the APNs key of leg 2. See
 * docs/runbooks/push-setup.md.
 *
 * What it still cannot tell you: whether the notification ARRIVED. FCM accepts
 * a send and delivers asynchronously, and iOS delivery depends on Apple-side
 * state this codebase cannot read. Look at the phone.
 */
export async function POST() {
  const session = await auth();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const readiness = getNativePushReadiness();

  const devices = await db.nativeDeviceToken
    .findMany({ where: { userId: session.user.id }, select: { platform: true } })
    .catch(() => null);

  // A failed read is not "no devices" — reporting 0 here would send someone
  // hunting for a registration bug that is really a database blip.
  if (devices === null) {
    return NextResponse.json({ error: 'Could not read your registered devices.' }, { status: 503 });
  }

  await sendPushToAllDevices(session.user.id, {
    title: 'iHYPE push test',
    body: 'If this reached your phone, native push is working end to end.',
    url: '/app/me',
  });

  return NextResponse.json({
    attempted: true,
    nativePushConfigured: readiness.ready,
    blockers: readiness.blockers,
    devices: devices.length,
    platforms: [...new Set(devices.map((device) => device.platform))].sort(),
    // Said plainly so no caller can read a 200 as proof of delivery.
    note:
      devices.length === 0
        ? 'No registered device — open the app on a phone, accept the notification prompt, then try again.'
        : readiness.ready
          ? 'Sent to FCM. Delivery is asynchronous; look at the phone.'
          : 'Not sent: the FCM service-account secrets are unset.',
  });
}
