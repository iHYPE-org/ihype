'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Mobile-only sticky "Join Beta" bar that slides in once the hero has
 * scrolled past — the index page's whole job is to sell the idea, so the
 * primary CTA should stay reachable through the entire long scroll, not
 * just at the very top and very bottom.
 */
export function IndexStickyCta({ heroSelector }: { heroSelector: string }) {
  const [show, setShow] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(heroSelector);
    if (!hero) return;

    function onScroll() {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const heroBottom = (hero?.offsetTop ?? 0) + (hero?.offsetHeight ?? 0);
        setShow(window.scrollY > heroBottom);
      });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [heroSelector]);

  return (
    <div className={`idx-sticky-cta${show ? ' is-visible' : ''}`}>
      <div className="idx-sticky-cta-text">
        <b>Join the scene</b>
        <span>Completely free · no fees</span>
      </div>
      <Link href="/register">Join Beta →</Link>
      <style>{`
        .idx-sticky-cta { display: none; }
        @media (max-width: 768px) {
          .idx-sticky-cta {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 200;
            padding: 10px 16px calc(12px + env(safe-area-inset-bottom, 0px));
            background: rgba(10,8,5,.9); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
            border-top: 1px solid var(--hair-80);
            display: flex; align-items: center; gap: 12px;
            transform: translateY(120%); transition: transform .3s cubic-bezier(.22,1,.36,1);
          }
          .idx-sticky-cta.is-visible { transform: translateY(0); }
          .idx-sticky-cta-text { flex: 1; min-width: 0; }
          .idx-sticky-cta-text b { display: block; font-family: var(--f-d); font-weight: 800; font-size: 13.5px; color: var(--ink); }
          .idx-sticky-cta-text span { display: block; font-family: var(--f-m); font-size: 9.5px; color: var(--ink-3); letter-spacing: .03em; }
          .idx-sticky-cta a {
            font-family: var(--f-d); font-weight: 800; font-size: 13px; white-space: nowrap;
            background: var(--accent); color: #fff; border-radius: 10px; padding: 11px 18px; text-decoration: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .idx-sticky-cta { transition: none; }
        }
      `}</style>
    </div>
  );
}
