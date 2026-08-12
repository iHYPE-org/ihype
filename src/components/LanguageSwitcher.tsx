'use client';

import { useId, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { SUPPORTED_LOCALES, LOCALE_NAMES } from '@/lib/i18n/locales';

/** Real language switcher — ports the design system's 12-locale dictionary (lib/i18n.js) into a working control, not just scoped. */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const selectId = useId();
  const [changing, setChanging] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <label htmlFor={selectId} style={{ fontSize: '0.8125rem', opacity: 0.7 }}>{t('languageSwitcher.label', 'Language')}</label>
      <select
        id={selectId}
        onChange={(e) => {
          setChanging(true);
          setLocale(e.target.value as (typeof SUPPORTED_LOCALES)[number]);
          setTimeout(() => setChanging(false), 300);
        }}
        style={{
          fontSize: '0.8125rem', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)',
          background: 'var(--bg2)', color: 'var(--ink)', cursor: 'pointer',
        }}
        value={locale}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>{LOCALE_NAMES[l]}</option>
        ))}
      </select>
      {changing && <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>{t('languageSwitcher.changed', 'Language changed')}</span>}
    </div>
  );
}
