'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { postJson } from '@/lib/api-client';
import { useI18n } from '@/components/I18nProvider';

export type RoleOption = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';
export type AuthMethod = 'email' | 'passkey';
export type RegisterStep = 'gate' | 'form' | 'passkey' | 'magic-link-sent';
export type SignupVariant = 'email_first' | 'passkey_first';
export type SignupFunnelMetadata = {
  role?: RoleOption;
  method?: AuthMethod;
  step?: string;
  reason?: string;
  browser?: string;
  platform?: string;
  webauthn?: string;
  errorName?: string;
  variant?: string;
  viewport?: string;
};

export const roleOptions: Array<{ value: RoleOption; label: string; help: string }> = [
  { value: 'FAN', label: 'Fan', help: 'Discover, hype, playlist, and track your music life.' },
  { value: 'ARTIST', label: 'Artist', help: 'Publish your page, media, shows, and growth signals.' },
  { value: 'DJ', label: 'DJ', help: 'Create radio-style shows, connect scenes, and promote with HYPE Links.' },
  { value: 'VENUE', label: 'Venue', help: 'Manage events, ticketing, and demand signals.' }
];

/**
 * Single centered auth card — matches the Auth.dc.html redesign. Replaces
 * the old two-column AuthSignalShell (marketing copy + glass card); the
 * sitewide header already carries the pitch, so this page is just the form.
 */
export function AuthCardShell({
  mode,
  eyebrow,
  title,
  subtitle,
  children
}: {
  mode: 'signin' | 'signup';
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const sceneTitle = mode === 'signin' ? 'Your scene is waiting.' : 'Free local music. Built around you.';
  const sceneBody = mode === 'signin'
    ? 'Pick up where you left off—your HYPEs, discovery playlist, radio, and local shows are ready.'
    : 'Hear what is happening nearby, HYPE what deserves attention, and help real local music reach real people.';
  return (
    <section className={`authcard-page authcard-page-${mode}`}>
      <header className="authcard-header">
        <Link aria-label="iHYPE home" className="authcard-brand" href="/">
          <Image alt="" height={46} priority src="/brand/ihype-signal-mark.svg" width={46} />
          <span><b>iHYPE</b><small>LOCAL SIGNAL</small></span>
        </Link>
        <Link className="authcard-home-link" href="/">Free local music <span aria-hidden="true">↗</span></Link>
      </header>

      <div aria-hidden="true" className="authcard-atmosphere"><span /><span /><i /><i /><i /><i /><i /><i /><i /></div>

      <div className="authcard-layout">
        <aside className="authcard-scene">
          <p>YOUR MUSIC · YOUR SCENE · YOUR SIGNAL</p>
          <h2>{sceneTitle}</h2>
          <p>{sceneBody}</p>
          <div className="authcard-scene-points">
            <span><i /> Listen free</span>
            <span><i /> HYPE what matters</span>
            <span><i /> We never sell your data</span>
          </div>
        </aside>

        <div className="authcard-wrap">
          <p className="authcard-eyebrow">{eyebrow}</p>
          <h1 className="authcard-title">{title}</h1>
          <p className="authcard-sub">{subtitle}</p>

          <div className="authcard-tabs" role="tablist" aria-label="Sign in or create an account">
            <Link
              aria-selected={mode === 'signin'}
              className={mode === 'signin' ? 'authcard-tab active' : 'authcard-tab'}
              href="/login"
              role="tab"
            >
              {t('authShared.signInTab', 'Sign In')}
            </Link>
            <Link
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'authcard-tab active' : 'authcard-tab'}
              href="/register"
              role="tab"
            >
              {t('authShared.createAccountTab', 'Create Account')}
            </Link>
          </div>

          <div className="authcard-box">{children}</div>

          <p className="authcard-charter">{t('authShared.charterLine', 'iHYPE takes nothing · locked in the charter')}</p>
        </div>
      </div>
    </section>
  );
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function trackSignupFunnel(event: string, metadata: SignupFunnelMetadata = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  void fetch('/api/analytics/signup-funnel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...metadata }),
    keepalive: true
  }).catch(() => {
    // Analytics should never block auth.
  });
}

export function getBrowserLabel(userAgent: string) {
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('Chrome/')) return 'Chrome';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Safari';
  return 'Other';
}

export function getPasskeyDiagnostics(error?: unknown): SignupFunnelMetadata {
  if (typeof window === 'undefined') {
    return {};
  }

  const nav = window.navigator;
  return {
    browser: getBrowserLabel(nav.userAgent),
    platform: nav.platform || 'unknown',
    webauthn: typeof window.PublicKeyCredential === 'function' ? 'available' : 'missing',
    errorName: error instanceof Error ? error.name : undefined,
    viewport: `${window.innerWidth}x${window.innerHeight}`
  };
}

export function getStoredSignupVariant(): SignupVariant {
  if (typeof window === 'undefined') {
    return 'email_first';
  }

  const stored = window.localStorage.getItem('ihype-signup-variant');
  if (stored === 'email_first' || stored === 'passkey_first') {
    return stored;
  }

  const next: SignupVariant = Math.random() < 0.5 ? 'email_first' : 'passkey_first';
  window.localStorage.setItem('ihype-signup-variant', next);
  return next;
}

