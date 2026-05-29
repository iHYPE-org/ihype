import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#060813', color: '#f5f0eb',
      fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '2rem'
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎵</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Page not found</h1>
      <p style={{ color: '#9c8a7a', marginBottom: 32, maxWidth: 400 }}>
        This page doesn&apos;t exist or may have moved. Head back to discover music.
      </p>
      <Link href="/" style={{
        background: '#ff5029', color: '#fff', padding: '12px 28px',
        borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 15
      }}>
        Back to iHYPE
      </Link>
    </div>
  );
}
