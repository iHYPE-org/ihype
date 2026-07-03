'use client';

import { useEffect, useState } from 'react';
import { haptic } from '@/lib/haptics';

type CompactHypeButtonProps = {
  targetType: 'show' | 'profile';
  targetId: string;
  initialCount: number;
  initiallyHyped?: boolean;
};

export function CompactHypeButton({ targetType, targetId, initialCount, initiallyHyped }: CompactHypeButtonProps) {
  const storageKey = `hyped:${targetType}:${targetId}`;
  const [count, setCount] = useState(initialCount);
  const [hyped, setHyped] = useState(initiallyHyped ?? false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (initiallyHyped !== undefined) return;
    try {
      setHyped(localStorage.getItem(storageKey) === '1');
    } catch {}
  }, [storageKey, initiallyHyped]);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    haptic('light');
    setPending(true);

    const wasHyped = hyped;
    setHyped(!wasHyped);
    setCount((c) => wasHyped ? Math.max(0, c - 1) : c + 1);

    let response: Response;
    try {
      response = await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId })
      });
    } catch {
      setHyped(wasHyped);
      setCount((c) => wasHyped ? c + 1 : Math.max(0, c - 1));
      setPending(false);
      return;
    }

    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (response.ok) {
      const isHyped = data.action === 'hyped';
      if (typeof data.hypeCount === 'number') setCount(data.hypeCount);
      setHyped(isHyped);
      try {
        if (isHyped) localStorage.setItem(storageKey, '1');
        else localStorage.removeItem(storageKey);
      } catch {}
    } else {
      setHyped(wasHyped);
      setCount((c) => wasHyped ? c + 1 : Math.max(0, c - 1));
    }

    setPending(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      type="button"
      aria-pressed={hyped}
      aria-label={hyped ? 'Remove hype' : 'Hype this'}
      title={hyped ? 'Remove hype' : 'Hype this'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 20,
        border: `1px solid ${hyped ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,.1)'}`,
        background: hyped ? 'rgba(255,80,41,.12)' : 'rgba(255,255,255,.04)',
        color: hyped ? 'var(--accent, #ff5029)' : 'rgba(240,235,229,.5)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        cursor: pending ? 'default' : 'pointer',
        opacity: pending ? 0.6 : 1,
        transition: 'color .15s, border-color .15s, background .15s',
      }}
    >
      <span aria-hidden="true">🔥</span>
      {count.toLocaleString()}
    </button>
  );
}
