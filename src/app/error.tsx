'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 16, textAlign: 'center', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h2>
      <p className="meta">An unexpected error occurred. Try refreshing the page.</p>
      {error.digest && <p className="meta" style={{ fontSize: '0.75rem', opacity: 0.6 }}>Error ID: {error.digest}</p>}
      {isDev && error.message && (
        <pre style={{ fontSize: '0.75rem', textAlign: 'left', background: 'var(--surface-2, #1a1a2e)', padding: '12px', borderRadius: 6, maxWidth: '100%', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ''}
        </pre>
      )}
      <button className="button secondary small" onClick={reset}>Try again</button>
    </div>
  );
}
