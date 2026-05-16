'use client';

import { useEffect, useState } from 'react';

type Props = {
  /** When true, the user's email is unverified and the banner may show. */
  needsVerification: boolean;
};

const DISMISS_KEY = 'ihype-email-verify-dismissed';

export function EmailVerificationBanner({ needsVerification }: Props) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!needsVerification) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {}
    setVisible(true);
  }, [needsVerification]);

  if (!visible) return null;

  async function resend() {
    setPending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });
      if (res.ok) setStatus('Verification email sent.');
      else {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error ?? 'Could not send verification email.');
      }
    } catch {
      setStatus('Could not send verification email.');
    } finally {
      setPending(false);
    }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setVisible(false);
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        maxWidth: 560,
        width: 'calc(100% - 32px)',
        padding: '10px 14px',
        background: 'rgba(255, 200, 87, 0.95)',
        color: '#1a1300',
        borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        fontSize: 13,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <span style={{ flex: 1 }}>
        {status ?? 'Verify your email to unlock full features.'}
      </span>
      <button
        type="button"
        onClick={resend}
        disabled={pending}
        style={{
          padding: '6px 12px',
          background: '#1a1300',
          color: '#ffc857',
          border: 'none',
          borderRadius: 6,
          cursor: pending ? 'default' : 'pointer',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {pending ? 'Sending...' : 'Resend'}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          padding: '4px 8px',
          background: 'transparent',
          color: '#1a1300',
          border: 'none',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
