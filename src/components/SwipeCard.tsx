'use client';

import { useRef, useState } from 'react';

interface SwipeCardProps {
  onHype: () => void;
  onSkip: () => void;
  children: React.ReactNode;
}

const THRESHOLD = 80;

export function SwipeCard({ onHype, onSkip, children }: SwipeCardProps) {
  const startX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    setDragX(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    if (dragX >= THRESHOLD) {
      setDismissed(true);
      onHype();
    } else if (dragX <= -THRESHOLD) {
      setDismissed(true);
      onSkip();
    } else {
      setDragX(0);
    }
  }

  const ratio = Math.min(Math.abs(dragX) / THRESHOLD, 1);
  const isRight = dragX > 0;
  const isLeft = dragX < 0;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'relative',
        transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`,
        transition: dragX === 0 ? 'transform 0.3s ease' : 'none',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'pan-y',
      }}
    >
      {children}
      {isRight && ratio > 0.1 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          background: `rgba(34, 197, 94, ${ratio * 0.5})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, pointerEvents: 'none',
        }}>
          {ratio > 0.5 ? '🔥' : ''}
        </div>
      )}
      {isLeft && ratio > 0.1 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          background: `rgba(239, 68, 68, ${ratio * 0.5})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, pointerEvents: 'none',
        }}>
          {ratio > 0.5 ? '✕' : ''}
        </div>
      )}
    </div>
  );
}
