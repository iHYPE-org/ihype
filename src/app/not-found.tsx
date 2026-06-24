import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #0a0805)',
      color: 'var(--ink, #f0ebe5)',
      fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
      textAlign: 'center',
      padding: '2rem',
    }}>
      <div style={{
        fontFamily: "var(--font-display, 'Syne', sans-serif)",
        fontWeight: 800,
        fontSize: '2.4rem',
        letterSpacing: '-0.04em',
        color: 'var(--accent, #ff5029)',
        marginBottom: 24,
      }}>
        iH·YPE
      </div>
      <div style={{
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: '0.7rem',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--ink-3, #5a5048)',
        marginBottom: 16,
      }}>
        404
      </div>
      <h1 style={{
        fontFamily: "var(--font-display, 'Syne', sans-serif)",
        fontWeight: 800,
        fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
        margin: '0 0 12px',
      }}>
        Page not found
      </h1>
      <p style={{ color: 'var(--ink-2, #9e9080)', marginBottom: 32, maxWidth: 400, lineHeight: 1.6 }}>
        This page doesn&apos;t exist or may have moved. Head back to discover music.
      </p>
      <Link href="/" style={{
        background: 'var(--accent, #ff5029)',
        color: '#fff',
        padding: '13px 28px',
        borderRadius: 9999,
        fontFamily: "var(--font-display, 'Syne', sans-serif)",
        fontWeight: 800,
        textDecoration: 'none',
        fontSize: '0.95rem',
        letterSpacing: '-0.01em',
      }}>
        Back to iHYPE
      </Link>
    </div>
  );
}
