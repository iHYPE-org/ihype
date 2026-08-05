'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WebAuthnAbortService,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
} from '@simplewebauthn/browser';
import { postJson } from '@/lib/api-client';
import { resolvePostAuthRedirect } from '@/lib/auth-redirects';
import {
  AuthCardShell,
  getErrorMessage,
  getPasskeyDiagnostics,
  trackSignupFunnel,
} from '@/components/AuthShared';
import { useI18n } from '@/components/I18nProvider';

/**
 * Single-step sign-in (Auth.dc.html / Design System 6).
 *
 * One email field, one button. There is no passkey-vs-magic-link tab strip
 * any more: the method resolves itself.
 *
 * HOW, AND WHY IT IS NOT AN EMAIL-LOOKUP ENDPOINT. The obvious way to build
 * "one field that knows which method to use" is to POST the address and have
 * the server answer "this account has a passkey" / "it doesn't". Do not add
 * that. It is a user-enumeration oracle on the platform's only sign-in path —
 * anyone could test addresses for account existence, unauthenticated and at
 * whatever rate the bucket allows.
 *
 * It is also unnecessary, because `/api/auth/passkey/auth` has always issued
 * DISCOVERABLE-credential options (`getPasskeyAuthenticationOptions()` with no
 * userId sends no `allowCredentials`). The authenticator already knows which
 * passkeys it holds for this site, so the browser can offer them without the
 * server being told who is asking.
 *
 * So the passkey path runs as a WebAuthn *conditional* ceremony — the field is
 * marked `autocomplete="username webauthn"` and the ceremony is armed on mount,
 * which makes the browser list the user's passkeys inside the ordinary autofill
 * dropdown. Picking one signs in with zero typing. Typing an address and
 * submitting sends a magic link instead. Neither branch reveals whether an
 * account exists, and the server learns nothing it did not already know.
 *
 * THE EXPLICIT "Sign in with passkey" BUTTON IS A DELIBERATE DEVIATION from
 * the .dc.html, which shows one field and one button and nothing else. Three
 * reasons, none of them visible in a static mock:
 *
 *  1. Conditional mediation is not universal. Without the button, a browser
 *     that lacks it loses the passkey path entirely and silently.
 *  2. Discoverability. The autofill dropdown only appears if the user focuses
 *     the field and notices it; platform guidance is to pair conditional UI
 *     with an explicit control, not to replace one with the other.
 *  3. It is the only passkey affordance an end-to-end test can drive. The
 *     autofill dropdown is browser chrome, not DOM, so Playwright cannot
 *     click it — making this button the difference between the mandatory
 *     passkey suite covering sign-in and not covering it at all. On the
 *     platform's only auth path that is not a trade worth making.
 *
 * What the redesign actually removes is the *choice*: there is no tab strip,
 * no method to pick before identifying yourself, one field and one primary
 * CTA. The passkey button is a secondary affordance under a divider.
 */
export function LoginScreen({
  initialIdentifier = '',
  justRegistered = false,
}: {
  initialIdentifier?: string;
  justRegistered?: boolean;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState(initialIdentifier);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);
  const [autofillAvailable, setAutofillAvailable] = useState(false);
  // Guards the conditional ceremony against React 18 StrictMode's double
  // effect invocation — two overlapping ceremonies would abort each other.
  const conditionalStarted = useRef(false);

  const callbackQuery = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');
    return callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : '';
  }, []);

  const completePasskey = useCallback(async (assertion: unknown) => {
    const payload = await postJson<{ redirect?: string }>('/api/auth/passkey/auth', assertion);
    trackSignupFunnel('login_passkey_success', { method: 'passkey', step: 'login', ...getPasskeyDiagnostics() });
    window.location.href = resolvePostAuthRedirect(payload.redirect);
  }, []);

  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    setWebauthnAvailable(true);

    let cancelled = false;
    void (async () => {
      const supported = await browserSupportsWebAuthnAutofill().catch(() => false);
      if (cancelled) return;
      setAutofillAvailable(supported);
      if (!supported || conditionalStarted.current) return;
      conditionalStarted.current = true;

      try {
        const options = await fetch(`/api/auth/passkey/auth${callbackQuery()}`).then((r) => r.json());
        if (cancelled || options.error) return;
        // Resolves only once the user picks a passkey from the autofill
        // dropdown; stays pending otherwise, which is the intended behaviour.
        const assertion = await startAuthentication({ optionsJSON: options, useBrowserAutofill: true });
        if (cancelled) return;
        await completePasskey(assertion);
      } catch {
        // An aborted or dismissed conditional ceremony is the normal case —
        // the user simply typed their email instead. Never surface it: this
        // ceremony was armed by the page, not requested by the user.
      }
    })();

    return () => {
      cancelled = true;
      WebAuthnAbortService.cancelCeremony();
    };
  }, [callbackQuery, completePasskey]);

  async function signInWithPasskey() {
    setError('');
    setIsSubmitting(true);
    try {
      const options = await fetch(`/api/auth/passkey/auth${callbackQuery()}`).then((r) => r.json());
      if (options.error) throw new Error(options.error);
      const assertion = await startAuthentication({ optionsJSON: options });
      await completePasskey(assertion);
    } catch (err) {
      const reason = getErrorMessage(err, t('authLogin.passkeyFailed', 'Passkey sign-in failed. Try again or use your email.'));
      trackSignupFunnel('login_passkey_failed', { method: 'passkey', step: 'login', reason, ...getPasskeyDiagnostics(err) });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitMagicLink() {
    setError('');
    setIsSubmitting(true);
    // The user has chosen email, so stop offering the passkey dropdown.
    WebAuthnAbortService.cancelCeremony();
    try {
      await postJson('/api/auth/magic-link', { email });
      setSent(true);
      trackSignupFunnel('login_magic_link_sent', { method: 'email', step: 'login' });
    } catch (err) {
      setError(getErrorMessage(err, t('authLogin.sendLinkFailed', 'Could not send link. Try again.')));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitMagicLink();
  }

  return (
    <AuthCardShell
      eyebrow={t('authLogin.eyebrow', 'WELCOME BACK')}
      mode="signin"
      // Only promise the in-field passkey picker where conditional mediation
      // actually exists — elsewhere the button below is the only passkey path.
      subtitle={
        autofillAvailable
          ? t('authLogin.subtitleAutofill', 'Enter your email for a one-tap sign-in link — or pick your passkey straight from the field.')
          : t('authLogin.subtitle', 'Enter your email and we will send you a one-tap sign-in link.')
      }
      title={t('authLogin.title', 'Sign in.')}
    >
      {justRegistered && (
        <p className="authcard-status">{t('authLogin.justRegistered', 'Account created — check your inbox for your sign-in link, then add a passkey from Settings.')}</p>
      )}

      {sent ? (
        <div className="authcard-magic-sent">
          <div aria-hidden="true" className="authcard-icon-badge authcard-icon-badge-teal">{'✉︎'}</div>
          <h2 className="authcard-magic-heading">{t('authLogin.checkEmail', 'Check your email')}</h2>
          <p className="authcard-magic-body">{t('authLogin.sentLinkPrefix', 'We sent a sign-in link to')} <b>{email}</b>. {t('authLogin.sentLinkSuffix', 'It works once and expires in 15 minutes.')}</p>
          <button className="authcard-resend-btn" disabled={isSubmitting} onClick={submitMagicLink} type="button">
            {isSubmitting ? t('authLogin.resending', 'Resending…') : t('authLogin.resendLink', 'Resend link')}
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit}>
            <div className="authcard-field">
              <label htmlFor="auth-email">{t('authLogin.emailLabel', 'Email')}</label>
              <input
                // "username webauthn" is what arms the conditional ceremony —
                // without the webauthn token the browser will not offer
                // passkeys in this field's autofill dropdown.
                autoComplete="username webauthn"
                id="auth-email"
                inputMode="email"
                onChange={(e: { target: HTMLInputElement }) => setEmail(e.target.value)}
                placeholder={t('authLogin.emailPlaceholder', 'you@example.com')}
                required
                type="email"
                value={email}
              />
            </div>
            <button className="authcard-btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? t('authLogin.sending', 'Sending…') : t('authLogin.continue', 'Continue')}
            </button>
          </form>

          {webauthnAvailable && (
            <>
              <div className="authcard-divider">{t('authLogin.or', 'or')}</div>
              <button className="authcard-btn-ghost" disabled={isSubmitting} onClick={signInWithPasskey} type="button">
                {t('authLogin.signInWithPasskey', 'Sign in with passkey')}
              </button>
            </>
          )}

          <p className="authcard-fine authcard-nopasswords">{t('authLogin.noPasswords', 'No passwords. Ever.')}</p>
        </>
      )}

      {error && <p className="authcard-status authcard-status-error">{error}</p>}

      <p className="authcard-fine">{t('authLogin.newToIhype', 'New to iHYPE?')} <Link href="/register">{t('authLogin.createAccount', 'Create an account')}</Link></p>
    </AuthCardShell>
  );
}
