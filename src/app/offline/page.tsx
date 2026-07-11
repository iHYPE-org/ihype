'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const MESSAGES: Record<string, { title: string; subtitle: string; code: string }> = {
  offline: {
    title: 'No connection.',
    subtitle: "Can't reach ihype.org. Check your connection and we'll retry automatically.",
    code: 'ERR · OFFLINE',
  },
  '503': {
    title: 'Back in a moment.',
    subtitle: "The server is catching its breath. We'll retry in a few seconds.",
    code: 'HTTP 503 · SERVICE UNAVAILABLE',
  },
  '500': {
    title: 'Something broke.',
    subtitle: 'An unexpected error occurred. If it keeps happening, email admin@ihype.org.',
    code: 'HTTP 500 · INTERNAL SERVER ERROR',
  },
};

const RETRY_INTERVALS_MS = [8000, 15000, 30000];

function OfflinePageInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? 'offline';
  const msg = MESSAGES[code] ?? MESSAGES.offline;
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const [barWidth, setBarWidth] = useState(0);
  const [barDurationMs, setBarDurationMs] = useState(RETRY_INTERVALS_MS[0]);
  const retryCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doRetry = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRetryMessage('Checking…');
    setRetrying(true);
    setTimeout(() => {
      fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error('not ok');
          window.location.href = '/';
        })
        .catch(() => {
          setRetrying(false);
          const delay = RETRY_INTERVALS_MS[Math.min(retryCountRef.current, RETRY_INTERVALS_MS.length - 1)];
          retryCountRef.current += 1;
          startRetryBar(delay);
        });
    }, 600);
  };

  const startRetryBar = (ms: number) => {
    setBarWidth(0);
    setBarDurationMs(ms);
    requestAnimationFrame(() => setBarWidth(100));
    setRetryMessage(`Auto-retry in ${Math.round(ms / 1000)}s`);
    timerRef.current = setTimeout(doRetry, ms);
  };

  useEffect(() => {
    const handleOnline = () => {
      setRetryMessage('Connection restored — retrying…');
      setTimeout(() => {
        window.location.href = '/';
      }, 800);
    };
    window.addEventListener('online', handleOnline);
    startRetryBar(RETRY_INTERVALS_MS[0]);
    return () => {
      window.removeEventListener('online', handleOnline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualRetry = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doRetry();
  };

  return (
    <div className="offline-body">
      <div className="offline-wordmark">i<span>HYPE</span></div>

      <div className="offline-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,80,41,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      <h1 className="offline-title">{msg.title}</h1>
      <p className="offline-sub">{msg.subtitle}</p>
      <div className="offline-code">{msg.code}</div>

      <div className="offline-actions">
        <button className="offline-btn-primary" disabled={retrying} onClick={handleManualRetry} type="button">
          {retrying ? 'Connecting…' : 'Try again'}
        </button>
        <a className="offline-btn-ghost" href="/">Back to home</a>
      </div>

      <div className="offline-retry-msg">{retryMessage}</div>

      <div className="offline-status-bar">
        <div className="offline-status-fill" style={{ width: `${barWidth}%`, transition: barWidth === 0 ? 'none' : `width ${barDurationMs / 1000}s linear` }} />
      </div>

      <style>{`
        .offline-body { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; }
        .offline-wordmark { font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); margin-bottom: 56px; }
        .offline-wordmark span { color: var(--accent); }
        .offline-icon { width: 72px; height: 72px; border-radius: 20px; background: rgba(255,80,41,.08); border: 1px solid rgba(255,80,41,.18); display: flex; align-items: center; justify-content: center; margin-bottom: 28px; animation: offline-softpulse 2s ease-in-out infinite; }
        @keyframes offline-softpulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        .offline-title { font-family: var(--font-display); font-size: clamp(28px, 5vw, 40px); font-weight: 800; letter-spacing: -.03em; line-height: .95; text-align: center; margin-bottom: 16px; color: var(--ink); }
        .offline-sub { font-size: 15px; color: var(--ink-a60); text-align: center; max-width: 380px; line-height: 1.6; margin-bottom: 48px; }
        .offline-code { font-family: var(--font-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a30); margin-bottom: 48px; }
        .offline-actions { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; }
        .offline-btn-primary { padding: 14px; background: var(--accent); color: #fff; border: none; border-radius: 10px; font-family: var(--font-display); font-size: 16px; font-weight: 800; cursor: pointer; transition: opacity 150ms; text-align: center; }
        .offline-btn-primary:hover { opacity: .88; }
        .offline-btn-primary:disabled { opacity: .4; cursor: not-allowed; }
        .offline-btn-ghost { padding: 13px; background: transparent; color: var(--ink-a60); border: 1px solid var(--hair-100); border-radius: 10px; font-family: var(--font-body); font-size: 14px; cursor: pointer; transition: all 150ms; text-align: center; text-decoration: none; display: block; }
        .offline-btn-ghost:hover { background: var(--hair-40); color: var(--ink); }
        .offline-status-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 3px; background: var(--line); overflow: hidden; }
        .offline-status-fill { height: 100%; width: 0%; background: var(--accent); }
        .offline-retry-msg { font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a30); margin-top: 32px; min-height: 16px; }
      `}</style>
    </div>
  );
}

export default function OfflinePage() {
  return (
    <Suspense fallback={null}>
      <OfflinePageInner />
    </Suspense>
  );
}
