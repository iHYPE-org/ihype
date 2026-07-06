'use client';

import { useRef, useState, type ReactNode } from 'react';

const TRIGGER_DISTANCE = 64;
const MAX_PULL = 90;
const RESISTANCE = 0.5;

/**
 * Native-style pull-to-refresh. Only arms when the page is scrolled to the
 * very top, so it never fights normal scrolling or the shell's own
 * horizontal swipe-between-sections gesture (which is already disabled
 * whenever a section's content — not its grid — is showing, see
 * MobileAppShell/useDragCarousel).
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => unknown; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  return (
    <div
      onTouchStart={(e) => {
        if (refreshing || window.scrollY > 0) { startY.current = null; return; }
        startY.current = e.touches[0].clientY;
      }}
      onTouchMove={(e) => {
        if (startY.current === null) return;
        const delta = e.touches[0].clientY - startY.current;
        if (delta <= 0) { setPull(0); return; }
        setPull(Math.min(delta * RESISTANCE, MAX_PULL));
      }}
      onTouchEnd={async () => {
        if (startY.current === null) return;
        startY.current = null;
        if (pull >= TRIGGER_DISTANCE) {
          setRefreshing(true);
          setPull(TRIGGER_DISTANCE);
          try {
            await onRefresh();
          } finally {
            setRefreshing(false);
            setPull(0);
          }
        } else {
          setPull(0);
        }
      }}
    >
      <div
        aria-hidden="true"
        className="ptr-indicator"
        style={{ height: refreshing ? TRIGGER_DISTANCE : pull, opacity: pull > 8 || refreshing ? 1 : 0 }}
      >
        <span
          className={`pull-to-refresh-spinner${refreshing ? ' spinning' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${Math.min(pull / TRIGGER_DISTANCE, 1) * 360}deg)` }}
        >
          <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 3v6h-6" />
          </svg>
        </span>
      </div>
      {children}
    </div>
  );
}
