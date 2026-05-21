'use client';

import { useEffect } from 'react';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 16, textAlign: 'center', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Admin panel error</h2>
      <p className="meta">{error.message || 'An unexpected error occurred.'}</p>
      {error.digest && <p className="meta" style={{ fontSize: '0.75rem', opacity: 0.6 }}>Error ID: {error.digest}</p>}
      <button className="button secondary small" onClick={reset}>Try again</button>
    </div>
  );
}
