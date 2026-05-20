'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 16, textAlign: 'center', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h2>
      <p className="meta">An unexpected error occurred. Try refreshing the page.</p>
      <button className="button secondary small" onClick={reset}>Try again</button>
    </div>
  );
}
