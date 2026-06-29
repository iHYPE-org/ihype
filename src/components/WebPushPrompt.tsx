'use client';

import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'ihype:push-dismissed';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return view;
}

export function WebPushPrompt() {
  const [state, setState] = useState<'idle' | 'prompt' | 'subscribing' | 'subscribed' | 'denied' | 'unsupported'>('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'granted') { setState('subscribed'); return; }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch { /* ignore */ }
    // Delay so it doesn't interrupt the initial render
    const t = setTimeout(() => setState('prompt'), 5000);
    return () => clearTimeout(t);
  }, []);

  async function subscribe() {
    setState('subscribing');
    try {
      const keyRes = await fetch('/api/push/vapid-key');
      const { key } = await keyRes.json() as { key: string | null };
      if (!key) { setState('idle'); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setState('subscribed');
    } catch {
      setState('idle');
    }
  }

  async function request() {
    setState('subscribing');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await subscribe();
    } else {
      setState(permission === 'denied' ? 'denied' : 'idle');
    }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
    setState('idle');
  }

  if (state !== 'prompt' && state !== 'subscribing') return null;

  return (
    <div
      role="dialog"
      aria-label="Enable notifications"
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
        zIndex: 55, margin: '0 auto', maxWidth: 440,
        background: 'rgba(16,13,9,.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'flex-start', gap: 13,
        boxShadow: '0 16px 48px rgba(0,0,0,.5)',
        animation: 'push-slide-up .28s cubic-bezier(.4,0,.2,1) both',
      }}
    >
      <style>{`@keyframes push-slide-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Bell icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'rgba(255,80,41,.12)', border: '1px solid rgba(255,80,41,.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ff5029" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display, system-ui)', fontWeight: 700, fontSize: 14, color: '#f0ebe5', marginBottom: 3 }}>
          Never miss a show
        </div>
        <div style={{ fontFamily: 'var(--font-body, system-ui)', fontSize: 12, color: 'rgba(240,235,229,.5)', lineHeight: 1.4, marginBottom: 12 }}>
          Get notified when artists you follow announce shows near you.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={request}
            disabled={state === 'subscribing'}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#ff5029', color: '#fff',
              fontFamily: 'var(--font-mono, monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
              opacity: state === 'subscribing' ? .6 : 1, transition: 'opacity 150ms',
            }}
          >
            {state === 'subscribing' ? 'Enabling…' : 'Enable'}
          </button>
          <button
            onClick={dismiss}
            style={{
              padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
              background: 'none', border: '1px solid rgba(255,255,255,.1)',
              fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'rgba(240,235,229,.45)', letterSpacing: '.04em',
            }}
          >
            Not now
          </button>
        </div>
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none', border: 'none', color: 'rgba(240,235,229,.3)',
          cursor: 'pointer', padding: 4, fontSize: 18, lineHeight: 1, flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
