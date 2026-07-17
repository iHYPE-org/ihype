'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Fades/rises a section in once it scrolls into view (matches Charter.dc.html's `.ch-reveal`). */
export function Reveal({ children, delayMs = 0 }: { children: ReactNode; delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setOn(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? 'none' : 'translateY(26px)',
        transition: `opacity .8s cubic-bezier(.16,1,.3,1) ${delayMs}ms, transform .8s cubic-bezier(.16,1,.3,1) ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Animated 70/20/10/0 split bar with count-up percentages (matches Charter.dc.html). */
export function SplitBar() {
  const [pct, setPct] = useState({ artist: 0, venue: 0, promoter: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const t0 = performance.now();
            const dur = 1600;
            const delay = 300;
            const tick = (now: number) => {
              const p = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
              const eased = 1 - Math.pow(1 - p, 3);
              setPct({
                artist: Math.round(eased * 70),
                venue: Math.round(eased * 20),
                promoter: Math.round(eased * 10),
              });
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <div className="charter-split-bar">
        <div style={{ flex: 70, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
        <div style={{ flex: 20, background: 'var(--role-venue)' }} />
        <div style={{ flex: 10, background: 'var(--role-fan)' }} />
      </div>

      <p className="charter-split-display">
        <span className="charter-accent">{pct.artist}%</span> artist ·{' '}
        <span className="charter-venue">{pct.venue}%</span> venue ·{' '}
        <span className="charter-fan">{pct.promoter}%</span> promoters ·{' '}
        0% iHYPE.
      </p>
    </div>
  );
}
