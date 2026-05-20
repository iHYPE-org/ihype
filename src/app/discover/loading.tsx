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
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[80, 60, 100].map((w, i) => <Shimmer key={i} w={`${w}px`} h={32} r={20} />)}
        </div>
        {/* Genre pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {[60, 80, 55, 70, 65].map((w, i) => <Shimmer key={i} w={`${w}px`} h={26} r={14} />)}
        </div>
        {/* Ranked rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line,rgba(255,255,255,.06))' }}>
            <Shimmer w="24px" h={14} />
            <Shimmer w="36px" h={36} r={18} />
            <div style={{ flex: 1, display: 'grid', gap: 6 }}>
              <Shimmer w="45%" h={14} />
              <Shimmer w="30%" h={11} />
            </div>
            <Shimmer w="40px" h={22} r={4} />
          </div>
        ))}
      </div>
    </>
  );
}
