'use client';

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type AccessibilitySettings = {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  readableFont: boolean;
  language: string;
};

const STORAGE_KEY = 'ihype-accessibility-settings';

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  reduceMotion: false,
  underlineLinks: false,
  readableFont: false,
  language: 'en'
};

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
  { value: 'fr', label: 'Francais' },
  { value: 'pt', label: 'Portugues' }
];

function getStoredSettings() {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return defaultSettings;
  }

  try {
    return {
      ...defaultSettings,
      ...(JSON.parse(storedValue) as Partial<AccessibilitySettings>)
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return defaultSettings;
  }
}

function applyClass(className: string, enabled: boolean) {
  document.documentElement.classList.toggle(className, enabled);
}

type AccessibilityContextValue = {
  settings: AccessibilitySettings;
  updateSetting: <Key extends keyof AccessibilitySettings>(key: Key, value: AccessibilitySettings[Key]) => void;
  resetSettings: () => void;
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

/**
 * Mounted once at the app root (AppProviders), independent of whether the
 * Accessibility panel UI is open — a saved preference (high contrast,
 * larger text, etc.) needs to re-apply on every fresh page load, not just
 * while AccessibilityControls itself happens to be mounted (e.g. only while
 * the nav drawer containing it is open).
 */
export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);

  useEffect(() => {
    setSettings(getStoredSettings());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    applyClass('high-contrast', settings.highContrast);
    applyClass('a11y-large-text', settings.largeText);
    applyClass('a11y-reduce-motion', settings.reduceMotion);
    applyClass('a11y-underline-links', settings.underlineLinks);
    applyClass('a11y-readable-font', settings.readableFont);
    document.documentElement.lang = settings.language;
    document.documentElement.dataset.accessibilityLanguage = settings.language;

    if (hasLoaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  }, [hasLoaded, settings]);

  function updateSetting<Key extends keyof AccessibilitySettings>(
    key: Key,
    value: AccessibilitySettings[Key]
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function resetSettings() {
    setSettings(defaultSettings);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function AccessibilityControls({ inline = false }: { inline?: boolean } = {}) {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(inline);
  const ctx = useContext(AccessibilityContext);
  const settings = ctx?.settings ?? defaultSettings;
  const updateSetting = ctx?.updateSetting ?? (() => {});
  const resetSettings = ctx?.resetSettings ?? (() => {});

  useEffect(() => {
    if (!isOpen || inline) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [inline, isOpen]);

  const activeCount = [
    settings.highContrast,
    settings.largeText,
    settings.reduceMotion,
    settings.underlineLinks,
    settings.readableFont,
    settings.language !== 'en'
  ].filter(Boolean).length;

  const panel = (
    <section
      aria-label="Accessibility settings"
      className={inline ? 'a11y-panel a11y-panel-inline' : 'a11y-panel'}
      id={panelId}
    >
      <div className="a11y-panel-head">
        <div>
          <strong>Accessibility</strong>
          <p className="meta">Preferences apply across the full site on this device.</p>
        </div>
        {!inline ? (
          <button className="a11y-close" onClick={() => setIsOpen(false)} type="button">
            Close
          </button>
        ) : null}
      </div>

      <div className="a11y-option-grid">
        <label className="a11y-option">
          <input
            checked={settings.highContrast}
            onChange={(event) => updateSetting('highContrast', event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>High contrast</strong>
            <small>Maximizes text and border contrast.</small>
          </span>
        </label>

        <label className="a11y-option">
          <input
            checked={settings.largeText}
            onChange={(event) => updateSetting('largeText', event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Larger text</strong>
            <small>Increases base text size site-wide.</small>
          </span>
        </label>

        <label className="a11y-option">
          <input
            checked={settings.reduceMotion}
            onChange={(event) => updateSetting('reduceMotion', event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Reduce motion</strong>
            <small>Minimizes animation and smooth scrolling.</small>
          </span>
        </label>

        <label className="a11y-option">
          <input
            checked={settings.underlineLinks}
            onChange={(event) => updateSetting('underlineLinks', event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Underline links</strong>
            <small>Makes text links easier to identify.</small>
          </span>
        </label>

        <label className="a11y-option">
          <input
            checked={settings.readableFont}
            onChange={(event) => updateSetting('readableFont', event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Readable font</strong>
            <small>Uses a simpler font stack for long reading.</small>
          </span>
        </label>
      </div>

      <label className="a11y-language">
        <span>Page language for assistive tech</span>
        <select
          aria-describedby={`${panelId}-language-help`}
          onChange={(event) => updateSetting('language', event.target.value)}
          value={settings.language}
        >
          {languageOptions.map((language) => (
            <option key={language.value} value={language.value}>
              {language.label}
            </option>
          ))}
        </select>
        <small id={`${panelId}-language-help`}>
          Updates the page language metadata for screen readers and browser translation tools.
        </small>
      </label>

      <div className="a11y-actions">
        <button className="a11y-close" onClick={resetSettings} type="button">
          Reset
        </button>
        {!inline ? (
          <button
            onClick={() => setIsOpen(false)}
            type="button"
            style={{
              background: 'var(--accent, #ff5029)', color: '#fff', border: 'none',
              borderRadius: 999, padding: '8px 16px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Apply
          </button>
        ) : null}
      </div>
    </section>
  );

  if (inline) {
    return panel;
  }

  return (
    <div className="a11y-menu">
      <button
        aria-label="Open accessibility preferences"
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="nav-a11y-button"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        Accessibility{activeCount ? ` (${activeCount})` : ''}
      </button>

      {isOpen ? panel : null}
    </div>
  );
}

export function RouteAccessibilityAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const title = document.title || 'iHYPE.org';
    setAnnouncement(`${title} loaded`);
  }, [pathname]);

  return (
    <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
      {announcement}
    </div>
  );
}
