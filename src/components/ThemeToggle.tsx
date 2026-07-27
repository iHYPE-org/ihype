'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark';
    setTheme(stored);
    document.documentElement.setAttribute('data-theme', stored);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  return (
    <button
      aria-label={t('themeToggle.ariaLabel', 'Toggle theme')}
      onClick={toggle}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 18,
        padding: '4px 8px',
        color: 'var(--ink)',
        opacity: 0.7
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
