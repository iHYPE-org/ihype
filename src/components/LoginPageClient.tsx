'use client';

import { useActionState, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginAction } from '@/app/login/actions';

type ResetStage = 'request' | 'confirm';

function getAuthErrorMessage(error: string | null) {
  if (!error) return null;
  return 'Invalid email, username, or password.';
}

export function LoginPageClient() {
  const searchParams = useSearchParams();
  const requestedCallbackUrl = searchParams.get('callbackUrl');
  const callbackUrl = requestedCallbackUrl || '/auth/landing';
  const defaultIdentifier = searchParams.get('email') || searchParams.get('identifier') || '';
  const authError = searchParams.get('error');

  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, {
    error: getAuthErrorMessage(authError),
    identifier: defaultIdentifier
  });
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(getAuthErrorMessage(authError));

  const [showReset, setShowReset] = useState(false);
  const [resetStage, setResetStage] = useState<ResetStage>('request');
  const [resetEmail, setResetEmail] = useState(defaultIdentifier);
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetPending, setResetPending] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    setIdentifier(defaultIdentifier);
    setResetEmail(defaultIdentifier);
  }, [defaultIdentifier]);

  useEffect(() => {
    if (loginState.identifier && loginState.identifier !== identifier) {
      setIdentifier(loginState.identifier);
    }
    setMessage(loginState.error);
  }, [authError, identifier, loginState.identifier, loginState.error]);

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
          email: resetEmail || identifier
        })
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setResetMessage(data.error ?? 'Unable to send a reset code right now.');
        return;
      }

      const nextEmail = resetEmail || identifier;
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
          email: resetEmail || identifier,
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
          <h1>Sign in</h1>
          <p className="kicker">
            Use your iHYPE account to jump back into your fan, artist, promoter, venue, or admin workspace.
            Sign in with either email or username. Demo logins are fan@ihype.org, promoter@ihype.org, artist@ihype.org, venue@ihype.org, and admin@ihype.org, all using demo12345.
          </p>

          <form className="form" action={loginFormAction}>
            <input name="callbackUrl" type="hidden" value={callbackUrl} />
            <label className="field">
              <span>Email or username</span>
              <input
                name="identifier"
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  if (!resetEmail) {
                    setResetEmail(event.target.value);
                  }
                }}
                required
                type="text"
                value={identifier}
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
            <button className="button" disabled={loginPending} type="submit">
              {loginPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="auth-inline-actions">
            <button
              className="text-link"
              onClick={() => {
                setShowReset((current) => !current);
                setResetMessage(null);
                setResetStage('request');
                setResetEmail('');
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
