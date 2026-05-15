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
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [hoursText, setHoursText] = useState('');
  const [acceptedAge, setAcceptedAge] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [company, setCompany] = useState('');
  const needsPublicName = role !== 'FAN';
  const needsUploadPolicy = role === 'ARTIST' || role === 'DJ';
  const selectedRole = useMemo(() => roleOptions.find((option) => option.value === role), [role]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await postJson('/api/register', {
        name,
        email,
        username,
        role,
        isThirteenOrOlder: acceptedAge,
        acceptedArtistUploadPolicy: needsUploadPolicy ? acceptedPolicy : true,
        inviteCode,
        company,
        city,
        stateRegion,
        country,
        postalCode,
        contactInfo,
        addressLine1,
        hoursText
      });
      router.push(`/login?registered=1&identifier=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create account.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSignalShell
      badge="Join iHYPE"
      cardSubtitle="Choose the lane you are joining first. If anything needs correction, this form keeps what you already typed."
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
      <form className="form" onSubmit={createAccount}>
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

          {needsPublicName ? (
            <label className="field">
              <span>{selectedRole?.label ?? 'Profile'} name</span>
              <input onChange={(event) => setName(event.target.value)} required type="text" value={name} />
            </label>
          ) : null}

          <div className="auth-field-grid">
            <label className="field">
              <span>Email</span>
              <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            <label className="field">
              <span>Username</span>
              <input autoComplete="username" onChange={(event) => setUsername(event.target.value)} required type="text" value={username} />
            </label>
          </div>

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

          <details className="auth-optional-details">
            <summary>
              <span>Optional profile details</span>
              <small>Add location/contact now, or finish it later from your dashboard.</small>
            </summary>

            <div className="auth-field-grid">
              <label className="field">
                <span>City</span>
                <input onChange={(event) => setCity(event.target.value)} type="text" value={city} />
              </label>
              <label className="field">
                <span>State / province</span>
                <input onChange={(event) => setStateRegion(event.target.value)} type="text" value={stateRegion} />
              </label>
              <label className="field">
                <span>Country</span>
                <input onChange={(event) => setCountry(event.target.value)} type="text" value={country} />
              </label>
              <label className="field">
                <span>Home ZIP / postal code</span>
                <input onChange={(event) => setPostalCode(event.target.value)} type="text" value={postalCode} />
              </label>
            </div>

            {role === 'VENUE' ? (
              <div className="auth-field-grid">
                <label className="field">
                  <span>Venue address</span>
                  <input onChange={(event) => setAddressLine1(event.target.value)} type="text" value={addressLine1} />
                </label>
                <label className="field">
                  <span>Hours</span>
                  <input onChange={(event) => setHoursText(event.target.value)} type="text" value={hoursText} />
                </label>
              </div>
            ) : null}

            {role !== 'FAN' ? (
              <label className="field">
                <span>Contact info</span>
                <input onChange={(event) => setContactInfo(event.target.value)} type="text" value={contactInfo} />
              </label>
            ) : null}
          </details>

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
            {isSubmitting ? 'Creating account...' : 'Create account'}
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
