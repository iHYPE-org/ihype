'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h2>
      <p className="meta">This fan profile couldn&apos;t load. Try refreshing.</p>
      {error.digest && <p className="meta" style={{ fontSize: '0.75rem', opacity: 0.6 }}>Error ID: {error.digest}</p>}
      <button className="button secondary small" onClick={reset}>Try again</button>
    </div>
  );
}
