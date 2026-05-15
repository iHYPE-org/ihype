'use client';

import { useState } from 'react';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleResend() {
    setStatus('sending');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 14,
        padding: '40px 48px',
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,.5)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>✉️</div>
        <h1 style={{
          fontFamily: 'var(--f-d)',
          fontWeight: 800,
          fontSize: 26,
          letterSpacing: '-.02em',
          color: 'var(--ink)',
          margin: '0 0 12px',
        }}>
          Check your email
        </h1>
        <p style={{
          fontFamily: 'var(--f-m)',
          fontSize: 13,
          color: 'var(--ink-2)',
          lineHeight: 1.65,
          margin: '0 0 28px',
        }}>
          We sent a verification link to your email address. Click the link to verify your account and continue.
        </p>
        {status === 'sent' && (
          <p style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#22e5d4', marginBottom: 16 }}>
            Verification email sent! Check your inbox.
          </p>
        )}
        {status === 'error' && (
          <p style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--accent)', marginBottom: 16 }}>
            Something went wrong. Please try again.
          </p>
        )}
        <button
          onClick={handleResend}
          disabled={status === 'sending' || status === 'sent'}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 28px',
            fontFamily: 'var(--f-m)',
            fontSize: 13,
            letterSpacing: '.04em',
            cursor: status === 'sending' || status === 'sent' ? 'not-allowed' : 'pointer',
            opacity: status === 'sending' || status === 'sent' ? 0.6 : 1,
            width: '100%',
          }}
        >
          {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Email sent!' : 'Resend verification email'}
        </button>
        <a
          href="/login"
          style={{
            display: 'block',
            marginTop: 16,
            fontFamily: 'var(--f-m)',
            fontSize: 12,
            color: 'var(--ink-3)',
          }}
        >
          Back to login
        </a>
      </div>
    </div>
  );
}
