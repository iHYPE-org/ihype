'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

const ROLES = [
  { value: 'FAN', label: 'Fan', icon: '🎧' },
  { value: 'ARTIST', label: 'Artist', icon: '🎤' },
  { value: 'DJ', label: 'Promoter', icon: '🎛️' },
  { value: 'VENUE', label: 'Venue', icon: '🏟️' }
] as const;

export default function RegisterPage() {
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState('');
  const [error, setError] = useState('');
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

  async function handleRegister() {
    if (!email || !username || !role || !password) { setError('Please fill in all fields.'); return; }
    if (!accepted) { setError('Please confirm the age and content attestation.'); return; }
    setError('');
    setLoading(true);
    try {
      const regRes = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, username, password, role,
          isThirteenOrOlder: accepted,
          acceptedArtistUploadPolicy: (role === 'ARTIST' || role === 'DJ') ? accepted : false
        })
      });
      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.error || 'Registration failed.');
      const otpData = await requestOtp(email, password);
      setChallengeId(otpData.challengeId);
      setOtpEmail(otpData.email);
      setStep('otp');
      startCountdown();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.');
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
      window.location.href = data.redirect || '/auth/landing';
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setCanResend(false);
    try {
      const data = await requestOtp(email, password);
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
      otpRefs.current[index - 1]?.focus();
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
      <main className="auth-page-wrap">
        <div className="auth-card auth-card-wide" style={{ alignItems: 'center', gap: '1rem' }}>
          <div className="auth-brand" style={{ width: '100%' }}>
            <Link className="auth-wordmark" href="/">i<em>HYPE</em></Link>
          </div>

          <div className="auth-heading" style={{ alignItems: 'center', textAlign: 'center' }}>
            <h1>Check your inbox.</h1>
            <p>We sent a 6-digit code to <strong style={{ color: 'var(--text)' }}>{otpEmail}</strong>.<br />It expires in 10 minutes.</p>
          </div>

          <div className="otp-grid">
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
            <button className="auth-inline-btn" onClick={() => { setStep('form'); setOtp(['', '', '', '', '', '']); setError(''); }}>
              Go back and change it
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page-wrap">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <Link className="auth-wordmark" href="/">i<em>HYPE</em></Link>
          <span className="auth-switch">Have an account? <Link href="/login">Sign in →</Link></span>
        </div>

        <div className="auth-heading">
          <h1>Join iHYPE.</h1>
          <p>Beta is open. Create your account — your role determines which tools you get after login.</p>
        </div>

        <div className="field">
          <span>Account type</span>
          <div className="role-grid" role="radiogroup" aria-label="Account type">
            {ROLES.map(r => (
              <button key={r.value} type="button"
                className={`role-btn${role === r.value ? ' selected' : ''}`}
                aria-pressed={role === r.value}
                onClick={() => setRole(r.value)}
              >
                <span style={{ display: 'block', fontSize: '1.15rem', marginBottom: '0.2rem' }}>{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Email</span>
          <input type="email" placeholder="you@example.com" autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="field">
          <span>Username</span>
          <input type="text" placeholder="yourname" autoComplete="username" value={username}
            onChange={e => setUsername(e.target.value)} />
        </div>

        <div className="field">
          <span>Password <span style={{ color: 'var(--muted)', fontSize: '0.75em', fontWeight: 400, textTransform: 'none' }}>8+ chars, 1 letter, 1 number</span></span>
          <input type="password" placeholder="Password" autoComplete="new-password" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRegister()} />
        </div>

        <label style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.65rem', alignItems: 'start', color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.45 }}>
          <input type="checkbox" style={{ marginTop: '0.2rem', accentColor: 'var(--accent)' }} checked={accepted} onChange={e => setAccepted(e.target.checked)} />
          <span>I confirm I am 13 or older and recognize that iHYPE is not responsible for third-party content. Artists and promoters also confirm they have rights to any uploaded media.</span>
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="button auth-button-block" disabled={loading} onClick={handleRegister}>
          {loading ? 'Creating account…' : 'Create account and send code'}
        </button>

        <div className="auth-footer">
          By joining you agree to the <Link href="/integrity">iHYPE charter</Link> and privacy promise.
        </div>
      </div>
    </main>
  );
}
