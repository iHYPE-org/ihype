'use client';

import { useEffect, useState } from 'react';
import { haptic } from '@/lib/haptics';
import { useI18n } from '@/components/I18nProvider';
import { formatHypeWait, hypeWaitMs } from '@/lib/hype-window';

type CompactHypeButtonProps = {
  targetType: 'show' | 'profile';
  targetId: string;
  initialCount: number;
  /** When the viewer last hyped this target, ISO. See `src/lib/hype-window.ts`. */
  lastHypedAt?: string | null;
};

export function CompactHypeButton({ targetType, targetId, initialCount, lastHypedAt }: CompactHypeButtonProps) {
  const { t } = useI18n();
  const storageKey = `hyped-at:${targetType}:${targetId}`;
  const [count, setCount] = useState(initialCount);
  const [hypedAt, setHypedAt] = useState<string | null>(lastHypedAt ?? null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (lastHypedAt !== undefined) return;
    try {
      setHypedAt(localStorage.getItem(storageKey));
    } catch {}
  }, [storageKey, lastHypedAt]);

  const waitMs = hypeWaitMs(hypedAt);
  const waiting = waitMs > 0;

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending || waiting) return;
    haptic('light');
    setPending(true);

    const previousHypedAt = hypedAt;
    const now = new Date().toISOString();
    setHypedAt(now);
    setCount((c) => c + 1);

    let response: Response;
    try {
      response = await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId })
      });
    } catch {
      setHypedAt(previousHypedAt);
      setCount((c) => Math.max(0, c - 1));
      setPending(false);
      return;
    }

    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (response.ok) {
      if (typeof data.hypeCount === 'number') setCount(data.hypeCount);
      try { localStorage.setItem(storageKey, now); } catch {}
    } else {
      setHypedAt(previousHypedAt);
      setCount((c) => Math.max(0, c - 1));
    }

    setPending(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending || waiting}
      type="button"
      aria-label={waiting
        ? t('compactHypeButton.waitAria', 'You can hype this again in {wait}').replace('{wait}', formatHypeWait(waitMs))
        : t('compactHypeButton.hypeThis', 'Hype this')}
      title={waiting
        ? t('compactHypeButton.waitAria', 'You can hype this again in {wait}').replace('{wait}', formatHypeWait(waitMs))
        : t('compactHypeButton.hypeThis', 'Hype this')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 20,
        border: `1px solid ${waiting ? 'var(--accent)' : 'var(--hair-100)'}`,
        background: waiting ? 'rgba(var(--accent-rgb),.12)' : 'var(--hair-40)',
        color: waiting ? 'var(--accent)' : 'var(--ink-a50)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        cursor: pending || waiting ? 'default' : 'pointer',
        opacity: pending ? 0.6 : 1,
        transition: 'color .15s, border-color .15s, background .15s',
      }}
    >
      <span aria-hidden="true">🔥</span>
      {count.toLocaleString()}
    </button>
  );
}
