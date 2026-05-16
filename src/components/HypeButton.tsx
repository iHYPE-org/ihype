'use client';

import { useEffect, useState } from 'react';

type HypeButtonProps = {
  targetType: 'show' | 'profile';
  targetId: string;
  initialCount: number;
  entityLabel?: string;
};

export function HypeButton({ targetType, targetId, initialCount, entityLabel }: HypeButtonProps) {
  const storageKey = `hyped:${targetType}:${targetId}`;
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [alreadyHyped, setAlreadyHyped] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const noun = entityLabel ?? (targetType === 'show' ? 'show' : 'profile');

  useEffect(() => {
    try {
      setAlreadyHyped(localStorage.getItem(storageKey) === '1');
    } catch {}
  }, [storageKey]);

  async function handleHype() {
    if (alreadyHyped) {
      setMessage(`You already hyped this ${noun}`);
      return;
    }
    setPending(true);
    setMessage(null);

    // Optimistic update: increment count + trigger pop animation immediately.
    const previousCount = count;
    setCount((c) => c + 1);
    setPopping(true);
    setTimeout(() => setPopping(false), 400);

    let response: Response;
    try {
      response = await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId })
      });
    } catch {
      // Network failure — roll back.
      setCount(previousCount);
      setMessage(`Could not hype this ${noun} (network error)`);
      setPending(false);
      return;
    }

    const data = await response.json().catch(() => ({} as any));
    if (response.ok) {
      // Reconcile with authoritative server count.
      if (typeof data.hypeCount === 'number') setCount(data.hypeCount);
      if (data.created) {
        setAlreadyHyped(true);
        try { localStorage.setItem(storageKey, '1'); } catch {}
        setMessage(`Hyped! You've hyped ${(data.hypeCount ?? previousCount + 1).toLocaleString()} total on this ${noun}.`);
      } else {
        setAlreadyHyped(true);
        try { localStorage.setItem(storageKey, '1'); } catch {}
        setMessage(`You already hyped this ${noun}`);
      }
    } else {
      // Roll back the optimistic increment.
      setCount(previousCount);
      setMessage(data.error ?? `Could not hype this ${noun}`);
    }

    setPending(false);
  }

  return (
    <div className="cta-row">
      <button
        className={`button${alreadyHyped ? ' secondary' : ''}${popping ? ' hype-pop' : ''}`}
        onClick={handleHype}
        disabled={pending}
        title={alreadyHyped ? `You hyped this ${noun}` : `Hype this ${noun}`}
      >
        {pending ? 'Hyping…' : alreadyHyped ? `✓ Hyped ${count.toLocaleString()}` : `Hype ${count.toLocaleString()}`}
      </button>
      {message ? <span className="meta">{message}</span> : null}
    </div>
  );
}
