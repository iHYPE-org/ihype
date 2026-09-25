'use client';

import { openExternalUrl, type ExternalTripOptions } from '@/lib/open-external';

/**
 * Send a member in the iOS or Android app to a page of this site in a real
 * browser tab (SFSafariViewController / a Custom Tab), where the WebView's
 * user-agent token and `window.Capacitor` are both absent — so the campaign
 * builder and its checkout render there and never inside the app (row 514).
 *
 * The tab has its own cookies on iOS, so the member may be asked to sign in
 * there with the same account (the in-app page says so; a passkey works in the
 * tab). A one-time sign-in
 * link that signed the tab in automatically was built and then REMOVED after
 * its security review (row 514): it let an impersonating operator mint an
 * unmarked session, outlived an admin suspension, and left a member signed in
 * inside a tab the next person on the phone would open. A sign-in prompt in a
 * browser is the smaller risk. Do not bring it back without answering those.
 *
 * `onReturn` re-reads the app's page when the tab is closed, which is how a
 * campaign made in the tab appears in the app.
 */
export function openOnWeb(path: string, options: ExternalTripOptions = {}): Promise<void> {
  return openExternalUrl(new URL(path, window.location.origin).toString(), options);
}
