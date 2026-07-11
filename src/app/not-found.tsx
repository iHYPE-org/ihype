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
      color: 'var(--ink)',
      fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
      textAlign: 'center',
      padding: '2rem',
    }}>
      <div style={{
        height: 3,
        width: 160,
        background: 'linear-gradient(90deg,#ff4635,#ff3d87,#7c5cff,#39d8df)',
        borderRadius: 999,
        marginBottom: 32,
      }} />
      <div style={{
        fontFamily: "var(--font-display, 'Syne', sans-serif)",
        fontWeight: 800,
        fontSize: '1.1rem',
        letterSpacing: '-0.03em',
        marginBottom: 24,
      }}>
        i<span style={{ color: 'var(--accent, #ff5029)' }}>HYPE</span>
      </div>
      <div style={{
        fontFamily: "var(--font-display, 'Syne', sans-serif)",
        fontWeight: 800,
        fontSize: '5rem',
        letterSpacing: '-0.05em',
        lineHeight: 0.85,
        color: 'var(--bg3, #1a1611)',
        WebkitTextStroke: '2px rgba(255,255,255,0.08)',
        marginBottom: 16,
      }}>
        404
      </div>
      <h1 style={{
        fontFamily: "var(--font-display, 'Syne', sans-serif)",
        fontWeight: 800,
        fontSize: 'clamp(1.4rem, 5vw, 1.6rem)',
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
        margin: '0 0 12px',
      }}>
        This page doesn&apos;t exist.
      </h1>
      <p style={{ color: 'var(--ink-2, #9e9080)', marginBottom: 24, maxWidth: 400, lineHeight: 1.7, fontSize: '0.9rem' }}>
        The link may be broken or the page may have moved. iHYPE still takes nothing, though.
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
        boxShadow: '0 4px 20px rgba(255,80,41,0.3)',
      }}>
        Back to home →
      </Link>
      <div style={{
        height: 3,
        width: 160,
        background: 'linear-gradient(90deg,#ff4635,#ff3d87,#7c5cff,#39d8df)',
        borderRadius: 999,
        opacity: 0.3,
        marginTop: 40,
      }} />
    </div>
  );
}
