import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CAMPAIGNS_WEB_ONLY,
  NATIVE_APP_UA_SUFFIX,
  NATIVE_APP_UA_TOKEN,
  isCapacitorNative,
  isNativeAppUserAgent,
} from '@/lib/native-app';

/**
 * Inside the iOS and Android apps an advertiser may sign up and read the price
 * list, and builds and pays for a campaign on the web (DESIGN_SYNC row 514).
 * These pin the two signals that say "this is the app" and every place that
 * could otherwise start an ad checkout inside it.
 */

const IOS_WEBVIEW = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const ANDROID_WEBVIEW = 'Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/139.0.0.0 Mobile Safari/537.36';
const IOS_SAFARI = `${IOS_WEBVIEW} Version/18.0 Safari/604.1`;

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('recognising the app', () => {
  it('reads the token the store builds append, on both platforms', () => {
    expect(isNativeAppUserAgent(`${IOS_WEBVIEW} ${NATIVE_APP_UA_SUFFIX}`)).toBe(true);
    expect(isNativeAppUserAgent(`${ANDROID_WEBVIEW} ${NATIVE_APP_UA_SUFFIX}`)).toBe(true);
  });

  it('never reads a browser as the app — a browser may always buy', () => {
    for (const ua of [IOS_SAFARI, ANDROID_WEBVIEW, IOS_WEBVIEW, '', null, undefined]) {
      expect(isNativeAppUserAgent(ua as string | null | undefined), String(ua)).toBe(false);
    }
    // The token must stand on its own, not as the tail of another product name.
    expect(isNativeAppUserAgent(`${IOS_WEBVIEW} NotiHYPEApp/1`)).toBe(false);
    expect(isNativeAppUserAgent(`${IOS_WEBVIEW} ${NATIVE_APP_UA_TOKEN}`)).toBe(false);
  });

  it('capacitor.config.ts appends exactly the token the site reads', () => {
    const config = readFileSync('capacitor.config.ts', 'utf8');
    const match = /appendUserAgent:\s*'([^']+)'/.exec(config);
    expect(match?.[1]).toBe(NATIVE_APP_UA_SUFFIX);
    // Capacitor joins the suffix to the WebView's own agent with a space.
    expect(isNativeAppUserAgent(`${IOS_WEBVIEW} ${match?.[1]}`)).toBe(true);
  });

  describe('window.Capacitor, for a store build that predates the token', () => {
    const g = globalThis as unknown as { window?: unknown };
    const saved = g.window;
    afterEach(() => { g.window = saved; });

    it('is true only when the native bridge says so', () => {
      g.window = { Capacitor: { isNativePlatform: () => true } };
      expect(isCapacitorNative()).toBe(true);
      g.window = { Capacitor: { isNativePlatform: () => false } }; // the @capacitor/core web stub
      expect(isCapacitorNative()).toBe(false);
      g.window = {};
      expect(isCapacitorNative()).toBe(false);
      g.window = { get Capacitor() { throw new Error('blocked'); } };
      expect(isCapacitorNative()).toBe(false);
    });
  });
});

describe('every way to start an ad checkout is closed inside the app', () => {
  it('the builder is rendered only through the gate', () => {
    const renderers = walk('src')
      .filter((file) => !file.endsWith('AdvertisePage.tsx'))
      .filter((file) => /\bMmmCampaignBuilderPage\b/.test(strip(readFileSync(file, 'utf8'))));
    expect(renderers).toEqual([join('src', 'components', 'advertise', 'CampaignBuilderGate.tsx')]);

    const page = readFileSync('src/app/app/me/advertising/new/page.tsx', 'utf8');
    expect(page).toMatch(/<CampaignBuilderGate initialNative=\{await isNativeAppRequest\(\)\} \/>/);
  });

  it('"Pay now" on an unpaid campaign is the web trip inside the app', () => {
    const source = strip(readFileSync('src/components/CampaignCancelButton.tsx', 'utf8'));
    const gate = source.indexOf('{inApp ? (');
    const retry = source.indexOf("act('retry-checkout')");
    expect(gate).toBeGreaterThan(-1);
    expect(retry).toBeGreaterThan(gate);
    expect(source).toMatch(/useNativeApp\(nativeApp\)/);
  });

  it('the dashboard hands both controls the server reading of the user agent', () => {
    const page = readFileSync('src/app/app/me/advertising/page.tsx', 'utf8');
    expect(page).toMatch(/const nativeApp = await isNativeAppRequest\(\);/);
    expect(page).toMatch(/<NewCampaignAction initialNative=\{nativeApp\} \/>/);
    expect(page).toMatch(/nativeApp=\{nativeApp\}/);
  });

  it('no page links straight into the builder around the dashboard key', () => {
    const offenders = walk('src').filter((file) =>
      /href=["'{`]*\/app\/me\/advertising\/new/.test(strip(readFileSync(file, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });

  it('the API refuses both checkout paths from the app before it starts one', () => {
    const source = strip(readFileSync('src/app/api/advertise/campaigns/route.ts', 'utf8'));
    expect(source).toContain(CAMPAIGNS_WEB_ONLY);
    for (const handler of ['export async function POST', 'export async function PATCH']) {
      const start = source.indexOf(handler);
      const next = source.indexOf('export async function', start + handler.length);
      const body = source.slice(start, next === -1 ? undefined : next);
      const refusal = body.indexOf('refuseInApp(request)');
      const checkout = body.indexOf('createAdCampaignCheckoutSession(');
      expect(refusal, handler).toBeGreaterThan(-1);
      expect(checkout, handler).toBeGreaterThan(refusal);
    }
  });
});
