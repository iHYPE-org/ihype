'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { postJson } from '@/lib/api-client';
import { resolvePostAuthRedirect } from '@/lib/auth-redirects';
import {
  AuthCardShell,
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
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);

  // Magic link state
  const [mlEmail, setMlEmail] = useState(initialIdentifier);
  const [mlSent, setMlSent] = useState(false);

  useEffect(() => {
    const available = typeof window.PublicKeyCredential !== 'undefined';
    setWebauthnAvailable(available);
    if (!available) setTab('magic');
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

  async function submitMagicLink() {
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

  async function sendMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitMagicLink();
  }

  return (
    <AuthCardShell
      eyebrow="WELCOME BACK"
      mode="signin"
      subtitle={
        tab === 'passkey'
          ? 'Use Face ID, Touch ID, or your device PIN.'
          : 'Enter your email and we\'ll send a one-tap sign-in link.'
      }
      title="Sign in."
    >
      {justRegistered && (
        <p className="authcard-status">Account created — check your inbox for your sign-in link, then add a passkey from Settings.</p>
      )}

      {tab === 'passkey' ? (
        <>
          <button className="authcard-btn-primary" disabled={isSubmitting} onClick={signInWithPasskey} type="button">
            {isSubmitting ? 'Checking passkey…' : 'Sign in with passkey'}
          </button>
          <div className="authcard-divider">or</div>
          <button className="authcard-btn-ghost" onClick={() => { setTab('magic'); setError(''); }} type="button">
            Email me a magic link
          </button>
        </>
      ) : mlSent ? (
        <div className="authcard-magic-sent">
          <div aria-hidden="true" className="authcard-icon-badge authcard-icon-badge-teal">✉️</div>
          <h2 className="authcard-magic-heading">Check your email</h2>
          <p className="authcard-magic-body">We sent a sign-in link to <b>{mlEmail}</b>. It works once and expires in 15 minutes.</p>
          <button className="authcard-resend-btn" disabled={isSubmitting} onClick={submitMagicLink} type="button">
            {isSubmitting ? 'Resending…' : 'Resend link'}
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={sendMagicLink}>
            <div className="authcard-field">
              <label>Email</label>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(e: { target: HTMLInputElement }) => setMlEmail(e.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={mlEmail}
              />
            </div>
            <button className="authcard-btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
          {webauthnAvailable && (
            <>
              <div className="authcard-divider">or</div>
              <button className="authcard-btn-ghost" onClick={() => { setTab('passkey'); setError(''); }} type="button">
                Use passkey instead
              </button>
            </>
          )}
        </>
      )}

      {error && <p className="authcard-status authcard-status-error">{error}</p>}

      <p className="authcard-fine">New to iHYPE? <Link href="/register">Create an account</Link></p>
    </AuthCardShell>
  );
}
