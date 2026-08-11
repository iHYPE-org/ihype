'use client';

import { useRef, useState, type ReactNode } from 'react';

const TRIGGER_DISTANCE = 64;
const MAX_PULL = 90;
const RESISTANCE = 0.5;

/**
 * Native-style pull-to-refresh. Only arms when the surface is scrolled to the
 * very top, so it never fights normal scrolling.
 *
 * "Scrolled to the top" is read from the nearest SCROLLABLE ANCESTOR, not from
 * `window.scrollY`. Inside the app shell the document does not scroll at all —
 * `html`/`body` are locked and `.shell-content` is the scroll container — so
 * `window.scrollY` is permanently 0 there, and this armed on every touch no
 * matter how far down the page the finger started. That is the same trap the
 * shell's own contract rule 3 names: read the content container's scrollTop,
 * never the window's. Off the shell there is no scrollable ancestor and the
 * walk falls through to the document, which is the old behaviour exactly.
 */
function scrollTopOf(from: Element | null): number {
  for (let node = from; node && node !== document.body; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node.scrollTop;
  }
  return window.scrollY || document.documentElement.scrollTop;
}

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => unknown; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  return (
    <div
      onTouchStart={(e) => {
        if (refreshing || scrollTopOf(e.target as Element | null) > 0) { startY.current = null; return; }
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
