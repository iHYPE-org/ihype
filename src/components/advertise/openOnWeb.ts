'use client';

import { openExternalUrl, type ExternalTripOptions } from '@/lib/open-external';

/**
 * Send a member in the iOS or Android app to a page of this site in a real
 * browser tab (SFSafariViewController / a Custom Tab), where the WebView's
 * user-agent token and `window.Capacitor` are both absent — so the campaign
 * builder and its checkout render there and never inside the app (row 514).
 *
 * The browser tab keeps its own cookies, so the member signs in once on the
 * web with the same account; `onReturn` re-reads the dashboard when they close
 * it, which is how a campaign they just created appears in the app.
 */
export function openOnWeb(path: string, options: ExternalTripOptions = {}): Promise<void> {
  const url = new URL(path, window.location.origin).toString();
  return openExternalUrl(url, options);
}
