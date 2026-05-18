'use client';
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ background: '#0a0805', color: '#f0ebe5', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
        <h2>Something went wrong</h2>
        <p style={{ opacity: 0.6, fontSize: 14 }}>{error.digest ?? 'An unexpected error occurred.'}</p>
        <button onClick={reset} style={{ padding: '10px 20px', background: '#ff5029', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Try again</button>
      </body>
    </html>
  );
}
