'use client';

import { useEffect, useState } from 'react';

export function PushPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    const dismissed = localStorage.getItem('push-prompt-dismissed');
    if (dismissed) return;
    const t = setTimeout(() => setShow(true), 30_000);
    return () => clearTimeout(t);
  }, []);

  function allow() {
    Notification.requestPermission().finally(() => setShow(false));
  }

  function dismiss() {
    localStorage.setItem('push-prompt-dismissed', '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(80px + env(safe-area-inset-bottom))',
        left: 16,
        right: 16,
        zIndex: 400,
        background: 'var(--surface, var(--bg-2, #100d09))',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Get notified about new shows</p>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
        We&apos;ll let you know when artists you follow announce shows nearby.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="button small" onClick={allow} type="button">
          Enable
        </button>
        <button className="button small secondary" onClick={dismiss} type="button">
          Not now
        </button>
      </div>
    </div>
  );
}
