'use client';

import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const on = () => setOffline(true);
    const off = () => setOffline(false);
    window.addEventListener('offline', on);
    window.addEventListener('online', off);
    return () => {
      window.removeEventListener('offline', on);
      window.removeEventListener('online', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top)',
        left: 0,
        right: 0,
        zIndex: 500,
        background: '#b91c1c',
        color: '#fff',
        textAlign: 'center',
        padding: '8px 16px',
        fontSize: 13,
      }}
    >
      No internet connection — showing cached content
    </div>
  );
}
