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
      <div className="container section" style={{ maxWidth: 860 }}>
        {/* Banner placeholder */}
        <Shimmer h={48} r={8} />
        <div style={{ height: 24 }} />

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel" style={{ padding: '1rem', display: 'grid', gap: 8 }}>
              <Shimmer h={12} w="55%" />
              <Shimmer h={28} w="40%" />
            </div>
          ))}
        </div>
        <div style={{ height: 24 }} />

        {/* Main content panels */}
        {[80, 120, 96].map((h, i) => (
          <div key={i} className="panel" style={{ padding: '1rem', marginBottom: 16, display: 'grid', gap: 10 }}>
            <Shimmer h={14} w="35%" />
            <Shimmer h={h} r={8} />
          </div>
        ))}
      </div>
    </>
  );
}
