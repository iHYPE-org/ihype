'use client';
import { useEffect, useState } from 'react';

export function A2HSPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari (no beforeinstallprompt support)
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isInStandalone = ('standalone' in navigator) && (navigator as unknown as { standalone: boolean }).standalone;
    const dismissed = localStorage.getItem('a2hs-dismissed');
    if (isIOS && !isInStandalone && !dismissed) {
      setTimeout(() => setShow(true), 60_000);
    }
  }, []);

  function dismiss() {
    localStorage.setItem('a2hs-dismissed', '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: 16, right: 16,
      zIndex: 400, background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Add iHYPE to Home Screen</p>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 0 }}>×</button>
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 13, opacity: 0.7 }}>
        Tap <strong>Share</strong> then <strong>Add to Home Screen</strong> for the full app experience.
      </p>
    </div>
  );
}
