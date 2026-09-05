'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TEXT_SCALE_MAX, TEXT_SCALE_MIN, TEXT_SCALE_STEP, THEMES,
  clampTextScale, refreshSystemTextScale, useAccessibilitySettings,
} from '@/components/AccessibilityControls';
import { useI18n } from '@/components/I18nProvider';
import { MmmSegmentedTabs } from '@/components/mmm/MmmSegmentedTabs';
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@/lib/i18n/locales';

/**
 * The Accessibility route from the app-shell handoff — four cards, each of
 * which applies a real effect and persists:
 *
 *   | Card          | Control              | Applied effect                        |
 *   | Language      | locale buttons       | UI string table + <html lang>         |
 *   | Text size     | A − / A + / Reset    | root font scale 85–140%, not a scale()|
 *   | High contrast | On / Off             | stronger --line/--line-2/--ink-2/-3   |
 *   | Reduce motion | On / Off             | chrome transitions AND DS keyframes    |
 *
 * It was five, then four, and the fifth is BACK as "Theme" (owner,
 * 2026-08-24: "Can you add different themes to the app? Like dark, flowery,
 * street, metal, classical?"). The old Appearance card was removed because a
 * control offering one option is worse than no control; it now has six real
 * options — the console board plus five measured token grounds in
 * globals.css — so the reasoning that removed it is the reasoning that
 * brings it back.
 *
 * HIGH CONTRAST stays separate and is not in the theme list: it is an
 * accessibility mode with its own black ground, and it wins over any theme
 * on specificity, so a reader who needs it keeps it whatever theme is set.
 *
 * The handoff notes these persist to a localStorage key and says "in code move
 * to a preferences provider". They do: locale through I18nProvider (cookie +
 * storage, so server components see it too) and the rest through
 * AccessibilityProvider — stores that already existed, rather than a parallel
 * one.
 *
 * The prototype offers three languages; this renders the twelve the product
 * actually ships dictionaries for.
 */
export function MmmAccessibilitySettings() {
  const { t, locale, setLocale } = useI18n();
  const { settings, updateSetting } = useAccessibilitySettings();
  // The reader's SYSTEM text size, which multiplies with the control below.
  // Without this the card's percentage would be a half-truth on a phone: a
  // reader at iOS 130% and the app at 100% would be told "100%" while looking
  // at type a third larger than the number claims.
  const [systemScale, setSystemScale] = useState(1);

  useEffect(() => {
    setSystemScale(refreshSystemTextScale());
  }, []);

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
          <h2 className="mmm-settings-card-title">{t('appShell.a11y.theme', 'Theme')}</h2>
          <p className="mmm-settings-card-hint">
            {t('appShell.a11y.themeHint', 'Light and Dark follow the phone. The other four keep the console: walnut, brass and the chart.')}
          </p>
          <MmmSegmentedTabs
            className="mmm-settings-card-controls"
            items={THEMES.map((name) => ({
              id: name,
              /* 'console' is the stored id of the DEFAULT theme and stays so saved
                 preferences keep resolving; since 2026-09-05 the default is the
                 Apple Music light look, so its label says what it is. */
              label: t(`appShell.a11y.theme_${name}`, name === 'console' ? 'Light' : name[0].toUpperCase() + name.slice(1)),
              active: settings.theme === name,
              onSelect: () => updateSetting('theme', name),
            }))}
            label={t('appShell.a11y.theme', 'Theme')}
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
          <p className="mmm-settings-card-hint" role="status">
            {systemScale > 1.005
              ? t('appShell.a11y.textSizeCombined', '{app}% here · {system}% from your device · {total}% in total')
                  .replace('{app}', String(scalePercent))
                  .replace('{system}', String(Math.round(systemScale * 100)))
                  .replace('{total}', String(Math.min(160, Math.round(settings.textScale * systemScale * 100))))
              : `${scalePercent}%`}
          </p>
          {systemScale > 1.005 ? (
            <p className="mmm-settings-card-hint">
              {t(
                'appShell.a11y.textSizeSystemHint',
                'Your device is already set to larger text and the app follows it. This control adjusts on top of that.',
              )}
            </p>
          ) : null}
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
