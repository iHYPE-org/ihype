import { db } from '@/lib/db';
import { sendPushNotification } from '@/lib/push-notify';
import { sendNativePushNotification } from '@/lib/native-push';

export type PushToAllPayload = {
  title: string;
  body: string;
  /** Where tapping the notification lands. Web push calls this `url`, the
      native senders call it `link`; the mapping happens once, here. */
  url?: string;
};

/**
 * Send to EVERY device a member has — browser and phone.
 *
 * ## Why this exists
 *
 * There are two independent push transports: web push over VAPID
 * (`push-notify.ts`) and native APNs/FCM (`native-push.ts`). A member who
 * installed the iOS or Android app has a `NativeDeviceToken` and may have no
 * `PushSubscription` at all, so calling only the web sender reaches nobody on
 * a phone — silently, because both senders are best-effort and a member with
 * zero rows of the kind you asked for is indistinguishable from a successful
 * send.
 *
 * `notifyUser` fanned out to both and its docstring claimed "every existing
 * and future call site gets native push for free through this one fan-in
 * point". That was false when it was written and stayed false: SIX call sites
 * imported `sendPushNotification` directly and never reached a phone — the
 * RSVP reminder, the capacity alert, the nearby-show alert, the
 * publish-scheduled notice, the post-show recap, and two of the three hype
 * paths. `hype/route.ts` imported BOTH, so one branch of one file reached a
 * phone and two did not.
 *
 * Those six are the most time-sensitive notifications the product has, which
 * makes them exactly the ones that justify a native app existing rather than a
 * bookmark. Found while preparing the store submissions, by asking who calls
 * the native sender rather than by reading the comment that said everyone did.
 *
 * ## The rule
 *
 * `push-notify.ts` and `native-push.ts` are imported by THIS FILE AND NOTHING
 * ELSE, and `wiring-guards.test.ts` fails the build if that stops being true.
 * A comment is not coverage — this repository has learned that twice now, once
 * from a cron schedule that had never fired.
 *
 * Both sends are caught: a notification is always a side effect and must never
 * break the caller's flow.
 */
export async function sendPushToAllDevices(userId: string, payload: PushToAllPayload): Promise<void> {
  await sendPushNotification(userId, {
    title: payload.title,
    body: payload.body,
    url: payload.url,
  }).catch(() => {});
  await sendNativePushNotification(userId, {
    title: payload.title,
    body: payload.body,
    link: payload.url,
  }).catch(() => {});
}

/**
 * Records an in-app Notification and pushes it to every device.
 *
 * Use this when the member should also see the item in their notification
 * centre. When the caller already writes its own Notification row — several
 * crons batch them with `createMany` — call `sendPushToAllDevices` directly
 * instead, or the row is written twice.
 */
export async function notifyUser(
  userId: string,
  opts: { type: string; title: string; body: string; link?: string | null },
): Promise<void> {
  await db.notification.create({
    data: { userId, type: opts.type, body: opts.body, link: opts.link ?? null },
  }).catch(() => {});
  await sendPushToAllDevices(userId, {
    title: opts.title,
    body: opts.body,
    url: opts.link ?? undefined,
  });
}
