'use client';

import { openExternalUrl, type ExternalTripOptions } from '@/lib/open-external';
import type { WEB_HANDOFF_PATHS } from '@/lib/native-app';

type WebHandoffPath = (typeof WEB_HANDOFF_PATHS)[number];

/**
 * Send a member in the iOS or Android app to a page of this site in a real
 * browser tab (SFSafariViewController / a Custom Tab), where the WebView's
 * user-agent token and `window.Capacitor` are both absent — so the campaign
 * builder and its checkout render there and never inside the app (row 514).
 *
 * The tab keeps its own cookies and starts signed out, and the emailed sign-in
 * link cannot help on the same phone: it is a universal link, so Mail opens the
 * APP with it. So the app first asks `POST /api/auth/web-handoff` for a
 * single-use sign-in link to the same page and opens that; the tab lands on the
 * existing confirm page and is signed in as this member. If the handoff is
 * unavailable for any reason (an older build without the user-agent token, an
 * unverified email, a failed request) the plain page opens instead and the
 * member signs in there — a passkey works in the tab. Never a dead button.
 *
 * `onReturn` re-reads the app's page when the tab is closed, which is how a
 * campaign made in the tab appears in the app.
 */
export async function openOnWeb(path: WebHandoffPath, options: ExternalTripOptions = {}): Promise<void> {
  let target: string = path;
  try {
    const res = await fetch('/api/auth/web-handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next: path }),
    });
    if (res.ok) {
      const data = (await res.json()) as { url?: unknown };
      // Same-origin relative paths only — the route never returns anything else.
      if (typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//')) target = data.url;
    }
  } catch {
    // Fall through to the plain page.
  }
  return openExternalUrl(new URL(target, window.location.origin).toString(), options);
}
