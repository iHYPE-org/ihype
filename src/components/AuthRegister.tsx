'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { postJson } from '@/lib/api-client';
import { resolvePostAuthRedirect } from '@/lib/auth-redirects';
import {
  AuthCardShell,
  getErrorMessage,
  getPasskeyDiagnostics,
  getStoredSignupVariant,
  roleOptions,
  trackSignupFunnel,
} from '@/components/AuthShared';
import type { AuthMethod, RegisterStep, RoleOption, SignupVariant } from '@/components/AuthShared';
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/TurnstileWidget';
import { RequestBetaAccessForm } from '@/components/RequestBetaAccessForm';
import { useI18n } from '@/components/I18nProvider';

type PasskeyRegistrationOptions = Parameters<typeof startRegistration>[0]['optionsJSON'];

const ROLE_COLOR: Record<RoleOption, string> = {
  FAN: 'var(--role-fan)',
  ARTIST: 'var(--role-artist)',
  DJ: 'var(--role-dj)',
  VENUE: 'var(--role-venue)'
};

export function RegisterScreen({
  initialRole = 'FAN',
  inviteOnly = false
}: {
  initialRole?: RoleOption;
  inviteOnly?: boolean;
}) {
  const { t } = useI18n();
  const [role, setRole] = useState<RoleOption>(initialRole);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [signupVariant, setSignupVariant] = useState<SignupVariant>('email_first');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedAge, setAcceptedAge] = useState(false);
  const [acceptedAdult, setAcceptedAdult] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [company, setCompany] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [step, setStep] = useState<RegisterStep>(inviteOnly ? 'gate' : 'form');
  const [gateChecking, setGateChecking] = useState(false);
  const [gateError, setGateError] = useState('');
  const [createdAccountId, setCreatedAccountId] = useState('');
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  // Holds a pre-fetched WebAuthn challenge so the "Try passkey again" tap can
  // call startRegistration() with no awaited network in between — see
  // registerPasskeyForAccount for why iOS Safari needs that.
  const preparedPasskeyOptionsRef = useRef<PasskeyRegistrationOptions | null>(null);
  // TurnstileWidget renders nothing when this is unset (local/dev without a
  // site key configured) — only gate submission on a token when the widget
  // can actually produce one, or signup would deadlock in those environments.
  const turnstileConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const awaitingTurnstile = turnstileConfigured && !turnstileToken;
  const needsPublicName = role !== 'FAN';
  const needsUploadPolicy = role === 'ARTIST' || role === 'DJ';
  const selectedRole = useMemo(() => roleOptions.find((option) => option.value === role), [role]);

  useEffect(() => {
    const variant = getStoredSignupVariant();
    setSignupVariant(variant);
    setAuthMethod(variant === 'passkey_first' ? 'passkey' : 'email');
    trackSignupFunnel('view', { role: initialRole, method: variant === 'passkey_first' ? 'passkey' : 'email', step: 'form', variant });
  }, [initialRole]);

  function validateAccountForm() {
    if (!email.trim()) {
      throw new Error(t('authRegister.emailRequired', 'Email is required so you can sign in with a magic link.'));
    }
  }

  async function createAccountOnce() {
    validateAccountForm();

    if (createdAccountId) {
      return { id: createdAccountId };
    }

    const result = await postJson<{ id: string }>('/api/register', {
      name,
      email: email.trim(),
      phone: phone.trim() || undefined,
      role,
      isThirteenOrOlder: acceptedAge,
      isEighteenOrOlder: acceptedAdult,
      acceptedArtistUploadPolicy: needsUploadPolicy ? acceptedPolicy : true,
      inviteCode: inviteOnly ? inviteCode : undefined,
      company,
      passkeyFlow: authMethod === 'passkey',
      turnstileToken: turnstileToken || undefined,
    });

    setCreatedAccountId(result.id);
    trackSignupFunnel('account_created', { role, method: authMethod, step: 'register', variant: signupVariant });
    return result;
  }

  async function sendSignupMagicLink() {
    await postJson('/api/auth/magic-link', { email: email.trim() });
    setStep('magic-link-sent');
    setStatus(t('authRegister.magicLinkSentStatus', 'Account created. Check your inbox for a one-tap sign-in link.'));
    trackSignupFunnel('login_magic_link_sent', { role, method: 'email', step: 'register', variant: signupVariant });
  }

  async function fetchPasskeyOptions(userId: string): Promise<PasskeyRegistrationOptions> {
    const optRes = await fetch(`/api/auth/passkey/register-first?userId=${userId}`);
    if (!optRes.ok) throw new Error(t('authRegister.passkeySetupError', 'Could not start passkey setup.'));
    return optRes.json();
  }

  // Pre-fetch the WebAuthn challenge in the background so a later button tap
  // can start the ceremony synchronously. iOS Safari only runs
  // navigator.credentials.create() inside the transient user activation from a
  // tap; if an awaited fetch sits between the tap and the ceremony it consumes
  // that activation and the Face ID / passkey sheet silently never appears
  // (the "Waiting for your device passkey prompt" hang). Fire-and-forget and
  // tolerant — the ceremony falls back to an inline fetch if this hasn't
  // resolved yet.
  function preparePasskeyOptions(userId: string) {
    preparedPasskeyOptionsRef.current = null;
    void fetchPasskeyOptions(userId)
      .then((options) => { preparedPasskeyOptionsRef.current = options; })
      .catch(() => { preparedPasskeyOptionsRef.current = null; });
  }

  async function registerPasskeyForAccount(userId: string, prefetched?: PasskeyRegistrationOptions | null) {
    setStep('passkey');
    setStatus(t('authRegister.passkeyFollowPrompt', 'Follow your device prompt. If it closes, retry here or finish with a magic link.'));
    trackSignupFunnel('passkey_prompt', { role, method: 'passkey', step: 'register', variant: signupVariant, ...getPasskeyDiagnostics() });

    // When options are already in hand, startRegistration() is the first
    // awaited call after the user gesture — keeping iOS's activation valid.
    const options = prefetched ?? await fetchPasskeyOptions(userId);
    trackSignupFunnel('passkey_prompt_ready', { role, method: 'passkey', step: 'register', variant: signupVariant, ...getPasskeyDiagnostics() });
    const credential = await startRegistration({ optionsJSON: options });
    const verifyRes = await postJson<{ redirect?: string }>('/api/auth/passkey/register-first', credential);
    trackSignupFunnel('passkey_success', { role, method: 'passkey', step: 'register', variant: signupVariant, ...getPasskeyDiagnostics() });
    window.location.href = resolvePostAuthRedirect(verifyRes.redirect);
  }

  async function submitGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGateError('');
    const code = inviteCode.trim();
    if (!code) {
      setGateError(t('authRegister.gateCodeRequired', 'Enter a HYPE referral code to continue.'));
      return;
    }
    setGateChecking(true);
    try {
      const result = await postJson<{ valid: boolean; error?: string }>('/api/referral/validate', { code });
      if (result.valid) {
        trackSignupFunnel('invite_gate_passed', { role, method: authMethod, step: 'gate', variant: signupVariant });
        setStep('form');
      } else {
        setGateError(result.error ?? t('authRegister.gateCodeNotRecognized', 'That code isn’t recognized. Ask an existing member for their HYPE code.'));
      }
    } catch (err) {
      setGateError(getErrorMessage(err, t('authRegister.gateCodeCheckError', 'Could not check that code. Please try again.')));
    } finally {
      setGateChecking(false);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStatus('');
    setIsSubmitting(true);
    let accountCreated = Boolean(createdAccountId);
    let accountId = createdAccountId;

    try {
      // Turnstile's challenge usually resolves in well under a second, but it's
      // still async — a fast submit (autofill, or someone who fills the form
      // quickly) can beat it, sending no token and failing the bot check even
      // though the widget itself is working. Catch that case client-side with
      // a clearer, retryable message instead of letting it hit the server and
      // come back as a generic "Bot check failed."
      if (!accountCreated && awaitingTurnstile) {
        throw new Error(t('authRegister.turnstilePending', 'Still verifying you’re human — give it a second and try again.'));
      }

      trackSignupFunnel('submit', { role, method: authMethod, step: 'form', variant: signupVariant });
      const result = await createAccountOnce();
      accountCreated = true;
      accountId = result.id;

      if (authMethod === 'passkey') {
        await registerPasskeyForAccount(result.id);
      } else {
        await sendSignupMagicLink();
      }
    } catch (err) {
      const reason = getErrorMessage(err, t('authRegister.createAccountError', 'Could not create account.'));
      trackSignupFunnel(authMethod === 'passkey' ? 'passkey_failed' : 'login_magic_link_failed', {
        role,
        method: authMethod,
        step: accountCreated ? step : 'form',
        reason,
        variant: signupVariant,
        ...(authMethod === 'passkey' ? getPasskeyDiagnostics(err) : {})
      });
      if (accountCreated) {
        setStep('passkey');
        setStatus(t('authRegister.accountCreatedRetryPasskey', 'Your account was created. Retry the passkey prompt or use a magic link to finish signing in.'));
        // Warm a fresh challenge so the retry tap can open the prompt without
        // an awaited fetch first — the fix for iOS never showing the sheet.
        if (authMethod === 'passkey' && accountId) preparePasskeyOptions(accountId);
      } else {
        setStep('form');
        // Turnstile tokens are single-use — a failed /api/register call already
        // consumed this one, so every retry would fail the bot check again
        // (even for an unrelated error like a duplicate email) unless we fetch
        // a fresh token now.
        setTurnstileToken('');
        turnstileRef.current?.reset();
      }
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function retryPasskey() {
    if (!createdAccountId) {
      setStep('form');
      return;
    }

    setError('');
    setIsSubmitting(true);
    // Consume the pre-fetched challenge (if warmed) so startRegistration()
    // runs inside this tap's user activation — the whole point on iOS.
    const prefetched = preparedPasskeyOptionsRef.current;
    preparedPasskeyOptionsRef.current = null;
    try {
      await registerPasskeyForAccount(createdAccountId, prefetched);
    } catch (err) {
      const reason = getErrorMessage(err, t('authRegister.passkeyInterrupted', 'Passkey setup was interrupted.'));
      trackSignupFunnel('passkey_retry_failed', { role, method: 'passkey', step: 'register', reason, variant: signupVariant, ...getPasskeyDiagnostics(err) });
      setError(reason);
      setStatus(t('authRegister.retryPasskeyOrMagicLink', 'Retry the passkey prompt, or use a magic link to finish signing in.'));
      // Re-arm a fresh challenge for the next tap.
      preparePasskeyOptions(createdAccountId);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function useMagicLinkInstead() {
    setError('');
    setIsSubmitting(true);
    try {
      await sendSignupMagicLink();
    } catch (err) {
      const reason = getErrorMessage(err, t('authRegister.magicLinkSendError', 'Could not send a magic link.'));
      trackSignupFunnel('login_magic_link_failed', { role, method: 'email', step: 'register', reason, variant: signupVariant });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCardShell
      eyebrow={t('authRegister.eyebrow', 'JOIN THE SCENE')}
      mode="signup"
      subtitle={
        step === 'gate'
          ? t('authRegister.subtitleGate', 'iHYPE is in private alpha. Enter a HYPE referral code from an existing member to continue.')
          : step === 'passkey'
          ? t('authRegister.subtitlePasskey', 'Retry the device prompt or finish with a magic link. Your account is not stranded.')
          : step === 'magic-link-sent'
          ? t('authRegister.subtitleMagicLinkSent', 'Check your inbox for a one-tap link to finish signing in. You can add a passkey later from Settings.')
          : t('authRegister.subtitleDefault', 'A free fan account for discovering, supporting, and strengthening local music.')
      }
      title={t('authRegister.title', 'Join your local scene.')}
    >
      {step === 'gate' ? (
        <div className="authcard-gate">
          <div className="authcard-alpha-banner">
            <strong>{t('authRegister.alphaBannerStrong', 'iHYPE is currently in private alpha.')}</strong> {t('authRegister.alphaBannerBody', 'To keep the alpha small and well-tested, new accounts need a HYPE code from an existing member. Enter one below to continue, or request access and we’ll reach out for the official launch.')}
          </div>
          <form onSubmit={submitGate}>
            <div className="authcard-field">
              <label htmlFor="authcard-gate-code">{t('authRegister.gateCodeLabel', 'HYPE referral code')}</label>
              <input
                id="authcard-gate-code"
                autoComplete="off"
                autoFocus
                onChange={(event) => {
                  setInviteCode(event.target.value);
                  if (gateError) setGateError('');
                }}
                placeholder={t('authRegister.gateCodePlaceholder', "A member's code or @username")}
                required
                type="text"
                value={inviteCode}
              />
            </div>
            <button className="authcard-btn-primary" disabled={gateChecking} type="submit">
              {gateChecking ? t('authRegister.checking', 'Checking…') : t('authRegister.continueBtn', 'Continue')}
            </button>
          </form>
          <p className="authcard-privacy-promise">
            <span aria-hidden="true">◇</span> {t('authRegister.privacyPromise', 'Free forever. We never sell your data.')}
          </p>
          {gateError ? <p className="authcard-status authcard-status-error">{gateError}</p> : null}
          <RequestBetaAccessForm role={role} />
        </div>
      ) : step === 'passkey' ? (
        <div className="authcard-passkey-pending">
          <p>{t('authRegister.waitingForPrompt', 'Waiting for your device passkey prompt.')}</p>
          <p className="meta">{t('authRegister.passkeyPromptHint', 'Use Face ID, Touch ID, or your device PIN when prompted.')}</p>
          <div className="authcard-passkey-actions">
            <button className="authcard-btn-primary" disabled={isSubmitting} onClick={retryPasskey} type="button">
              {isSubmitting ? t('authRegister.openingPrompt', 'Opening prompt...') : t('authRegister.tryPasskeyAgain', 'Try passkey again')}
            </button>
            <button className="authcard-btn-ghost" disabled={isSubmitting} onClick={useMagicLinkInstead} type="button">
              {t('authRegister.useMagicLinkInstead', 'Use a magic link instead')}
            </button>
          </div>
          <p className="meta">{t('authRegister.addPasskeyLater', 'You can add a passkey later from Settings after signing in.')}</p>
        </div>
      ) : step === 'magic-link-sent' ? (
        <div className="authcard-magic-sent">
          <div aria-hidden="true" className="authcard-icon-badge authcard-icon-badge-teal">✉️</div>
          <h2 className="authcard-magic-heading">{t('authRegister.checkYourEmail', 'Check your email')}</h2>
          <p className="authcard-magic-body">{t('authRegister.magicLinkSentBody', 'We sent a sign-in link to')} <b>{email.trim()}</b>. {t('authRegister.magicLinkExpiry', 'It works once and expires in 15 minutes.')}</p>
          <button className="authcard-resend-btn" disabled={isSubmitting} onClick={useMagicLinkInstead} type="button">
            {isSubmitting ? t('authRegister.resending', 'Resending…') : t('authRegister.resendLink', 'Resend link')}
          </button>
        </div>
      ) : (
        <form onSubmit={createAccount}>
          {inviteOnly ? (
            <div className="authcard-gate-confirmed">
              <span aria-hidden="true">✓</span> {t('authRegister.gateAccepted', 'HYPE code accepted — finish creating your account below.')}
            </div>
          ) : null}
          <fieldset className="authcard-field">
            <legend>{t('authRegister.joiningAsLegend', "I'm joining as")}</legend>
            <div className="authcard-role-grid">
              {roleOptions.map((option) => (
                <label
                  className={option.value === role ? 'authcard-role-opt active' : 'authcard-role-opt'}
                  key={option.value}
                  style={option.value === role
                    ? ({ '--role-c': ROLE_COLOR[option.value], '--role-bg': `${ROLE_COLOR[option.value]}1a` } as React.CSSProperties)
                    : undefined}
                >
                  <input
                    checked={option.value === role}
                    className="authcard-role-radio"
                    name="role"
                    onChange={() => {
                      setRole(option.value);
                      trackSignupFunnel('role_selected', { role: option.value, method: authMethod, step: 'form', variant: signupVariant });
                    }}
                    type="radio"
                    value={option.value}
                  />
                  <div className="authcard-role-dot" style={{ background: ROLE_COLOR[option.value] }} />
                  <div className="authcard-role-name">{t(`authRegister.roleLabel.${option.value}`, option.label)}</div>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="authcard-method-grid" role="tablist" aria-label="Signup method">
            <button
              aria-selected={authMethod === 'email'}
              role="tab"
              className={authMethod === 'email' ? 'authcard-method-choice active' : 'authcard-method-choice'}
              onClick={() => {
                setAuthMethod('email');
                trackSignupFunnel('method_selected', { role, method: 'email', step: 'form', variant: signupVariant });
              }}
              type="button"
            >
              <strong>{t('authRegister.magicLinkTitle', 'Magic link')}</strong>
              <span>{t('authRegister.magicLinkDesc', 'Most reliable: one-tap link sent to your inbox.')}</span>
            </button>
            <button
              aria-selected={authMethod === 'passkey'}
              role="tab"
              className={authMethod === 'passkey' ? 'authcard-method-choice active' : 'authcard-method-choice'}
              onClick={() => {
                setAuthMethod('passkey');
                trackSignupFunnel('method_selected', { role, method: 'passkey', step: 'form', variant: signupVariant });
              }}
              type="button"
            >
              <strong>{t('authRegister.passkeyTitle', 'Passkey')}</strong>
              <span>{t('authRegister.passkeyDesc', 'Use your device prompt now, with a magic link as backup.')}</span>
            </button>
          </div>

          <div className="authcard-field">
            <label>{needsPublicName ? (selectedRole?.label ?? t('authRegister.profileLabel', 'Profile')) + ' ' + t('authRegister.nameSuffix', 'name') : t('authRegister.displayNameLabel', 'Display name')}</label>
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder={needsPublicName ? t('authRegister.publicNamePlaceholder', 'Your public artist/venue name') : t('authRegister.displayNamePlaceholder', 'Optional - shown on your profile')}
              required={needsPublicName}
              type="text"
              value={name}
            />
          </div>

          <div className="authcard-field">
            <label>{t('authRegister.emailLabel', 'Email')} <span className="authcard-field-optional">— {t('authRegister.emailOptionalHint', 'required so passkey setup can fall back safely')}</span></label>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('authRegister.emailPlaceholder', 'you@example.com')}
              required
              type="email"
              value={email}
            />
          </div>

          <div className="authcard-field">
            <label>{t('authRegister.phoneLabel', 'Phone')}</label>
            <input
              autoComplete="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t('authRegister.phonePlaceholder', 'Optional')}
              type="tel"
              value={phone}
            />
          </div>

          <label className="authcard-check-row">
            <input checked={acceptedAge} onChange={(event) => setAcceptedAge(event.target.checked)} required type="checkbox" />
            <span>
              {t('authRegister.ageAttestation', 'I attest that I am 13 years of age or older and I recognize that iHYPE is not responsible for any content within.')}
            </span>
          </label>

          <label className="authcard-check-row">
            <input checked={acceptedAdult} onChange={(event) => setAcceptedAdult(event.target.checked)} type="checkbox" />
            <span>
              {t('authRegister.adultAttestation', 'I am 18 or older')} <span className="authcard-field-optional">— {t('authRegister.adultAttestationHint', 'optional now, but required to buy tickets or share referral links. You can confirm later in Settings.')}</span>
            </span>
          </label>

          {needsUploadPolicy ? (
            <label className="authcard-check-row">
              <input
                checked={acceptedPolicy}
                onChange={(event) => setAcceptedPolicy(event.target.checked)}
                required
                type="checkbox"
              />
              <span>{t('authRegister.uploadPolicyAttestation', 'I confirm I am authorized to upload or use the music/media I add to iHYPE.')}</span>
            </label>
          ) : null}

          <TurnstileWidget
            ref={turnstileRef}
            onToken={setTurnstileToken}
            onExpire={() => setTurnstileToken('')}
          />
          <p className="authcard-privacy-promise">
            <span aria-hidden="true">◇</span> {t('authRegister.privacyPromise', 'Free forever. We never sell your data.')}
          </p>
          <button className="authcard-btn-primary" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? t('authRegister.settingUp', 'Setting up...')
              : authMethod === 'passkey'
              ? t('authRegister.createAccountPasskey', 'Create account with passkey')
              : t('authRegister.createAccountMagicLink', 'Create account with magic link')}
          </button>
          <div className="authcard-trust-row" aria-label="Signup trust links">
            <Link href="/info?tab=privacy">{t('authRegister.privacyLink', 'Privacy')}</Link>
            <Link href="/info?tab=terms">{t('authRegister.termsLink', 'Terms')}</Link>
            <Link href="/community-rules">{t('authRegister.communityRulesLink', 'Community rules')}</Link>
          </div>
          <label className="bot-field" aria-hidden="true">
            <span>Company</span>
            <input
              autoComplete="off"
              onChange={(event) => setCompany(event.target.value)}
              tabIndex={-1}
              type="text"
              value={company}
            />
          </label>
        </form>
      )}

      {status ? <p className="authcard-status">{status}</p> : null}
      {error ? <p className="authcard-status authcard-status-error">{error}</p> : null}

      <p className="authcard-fine">{t('authRegister.alreadyHaveAccount', 'Already have an account?')} <Link href="/login">{t('authRegister.signInLink', 'Sign in')}</Link></p>
    </AuthCardShell>
  );
}
