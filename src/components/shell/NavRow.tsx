'use client';

import Link from 'next/link';
import { badgeToneVar, type ShellBadge } from '@/lib/app-nav';

/**
 * Backlog item 4: the drawer row promoted to a component — "badge + active
 * left border + aria-current".
 *
 * Design: padding 10px 14px, radius 8px, DM Sans 14.5px var(--ink-2),
 * border-left 2px solid transparent. Active → var(--ink-1),
 * rgba(var(--surface-tint-rgb), 0.07), border-left-color var(--accent),
 * aria-current="true". All of that lives in `.shell-nav-row` in shell.css.
 */
export function NavRow({
  href,
  label,
  badge,
  active,
  onNavigate,
  tabIndex,
}: {
  href: string;
  label: string;
  badge?: ShellBadge;
  active: boolean;
  onNavigate?: () => void;
  tabIndex?: number;
}) {
  return (
    <Link
      aria-current={active ? 'true' : undefined}
      className="shell-nav-row"
      data-active={active ? 'true' : 'false'}
      href={href}
      onClick={onNavigate}
      tabIndex={tabIndex}
    >
      <span className="shell-nav-row-label">{label}</span>
      {badge ? (
        <span className="shell-eyebrow shell-nav-row-badge" style={{ color: badgeToneVar(badge.tone) }}>
          {badge.text}
        </span>
      ) : null}
    </Link>
  );
}
