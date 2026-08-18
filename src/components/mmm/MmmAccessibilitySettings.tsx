'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TEXT_SCALE_MAX, TEXT_SCALE_MIN, TEXT_SCALE_STEP,
  clampTextScale, useAccessibilitySettings,
} from '@/components/AccessibilityControls';
import { useI18n } from '@/components/I18nProvider';
import { MmmSegmentedTabs } from '@/components/mmm/MmmSegmentedTabs';
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@/lib/i18n/locales';

/**
 * The Accessibility route from the app-shell handoff — five cards, each of
 * which applies a real effect and persists:
 *
 *   | Card          | Control              | Applied effect                        |
 *   | Appearance    | Dark / Light         | data-theme on <html>                  |
 *   | Language      | locale buttons       | UI string table + <html lang>         |
 *   | Text size     | A − / A + / Reset    | root font scale 85–140%, not a scale()|
 *   | High contrast | On / Off             | stronger --line/--line-2/--ink-2/-3   |
 *   | Reduce motion | On / Off             | chrome transitions AND DS keyframes    |
 *
 * The handoff notes all five persist to a localStorage key and says "in code
 * move to a preferences provider". They do: theme through the existing theme
 * bootstrap, locale through I18nProvider (cookie + storage, so server
 * components see it too), and the other three through AccessibilityProvider —
 * three stores that already existed, rather than a fourth parallel one.
 *
 * The prototype offers three languages; this renders the twelve the product
 * actually ships dictionaries for.
 */
export function MmmAccessibilitySettings() {
  const { t, locale, setLocale } = useI18n();
  const { settings, updateSetting } = useAccessibilitySettings();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem('theme');
    setTheme(
      stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
    );
  }, []);

  function applyTheme(next: 'dark' | 'light') {
    setTheme(next);
    window.localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  function stepScale(delta: number) {
    updateSetting('textScale', clampTextScale(settings.textScale + delta));
  }

  const scalePercent = Math.round(settings.textScale * 100);
  const onLabel = t('appShell.a11y.on', 'On');
  const offLabel = t('appShell.a11y.off', 'Off');

  return (
    <div className="mmm-settings-route mmm-settings-route-narrow">
      <Link className="mmm-charter-back" href="/app/me?panel=settings">‹ Me</Link>
      <span className="mmm-eyebrow" style={{ color: 'var(--role-fan)' }}>
        {t('appShell.section.settings', 'Settings')}
      </span>
      <h1 className="mmm-settings-title">{t('appShell.nav.accessibility', 'Accessibility')}</h1>

      <div className="mmm-settings-stack">
        <section className="mmm-settings-card">
          <h2 className="mmm-settings-card-title">{t('appShell.a11y.appearance', 'Appearance')}</h2>
          <p className="mmm-settings-card-hint">
            {t('appShell.a11y.appearanceHint', 'Light and dark both ship from the same tokens.')}
          </p>
          <MmmSegmentedTabs
            className="mmm-settings-card-controls"
            items={[
              { id: 'dark', label: t('appShell.a11y.dark', 'Dark'), active: theme === 'dark', onSelect: () => applyTheme('dark') },
              { id: 'light', label: t('appShell.a11y.light', 'Light'), active: theme === 'light', onSelect: () => applyTheme('light') },
            ]}
            label={t('appShell.a11y.appearance', 'Appearance')}
            mode="toggle"
          />
        </section>

        <section className="mmm-settings-card">
          <h2 className="mmm-settings-card-title">{t('appShell.a11y.language', 'Language')}</h2>
          <p className="mmm-settings-card-hint">
            {t('appShell.a11y.languageHint', 'Interface text follows this choice everywhere.')}
          </p>
          <MmmSegmentedTabs
            className="mmm-settings-card-controls"
            items={SUPPORTED_LOCALES.map((code) => ({
              id: code,
              label: LOCALE_NAMES[code],
              active: locale === code,
              onSelect: () => setLocale(code),
            }))}
            label={t('appShell.a11y.language', 'Language')}
            mode="toggle"
          />
        </section>

        <section className="mmm-settings-card">
          <h2 className="mmm-settings-card-title">{t('appShell.a11y.textSize', 'Text size')}</h2>
          {/* The percentage is the card's live value, announced on change. */}
          <p className="mmm-settings-card-hint" role="status">{scalePercent}%</p>
          <div className="mmm-settings-card-controls">
            <button
              aria-label={t('appShell.a11y.textSmaller', 'Smaller text')}
              className="mmm-settings-pill"
              disabled={settings.textScale <= TEXT_SCALE_MIN}
              onClick={() => stepScale(-TEXT_SCALE_STEP)}
              type="button"
            >
              A −
            </button>
            <button
              aria-label={t('appShell.a11y.textBigger', 'Larger text')}
              className="mmm-settings-pill"
              disabled={settings.textScale >= TEXT_SCALE_MAX}
              onClick={() => stepScale(TEXT_SCALE_STEP)}
              type="button"
            >
              A +
            </button>
            <button className="mmm-settings-pill" onClick={() => updateSetting('textScale', 1)} type="button">
              {t('appShell.a11y.reset', 'Reset')}
            </button>
          </div>
        </section>

        <section className="mmm-settings-card mmm-settings-card-split">
          <div>
            <h2 className="mmm-settings-card-title">{t('appShell.a11y.contrast', 'High contrast')}</h2>
            <p className="mmm-settings-card-hint">
              {t('appShell.a11y.contrastHint', 'Stronger borders and brighter secondary text.')}
            </p>
          </div>
          <button
            aria-pressed={settings.highContrast}
            className="mmm-settings-pill"
            data-active={settings.highContrast ? 'true' : 'false'}
            onClick={() => updateSetting('highContrast', !settings.highContrast)}
            type="button"
          >
            {settings.highContrast ? onLabel : offLabel}
          </button>
        </section>

        <section className="mmm-settings-card mmm-settings-card-split">
          <div>
            <h2 className="mmm-settings-card-title">{t('appShell.a11y.motion', 'Reduce motion')}</h2>
            <p className="mmm-settings-card-hint">
              {t('appShell.a11y.motionHint', 'Removes the shell transitions.')}
            </p>
          </div>
          <button
            aria-pressed={settings.reduceMotion}
            className="mmm-settings-pill"
            data-active={settings.reduceMotion ? 'true' : 'false'}
            onClick={() => updateSetting('reduceMotion', !settings.reduceMotion)}
            type="button"
          >
            {settings.reduceMotion ? onLabel : offLabel}
          </button>
        </section>
      </div>
    </div>
  );
}
