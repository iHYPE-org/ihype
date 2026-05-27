export default function HomeLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0a',
      display: 'grid', gridTemplateRows: '60px 1fr 64px',
    }}>
      {/* Topbar skeleton */}
      <div style={{
        gridRow: 1, borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24
      }}>
        <div style={{ width: 80, height: 18, borderRadius: 4, background: '#1a1a1a' }} />
        <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
          {[72, 56, 52, 60, 68, 56].map((w, i) => (
            <div key={i} style={{ width: w, height: 32, borderRadius: 6, background: '#1a1a1a' }} />
          ))}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a1a1a' }} />
      </div>

      {/* Main content skeleton */}
      <div style={{ gridRow: 2, padding: '32px 48px', overflow: 'hidden' }}>
        {/* Hero */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
          <div style={{ width: 200, height: 200, borderRadius: 12, background: '#1a1a1a', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: '40%', height: 42, borderRadius: 6, background: '#1a1a1a' }} />
            <div style={{ width: '60%', height: 14, borderRadius: 4, background: '#1a1a1a' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ height: 72, borderRadius: 8, background: '#1a1a1a' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Track rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              height: 52, borderRadius: 8, background: '#1a1a1a',
              opacity: 1 - i * 0.15
            }} />
          ))}
        </div>
      </div>

      {/* Player dock skeleton */}
      <div style={{
        gridRow: 3, borderTop: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 6, background: '#1a1a1a' }} />
        <div style={{ width: 140, height: 12, borderRadius: 4, background: '#1a1a1a' }} />
        <div style={{ flex: 1, height: 3, borderRadius: 99, background: '#1a1a1a', margin: '0 24px' }} />
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a1a1a' }} />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { opacity: .5; }
          50% { opacity: 1; }
          100% { opacity: .5; }
        }
        div[style*="background: #1a1a1a"] {
          animation: shimmer 1.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
