export default function HomeLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      display: 'grid', gridTemplateRows: '60px 1fr 64px',
    }}>
      {/* Topbar skeleton */}
      <div style={{
        gridRow: 1, borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24
      }}>
        <div className="home-skel" style={{ width: 80, height: 18, borderRadius: 4 }} />
        <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
          {[72, 56, 52, 60, 68, 56].map((w, i) => (
            <div className="home-skel" key={i} style={{ width: w, height: 32, borderRadius: 6 }} />
          ))}
        </div>
        <div className="home-skel" style={{ width: 32, height: 32, borderRadius: '50%' }} />
      </div>

      {/* Main content skeleton */}
      <div style={{ gridRow: 2, padding: '32px 48px', overflow: 'hidden' }}>
        {/* Hero */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
          <div className="home-skel" style={{ width: 200, height: 200, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="home-skel" style={{ width: '40%', height: 42, borderRadius: 6 }} />
            <div className="home-skel" style={{ width: '60%', height: 14, borderRadius: 4 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              {[0,1,2,3].map(i => (
                <div className="home-skel" key={i} style={{ height: 72, borderRadius: 8 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Track rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0,1,2,3,4].map(i => (
            <div className="home-skel" key={i} style={{
              height: 52, borderRadius: 8, opacity: 1 - i * 0.15
            }} />
          ))}
        </div>
      </div>

      {/* Player dock skeleton */}
      <div style={{
        gridRow: 3, borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16
      }}>
        <div className="home-skel" style={{ width: 42, height: 42, borderRadius: 6 }} />
        <div className="home-skel" style={{ width: 140, height: 12, borderRadius: 4 }} />
        <div className="home-skel" style={{ flex: 1, height: 3, borderRadius: 99, margin: '0 24px' }} />
        <div className="home-skel" style={{ width: 38, height: 38, borderRadius: '50%' }} />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { opacity: .5; }
          50% { opacity: 1; }
          100% { opacity: .5; }
        }
        /* A CLASS, not div[style*="background: #1a1a1a"].
           That selector matched the inline style STRING, so it silently
           stopped animating anything the moment the colour was tokenised —
           a skeleton that renders but never shimmers looks like a hung page
           rather than a loading one, and nothing would have reported it. */
        .home-skel {
          background: var(--bg-3);
          animation: shimmer 1.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
