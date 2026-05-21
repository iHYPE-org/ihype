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

function ShowCardSkeleton() {
  return (
    <div className="panel" style={{ padding: '1rem', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'grid', gap: 7 }}>
          <Shimmer w="60%" h={16} />
          <Shimmer w="40%" h={12} />
        </div>
        <Shimmer w="64px" h={26} r={6} />
      </div>
      <Shimmer w="50%" h={11} />
    </div>
  );
}

export default function Loading() {
  return (
    <>
      <style>{`@keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }`}</style>
      <div className="container section">
        {/* Section heading */}
        <Shimmer w="160px" h={22} r={4} />
        <div style={{ height: 16 }} />
        <div style={{ display: 'grid', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => <ShowCardSkeleton key={i} />)}
        </div>
      </div>
    </>
  );
}
