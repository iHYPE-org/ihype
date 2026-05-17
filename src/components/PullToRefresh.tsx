'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const PULL_THRESHOLD = 60;

interface Props {
  children: React.ReactNode;
}

export function PullToRefresh({ children }: Props) {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const scrollTop = containerRef.current
      ? containerRef.current.scrollTop
      : window.scrollY;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        setPullDistance(Math.min(delta, PULL_THRESHOLD * 1.5));
      }
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      router.refresh();
      setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
      }, 1200);
    } else {
      setPullDistance(0);
    }
    startY.current = null;
  }, [pullDistance, refreshing, router]);

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const showIndicator = pullDistance > 10 || refreshing;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {showIndicator && (
        <div
          className="pull-to-refresh-indicator"
          style={{
            transform: `translateY(${refreshing ? 0 : pullDistance - PULL_THRESHOLD}px)`,
            opacity: refreshing ? 1 : pullDistance / PULL_THRESHOLD,
          }}
          aria-live="polite"
          aria-label={refreshing ? 'Refreshing…' : 'Pull to refresh'}
        >
          <span className={`pull-to-refresh-spinner${refreshing ? ' spinning' : ''}`}>↻</span>
          {refreshing ? 'Refreshing…' : pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
      {children}
    </div>
  );
}
