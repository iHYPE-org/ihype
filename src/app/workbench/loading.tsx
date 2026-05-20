function Shimmer({ w, h, r = 6 }: { w?: string; h?: number; r?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: w ?? '100%',
        height: h ?? 16,
        borderRadius: r,
        background: 'linear-gradient(90deg, var(--bg-2,#1a1712) 25%, var(--bg-3,#242018) 50%, var(--bg-2,#1a1712) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite linear',
      }}
    />
  );
}

export default function Loading() {
  return (
    <>
      <style>{`@keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }`}</style>
      <div className="container section">
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[100, 80].map((w, i) => <Shimmer key={i} w={`${w}px`} h={32} r={20} />)}
        </div>
        {/* Chart panel */}
        <div className="panel" style={{ padding: '1rem', marginBottom: 16 }}>
          <Shimmer w="40%" h={14} />
          <div style={{ height: 12 }} />
          <Shimmer h={120} r={4} />
        </div>
        {/* Bar chart panel */}
        <div className="panel" style={{ padding: '1rem', marginBottom: 16 }}>
          <Shimmer w="35%" h={14} />
          <div style={{ height: 12 }} />
          <Shimmer h={80} r={4} />
        </div>
        {/* Recent list */}
        <div className="panel" style={{ padding: '1rem' }}>
          <Shimmer w="30%" h={14} />
          <div style={{ height: 12 }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line,rgba(255,255,255,.06))' }}>
              <Shimmer w="36px" h={36} r={18} />
              <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                <Shimmer w="50%" h={13} />
                <Shimmer w="30%" h={11} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
