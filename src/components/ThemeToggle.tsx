'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const resolved = stored === 'dark' || stored === 'light'
      ? stored
      : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    setTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  return (
    <button
      aria-label={theme === 'dark'
        ? t('themeToggle.useLight', 'Use light mode')
        : t('themeToggle.useDark', 'Use dark mode')}
      className="theme-toggle"
      onClick={toggle}
      title={theme === 'dark'
        ? t('themeToggle.useLight', 'Use light mode')
        : t('themeToggle.useDark', 'Use dark mode')}
      type="button"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}
