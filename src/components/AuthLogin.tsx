'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { postJson } from '@/lib/api-client';
import { resolvePostAuthRedirect } from '@/lib/auth-redirects';
import {
  AuthSignalShell,
  getErrorMessage,
  getPasskeyDiagnostics,
  trackSignupFunnel,
} from '@/components/AuthShared';

type LoginTab = 'passkey' | 'magic';

export function LoginScreen({
  initialIdentifier = '',
  justRegistered = false,
}: {
  initialIdentifier?: string;
  justRegistered?: boolean;
}) {
  const [tab, setTab] = useState<LoginTab>('passkey');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Magic link state
  const [mlEmail, setMlEmail] = useState(initialIdentifier);
  const [mlSent, setMlSent] = useState(false);

  useEffect(() => {
    if (typeof window.PublicKeyCredential === 'undefined') setTab('magic');
  }, []);

  async function signInWithPasskey() {
    setError('');
    setIsSubmitting(true);
    try {
      const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');
      const query = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : '';
      const options = await fetch(`/api/auth/passkey/auth${query}`).then(r => r.json());
      if (options.error) throw new Error(options.error);
      const assertion = await startAuthentication({ optionsJSON: options });
      const payload = await postJson<{ redirect?: string }>('/api/auth/passkey/auth', assertion);
      trackSignupFunnel('login_passkey_success', { method: 'passkey', step: 'login', ...getPasskeyDiagnostics() });
      window.location.href = resolvePostAuthRedirect(payload.redirect);
    } catch (err) {
      const reason = getErrorMessage(err, 'Passkey sign-in failed. Try again or use magic link.');
      trackSignupFunnel('login_passkey_failed', { method: 'passkey', step: 'login', reason, ...getPasskeyDiagnostics(err) });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await postJson('/api/auth/magic-link', { email: mlEmail });
      setMlSent(true);
      trackSignupFunnel('login_magic_link_sent', { method: 'email', step: 'login' });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send link. Try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSignalShell
      compactOnMobile
      badge={tab === 'passkey' ? 'Passkey sign-in' : 'Magic link sign-in'}
      cardSubtitle={
        tab === 'passkey'
          ? 'Use Face ID, Touch ID, or your device PIN.'
          : 'Enter your email and we\'ll send a one-tap sign-in link.'
      }
      cardTitle="Sign in to iHYPE"
      description="Fast sign-in with passkeys, or a magic link sent to your inbox."
      eyebrow="Secure sign-in"
      highlight="Your lane."
      signals={[
        { label: 'Primary', value: 'Passkey', detail: 'Device biometrics' },
        { label: 'Fallback', value: 'Magic link', detail: 'One tap from inbox' },
        { label: 'Session', value: '12 hours', detail: 'Short-lived auth' },
      ]}
      title="Sign in."
    >
      {justRegistered && (
        <p className="status-note">Account created — check your inbox for your sign-in link, then add a passkey from Settings.</p>
      )}

      <div className="auth-method-grid" role="tablist" aria-label="Sign-in method">
        <button
          aria-selected={tab === 'passkey'}
          className={tab === 'passkey' ? 'auth-method-choice active' : 'auth-method-choice'}
          onClick={() => { setTab('passkey'); setError(''); }}
          type="button"
        >
          <strong>Passkey</strong>
          <span>Face ID, Touch ID, or device PIN.</span>
        </button>
        <button
          aria-selected={tab === 'magic'}
          className={tab === 'magic' ? 'auth-method-choice active' : 'auth-method-choice'}
          onClick={() => { setTab('magic'); setError(''); }}
          type="button"
        >
          <strong>Magic link</strong>
          <span>One-tap link sent to your inbox.</span>
        </button>
      </div>

      {tab === 'passkey' ? (
        <>
          <button className="button" disabled={isSubmitting} onClick={signInWithPasskey} type="button">
            {isSubmitting ? 'Checking passkey…' : 'Sign in with passkey'}
          </button>
          {error && (
            <button className="button secondary" onClick={() => { setTab('magic'); setError(''); }} type="button" style={{ marginTop: 8 }}>
              Use magic link instead
            </button>
          )}
        </>
      ) : mlSent ? (
        <p className="status-note">Check your inbox for a sign-in link (expires in 15 min). You can close this tab.</p>
      ) : (
        <form className="form" onSubmit={sendMagicLink}>
          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(e: { target: HTMLInputElement }) => setMlEmail(e.target.value)}
              required
              type="email"
              value={mlEmail}
            />
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      )}

      {error && <p className="status-note status-note-error">{error}</p>}

      <div className="auth-route-links">
        <Link className="text-link" href="/register">Join free</Link>
      </div>
    </AuthSignalShell>
  );
}
