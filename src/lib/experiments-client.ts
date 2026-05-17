'use client';

import { useEffect, useMemo, useRef } from 'react';
import { getExperimentVariant } from './experiments';

/**
 * Returns the assigned variant for `key` and fires a one-time exposure
 * event to `/api/experiments/expose` per mount.
 *
 * Pass `userId` (or null for anonymous) so server + client stay in sync.
 */
export function useExperiment<T extends string>(
  key: string,
  variants: readonly T[],
  userId: string | null = null
): T {
  const variant = useMemo(() => getExperimentVariant(key, userId, variants), [key, userId, variants]);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fetch('/api/experiments/expose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, variant, userId }),
      keepalive: true
    }).catch(() => {});
  }, [key, variant, userId]);

  return variant;
}
