import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Facts that used to live in prose, asserted here instead.
 *
 * CLAUDE.md is read cold by every session, and four of its factual claims went
 * stale in a single day: a fixed overflow described as an open mystery, a
 * passing contrast ratio described as failing, an accessibility control
 * described as unreachable after it had been wired. Prose cannot fail, so
 * nothing tells anyone it has drifted — and one of those stale lines actively
 * invited a change that would have re-broken contrast.
 *
 * The rule this file encodes: CLAUDE.md keeps the DECISIONS and the reasoning;
 * the FACTS are held by tests, which go red when they stop being true.
 */

const globals = readFileSync('src/app/globals.css', 'utf8');
const layout = readFileSync('src/app/layout.tsx', 'utf8');

/** The first definition of a token, which is the `:root` (dark) value. */
function token(name: string): string {
  const match = globals.match(new RegExp(`\\s${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`token ${name} is not defined in globals.css`);
  return match[1].trim();
}

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('design facts', () => {
  /**
   * White on the accent measured 3.27:1 and failed AA. It is now ink navy at
   * ~6:1 — and because dark text on orange looks unusual, "restoring" white is
   * the obvious wrong instinct. This is the assertion that catches it.
   */
  it('keeps ink-on-accent readable on the accent fill', () => {
    const ratio = contrast(token('--ink-on-accent'), token('--accent'));
    expect(ratio, `--ink-on-accent on --accent is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps body ink readable on both grounds', () => {
    const dark = contrast(token('--ink'), token('--bg'));
    expect(dark, `--ink on --bg is ${dark.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * `public/manifest.json` existed for months and no browser ever read it:
   * nothing declared it, so the site was not installable and its icons, name
   * and shortcuts applied nowhere. The service worker pre-caching the file is
   * not the same as the document pointing at it.
   */
  it('declares the web app manifest', () => {
    expect(layout).toMatch(/manifest:\s*'\/manifest\.json'/);
  });

  /**
   * `viewportFit: 'cover'` plus a translucent status bar is a promise to tell
   * the OS what colour it is painting its own chrome over.
   *
   * This used to assert a `prefers-color-scheme` PAIR. There is one ground
   * now, so it asserts something stronger instead: that all three places
   * naming that ground AGREE. They did not — dropping the themes left the web
   * app manifest on the retired navy, which is the PWA splash screen and the
   * installed app's chrome, so an installed app would have flashed navy before
   * painting a cream page. Nothing renders the manifest during development,
   * which is exactly why it needs a test rather than an eye.
   */
  it('paints one ground, and every declaration of it agrees', () => {
    const ground = /--bg:\s*(#[0-9a-f]{6})/i.exec(readFileSync('src/app/globals.css', 'utf8'))?.[1];
    expect(ground).toBeDefined();

    expect(layout).toMatch(new RegExp(`themeColor:\\s*'${ground}'`, 'i'));
    // A scheme-conditional pair would mean the OS chrome still tracks a
    // preference the product no longer honours.
    expect(layout).not.toMatch(/prefers-color-scheme/);

    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as {
      theme_color: string; background_color: string;
    };
    expect(manifest.theme_color.toLowerCase()).toBe(ground!.toLowerCase());
    expect(manifest.background_color.toLowerCase()).toBe(ground!.toLowerCase());
  });

  /**
   * The manifest's shortcuts are the app's own deep links, and they survive a
   * refactor unnoticed because nothing renders them in the product. One pointed
   * at `/listen`, which is both a redirect and the single destination the route
   * registry forbids.
   */
  it('never points a manifest shortcut at a retired route', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as {
      shortcuts?: Array<{ url: string }>;
      start_url: string;
    };
    const retired = ['/listen', '/home', '/studio', '/workbench'];
    for (const shortcut of manifest.shortcuts ?? []) {
      for (const dead of retired) {
        expect(shortcut.url.startsWith(dead), `shortcut points at ${shortcut.url}`).toBe(false);
      }
    }
    expect(manifest.start_url.startsWith('/')).toBe(true);
  });
});
