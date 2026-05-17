export function Skeleton({
  width,
  height,
  className,
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return <div className={`skeleton ${className ?? ''}`} style={{ width, height }} />;
}

export function SkeletonCard() {
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <Skeleton height={180} />
      <Skeleton height={20} width="60%" />
      <Skeleton height={16} width="40%" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}
