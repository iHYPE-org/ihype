'use client';

import { useEffect, useRef } from 'react';

export function InfiniteScroll({
  onLoadMore,
  hasMore,
  loading,
}: {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && hasMore && !loading) onLoadMore();
      },
      { threshold: 0.1 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [hasMore, loading, onLoadMore]);

  return (
    <div ref={ref} style={{ height: 1 }}>
      {loading && (
        <div className="meta" style={{ textAlign: 'center', padding: 16 }}>
          Loading…
        </div>
      )}
    </div>
  );
}
