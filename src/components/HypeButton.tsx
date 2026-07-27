'use client';

import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';
import { useI18n } from '@/components/I18nProvider';

type HypeButtonProps = {
  targetType: 'show' | 'profile';
  targetId: string;
  initialCount: number;
  initiallyHyped?: boolean;
  entityLabel?: string;
};

export function HypeButton({ targetType, targetId, initialCount, initiallyHyped, entityLabel }: HypeButtonProps) {
  const { t } = useI18n();
  const storageKey = `hyped:${targetType}:${targetId}`;
  const [count, setCount] = useState(initialCount);
  const [hyped, setHyped] = useState(initiallyHyped ?? false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const [bursting, setBursting] = useState(false);
  const burstRef = useRef<HTMLSpanElement>(null);
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
      setBursting(true);
      setTimeout(() => setPopping(false), 400);
      setTimeout(() => setBursting(false), 700);
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
      setMessage(
        wasHyped
          ? t('hypeButton.unhypeNetworkError', 'Could not unhype this {noun} (network error)').replace('{noun}', noun)
          : t('hypeButton.hypeNetworkError', 'Could not hype this {noun} (network error)').replace('{noun}', noun)
      );
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
      setMessage(
        isHyped
          ? t('hypeButton.hypedSuccess', "Hyped! You've hyped {count} total on this {noun}.")
              .replace('{count}', (data.hypeCount ?? count).toLocaleString())
              .replace('{noun}', noun)
          : null
      );
    } else {
      // Roll back the optimistic update.
      setHyped(wasHyped);
      setCount((c) => wasHyped ? c + 1 : Math.max(0, c - 1));
      setMessage(
        (data.error as string | undefined) ??
          (wasHyped
            ? t('hypeButton.unhypeFailed', 'Could not unhype this {noun}').replace('{noun}', noun)
            : t('hypeButton.hypeFailed', 'Could not hype this {noun}').replace('{noun}', noun))
      );
    }

    setPending(false);
  }

  return (
    <div className="cta-row" style={{ position: 'relative' }}>
      <button
        className={`button${hyped ? ' secondary' : ''}${popping ? ' hype-pop' : ''}`}
        onClick={handleClick}
        disabled={pending}
        type="button"
        aria-pressed={hyped}
        aria-label={hyped ? t('hypeButton.removeHypeAria', 'Remove hype from this {noun}').replace('{noun}', noun) : t('hypeButton.hypeAria', 'Hype this {noun}').replace('{noun}', noun)}
        title={hyped ? t('hypeButton.removeHypeAria', 'Remove hype from this {noun}').replace('{noun}', noun) : t('hypeButton.hypeAria', 'Hype this {noun}').replace('{noun}', noun)}
        style={{ position: 'relative', overflow: 'visible' }}
      >
        {pending
          ? t('hypeButton.updating', 'Updating…')
          : hyped
            ? `${t('hypeButton.hypedCount', '✓ Hyped')} ${count.toLocaleString()}`
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
                background: '#ff5029',
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
