'use client';

import type { ReactNode } from 'react';
import { useMobileShell } from '@/lib/MobileShellContext';

/**
 * Wraps each of Listen/Events/Pages' routed page content. On mobile, once
 * MobileAppShell has taken over (it holds its own permanently-mounted copy
 * of all 3 sections), the routed copy renders null so we don't double-mount
 * / double-fetch the same section. Desktop, and mobile before hydration,
 * render children normally — the shell's absence (SSR) or inactivity
 * (desktop viewport) falls back to today's behavior.
 */
export function RouteShellSlot({ children }: { children: ReactNode }) {
  const shell = useMobileShell();
  if (shell?.active) return null;
  return <>{children}</>;
}
