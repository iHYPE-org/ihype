'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

type RoleOption = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';

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

export function LoginScreen({
  justRegistered = false
}: {
  justRegistered?: boolean;
}) {
  const router = useRouter();
  const [message] = useState(
    justRegistered ? 'Account created. Add a passkey in Settings, then sign in here.' : ''
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
      router.push(payload.redirect || '/auth/landing');
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, 'Passkey sign-in failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSignalShell
      badge="Passkey sign-in"
      cardSubtitle="Use Face ID, Touch ID, or your device PIN — no password, no email code."
      cardTitle="Sign in to iHYPE"
      description="Fast, phishing-resistant sign-in with your device's built-in biometrics. No password to remember."
      eyebrow="Passkey sign-in"
      highlight="One tap."
      signals={[
        { label: 'No password', value: 'Passkey', detail: 'Device biometrics' },
        { label: 'No inbox', value: 'Instant', detail: 'No email code needed' },
        { label: 'Phishing-safe', value: 'FIDO2', detail: 'Bound to this site' }
      ]}
      title="Sign in."
    >
      <button
        className="button"
        disabled={isSubmitting}
        onClick={signInWithPasskey}
        type="button"
      >
        {isSubmitting ? 'Checking passkey...' : 'Sign in with passkey'}
      </button>

      {message ? <p className="status-note">{message}</p> : null}
      {error ? <p className="status-note status-note-error">{error}</p> : null}

      <div className="auth-route-links">
        <Link className="text-link" href="/register">
          Join free
        </Link>
      </div>
    </AuthSignalShell>
  );
}

export function RegisterScreen({ initialRole = 'FAN' }: { initialRole?: RoleOption }) {
  const router = useRouter();
  const [role, setRole] = useState<RoleOption>(initialRole);
  const [name, setName] = useState('');
  const [acceptedAge, setAcceptedAge] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [company, setCompany] = useState('');
  const [step, setStep] = useState<'form' | 'passkey'>('form');
  const needsPublicName = role !== 'FAN';
  const needsUploadPolicy = role === 'ARTIST' || role === 'DJ';
  const selectedRole = useMemo(() => roleOptions.find((option) => option.value === role), [role]);

  async function createAccountAndRegisterPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Step 1: create account
      const result = await postJson<{ id: string }>('/api/register', {
        name,
        role,
        isThirteenOrOlder: acceptedAge,
        acceptedArtistUploadPolicy: needsUploadPolicy ? acceptedPolicy : true,
        inviteCode,
        company,
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
      cardSubtitle={step === 'passkey' ? 'Follow your device prompt to save a passkey.' : 'Pick your lane, then your device saves a passkey — no password needed.'}
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
          <p>Waiting for your device passkey prompt…</p>
          <p className="subtitle">Use Face ID, Touch ID, or your device PIN when prompted.</p>
        </div>
      ) : (
        <form className="form" onSubmit={createAccountAndRegisterPasskey}>
          <fieldset className="role-choice-grid">
            <legend>Account type</legend>
            {roleOptions.map((option) => (
              <label className={option.value === role ? 'role-choice active' : 'role-choice'} key={option.value}>
                <input
                  checked={option.value === role}
                  name="role"
                  onChange={() => setRole(option.value)}
                  type="radio"
                  value={option.value}
                />
                <strong>{option.label}</strong>
                <span>{option.help}</span>
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span>{needsPublicName ? (selectedRole?.label ?? 'Profile') + ' name' : 'Display name'}</span>
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder={needsPublicName ? 'Your public artist/venue name' : 'Optional — shown on your profile'}
              required={needsPublicName}
              type="text"
              value={name}
            />
          </label>

          <label className="field">
            <span>Beta invite code</span>
            <input
              autoComplete="off"
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Required only when beta invite mode is enabled"
              type="text"
              value={inviteCode}
            />
          </label>

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
            {isSubmitting ? 'Setting up…' : 'Create account with passkey'}
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
      )}

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
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
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
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
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
