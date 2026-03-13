'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

type ResetStage = 'request' | 'confirm';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const requestedCallbackUrl = searchParams.get('callbackUrl');
  const callbackUrl = requestedCallbackUrl || '/auth/landing';
  const defaultEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [showReset, setShowReset] = useState(false);
  const [resetStage, setResetStage] = useState<ResetStage>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetPending, setResetPending] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    setEmail(defaultEmail);
    setResetEmail(defaultEmail);
  }, [defaultEmail]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl
    });

    if (result?.error) {
      setMessage('Invalid email or password.');
      setPending(false);
      return;
    }

    window.location.assign(result?.url ?? callbackUrl);
  }

  async function handleResetRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetPending(true);
    setResetMessage(null);

    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: resetEmail || email
        })
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setResetMessage(data.error ?? 'Unable to send a reset code right now.');
        return;
      }

      const nextEmail = resetEmail || email;
      setEmail(nextEmail);
      setResetEmail(nextEmail);
      setResetStage('confirm');
      setResetMessage(data.message ?? 'Check your inbox for the six-digit reset passcode.');
    } finally {
      setResetPending(false);
    }
  }

  async function handleResetConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetMessage(null);

    if (resetPassword !== resetConfirmPassword) {
      setResetMessage('New password and confirmation must match.');
      return;
    }

    setResetPending(true);

    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: resetEmail || email,
          code: resetCode,
          password: resetPassword,
          confirmPassword: resetConfirmPassword
        })
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setResetMessage(data.error ?? 'Unable to update your password right now.');
        return;
      }

      setPassword('');
      setResetCode('');
      setResetPassword('');
      setResetConfirmPassword('');
      setShowReset(false);
      setResetStage('request');
      setMessage(data.message ?? 'Password updated. Sign in with your new password.');
    } finally {
      setResetPending(false);
    }
  }

  return (
    <main className="container section">
      <div className="auth-shell">
        <div className="panel auth-panel">
          <h1>Login</h1>
          <p className="kicker">
            Demo users: fan@ihype.org, dj@ihype.org, artist@ihype.org, venue@ihype.org. Password: demo12345. Admin:
            admin@ihype.org / 123456.
          </p>

          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                name="email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (!resetEmail) {
                    setResetEmail(event.target.value);
                  }
                }}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button className="button" disabled={pending} type="submit">
              {pending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="auth-inline-actions">
            <button
              className="text-link"
              onClick={() => {
                setShowReset((current) => !current);
                setResetMessage(null);
                setResetStage('request');
                setResetEmail(email);
              }}
              type="button"
            >
              {showReset ? 'Hide password reset' : 'Forgot password?'}
            </button>
          </div>

          {message ? <p className="status-note">{message}</p> : null}
        </div>

        {showReset ? (
          <div className="panel auth-panel auth-reset-panel">
            <div className="auth-reset-header">
              <div>
                <h2>Password reset</h2>
                <p className="meta">A six-digit passcode will expire 5 minutes after it is sent.</p>
              </div>
              {resetStage === 'confirm' ? (
                <button
                  className="button secondary small"
                  onClick={() => {
                    setResetStage('request');
                    setResetCode('');
                    setResetPassword('');
                    setResetConfirmPassword('');
                    setResetMessage(null);
                  }}
                  type="button"
                >
                  Resend code
                </button>
              ) : null}
            </div>

            {resetStage === 'request' ? (
              <form className="form" onSubmit={handleResetRequest}>
                <label className="field">
                  <span>Email</span>
                  <input
                    name="resetEmail"
                    onChange={(event) => setResetEmail(event.target.value)}
                    required
                    type="email"
                    value={resetEmail}
                  />
                </label>
                <button className="button" disabled={resetPending} type="submit">
                  {resetPending ? 'Sending code...' : 'Send reset code'}
                </button>
              </form>
            ) : (
              <form className="form" onSubmit={handleResetConfirm}>
                <label className="field">
                  <span>Email</span>
                  <input
                    name="confirmResetEmail"
                    onChange={(event) => setResetEmail(event.target.value)}
                    required
                    type="email"
                    value={resetEmail}
                  />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>Passcode</span>
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      name="resetCode"
                      onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      pattern="\d{6}"
                      placeholder="000000"
                      required
                      type="text"
                      value={resetCode}
                    />
                  </label>
                  <div className="status-chip">5 minute window</div>
                </div>
                <label className="field">
                  <span>New password</span>
                  <input
                    minLength={8}
                    name="resetPassword"
                    onChange={(event) => setResetPassword(event.target.value)}
                    required
                    type="password"
                    value={resetPassword}
                  />
                </label>
                <label className="field">
                  <span>Confirm new password</span>
                  <input
                    minLength={8}
                    name="resetConfirmPassword"
                    onChange={(event) => setResetConfirmPassword(event.target.value)}
                    required
                    type="password"
                    value={resetConfirmPassword}
                  />
                </label>
                <button className="button" disabled={resetPending} type="submit">
                  {resetPending ? 'Updating password...' : 'Change password'}
                </button>
              </form>
            )}

            {resetMessage ? <p className="status-note">{resetMessage}</p> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
