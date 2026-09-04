/**
 * Leave iHYPE for a third party — Stripe Checkout, Stripe Connect onboarding —
 * without leaving the app.
 *
 * ## The bug this exists for
 *
 * `window.location.assign(checkoutUrl)` is correct on the web and wrong inside
 * the native shell. Capacitor ejects any top-level navigation off `server.url`
 * into the system browser (Android `Bridge.launchIntent()`, iOS
 * `WebViewDelegationHandler`'s `UIApplication.shared.open` + `.cancel`), so a
 * fan tapping Buy was thrown into Safari — and Stripe's `success_url` is a
 * SERVER redirect, which never triggers a universal link, so they never came
 * back. Measured 2026-09-04 across seven call sites: the ticket checkout, ad
 * campaign checkout and cancellation, and four Connect onboarding buttons.
 *
 * ## Why an in-app browser rather than an allowlist
 *
 * `server.allowNavigation: ['checkout.stripe.com', …]` fixes the common path in
 * one line and was shipped first. Two things make it the wrong end state, both
 * measured rather than assumed:
 *
 *   1. **It grants native bridge access on Android.** The same hosts are handed
 *      to `WebViewCompat.addWebMessageListener(webView, "androidBridge", …)`
 *      (`MessageHandler.java:36`), so an allowlisted origin can call plugins.
 *   2. **An allowlist cannot cover 3-D Secure.** A card challenge can send the
 *      top-level frame to the ISSUING BANK's domain, and bank domains are not
 *      enumerable. Ejecting mid-3DS is worse than ejecting at the start,
 *      because the buyer has already entered their card.
 *
 * A Custom Tab (Android) / `SFSafariViewController` (iOS) is not the app's
 * WebView: it needs no allowlist, exposes no bridge, and follows a redirect
 * chain to any domain. It also shows the real URL and padlock, which is the
 * right thing for a payment surface — a WebView cannot prove where it is.
 *
 * ## The return leg, and why it is a refresh rather than a link
 *
 * The obvious design is to let `success_url` deep-link back through the
 * `appUrlOpen` handler this app already has. **Do not rely on that**:
 * `SFSafariViewController` does not fire universal links back to the app that
 * presented it, and a Custom Tab does not reliably hand off App Links either —
 * so a return built on it works on one platform and silently fails on the
 * other, which is the worst of the three outcomes.
 *
 * What is reliable on both is dismissal. `browserFinished` fires when the
 * member closes the tab, and `router.refresh()` then re-reads server state — by
 * which time Stripe's webhook has finalised the order. The cost is one tap on
 * "Done"; the benefit is that it behaves the same on both platforms and cannot
 * strand anyone. `appUrlOpen` still works and is untouched: if a link handoff
 * DOES happen, that path routes as it always did.
 */

/** Where a caller wants the member to end up if the trip succeeds. */
export type ExternalTripOptions = {
  /**
   * Run when the in-app browser closes. Re-read whatever the trip may have
   * changed — an order's status, a profile's Connect state. Not called on the
   * web, where the page is being replaced rather than layered over.
   */
  onReturn?: () => void;
};

/**
 * True when this is running inside the Capacitor shell rather than a browser.
 * Dynamically imported so the web bundle never loads the native modules.
 */
async function nativeBrowser() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const { Browser } = await import('@capacitor/browser');
    return Browser;
  } catch {
    /* The plugin is absent or failed to load. Fall through to the web path,
       which on native means the old eject — degraded, but never a dead
       button. A pay button that does nothing is worse than one that opens
       Safari. */
    return null;
  }
}

export async function openExternalUrl(url: string, options: ExternalTripOptions = {}): Promise<void> {
  const Browser = await nativeBrowser();

  if (!Browser) {
    window.location.assign(url);
    return;
  }

  /* Registered BEFORE `open`, because the member can dismiss immediately and
     a listener attached afterwards would miss it. Removed on the first fire:
     the plugin's listener is global, so leaving it attached would refresh on
     every later trip as well. */
  let finished: { remove: () => Promise<void> } | undefined;
  finished = await Browser.addListener('browserFinished', () => {
    void finished?.remove();
    finished = undefined;
    options.onReturn?.();
  });

  try {
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch {
    void finished?.remove();
    finished = undefined;
    /* Opening failed — fall back rather than leaving the member on a button
       that did nothing. */
    window.location.assign(url);
  }
}
