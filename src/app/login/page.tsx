'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [showResetBanner, setShowResetBanner] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      setShowResetBanner(true);
      window.history.replaceState(null, '', '/login');
    }
    const next = searchParams.get('next');
    if (next?.startsWith('/') && !next.startsWith('//')) {
      sessionStorage.setItem('ihype_auth_next', next);
    }
    const urlError = searchParams.get('error');
    if (urlError === 'CredentialsSignin') {
      setError('Incorrect code or it expired. Enter your password again to get a new code.');
    } else if (urlError) {
      setError(`Sign-in error: ${urlError}. Please try again.`);
    }
  }, [searchParams]);

  function startCountdown() {
    setResendSeconds(60);
    setCanResend(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current!); setCanResend(true); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function requestOtp(id: string, pw: string) {
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: id, password: pw })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send code.');
    return data;
  }

  async function handleSignIn() {
    if (!identifier || !password) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await requestOtp(identifier, password);
      setChallengeId(data.challengeId);
      setEmail(data.email);
      setStep('otp');
      startCountdown();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length < 6) { setError('Enter all 6 digits.'); return; }
    if (!challengeId) { setError('Session expired — use Resend to get a new code.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, otp: code })
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = data.error || 'Something went wrong.';
        if (msg.toLowerCase().includes('expir')) msg = 'Code expired — tap Resend below to get a new one.';
        else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('incorrect')) msg = 'Incorrect code — double-check and try again, or resend.';
        setError(msg);
        setLoading(false);
        return;
      }
      const next = sessionStorage.getItem('ihype_auth_next');
      if (next?.startsWith('/') && !next.startsWith('//')) {
        sessionStorage.removeItem('ihype_auth_next');
        window.location.href = next;
      } else {
        window.location.href = data.redirect || '/auth/landing';
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setCanResend(false);
    try {
      const data = await requestOtp(identifier, password);
      setChallengeId(data.challengeId);
      setOtp(['', '', '', '', '', '']);
      startCountdown();
    } catch (e) {
      setCanResend(true);
      setError(e instanceof Error ? e.message : 'Failed to resend.');
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prev = otpRefs.current[index - 1];
      if (prev) prev.focus();
    }
    if (e.key === 'Enter') handleVerify();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    digits.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  if (step === 'otp') {
    return (
      <div className="auth-card" style={{ alignItems: 'center', gap: '1rem' }}>
        <div className="auth-brand" style={{ width: '100%' }}>
          <Link className="auth-wordmark" href="/">i<em>HYPE</em></Link>
        </div>

        <div className="auth-heading" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h1>Check your inbox.</h1>
          <p>We sent a 6-digit code to <strong style={{ color: 'var(--text)' }}>{email}</strong>.<br />It expires in 10 minutes.</p>
        </div>

        <div className="otp-grid">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => { otpRefs.current[i] = el; }}
              className={`otp-input${digit ? ' filled' : ''}`}
              maxLength={1}
              inputMode="numeric"
              aria-label={`Digit ${i + 1}`}
              value={digit}
              onChange={e => handleOtpChange(i, e.target.value)}
              onKeyDown={e => handleOtpKeyDown(i, e)}
              onPaste={i === 0 ? handleOtpPaste : undefined}
            />
          ))}
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="button auth-button-block" disabled={loading} onClick={handleVerify}>
          {loading ? 'Verifying…' : 'Verify and continue'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button className="button secondary small" disabled={!canResend} onClick={handleResend} style={{ minWidth: 200 }}>
            {canResend ? "Didn't get it? Resend code →" : `Resend in 0:${String(resendSeconds).padStart(2, '0')}`}
          </button>
        </div>

        <p style={{ fontSize: '0.76rem', color: 'var(--muted)', textAlign: 'center', marginTop: '-0.25rem' }}>
          Check your spam folder if you don&apos;t see it.
        </p>

        <div className="auth-footer" style={{ width: '100%' }}>
          Wrong email?{' '}
          <button className="auth-inline-btn" onClick={() => { setStep('credentials'); setOtp(['', '', '', '', '', '']); setError(''); }}>
            Go back and change it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <Link className="auth-wordmark" href="/">i<em>HYPE</em></Link>
        <span className="auth-switch">New here? <Link href="/register">Create account →</Link></span>
      </div>

      <div className="auth-heading">
        <h1>Welcome back.</h1>
        <p>Enter your email or username and password. We&apos;ll send a one-time code to verify it&apos;s you.</p>
      </div>

      {showResetBanner && (
        <div className="auth-success-banner">✓ Password updated. Sign in with your new password.</div>
      )}

      <div className="field">
        <span>Email or username</span>
        <input type="text" placeholder="you@example.com" autoComplete="username" value={identifier}
          onChange={e => setIdentifier(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
      </div>

      <div className="field">
        <span>Password</span>
        <input type="password" placeholder="Password" autoComplete="current-password" value={password}
          onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button className="button auth-button-block" disabled={loading} onClick={handleSignIn}>
        {loading ? 'Sending code…' : 'Send my code'}
      </button>

      <div style={{ textAlign: 'right', marginTop: '-0.4rem' }}>
        <Link href="/forgot" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Forgot password?</Link>
      </div>

      <div className="auth-footer">
        By signing in you agree to the <Link href="/integrity">iHYPE charter</Link> and privacy promise.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-page-wrap">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
