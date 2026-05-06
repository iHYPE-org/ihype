'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

type StrengthLevel = 0 | 1 | 2 | 3 | 4;
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_CLASSES = ['', 'weak', 'fair', 'good', 'strong'];

function scorePassword(pw: string): StrengthLevel {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score) as StrengthLevel;
}

export default function ForgotPage() {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [emailVal, setEmailVal] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStrength, setPwStrength] = useState<StrengthLevel>(0);
  const [emailError, setEmailError] = useState('');
  const [resetError, setResetError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function handleSendCode() {
    setEmailError('');
    const em = emailVal.trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em })
      });
      if (res.status === 429) {
        setEmailError('Too many requests. Please wait a few minutes and try again.');
        return;
      }
      if (res.ok) {
        setStep('reset');
        setOtp(['', '', '', '', '', '']);
        startCountdown();
      } else {
        const data = await res.json().catch(() => ({}));
        setEmailError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setEmailError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResetError('');
    setCanResend(false);
    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal })
      });
      if (res.status === 429) {
        setResetError('Too many requests. Please wait a few minutes.');
        setCanResend(true);
        return;
      }
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      startCountdown();
    } catch {
      setResetError('Network error. Check your connection and try again.');
      setCanResend(true);
    }
  }

  async function handleConfirmReset() {
    setResetError('');
    const code = otp.join('');
    if (code.length < 6) { setResetError('Enter all 6 digits of your reset code.'); return; }
    if (newPassword.length < 8) { setResetError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setResetError("Passwords don't match."); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, code, password: newPassword, confirmPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.href = '/login?reset=1';
      } else if (res.status === 429) {
        setResetError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setResetError(data.error || 'Invalid or expired code. Request a new one.');
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch {
      setResetError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
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
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    digits.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  if (step === 'reset') {
    return (
      <main className="auth-page-wrap">
        <div className="auth-card" style={{ alignItems: 'center', gap: '1rem' }}>
          <div className="auth-brand" style={{ width: '100%' }}>
            <Link className="auth-wordmark" href="/">i<em>HYPE</em></Link>
          </div>

          <div className="auth-heading" style={{ alignItems: 'center', textAlign: 'center' }}>
            <h1>Reset your password.</h1>
            <p>We sent a 6-digit code to <strong style={{ color: 'var(--text)' }}>{emailVal}</strong>.<br />It expires in 5 minutes.</p>
          </div>

          <div className="otp-grid" role="group" aria-label="6-digit reset code">
            {otp.map((digit, i) => (
              <input key={i} ref={el => { otpRefs.current[i] = el; }}
                className={`otp-input${digit ? ' filled' : ''}`}
                maxLength={1} inputMode="numeric" aria-label={`Digit ${i + 1}`}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                onPaste={i === 0 ? handleOtpPaste : undefined}
              />
            ))}
          </div>

          <div className="field" style={{ width: '100%' }}>
            <span>New password</span>
            <input type="password" placeholder="At least 8 characters" autoComplete="new-password"
              value={newPassword}
              onChange={e => {
                setNewPassword(e.target.value);
                setPwStrength(e.target.value.length === 0 ? 0 : Math.max(1, scorePassword(e.target.value)) as StrengthLevel);
              }}
              onKeyDown={e => e.key === 'Enter' && handleConfirmReset()}
            />
            {newPassword.length > 0 && (
              <>
                <div className="pw-strength">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`pw-strength-bar${i < pwStrength ? ` ${STRENGTH_CLASSES[pwStrength]}` : ''}`} />
                  ))}
                </div>
                <div className="pw-strength-label">{STRENGTH_LABELS[pwStrength]}</div>
              </>
            )}
          </div>

          <div className="field" style={{ width: '100%' }}>
            <span>Confirm new password</span>
            <input type="password" placeholder="Repeat your new password" autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmReset()}
            />
          </div>

          {resetError && <p className="auth-error" style={{ textAlign: 'center' }}>{resetError}</p>}

          <button className="button auth-button-block" disabled={loading} onClick={handleConfirmReset}>
            {loading ? 'Please wait…' : 'Set new password'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <button className="button secondary small" disabled={!canResend} onClick={handleResend} style={{ minWidth: 200 }}>
              {canResend ? 'Resend code' : `Resend in 0:${String(resendSeconds).padStart(2, '0')}`}
            </button>
          </div>

          <p style={{ fontSize: '0.76rem', color: 'var(--muted)', textAlign: 'center', marginTop: '-0.25rem' }}>
            Check your spam folder if you don&apos;t see it.
          </p>

          <div className="auth-footer" style={{ width: '100%' }}>
            Wrong email?{' '}
            <button className="auth-inline-btn" onClick={() => { setStep('email'); setResetError(''); }}>
              Go back and change it
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <Link className="auth-wordmark" href="/">i<em>HYPE</em></Link>
          <span className="auth-switch">Remember it? <Link href="/login">Sign in →</Link></span>
        </div>

        <div className="auth-heading">
          <h1>Forgot your password?</h1>
          <p>Enter the email on your account. We&apos;ll send a 6-digit reset code — it expires in 5 minutes.</p>
        </div>

        <div className="field">
          <span>Email address</span>
          <input type="email" placeholder="you@example.com" autoComplete="email" value={emailVal}
            onChange={e => setEmailVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendCode()} />
        </div>

        {emailError && <p className="auth-error">{emailError}</p>}

        <button className="button auth-button-block" disabled={loading} onClick={handleSendCode}>
          {loading ? 'Please wait…' : 'Send reset code'}
        </button>

        <div className="auth-footer">
          <Link href="/login">← Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
