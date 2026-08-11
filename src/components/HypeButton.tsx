'use client';

import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';
import { useI18n } from '@/components/I18nProvider';
import { formatHypeWait, hypeWaitMs, HYPE_WINDOW_MS } from '@/lib/hype-window';

type HypeButtonProps = {
  targetType: 'show' | 'profile';
  targetId: string;
  initialCount: number;
  /**
   * When the viewer last hyped this target, ISO. The window is a timestamp,
   * never a boolean — see `src/lib/hype-window.ts`.
   */
  lastHypedAt?: string | null;
  entityLabel?: string;
};

export function HypeButton({ targetType, targetId, initialCount, lastHypedAt, entityLabel }: HypeButtonProps) {
  const { t } = useI18n();
  const storageKey = `hyped-at:${targetType}:${targetId}`;
  const [count, setCount] = useState(initialCount);
  const [hypedAt, setHypedAt] = useState<string | null>(lastHypedAt ?? null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const [bursting, setBursting] = useState(false);
  // Re-render on a coarse tick so the stated wait counts down while the page
  // is open. Every 30s, not every second: the label is minutes, and a
  // per-second countdown turns a fairness rule into a game to be timed.
  const [, setTick] = useState(0);
  const burstRef = useRef<HTMLSpanElement>(null);
  const noun = entityLabel ?? (targetType === 'show' ? 'show' : 'profile');

  useEffect(() => {
    if (lastHypedAt !== undefined) return; // server-provided state is authoritative
    try {
      setHypedAt(localStorage.getItem(storageKey));
    } catch {}
  }, [storageKey, lastHypedAt]);

  const waitMs = hypeWaitMs(hypedAt);
  const waiting = waitMs > 0;

  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [waiting]);

  async function handleClick() {
    if (waiting || pending) return;
    haptic('light');
    setPending(true);
    setMessage(null);

    // Optimistic: the spend is one-way now, so there is nothing to toggle back
    // to — only a failure rolls it off.
    const previousHypedAt = hypedAt;
    const now = new Date().toISOString();
    setHypedAt(now);
    setCount((c) => c + 1);
    setPopping(true);
    setBursting(true);
    setTimeout(() => setPopping(false), 400);
    setTimeout(() => setBursting(false), 700);

    let response: Response;
    try {
      response = await fetch('/api/hype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId })
      });
    } catch {
      // Network failure — roll back.
      setHypedAt(previousHypedAt);
      setCount((c) => Math.max(0, c - 1));
      setMessage(t('hypeButton.hypeNetworkError', 'Could not hype this {noun} (network error)').replace('{noun}', noun));
      setPending(false);
      return;
    }

    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (response.ok) {
      if (typeof data.hypeCount === 'number') setCount(data.hypeCount);
      try { localStorage.setItem(storageKey, now); } catch {}
      setMessage(
        t('hypeButton.hypedWindow', "Hyped! You can hype this {noun} again in 24 hours.")
          .replace('{noun}', noun)
      );
    } else {
      // A 429 from the window means this page was stale — adopt the server's
      // answer rather than rolling back to a state it disagrees with.
      const serverNext = typeof data.nextHypeAt === 'string' ? data.nextHypeAt : null;
      if (serverNext) {
        const lastFromServer = new Date(new Date(serverNext).getTime() - HYPE_WINDOW_MS);
        setHypedAt(Number.isNaN(lastFromServer.getTime()) ? previousHypedAt : lastFromServer.toISOString());
      } else {
        setHypedAt(previousHypedAt);
      }
      setCount((c) => Math.max(0, c - 1));
      setMessage(
        (data.error as string | undefined) ??
          t('hypeButton.hypeFailed', 'Could not hype this {noun}').replace('{noun}', noun)
      );
    }

    setPending(false);
  }

  const waitLabel = formatHypeWait(waitMs);
  const actionLabel = waiting
    ? t('hypeButton.waitAria', 'You can hype this {noun} again in {wait}')
        .replace('{noun}', noun).replace('{wait}', waitLabel)
    : t('hypeButton.hypeAria', 'Hype this {noun}').replace('{noun}', noun);

  return (
    <div className="cta-row" style={{ position: 'relative' }}>
      <button
        className={`button${waiting ? ' secondary' : ''}${popping ? ' hype-pop' : ''}`}
        onClick={handleClick}
        disabled={pending || waiting}
        type="button"
        aria-label={actionLabel}
        title={actionLabel}
        style={{ position: 'relative', overflow: 'visible' }}
      >
        {pending
          ? t('hypeButton.updating', 'Updating…')
          : waiting
            ? `${t('hypeButton.hypedCount', '✓ Hyped')} ${count.toLocaleString()} · ${waitLabel}`
            : `${t('hypeButton.hypeCount', 'Hype')} ${count.toLocaleString()}`}
        {bursting && (
          <span ref={burstRef} aria-hidden="true" style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit',
            pointerEvents: 'none', zIndex: 10,
          }}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <span key={i} style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: 6, height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
                transform: 'translate(-50%,-50%)',
                animation: `hype-particle 0.6s ease-out forwards`,
                animationDelay: `${i * 0.04}s`,
                // Each particle shoots in a different direction via CSS custom property
                ['--angle' as string]: `${i * 60}deg`,
              }} />
            ))}
          </span>
        )}
      </button>
      {message ? <span className="meta">{message}</span> : null}
    </div>
  );
}
