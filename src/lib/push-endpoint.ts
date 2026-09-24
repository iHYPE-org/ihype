import { validatePublicHttpUrl } from '@/lib/safe-external-url';

/**
 * The push services a browser subscription can legitimately name (2026-09-24,
 * DESIGN_SYNC row 513).
 *
 * A Web Push subscription's `endpoint` is a URL the SERVER then POSTs to on
 * every notification for that member, and `POST /api/push/subscribe` stored
 * whatever a signed-in client sent: any member could register any host as
 * their "device" and turn the Worker into a blind POST relay. The browsers
 * that ship Web Push use one of these services; nothing else is a device.
 * Checked on the way in and again before every send, so a row stored before
 * this rule is never fetched either.
 */
const PUSH_HOSTS = [
  'fcm.googleapis.com',          // Chrome, Edge on Android, Opera, Brave, Samsung
  'android.googleapis.com',      // legacy GCM endpoints still issued by old installs
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com',          // Safari 16+, iOS/iPadOS home-screen web apps
] as const;
const PUSH_HOST_SUFFIXES = [
  '.push.services.mozilla.com',
  '.notify.windows.com',         // Edge on Windows (WNS)
  '.push.apple.com',
] as const;

export function isKnownPushEndpoint(raw: string): boolean {
  const url = validatePublicHttpUrl(raw);
  if (!url || url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return (PUSH_HOSTS as readonly string[]).includes(host)
    || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
