'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

type RoleOption = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';
type AuthMethod = 'email' | 'passkey';
type RegisterStep = 'form' | 'passkey' | 'email-code';
type SignupVariant = 'email_first' | 'passkey_first';
type SignupFunnelMetadata = {
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

const roleOptions: Array<{ value: RoleOption; label: string; help: string }> = [
  { value: 'FAN', label: 'Fan', help: 'Discover, hype, playlist, and track your music life.' },
  { value: 'ARTIST', label: 'Artist', help: 'Publish your page, media, shows, and growth signals.' },
  { value: 'DJ', label: 'Promoter', help: 'Create radio-style shows and connect scenes.' },
  { value: 'VENUE', label: 'Venue', help: 'Manage events, ticketing, and demand signals.' }
];

type AuthSignal = {
  label: string;
  value: string;
  detail: string;
};

function AuthSignalShell({
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Request failed.');
  }

  return payload as T;
}

function getAuthLandingPath(redirect?: string) {
  if (!redirect || redirect.startsWith('/auth/landing')) {
    return '/auth/landing?module=tool-hub';
  }

  return redirect;
}

function trackSignupFunnel(event: string, metadata: SignupFunnelMetadata = {}) {
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

function getBrowserLabel(userAgent: string) {
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('Chrome/')) return 'Chrome';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Safari';
  return 'Other';
}

function getPasskeyDiagnostics(error?: unknown): SignupFunnelMetadata {
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

function getStoredSignupVariant(): SignupVariant {
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

export function LoginScreen({
  initialIdentifier = '',
  justRegistered = false
}: {
  initialIdentifier?: string;
  justRegistered?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMethod>(justRegistered ? 'email' : 'passkey');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [emailStep, setEmailStep] = useState<'credentials' | 'code'>('credentials');
  const [message] = useState(
    justRegistered ? 'Account created. Sign in with your email code, then add a passkey from Settings when ready.' : ''
  );
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signInWithPasskey() {
    setError('');
    setIsSubmitting(true);
    try {
      const optRes = await fetch('/api/auth/passkey/auth');
      const options = await optRes.json();
      const assertion = await startAuthentication(options);
      const payload = await postJson<{ redirect?: string }>('/api/auth/passkey/auth', assertion);
      trackSignupFunnel('login_passkey_success', { method: 'passkey', step: 'login', ...getPasskeyDiagnostics() });
      router.push(getAuthLandingPath(payload.redirect));
      router.refresh();
    } catch (err) {
      const reason = getErrorMessage(err, 'Passkey sign-in failed. Please try again or use email code.');
      trackSignupFunnel('login_passkey_failed', { method: 'passkey', step: 'login', reason, ...getPasskeyDiagnostics(err) });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const payload = await postJson<{ challengeId: string; email?: string | null }>('/api/auth/otp/request', {
        identifier,
        password
      });
      setChallengeId(payload.challengeId);
      setDeliveryEmail(payload.email || identifier);
      setEmailStep('code');
      trackSignupFunnel('login_email_code_requested', { method: 'email', step: 'login' });
    } catch (err) {
      const reason = getErrorMessage(err, 'Could not send a sign-in code.');
      trackSignupFunnel('login_email_code_failed', { method: 'email', step: 'login', reason });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const payload = await postJson<{ redirect?: string }>('/api/auth/otp/signin', {
        challengeId,
        otp
      });
      trackSignupFunnel('login_email_code_success', { method: 'email', step: 'login' });
      router.push(getAuthLandingPath(payload.redirect));
      router.refresh();
    } catch (err) {
      const reason = getErrorMessage(err, 'Could not verify that code.');
      trackSignupFunnel('login_email_code_verify_failed', { method: 'email', step: 'login', reason });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSignalShell
      badge={mode === 'passkey' ? 'Passkey sign-in' : 'Email code sign-in'}
      cardSubtitle={
        mode === 'passkey'
          ? 'Use Face ID, Touch ID, or your device PIN. Email code stays available as a fallback.'
          : 'Enter your email or username, confirm your password, then use the one-time email code.'
      }
      cardTitle="Sign in to iHYPE"
      description="Fast sign-in when passkeys are available, with an email-code lane when the browser or device prompt gets in the way."
      eyebrow="Secure sign-in"
      highlight="Your lane."
      signals={[
        { label: 'Primary', value: 'Passkey', detail: 'Device biometrics' },
        { label: 'Fallback', value: 'Email code', detail: 'No stranded account' },
        { label: 'Session', value: '12 hours', detail: 'Short-lived auth' }
      ]}
      title="Sign in."
    >
      <div className="auth-method-grid" role="tablist" aria-label="Sign-in method">
        <button
          aria-selected={mode === 'passkey'}
          className={mode === 'passkey' ? 'auth-method-choice active' : 'auth-method-choice'}
          onClick={() => {
            setMode('passkey');
            setError('');
          }}
          type="button"
        >
          <strong>Passkey</strong>
          <span>Face ID, Touch ID, or device PIN.</span>
        </button>
        <button
          aria-selected={mode === 'email'}
          className={mode === 'email' ? 'auth-method-choice active' : 'auth-method-choice'}
          onClick={() => {
            setMode('email');
            setError('');
          }}
          type="button"
        >
          <strong>Email code</strong>
          <span>Password plus one-time inbox code.</span>
        </button>
      </div>

      {mode === 'passkey' ? (
        <>
          <button
            className="button"
            disabled={isSubmitting}
            onClick={signInWithPasskey}
            type="button"
          >
            {isSubmitting ? 'Checking passkey...' : 'Sign in with passkey'}
          </button>
          {error ? (
            <button
              className="button secondary"
              onClick={() => { setMode('email'); setError(''); }}
              type="button"
              style={{ marginTop: 8 }}
            >
              Use email instead
            </button>
          ) : null}
        </>
      ) : emailStep === 'credentials' ? (
        <form className="form" onSubmit={requestEmailCode}>
          <label className="field">
            <span>Email or username</span>
            <input
              autoComplete="username"
              onChange={(event) => setIdentifier(event.target.value)}
              required
              type="text"
              value={identifier}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Sending code...' : 'Send email code'}
          </button>
        </form>
      ) : (
        <form className="form" onSubmit={verifyEmailCode}>
          <p className="status-note">Enter the 6-digit code sent to {deliveryEmail}.</p>
          <label className="field">
            <span>6-digit code</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              pattern="[0-9]{6}"
              required
              type="text"
              value={otp}
            />
          </label>
          <div className="auth-code-actions">
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Verifying...' : 'Verify code'}
            </button>
            <button className="text-link" onClick={() => setEmailStep('credentials')} type="button">
              Change email
            </button>
          </div>
        </form>
      )}

      {message ? <p className="status-note">{message}</p> : null}
      {error ? <p className="status-note status-note-error">{error}</p> : null}

      <div className="auth-route-links">
        <Link className="text-link" href="/register">
          Join free
        </Link>
        <Link className="text-link" href="/forgot-password">
          Reset password
        </Link>
        <MagicLinkButton />
      </div>
    </AuthSignalShell>
  );
}

function MagicLinkButton() {
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

export function RegisterScreen({
  initialRole = 'FAN',
  inviteOnly = false
}: {
  initialRole?: RoleOption;
  inviteOnly?: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<RoleOption>(initialRole);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [signupVariant, setSignupVariant] = useState<SignupVariant>('email_first');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedAge, setAcceptedAge] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [company, setCompany] = useState('');
  const [step, setStep] = useState<RegisterStep>('form');
  const [createdAccountId, setCreatedAccountId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [otp, setOtp] = useState('');
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
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      throw new Error('Email is required so you can sign in if the passkey prompt is blocked.');
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error('Password must be at least 8 characters and include a letter and a number.');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
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
      password,
      role,
      isThirteenOrOlder: acceptedAge,
      acceptedArtistUploadPolicy: needsUploadPolicy ? acceptedPolicy : true,
      inviteCode: inviteOnly ? inviteCode : undefined,
      company,
      passkeyFlow: authMethod === 'passkey',
    });

    setCreatedAccountId(result.id);
    trackSignupFunnel('account_created', { role, method: authMethod, step: 'register', variant: signupVariant });
    return result;
  }

  async function requestEmailCodeForAccount() {
    const payload = await postJson<{ challengeId: string; email?: string | null }>('/api/auth/otp/request', {
      identifier: email.trim(),
      password
    });

    setChallengeId(payload.challengeId);
    setDeliveryEmail(payload.email || email.trim());
    setOtp('');
    setStep('email-code');
    setStatus('Account created. Check your inbox for the 6-digit sign-in code.');
    trackSignupFunnel('email_code_requested', { role, method: 'email', step: 'register', variant: signupVariant });
  }

  async function registerPasskeyForAccount(userId: string) {
    setStep('passkey');
    setStatus('Follow your device prompt. If it closes, retry here or finish with an email code.');
    trackSignupFunnel('passkey_prompt', { role, method: 'passkey', step: 'register', variant: signupVariant, ...getPasskeyDiagnostics() });

    const optRes = await fetch(`/api/auth/passkey/register-first?userId=${userId}`);
    if (!optRes.ok) throw new Error('Could not start passkey setup.');
    const options = await optRes.json();
    trackSignupFunnel('passkey_prompt_ready', { role, method: 'passkey', step: 'register', variant: signupVariant, ...getPasskeyDiagnostics() });
    const credential = await startRegistration(options);
    const verifyRes = await postJson<{ redirect?: string }>('/api/auth/passkey/register-first', credential);
    trackSignupFunnel('passkey_success', { role, method: 'passkey', step: 'register', variant: signupVariant, ...getPasskeyDiagnostics() });
    router.push(getAuthLandingPath(verifyRes.redirect));
    router.refresh();
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStatus('');
    setIsSubmitting(true);
    let accountCreated = Boolean(createdAccountId);

    try {
      trackSignupFunnel('submit', { role, method: authMethod, step: 'form', variant: signupVariant });
      const result = await createAccountOnce();
      accountCreated = true;

      if (authMethod === 'passkey') {
        await registerPasskeyForAccount(result.id);
      } else {
        await requestEmailCodeForAccount();
      }
    } catch (err) {
      const reason = getErrorMessage(err, 'Could not create account.');
      trackSignupFunnel(authMethod === 'passkey' ? 'passkey_failed' : 'email_code_failed', {
        role,
        method: authMethod,
        step: accountCreated ? step : 'form',
        reason,
        variant: signupVariant,
        ...(authMethod === 'passkey' ? getPasskeyDiagnostics(err) : {})
      });
      if (accountCreated) {
        setStep('passkey');
        setStatus('Your account was created. Retry the passkey prompt or use email code to finish signing in.');
      } else {
        setStep('form');
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
    try {
      await registerPasskeyForAccount(createdAccountId);
    } catch (err) {
      const reason = getErrorMessage(err, 'Passkey setup was interrupted.');
      trackSignupFunnel('passkey_retry_failed', { role, method: 'passkey', step: 'register', reason, variant: signupVariant, ...getPasskeyDiagnostics(err) });
      setError(reason);
      setStatus('Retry the passkey prompt, or use email code to finish signing in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function useEmailCodeInstead() {
    setError('');
    setIsSubmitting(true);
    try {
      await requestEmailCodeForAccount();
    } catch (err) {
      const reason = getErrorMessage(err, 'Could not send an email sign-in code.');
      trackSignupFunnel('email_code_failed', { role, method: 'email', step: 'register', reason, variant: signupVariant });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifySignupEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const payload = await postJson<{ redirect?: string }>('/api/auth/otp/signin', {
        challengeId,
        otp
      });
      trackSignupFunnel('email_code_success', { role, method: 'email', step: 'register', variant: signupVariant });
      router.push(getAuthLandingPath(payload.redirect));
      router.refresh();
    } catch (err) {
      const reason = getErrorMessage(err, 'Could not verify that code.');
      trackSignupFunnel('email_code_verify_failed', { role, method: 'email', step: 'register', reason, variant: signupVariant });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createAccountAndRegisterPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Step 1: create account
      const result = await postJson<{ id: string }>('/api/register', {
        name,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
        isThirteenOrOlder: acceptedAge,
        acceptedArtistUploadPolicy: needsUploadPolicy ? acceptedPolicy : true,
        inviteCode,
        company,
        passkeyFlow: true,
      });

      // Step 2: get passkey registration options (no session needed — new account)
      setStep('passkey');
      const optRes = await fetch(`/api/auth/passkey/register-first?userId=${result.id}`);
      if (!optRes.ok) throw new Error('Could not start passkey setup.');
      const options = await optRes.json();

      // Step 3: device prompts user for biometric / PIN
      const credential = await startRegistration(options);

      // Step 4: verify and receive session
      const verifyRes = await postJson<{ redirect?: string }>('/api/auth/passkey/register-first', credential);
      router.push(verifyRes.redirect || '/auth/landing');
      router.refresh();
    } catch (err) {
      setStep('form');
      setError(getErrorMessage(err, 'Could not create account.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSignalShell
      badge="Join iHYPE"
      cardSubtitle={
        step === 'passkey'
          ? 'Retry the device prompt or finish with an email code. Your account is not stranded.'
          : step === 'email-code'
          ? 'Enter the inbox code to finish signup. You can add a passkey later from Settings.'
          : 'Pick your lane, then choose email-code signup or passkey setup with an email fallback.'
      }
      cardTitle="Create your account"
      description="One free account opens the ecosystem. Pick your role first, then build the page, shows, tickets, and discovery tools that match your lane."
      eyebrow="Free forever"
      highlight="Choose your lane."
      signals={[
        { label: 'Fans', value: 'Hype', detail: 'Discover and attend' },
        { label: 'Artists', value: 'Publish', detail: 'Media and tour signals' },
        { label: 'Rooms', value: 'Book', detail: 'Venue event tools' }
      ]}
      title="Join free."
      wide
    >
      {step === 'passkey' ? (
        <div className="auth-passkey-pending">
          <p>Waiting for your device passkey prompt.</p>
          <p className="subtitle">Use Face ID, Touch ID, or your device PIN when prompted.</p>
          <div className="auth-passkey-actions">
            <button className="button" disabled={isSubmitting} onClick={retryPasskey} type="button">
              {isSubmitting ? 'Opening prompt...' : 'Try passkey again'}
            </button>
            <button className="button secondary" disabled={isSubmitting} onClick={useEmailCodeInstead} type="button">
              Use email code instead
            </button>
          </div>
          <p className="meta">You can add a passkey later from Settings after email sign-in.</p>
        </div>
      ) : step === 'email-code' ? (
        <form className="form" onSubmit={verifySignupEmailCode}>
          <p className="status-note">Enter the 6-digit code sent to {deliveryEmail}.</p>
          <label className="field">
            <span>6-digit code</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              pattern="[0-9]{6}"
              required
              type="text"
              value={otp}
            />
          </label>
          <div className="auth-code-actions">
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Verifying...' : 'Finish signup'}
            </button>
            <button className="text-link" disabled={isSubmitting} onClick={useEmailCodeInstead} type="button">
              Send a new code
            </button>
          </div>
        </form>
      ) : (
        <form className="form" onSubmit={createAccount}>
          <fieldset className="role-choice-grid">
            <legend>Account type</legend>
            {roleOptions.map((option) => (
              <label className={option.value === role ? 'role-choice active' : 'role-choice'} key={option.value}>
                <input
                  checked={option.value === role}
                  name="role"
                  onChange={() => {
                    setRole(option.value);
                    trackSignupFunnel('role_selected', { role: option.value, method: authMethod, step: 'form', variant: signupVariant });
                  }}
                  type="radio"
                  value={option.value}
                />
                <strong>{option.label}</strong>
                <span>{option.help}</span>
              </label>
            ))}
          </fieldset>

          <div className="auth-method-grid" role="tablist" aria-label="Signup method">
            <button
              aria-selected={authMethod === 'email'}
              className={authMethod === 'email' ? 'auth-method-choice active' : 'auth-method-choice'}
              onClick={() => {
                setAuthMethod('email');
                trackSignupFunnel('method_selected', { role, method: 'email', step: 'form', variant: signupVariant });
              }}
              type="button"
            >
              <strong>Email code</strong>
              <span>Most reliable: verify by inbox code, add passkey later.</span>
            </button>
            <button
              aria-selected={authMethod === 'passkey'}
              className={authMethod === 'passkey' ? 'auth-method-choice active' : 'auth-method-choice'}
              onClick={() => {
                setAuthMethod('passkey');
                trackSignupFunnel('method_selected', { role, method: 'passkey', step: 'form', variant: signupVariant });
              }}
              type="button"
            >
              <strong>Passkey</strong>
              <span>Use your device prompt now, with email code as backup.</span>
            </button>
          </div>

          <label className="field">
            <span>{needsPublicName ? (selectedRole?.label ?? 'Profile') + ' name' : 'Display name'}</span>
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder={needsPublicName ? 'Your public artist/venue name' : 'Optional - shown on your profile'}
              required={needsPublicName}
              type="text"
              value={name}
            />
          </label>

          <div className="field-group-label">Sign-in backup <span className="field-group-optional">- required so passkey setup can fall back safely</span></div>

          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          <div className="auth-field-grid">
            <label className="field">
              <span>Password</span>
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
          </div>

          <label className="field">
            <span>Phone</span>
            <input
              autoComplete="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Optional"
              type="tel"
              value={phone}
            />
          </label>

          {inviteOnly ? (
            <label className="field">
              <span>Beta invite code</span>
              <input
                autoComplete="off"
                onChange={(event) => setInviteCode(event.target.value)}
                required
                type="text"
                value={inviteCode}
              />
            </label>
          ) : null}

          <label className="check-row">
            <input checked={acceptedAge} onChange={(event) => setAcceptedAge(event.target.checked)} required type="checkbox" />
            <span>
              I attest that I am 13 years of age or older and I recognize that iHYPE is not responsible for any
              content within.
            </span>
          </label>

          {needsUploadPolicy ? (
            <label className="check-row">
              <input
                checked={acceptedPolicy}
                onChange={(event) => setAcceptedPolicy(event.target.checked)}
                required
                type="checkbox"
              />
              <span>I confirm I am authorized to upload or use the music/media I add to iHYPE.</span>
            </label>
          ) : null}

          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? 'Setting up...'
              : authMethod === 'passkey'
              ? 'Create account with passkey'
              : 'Create account with email code'}
          </button>
          <div className="auth-trust-row" aria-label="Signup trust links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/community-rules">Community rules</Link>
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

      {status ? <p className="status-note">{status}</p> : null}
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </AuthSignalShell>
  );
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [company, setCompany] = useState('');

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const payload = await postJson<{ message?: string }>('/api/auth/password-reset/request', { email, company });
      setCodeRequested(true);
      setMessage(payload.message || 'If that email exists, a reset passcode has been sent.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not request a reset code.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const payload = await postJson<{ message?: string }>('/api/auth/password-reset/confirm', {
        email,
        code,
        password,
        confirmPassword
      });
      setMessage(payload.message || 'Password updated.');
      setCode('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update your password.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSignalShell
      badge="Password reset"
      cardSubtitle="Request a temporary code, then enter it within the 5-minute reset window."
      cardTitle={codeRequested ? 'Enter your reset code' : 'Reset your password'}
      description="Reset codes are single-purpose and short-lived. If an email is not connected to an account, iHYPE keeps the response private."
      eyebrow="Account recovery"
      highlight="Reset securely."
      signals={[
        { label: 'Window', value: '5 min', detail: 'Temporary reset code' },
        { label: 'Privacy', value: 'Quiet', detail: 'No account enumeration' },
        { label: 'Return', value: 'Sign in', detail: 'Back to your lane' }
      ]}
      title="Need a new key?"
    >
      {!codeRequested ? (
        <form className="form" onSubmit={requestReset}>
          <label className="field">
            <span>Email</span>
            <input autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Sending...' : 'Send reset code'}
          </button>
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
      ) : (
        <form className="form" onSubmit={confirmReset}>
          <label className="field">
            <span>Email</span>
            <input autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label className="field">
            <span>6-digit reset code</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              pattern="[0-9]{6}"
              required
              type="text"
              value={code}
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Updating...' : 'Update password'}
          </button>
        </form>
      )}

      {message ? <p className="status-note">{message}</p> : null}
      {error ? <p className="status-note status-note-error">{error}</p> : null}

      <div className="auth-route-links">
        <Link className="text-link" href="/login">
          Back to sign in
        </Link>
      </div>
    </AuthSignalShell>
  );
}

type PasskeyEntry = {
  id: string;
  deviceType: string;
  createdAt: string;
  backedUp: boolean;
};

export function PasskeyManager() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyEntry[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadPasskeys() {
    setLoadingList(true);
    try {
      const res = await fetch('/api/auth/passkey/list');
      const data = await res.json();
      setPasskeys(data.passkeys ?? []);
    } catch {
      // silently ignore list errors
    } finally {
      setLoadingList(false);
    }
  }

  // Load on mount
  useEffect(() => {
    void loadPasskeys();
  }, []);

  async function registerPasskey() {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const optRes = await fetch('/api/auth/passkey/register');
      const options = await optRes.json();
      const attestation = await startRegistration(options);
      await postJson('/api/auth/passkey/register', attestation);
      setStatus('Passkey added. You can now sign in without a password.');
      void loadPasskeys();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not register passkey.'));
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string) {
    setRemovingId(id);
    setError('');
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not remove passkey.');
      }
      void loadPasskeys();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove passkey.'));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <button className="button" disabled={busy} onClick={registerPasskey} type="button">
        {busy ? 'Registering...' : 'Add a passkey'}
      </button>
      {status ? <p className="status-note" style={{ marginTop: 8 }}>{status}</p> : null}
      {error ? <p className="status-note status-note-error" style={{ marginTop: 8 }}>{error}</p> : null}

      {!loadingList && passkeys && passkeys.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Registered passkeys</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {passkeys.map((pk) => (
              <li key={pk.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ flex: 1 }}>
                  <span style={{ textTransform: 'capitalize' }}>{pk.deviceType.replace(/-/g, ' ')}</span>
                  {pk.backedUp ? ' · synced' : ' · single device'}
                  {' · '}
                  {new Date(pk.createdAt).toLocaleDateString()}
                </span>
                <button
                  className="button"
                  disabled={removingId === pk.id}
                  onClick={() => void removePasskey(pk.id)}
                  style={{ padding: '4px 12px', fontSize: '0.85em' }}
                  type="button"
                >
                  {removingId === pk.id ? 'Removing...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
