'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

const STORAGE_KEY = 'ihype_cookie_consent';

/**
 * How much of the bottom of the viewport this dialog occupies, published on
 * `:root` so other fixed chrome can move out of its way.
 *
 * Consent is a compliance surface: it must not be restyled, moved or hidden so
 * that something else can have the corner. So the dialog states its own extent
 * and the shell yields — see `.mmm-nav-anchor` in `mmm.css`, whose 76px trigger
 * sits in the lower-left corner this banner spans at phone width (its width is
 * `100vw - 32px` there), swallowing every pointer event aimed at the nav.
 *
 * Measured rather than hardcoded, because the height is not knowable in
 * advance: the copy is 11px and wraps, the product ships twelve locales, and
 * the buttons reflow onto their own line at narrow widths. Any constant would
 * be correct in English and wrong in German.
 */
const INSET_VAR = '--consent-inset';

export function CookieConsent() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable — skip banner rather than show it every load
    }
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    const root = document.documentElement;
    if (!visible || !box) {
      root.style.removeProperty(INSET_VAR);
      return;
    }

    // Distance from the bottom of the viewport to the top of the dialog, so
    // this covers the dialog's own bottom offset (which differs by breakpoint
    // and by safe-area inset) as well as its height.
    const publish = () => {
      const rect = box.getBoundingClientRect();
      root.style.setProperty(INSET_VAR, `${Math.max(0, Math.round(window.innerHeight - rect.top))}px`);
    };
    publish();

    // Observing the dialog is safe from the classic ResizeObserver
    // re-entrancy loop: the property is set on :root and read only by elements
    // outside this dialog, so nothing the callback writes can change the box it
    // measures.
    const observer = new ResizeObserver(publish);
    observer.observe(box);
    window.addEventListener('resize', publish);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      // Clear on unmount as well as on dismiss — a stale inset would hold the
      // shell's chrome up the page with nothing there to avoid.
      root.style.removeProperty(INSET_VAR);
    };
  }, [visible]);

  function choose(value: 'all' | 'essential') {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // best-effort
    }
    window.dispatchEvent(new CustomEvent('ihype:cookie-consent', { detail: value }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Cookie preferences"
      className="ihype-cookie-consent"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: 400,
        width: 'min(430px, calc(100vw - 32px))',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem 1rem',
        padding: '0.75rem 0.875rem',
        borderRadius: 12,
        background: 'var(--bg-3)',
        border: '1px solid var(--line-2)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        fontFamily: "var(--font-body, 'Work Sans', sans-serif)",
      }}
    >
      {/* 12px, not 11: the same legibility floor as the buttons. This banner
          renders on every page, so one sub-floor paragraph here was counted 16
          times over. */}
      <p style={{ flex: '1 1 230px', margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.45 }}>
        {t('cookieConsent.description', 'We use essential cookies to keep you signed in, and optional analytics cookies to understand usage in aggregate.')}{' '}
        <Link href="/info?tab=privacy" style={{ color: 'var(--accent-text, var(--accent))', textDecoration: 'underline' }}>{t('cookieConsent.privacyLink', 'Read our privacy policy')}</Link>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {/* No inline `minHeight` here: an inline style outranks every
            stylesheet, so a hardcoded 36px would defeat mobile-fit.css's 44px
            touch floor on the one dialog every first-time visitor must dismiss
            before they can use the app. See the <style> block below for the
            second half of that rule, which is where it was actually failing.
            The size is 14px now, not the 12.5px floor. These two buttons were
            the largest contributor to audit:mobile's tinyText count at 11px,
            were raised to the floor, and sat there — but the floor is the
            point below which text is a defect, not the size a sitewide
            consent control should be. */}
        <button
          onClick={() => choose('essential')}
          className="ihype-btn-ghost ihype-consent-btn"
          style={{ fontSize: '0.9375rem' }}
        >
          {t('cookieConsent.essentialOnly', 'Essential only')}
        </button>
        <button
          onClick={() => choose('all')}
          className="ihype-btn-primary ihype-consent-btn"
          style={{ fontSize: '0.9375rem', padding: '8px 14px' }}
        >
          {t('cookieConsent.acceptAll', 'Accept all')}
        </button>
      </div>
      <style>{`
        /* The design's own 36px, restored for a mouse — and gated on NOT being
           a coarse pointer, which is load-bearing rather than tidy.
           mobile-fit.css sets .ihype-btn-primary/.ihype-btn-ghost to a 44px
           min-height under (pointer: coarse). Both rules score (0,1,0), and a
           <style> element rendered into the body comes after every linked
           stylesheet — so when this rule was unconditional it won on source
           order alone and every phone got 36px. The comment above the buttons
           asserted the opposite for as long as it was wrong.
           Making the two conditions mutually exclusive is what removes source
           order from the question entirely. Written "not all and" rather than
           the Media Queries Level 4 bare negation so it parses everywhere.
           audit:css cannot catch this class of bug: it reads .css files, not
           <style> blocks inside components. */
        @media not all and (pointer: coarse) {
          .ihype-consent-btn { min-height: 36px; }
        }
        /* Clear the fixed mobile bottom nav (60px + safe-area) instead of
           sitting underneath it — the nav has a higher z-index and a solid
           background, so without this the accept/decline buttons are
           unreachable on phones. */
        @media (max-width: 768px) {
          .ihype-cookie-consent {
            bottom: calc(68px + env(safe-area-inset-bottom, 0px)) !important;
          }
        }
      `}</style>
    </div>
  );
}
