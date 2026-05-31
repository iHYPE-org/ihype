'use client';

import type { ReactNode } from 'react';
import { postJson } from '@/lib/api-client';

export type RoleOption = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';
export type AuthMethod = 'email' | 'passkey';
export type RegisterStep = 'form' | 'passkey' | 'email-code';
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
  { value: 'DJ', label: 'Promoter', help: 'Create radio-style shows and connect scenes.' },
  { value: 'VENUE', label: 'Venue', help: 'Manage events, ticketing, and demand signals.' }
];

export type AuthSignal = {
  label: string;
  value: string;
  detail: string;
};

export function AuthSignalShell({
  eyebrow,
  title,
  highlight,
  description,
  badge,
  cardTitle,
  cardSubtitle,
  signals,
  wide = false,
  children
}: {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  badge: string;
  cardTitle: string;
  cardSubtitle: string;
  signals: AuthSignal[];
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={wide ? 'auth-signal-page auth-signal-page-wide' : 'auth-signal-page'}>
      <div className="auth-signal-shell">
        <div className="auth-signal-copy">
          <p className="auth-signal-eyebrow">{eyebrow}</p>
          <h1>
            {title}
            <span>{highlight}</span>
          </h1>
          <p>{description}</p>
          <div className="auth-signal-grid" aria-label="iHYPE account signals">
            {signals.map((signal) => (
              <article className="auth-signal-tile" key={signal.label}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
                <small>{signal.detail}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="auth-route-card auth-signal-card">
          <div className="badge">{badge}</div>
          <h2>{cardTitle}</h2>
          <p className="subtitle">{cardSubtitle}</p>
          {children}
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

// ---------------------------------------------------------------------------
// MagicLinkButton — used only by LoginScreen but kept here to avoid a
// circular import between AuthLogin.tsx and a dedicated tiny file.
// ---------------------------------------------------------------------------
import { useState } from 'react';
import type { FormEvent } from 'react';

export function MagicLinkButton() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await postJson('/api/auth/magic-link', { email });
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send link.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="text-link" onClick={() => setOpen(true)} type="button">
        Email me a sign-in link
      </button>
    );
  }

  if (sent) {
    return <p className="status-note">Check your inbox for a sign-in link (expires in 15 min).</p>;
  }

  return (
    <form className="form" onSubmit={send} style={{ marginTop: 4 }}>
      <label className="field">
        <span>Email</span>
        <input autoComplete="email" inputMode="email" onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
      </label>
      <button className="button secondary" disabled={busy} type="submit" style={{ fontSize: 13 }}>
        {busy ? 'Sending...' : 'Send sign-in link'}
      </button>
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </form>
  );
}
