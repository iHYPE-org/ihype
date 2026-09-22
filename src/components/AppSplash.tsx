'use client';

import { useEffect, useState } from 'react';
import { IhypeMark } from '@/components/brand/IhypeMark';

const MIN_VISIBLE_MS = 900;
const FADE_MS = 300;

/**
 * Launch splash for the installed PWA only — regular browser tabs never see
 * this. An installed app has no browser chrome, so without this it flashes
 * straight to a blank page while fonts/JS settle after the OS's own
 * (icon-based) launch screen disappears.
 *
 * IT DRAWS THE MARK, AND THIS WAS THE LAST PLACE THE STICKER RENDERED
 * (2026-09-18; owner: "It's ok to not have the audience in the logo, the
 * mission is what's important (and the testers really hated the AI look and
 * feel, including the logo)").
 *
 * The 2026-09-18 pass took `logo-sticker-2026.png` out of the header and off
 * the landing hero and then stopped, because the remaining uses were "store
 * assets with a build attached". That was true of the icons and NOT true of
 * this one: an installed app renders this from the web bundle, so it ships
 * with a Cloudflare deploy and no store review — and it is the FIRST thing a
 * tester sees, on every launch of the app they were asked to test. A grep for
 * the filename would have found it; what did not happen is asking what each
 * remaining hit actually costs to change.
 *
 * The icons followed on 2026-09-22: `npm run brand:assets` rasterises the PWA
 * set, both native launcher sets and every splash from the same geometry this
 * draws, and the sticker files are deleted. The store listings pick the new
 * icon up with the next native build.
 */
export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (!isStandalone) return;

    setVisible(true);
    const fadeTimer = setTimeout(() => setFading(true), MIN_VISIBLE_MS);
    const removeTimer = setTimeout(() => setVisible(false), MIN_VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div aria-hidden="true" className={`app-splash${fading ? ' app-splash-fade' : ''}`}>
      {/* A 44px cap renders 170x44 — about 43% of a 393px screen, measured against the
          real stylesheet and the real local woff2. The sticker was a 144px
          square tile; a wordmark needs more width and less height to carry the
          same weight. */}
      <IhypeMark size={44} />
    </div>
  );
}
