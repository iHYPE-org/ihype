import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';

export default async function NotFound() {
  const t = await getServerT();
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'var(--ink)',
      fontFamily: "var(--font-body, 'Work Sans', sans-serif)",
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
        fontFamily: "var(--font-display, 'Bricolage Grotesque', sans-serif)",
        fontWeight: 800,
        fontSize: '1.1rem',
        letterSpacing: '-0.03em',
        marginBottom: 24,
      }}>
        i<span style={{ color: 'var(--accent-text)' }}>HYPE</span>
      </div>
      <div style={{
        fontFamily: "var(--font-display, 'Bricolage Grotesque', sans-serif)",
        fontWeight: 800,
        fontSize: '3rem',
        letterSpacing: '-0.05em',
        lineHeight: 0.85,
        color: 'var(--accent-text)',
        marginBottom: 20,
        animation: 'notFoundGlitch 2.4s infinite',
      }}>
        4·0·4
      </div>
      <h1 style={{
        fontFamily: "var(--font-display, 'Bricolage Grotesque', sans-serif)",
        fontWeight: 800,
        fontSize: 'clamp(1.4rem, 5vw, 1.6rem)',
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
        margin: '0 0 12px',
      }}>
        {t('notFound.heading', 'This page skipped soundcheck.')}
      </h1>
      <p style={{ color: 'var(--ink-2)', marginBottom: 24, maxWidth: 400, lineHeight: 1.7, fontSize: '0.9rem' }}>
        {t('notFound.body', "The page you're looking for doesn't exist, moved, or was never booked in the first place.")}
      </p>
      <Link href="/" style={{
        background: 'var(--accent)',
        color: 'var(--ink-on-accent)',
        padding: '13px 28px',
        borderRadius: 9999,
        fontFamily: "var(--font-display, 'Bricolage Grotesque', sans-serif)",
        fontWeight: 800,
        textDecoration: 'none',
        fontSize: '0.95rem',
        letterSpacing: '-0.01em',
        boxShadow: '0 4px 20px rgba(var(--accent-rgb),0.3)',
      }}>
        {t('notFound.cta', 'Back to the scene →')}
      </Link>
      <style>{`
        @keyframes notFoundGlitch {
          0%, 92%, 100% { transform: translate(0); }
          93% { transform: translate(-2px, 1px); }
          95% { transform: translate(2px, -1px); }
          97% { transform: translate(-1px, 0); }
        }
      `}</style>
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
