'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const MESSAGES: Record<string, { headline: string; body: string }> = {
  offline: {
    headline: 'No connection',
    body: "You're offline right now. Your tickets and crate are still saved locally — reconnect to sync with the live feed.",
  },
  '503': {
    headline: 'Back in a moment',
    body: 'iHYPE is temporarily unavailable. We\'re on it — check back in a few minutes.',
  },
  '500': {
    headline: 'Something went wrong',
    body: 'An unexpected error occurred. We\'ve been notified and are looking into it.',
  },
};

export default function OfflinePage() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? 'offline';
  const msg = MESSAGES[code] ?? MESSAGES['offline'];
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      window.location.href = '/';
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => {
      window.location.href = '/';
    }, 300);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #0a0805)',
      color: 'var(--ink, #f0ebe5)',
      fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
      padding: 24,
    }}>
      <div style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{
          fontFamily: "var(--font-display, 'Syne', sans-serif)",
          fontWeight: 800,
          fontSize: '2.4rem',
          letterSpacing: '-0.04em',
          color: 'var(--accent, #ff5029)',
        }}>
          iH·YPE
        </div>

        <div style={{ fontSize: '3rem', margin: '22px 0 14px' }}>📡</div>

        <h1 style={{
          fontFamily: "var(--font-display, 'Syne', sans-serif)",
          fontWeight: 800,
          fontSize: '1.6rem',
          letterSpacing: '-0.02em',
          margin: '0 0 14px',
        }}>
          {msg.headline}
        </h1>

        <p style={{
          fontSize: '0.96rem',
          lineHeight: 1.6,
          color: 'var(--ink-2, #9e9080)',
          margin: '0 0 28px',
        }}>
          {msg.body}
        </p>

        <button
          onClick={handleRetry}
          disabled={retrying}
          style={{
            background: 'var(--accent, #ff5029)',
            color: '#fff',
            border: 'none',
            borderRadius: 9999,
            padding: '13px 28px',
            fontFamily: "var(--font-display, 'Syne', sans-serif)",
            fontWeight: 800,
            fontSize: '0.96rem',
            cursor: retrying ? 'default' : 'pointer',
            width: '100%',
            opacity: retrying ? 0.7 : 1,
            transition: 'opacity 150ms',
          }}
        >
          {retrying ? 'Connecting…' : 'Try again'}
        </button>

        <div style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: '0.7rem',
          color: 'var(--ink-3, #5a5048)',
          marginTop: 16,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          Your data is safe on this device.
        </div>
      </div>
    </div>
  );
}
