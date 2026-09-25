/**
 * Is this page running inside the iOS or Android app?
 *
 * WHY IT MATTERS (2026-09-24, DESIGN_SYNC row 514; owner: "remove iOS/Android
 * advertiser sign up, but let them sign up and learn about pricing and such,
 * but point them to the web/mobile web to create campaigns").
 *
 * Both native apps are a WebView on https://ihype.org, so without this the
 * store apps render exactly what a browser renders — including the campaign
 * builder and its Stripe checkout. Apple's App Review Guidelines name that
 * case outright: "buying advertisements to display in the same app (such as
 * sales of 'boosts' for posts in a social media app) must use in-app
 * purchase", and the 3.1.3(g) exemption covers only apps whose SOLE purpose is
 * managing campaigns across other media. So the apps may sign an advertiser up,
 * show them pricing and their campaigns, and point them at the web; they may
 * not build or pay for a campaign. A browser — desktop or phone — is untouched.
 *
 * TWO SIGNALS, BECAUSE ONE OF THEM IS NOT SHIPPED YET.
 *
 *   1. The user agent. `capacitor.config.ts` appends `iHYPEApp/1` to the
 *      WebView's user agent, which lets the SERVER decide before anything
 *      renders — no flash of a buy button, and the API can refuse a checkout
 *      from the app outright. It reaches a member only with the next store
 *      build, because the config is compiled into the native project.
 *   2. `window.Capacitor`. The native bridge injects it at document start on
 *      both platforms (`isNativePlatform = () => true` in each
 *      `native-bridge.js`), so a build that predates the user-agent token —
 *      every install in TestFlight today — is still recognised, one effect
 *      after hydration. On the web the global is either absent or the
 *      `@capacitor/core` stub that answers false.
 *
 * NOT A SECURITY CONTROL. A user agent is whatever the client says it is. This
 * only ever REMOVES a purchase path when the token is present; a client that
 * strips it is a browser as far as this product is concerned, and a browser is
 * allowed to buy. Nothing here may be used to grant anything.
 */

/** The token `capacitor.config.ts` appends. Keep the two in step — a test reads both. */
export const NATIVE_APP_UA_TOKEN = 'iHYPEApp';
export const NATIVE_APP_UA_SUFFIX = `${NATIVE_APP_UA_TOKEN}/1`;

const TOKEN_PATTERN = new RegExp(`(^|\\s)${NATIVE_APP_UA_TOKEN}/\\d`);

export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  return typeof userAgent === 'string' && TOKEN_PATTERN.test(userAgent);
}

type CapacitorGlobal = { isNativePlatform?: () => boolean };

/** True inside a native build, whether or not it carries the user-agent token. Client only. */
export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** The web address a member in the app is sent to for anything the app may not sell. */
export const WEB_CAMPAIGN_PATH = '/app/me/advertising/new';
export const WEB_ADVERTISING_PATH = '/app/me/advertising';

/** The only destinations `POST /api/auth/web-handoff` will sign a browser tab into. */
export const WEB_HANDOFF_PATHS = [WEB_CAMPAIGN_PATH, WEB_ADVERTISING_PATH] as const;

/** The refusal the campaign API returns to the app. Stable, so a client can branch on it. */
export const CAMPAIGNS_WEB_ONLY = 'CAMPAIGNS_WEB_ONLY';
