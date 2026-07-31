'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Backlog item 4 of the app-shell handoff: "Promote two patterns to
 * components: SegmentedTabs (the context-strip pill row, also used for
 * dashboard role tabs and account chips) and NavRow".
 *
 * One pill row, three jobs:
 *   - `mode="nav"`   → real links, `aria-current` on the active pill
 *                      (context strip, dashboard role tabs driven by URL)
 *   - `mode="toggle"`→ buttons with `aria-pressed` (account role chips)
 *
 * Active pill: `background: var(--ink-1)`, `color: var(--bg-base)`, matching
 * border — see `.shell-pill` in shell.css. Nothing here paints a hex value.
 */

export type SegmentedTabItem = {
  id: string;
  label: ReactNode;
  /** Required for mode="nav". */
  href?: string;
  onSelect?: () => void;
  active: boolean;
  disabled?: boolean;
};

export function SegmentedTabs({
  items,
  mode = 'nav',
  label,
  className,
}: {
  items: SegmentedTabItem[];
  mode?: 'nav' | 'toggle';
  label: string;
  className?: string;
}) {
  return (
    <div
      aria-label={label}
      className={`shell-pill-row${className ? ` ${className}` : ''}`}
      role={mode === 'nav' ? 'navigation' : 'group'}
    >
      {items.map((item) => {
        if (mode === 'nav' && item.href) {
          return (
            <Link
              aria-current={item.active ? 'page' : undefined}
              className="shell-pill"
              data-active={item.active ? 'true' : 'false'}
              href={item.href}
              key={item.id}
              onClick={item.onSelect}
            >
              {item.label}
            </Link>
          );
        }
        return (
          <button
            aria-current={mode === 'nav' && item.active ? 'true' : undefined}
            aria-pressed={mode === 'toggle' ? item.active : undefined}
            className="shell-pill"
            data-active={item.active ? 'true' : 'false'}
            disabled={item.disabled}
            key={item.id}
            onClick={item.onSelect}
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
