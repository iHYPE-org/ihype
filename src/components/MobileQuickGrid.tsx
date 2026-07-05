'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { acquireScrollLock } from '@/lib/scrollLock';

export type QuickGridItem = {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  icon: ReactNode;
  /** For server-component pages: navigate here instead of calling onSelect. */
  href?: string;
};

/**
 * Mobile-only "home" for a tabbed page: a full-screen search trigger +
 * quick-access button grid that replaces the desktop tab strip on phones.
 * Desktop is unaffected — see .mqg-* rules in globals.css, all gated
 * behind the same 768px breakpoint the rest of the mobile shell uses.
 *
 * Works for both client-state pages (pass onSelect) and server-component
 * pages that switch tabs via the URL (pass href on each item / searchHref).
 */
export function MobileQuickGrid({
  active,
  items,
  onSelect,
  searchPlaceholder,
  onSearchTap,
  searchHref,
}: {
  active: boolean;
  items: QuickGridItem[];
  onSelect?: (id: string) => void;
  searchPlaceholder?: string;
  onSearchTap?: () => void;
  searchHref?: string;
}) {
  const cells: (QuickGridItem | null)[] = [...items];
  while (cells.length < 4) cells.push(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!active) return;
    return acquireScrollLock();
  }, [active]);

  if (!mounted) return null;

  return createPortal(
    <div className={`mqg-overlay${active ? ' is-active' : ''}`}>
      {searchPlaceholder && (searchHref ? (
        <Link className="mqg-search" href={searchHref}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          {searchPlaceholder}
        </Link>
      ) : onSearchTap ? (
        <button className="mqg-search" onClick={onSearchTap} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          {searchPlaceholder}
        </button>
      ) : null)}
      <div className="mqg-grid">
        {cells.map((item, i) =>
          item ? (
            item.href ? (
              <Link className="mqg-btn" href={item.href} key={item.id} style={{ background: `${item.color}12` }}>
                <span className="mqg-icon" style={{ background: `${item.color}26`, color: item.color }}>
                  {item.icon}
                </span>
                <span className="mqg-label">{item.label}</span>
                <span className="mqg-sublabel">{item.sublabel}</span>
              </Link>
            ) : (
              <button
                className="mqg-btn"
                key={item.id}
                onClick={() => onSelect?.(item.id)}
                style={{ background: `${item.color}12` }}
                type="button"
              >
                <span className="mqg-icon" style={{ background: `${item.color}26`, color: item.color }}>
                  {item.icon}
                </span>
                <span className="mqg-label">{item.label}</span>
                <span className="mqg-sublabel">{item.sublabel}</span>
              </button>
            )
          ) : (
            <span aria-hidden="true" className="mqg-btn mqg-spacer" key={`spacer-${i}`} />
          )
        )}
      </div>
    </div>,
    document.body
  );
}
