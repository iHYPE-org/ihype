'use client';

import { useEffect, useState } from 'react';
import { haptic } from '@/lib/haptics';

type HypeButtonProps = {
  targetType: 'show' | 'profile';
  targetId: string;
  initialCount: number;
  initiallyHyped?: boolean;
  entityLabel?: string;
};

export function HypeButton({ targetType, targetId, initialCount, initiallyHyped, entityLabel }: HypeButtonProps) {
  const storageKey = `hyped:${targetType}:${targetId}`;
  const [count, setCount] = useState(initialCount);
  const [hyped, setHyped] = useState(initiallyHyped ?? false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const noun = entityLabel ?? (targetType === 'show' ? 'show' : 'profile');

  useEffect(() => {
    if (initiallyHyped !== undefined) return; // server-provided state is authoritative
    try {
      setHyped(localStorage.getItem(storageKey) === '1');
    } catch {}
  }, [storageKey, initiallyHyped]);

  async function handleClick() {
    haptic('light');
    setPending(true);
    setMessage(null);

    const wasHyped = hyped;
    // Optimistic update
    setHyped(!wasHyped);
    setCount((c) => wasHyped ? Math.max(0, c - 1) : c + 1);
    if (!wasHyped) {
      setPopping(true);
      setTimeout(() => setPopping(false), 400);
    }

    let response: Response;
    try {
      response = await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId })
      });
    } catch {
      // Network failure — roll back.
      setHyped(wasHyped);
      setCount((c) => wasHyped ? c + 1 : Math.max(0, c - 1));
      setMessage(`Could not ${wasHyped ? 'unhype' : 'hype'} this ${noun} (network error)`);
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
      setMessage(isHyped ? `Hyped! You've hyped ${(data.hypeCount ?? count).toLocaleString()} total on this ${noun}.` : null);
    } else {
      // Roll back the optimistic update.
      setHyped(wasHyped);
      setCount((c) => wasHyped ? c + 1 : Math.max(0, c - 1));
      setMessage((data.error as string | undefined) ?? `Could not ${wasHyped ? 'unhype' : 'hype'} this ${noun}`);
    }

    setPending(false);
  }

  return (
    <div className="cta-row">
      <button
        className={`button${hyped ? ' secondary' : ''}${popping ? ' hype-pop' : ''}`}
        onClick={handleClick}
        disabled={pending}
        title={hyped ? `Remove hype from this ${noun}` : `Hype this ${noun}`}
      >
        {pending
          ? 'Updating…'
          : hyped
            ? `✓ Hyped ${count.toLocaleString()}`
            : `Hype ${count.toLocaleString()}`}
      </button>
      {message ? <span className="meta">{message}</span> : null}
    </div>
  );
}
