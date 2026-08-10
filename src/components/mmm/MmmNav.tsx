'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  ARC,
  ARC_NARROW_MAX_WIDTH,
  MMM_NAV,
  arcTransform,
  type MmmModuleId,
} from '@/lib/mmm-nav';

/**
 * The radial arc nav, from the app-shell redesign.
 *
 * The logo and every fan item share one origin — a zero-size anchor at the
 * frame's lower left — and are moved into place by `transform` alone. Closed,
 * every item sits tucked behind the logo at `translate(14px,-6px) scale(.55)`
 * with `opacity: 0` and `pointer-events: none`; open, each animates to its slot
 * on the arc. Because nothing here changes layout, the whole fan-out is a
 * compositor animation.
 *
 * Three things are load-bearing:
 *
 *   - **Only MUSIC has a submenu.** MAP and ME navigate directly. The earlier
 *     seven-item ME fan-out is gone, which also retires
 *     `FRONTEND_GOTCHAS.md` §4 (a wrapping submenu clipped by an ancestor's
 *     overflow) — there is no wrapping submenu left to clip.
 *   - **The transform and delay are computed per index** from the ARC table and
 *     passed inline. §5 is the reason: the prototype routed the delay through an
 *     `--nd` custom property that was never declared, and an undefined custom
 *     property invalidates the whole declaration silently, so every item
 *     animated at once with no warning.
 *   - **A closed item is not tabbable.** `pointer-events: none` hides it from
 *     the mouse but not from the keyboard, so `tabIndex`/`aria-hidden` do the
 *     rest — otherwise five invisible buttons sit in the tab order.
 */

/**
 * The three marks, ported from `components/shell/ArcNav.jsx`.
 *
 * Every number here is the design's, including the ones that look wrong:
 *
 *  - **The mark is BIGGER than the disc.** The disc is a 66px target and a
 *    colour field; the drawing is 92px (the pin 100px, having the least ink of
 *    the three) and breaks its edge on every side, so the nav reads as three
 *    objects sitting on the frame rather than three buttons in a row. Nothing
 *    clips them — the button keeps `overflow: visible`.
 *  - **Line art at one weight, never solid.** Past about 60px a filled notehead
 *    or figure stops being a drawing and becomes a blob, and three blobs do not
 *    read as a set.
 *  - **Centred on a declared OPTICAL anchor**, not a bounding box. Bounding-box
 *    centring measures the protrusions — the pin's point, the beam, the
 *    shoulders — and pushes the body of the mark the other way. Each glyph
 *    names the point that should land dead centre: the pin's body, the waist of
 *    the notes, the head of the figure.
 *  - **Absolutely centred, not laid out.** `place-items: center` on a grid
 *    whose item is bigger than its track resolves to the START edge — CSS's
 *    overflow-alignment safety — which is why an oversized mark sat down and
 *    right of centre. Pinning 50/50 and pulling back half its own size is
 *    immune to that.
 */
const GLYPH_VIEWBOX = { x: -1.5, y: -3, w: 27.5, h: 30 };

function Glyph({ id }: { id: MmmModuleId }) {
  const spec = GLYPHS[id];
  if (!spec) return null;
  const [ax, ay] = spec.anchor;
  const dx = GLYPH_VIEWBOX.x + GLYPH_VIEWBOX.w / 2 - ax;
  const dy = GLYPH_VIEWBOX.y + GLYPH_VIEWBOX.h / 2 - ay;
  const size = spec.size ?? 92;
  return (
    <svg
      aria-hidden="true"
      className="mmm-ray-glyph"
      height={size}
      viewBox={`${GLYPH_VIEWBOX.x} ${GLYPH_VIEWBOX.y} ${GLYPH_VIEWBOX.w} ${GLYPH_VIEWBOX.h}`}
      width={size}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.55}
        transform={`translate(${dx.toFixed(2)} ${dy.toFixed(2)})`}
      >
        {spec.paths}
      </g>
    </svg>
  );
}

const GLYPHS: Partial<Record<MmmModuleId, { anchor: [number, number]; size?: number; paths: React.ReactNode }>> = {
  // A pin, alone. The folded map behind it did the same job twice and was the
  // part that read as boxy — the pin already means place.
  map: {
    anchor: [12, 10.4],
    size: 100,
    paths: (
      <>
        <path d="M12-1.4a7.7 7.7 0 0 0-7.7 7.7c0 6 7.7 14.7 7.7 14.7s7.7-8.7 7.7-14.7A7.7 7.7 0 0 0 12-1.4Z" />
        <circle cx={12} cy={6.3} r={2.9} />
      </>
    ),
  },
  // A tied pair — two heads under one beam — with the beam as two rules rather
  // than a slab, so it carries the weight of everything else.
  music: {
    anchor: [12.1, 12.8],
    paths: (
      <>
        <ellipse cx={3.6} cy={19.4} rx={4.3} ry={3.3} transform="rotate(-20 3.6 19.4)" />
        <ellipse cx={16.4} cy={17} rx={4.3} ry={3.3} transform="rotate(-20 16.4 17)" />
        <path d="M7.6 18V2.4" />
        <path d="M20.4 15.6V0" />
        <path d="M7.6 2.4 20.4 0" />
        <path d="M7.6 6.1 20.4 3.7" />
      </>
    ),
  },
  // Head and shoulders. The headphones came off for the same reason the map
  // did: two ideas in one mark, and the cups were the fiddliest thing at size.
  me: {
    anchor: [12, 15.2],
    paths: (
      <>
        <circle cx={12} cy={7.4} r={5.5} />
        <path d="M1.2 26.6c0-6 4.8-10.8 10.8-10.8s10.8 4.8 10.8 10.8" />
      </>
    ),
  },
};

export function MmmNav({
  activeModule,
  onClose,
  open,
}: {
  activeModule: MmmModuleId;
  onClose: () => void;
  open: boolean;
}) {
  const router = useRouter();
  const arc = useArcBreakpoint();

  // Escape closes. There is no level to step back to any more.
  // the earlier design had a visible chip for.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const level1 = ARC[arc].level1;

  return (
    <>
      {open && <button aria-label="Close navigation" className="mmm-nav-scrim" onClick={onClose} type="button" />}

      <div className="mmm-nav-anchor" data-open={open}>
        {/* Three discs, and nothing under them. `ArcNav.d.ts`: "one 66px icon
            disc each, drawn from the id … There is no second level: Music's
            sections are tabs at the top of the Music pane. `items` is ignored
            here and kept only so the shell can hold the route table in one
            place."

            The five-item MUSIC arc this used to open was a navigation layer
            the design does not have — a second route to the five destinations
            `MmmMusic`'s tab strip already carries, drawn to a table that
            existed nowhere in the design system. */}
        {MMM_NAV.map((module, index) => {
          const slot = level1[index];
          if (!slot) return null;
          return (
            <button
              aria-current={module.id === activeModule ? 'page' : undefined}
              aria-hidden={!open}
              /* The disc carries no visible text, so the name has to be stated. */
              aria-label={module.label}
              className="mmm-ray mmm-ray-disc"
              key={module.id}
              onClick={() => go(module.href)}
              style={{
                ...(open ? { transform: arcTransform(slot), opacity: 1, pointerEvents: 'auto' } : null),
                transitionDelay: open ? `${slot.delayMs}ms` : '0ms',
              } as CSSProperties}
              tabIndex={open ? 0 : -1}
              type="button"
            >
              <Glyph id={module.id} />
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * Which arc table to use. The design switches coordinates at 720px, and the
 * two tables are not a scale of one another — they are separately hand-placed —
 * so this has to be a real media-query subscription rather than a CSS override.
 * Starts at 'wide' and corrects after mount: server and first client render
 * must agree, and there is no viewport width on the server.
 */
function useArcBreakpoint(): 'wide' | 'narrow' {
  const [arc, setArc] = useState<'wide' | 'narrow'>('wide');
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${ARC_NARROW_MAX_WIDTH}px)`);
    const update = () => setArc(query.matches ? 'narrow' : 'wide');
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return arc;
}
