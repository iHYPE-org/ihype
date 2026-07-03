'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{
        background: '#0a0805', color: '#f0ebe5', fontFamily: "'DM Sans', sans-serif",
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, background: 'rgba(255,80,41,.08)', border: '1px solid rgba(255,80,41,.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,80,41,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: .95, margin: '0 0 16px' }}>
          Something broke.
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(240,235,229,.6)', maxWidth: 380, lineHeight: 1.6, margin: '0 0 24px' }}>
          {error.digest ? `Error ID: ${error.digest}` : 'An unexpected error occurred. If it keeps happening, email admin@ihype.org.'}
        </p>
        <button
          onClick={reset}
          style={{ padding: '14px 28px', background: '#ff5029', color: '#fff', border: 'none', borderRadius: 10, fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
