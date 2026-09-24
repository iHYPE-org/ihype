'use client';

import { useEffect, useState } from 'react';
import { isCapacitorNative } from '@/lib/native-app';

/**
 * Starts from what the server read off the user agent (so a current store build
 * never paints a buy button), then checks `window.Capacitor` once after mount,
 * which catches a store build that predates the user-agent token. See
 * `src/lib/native-app.ts` for why both exist.
 */
export function useNativeApp(initialNative: boolean): boolean {
  const [native, setNative] = useState(initialNative);
  useEffect(() => {
    if (!initialNative && isCapacitorNative()) setNative(true);
  }, [initialNative]);
  return native;
}
