'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

type Theme = 'console' | 'dark' | 'light';

/** The order the button walks. Console first — it is the default ground. */
const ORDER: readonly Theme[] = ['console', 'dark', 'light'];

const NEXT_LABEL: Record<Theme, { key: string; fallback: string; glyph: string }> = {
  console: { key: 'themeToggle.useConsole', fallback: 'Use console', glyph: '◐' },
  dark: { key: 'themeToggle.useDark', fallback: 'Use dark mode', glyph: '☾' },
  light: { key: 'themeToggle.useLight', fallback: 'Use light mode', glyph: '☀' },
};

/**
 * The public site's theme control.
 *
 * ## Why this file mattered more than it looks
 *
 * It was a SECOND source of truth for the theme, and it ran last. The
 * pre-paint bootstrap in `layout.tsx` set the ground before first paint; this
 * effect then overwrote it after hydration from its own two-value logic. So
 * when `console` became the default, every public page still rendered light or
 * dark — the bootstrap was correct and simply lost the race. Nothing about the
 * theme looked wrong in the CSS, the tokens, or the bootstrap.
 *
 * Both now resolve identically: a stored choice wins, otherwise `console`.
 * The OS `prefers-color-scheme` fallback is deliberately gone — the console
 * theme is a warm cream board with no dark counterpart, so honouring a dark OS
 * preference would hand a first-time visitor a theme the product is no longer
 * designed in.
 */
export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>('console');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const resolved: Theme = stored === 'dark' || stored === 'light' || stored === 'console'
      ? stored
      : 'console';
    setTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  // The button advertises what it will DO, not what is currently on.
  const upcoming = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const label = t(NEXT_LABEL[upcoming].key, NEXT_LABEL[upcoming].fallback);

  return (
    <button
      aria-label={label}
      className="theme-toggle"
      onClick={cycle}
      title={label}
      type="button"
    >
      <span aria-hidden="true">{NEXT_LABEL[upcoming].glyph}</span>
    </button>
  );
}
