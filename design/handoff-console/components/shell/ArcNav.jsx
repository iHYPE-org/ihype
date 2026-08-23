'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · surface rgba(52,32,15,.97) → var(--walnut-2); ink → the on-walnut set
   · every shadow was NAVY (rgba(4,8,18,.55/.6)) — Bulletin leftovers over a warm
     cabinet → var(--shadow-play) / var(--shadow-raised)
   · the emboss filter's dark stop was also navy → var(--scrim-rgb)
   · active disc ring rgba(255,80,41,.2) → color-mix on var(--accent)
   · fontSize 34 / 15.5 → var(--text-2xl) / var(--text-base); 15.5 was off-scale
     and the sub items are content, so they take the base step
   · letterSpacing -.022em on the sub items → var(--tracking-tight)
   · fontVariationSettings "'opsz' 16" REMOVED — Instrument Serif has no
     optical-size axis, so this declaration did nothing. It is a Bricolage
     leftover, and leaving it in implies a variable axis the font does not have.
   · disc 66 → 66 kept (it is a deliberate hit target, and the mark oversizes it)
   · borderRadius 9999 → var(--radius-pill)
   
   The ARC coordinate tables, the optical anchors and the static-transform
   approach are UNTOUCHED — they are hand-placed geometry matched to
   src/lib/mmm-nav.ts, not style values. */

const ARC_INK = {
  surf: 'var(--walnut-2)',
  ink: 'var(--ink-on-walnut)',
  onInk: 'var(--walnut-3)',
  line: 'var(--rule-on-walnut)',
  acc: 'var(--accent)',
  onAcc: 'var(--ink-on-accent)',
};

/**
 * The radial arc nav. Prop is `expanded`, not `open` — `open` is a reserved HTML
 * boolean attribute and never survives being set from a template.
 * Hand-placed coordinates, two breakpoints — the tables are
 * not a scale of one another, so the breakpoint has to be a real media-query
 * subscription rather than a CSS override. The three discs sit on an even fan
 * at 80° / 51° / 20° — about 230px out wide, 212px narrow. The spacing is set
 * by the 92px MARK, not the 66px disc: centres need roughly 104px between them
 * or the oversized drawings collide, which is why the narrow table is nearly as
 * open as the wide one.
 *
 * Every item shares one origin with the logo (a zero-size anchor at the frame's
 * lower left) and is moved into place by `transform` alone, so nothing reflows.
 *
 * One level, three destinations. Music's sections are tabs at the top of the
 * Music pane, so fanning them out here duplicated a control that is already on
 * screen once you arrive. A closed item must not be tabbable: `pointerEvents:
 * none` hides it from the mouse but not the keyboard, so tabIndex and
 * aria-hidden do the rest, or three invisible buttons sit in the tab order.
 */
export const ARC = {
  wide: { level1: [{ x: 5, y: -192, d: 60 }, { x: 115, y: -152, d: 30 }, { x: 182, y: -48, d: 0 }] },
  narrow: { level1: [{ x: 4, y: -176, d: 60 }, { x: 100, y: -132, d: 30 }, { x: 165, y: -43, d: 0 }] },
};
export const ARC_NARROW_MAX_WIDTH = 720;
const CLOSED = 'translate(14px,-6px) scale(.55)';

function useArcBreakpoint() {
  const [arc, setArc] = React.useState('wide');
  React.useEffect(() => {
    const q = window.matchMedia('(max-width: ' + ARC_NARROW_MAX_WIDTH + 'px)');
    const update = () => setArc(q.matches ? 'narrow' : 'wide');
    update();
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  return arc;
}

/* One glyph per module, drawn on a common 24 grid at a common 1.55 stroke so the
   three read as a set rather than three borrowed icons. Keyed by module id — an
   id with no glyph falls back to its text label, so a fourth module never
   renders an empty disc. */
function glyph(id) {
  /* The mark is BIGGER than the disc it sits in: the disc is a 66px target and a
     colour field, the drawing is 92px (the pin 100px, having the least ink of the
     three) and breaks its edge on every side, so the nav reads as three objects
     sitting on the frame rather than three buttons in a row.

     All three are LINE art at one weight. Solid fills at this size turned into
     silhouettes: past about 60px a filled notehead or a filled figure stops
     being a drawing and becomes a blob.

     Centring is by a declared OPTICAL anchor, not by bounding box. Each mark
     names the point that should land dead centre: the fold of the map, the waist
     of the notes, the head of the figure. */
  const VB = { x: -1.5, y: -3, w: 27.5, h: 30 };
  const svg = (children, anchor, size) => {
    const dx = VB.x + VB.w / 2 - anchor[0];
    const dy = VB.y + VB.h / 2 - anchor[1];
    /* Absolutely centred on the disc, not laid out inside it. `place-items:
       center` on a grid whose ITEM is bigger than its track resolves to the
       start edge — that is CSS's overflow-alignment safety. Pinning 50/50 and
       pulling back half its own size is immune to that. */
    return (
      <svg
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        width={size || 92}
        height={size || 92}
        aria-hidden="true"
        style={{
          display: 'block',
          overflow: 'visible',
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
        }}
      >
        <g
          transform={`translate(${dx.toFixed(2)} ${dy.toFixed(2)})`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.55}
          strokeLinecap="round"
          strokeLinejoin="round"
          /* Embossed: one dark stroke pushed down and one light stroke pulled up,
             both behind the mark itself, so the line reads as pressed into the
             surface rather than drawn on it. Sub-pixel offsets on purpose: at
             1.55 stroke a full pixel of relief turns into a visible double line.
             The dark stop was navy; it now uses the warm scrim triplet. */
          style={{
            filter: 'drop-shadow(0 1px 0.7px rgba(var(--scrim-rgb), .7)) drop-shadow(0 -0.8px 0.6px rgba(255,255,255,.3))',
          }}
        >{children}</g>
      </svg>
    );
  };

  if (id === 'map') {
    /* A pin, alone. The folded map behind it was doing the same job twice — the
       pin already means place, and the module it opens IS the map. */
    return svg([
      <path key="pin" d="M12-1.4a7.7 7.7 0 0 0-7.7 7.7c0 6 7.7 14.7 7.7 14.7s7.7-8.7 7.7-14.7A7.7 7.7 0 0 0 12-1.4Z" />,
      <circle key="dot" cx={12} cy={6.3} r={2.9} />,
    ], [12, 10.4], 100);
  }
  if (id === 'music') {
    /* A tied pair — two heads under one beam — with the beam as two rules rather
       than a slab so it carries the weight of everything else. */
    return svg([
      <ellipse key="h1" cx={3.6} cy={19.4} rx={4.3} ry={3.3} transform="rotate(-20 3.6 19.4)" />,
      <ellipse key="h2" cx={16.4} cy={17} rx={4.3} ry={3.3} transform="rotate(-20 16.4 17)" />,
      <path key="s1" d="M7.6 18V2.4" />,
      <path key="s2" d="M20.4 15.6V0" />,
      <path key="b1" d="M7.6 2.4 20.4 0" />,
      <path key="b2" d="M7.6 6.1 20.4 3.7" />,
    ], [12.1, 12.8]);
  }
  if (id === 'me') {
    /* Head and shoulders. The headphones came off for the same reason the map
       did: two ideas in one mark, and the cups were the fiddliest thing in the
       set at this size. */
    return svg([
      <circle key="head" cx={12} cy={7.4} r={5.5} />,
      <path key="body" d="M1.2 26.6c0-6 4.8-10.8 10.8-10.8s10.8 4.8 10.8 10.8" />,
    ], [12, 15.2]);
  }
  return null;
}

function Ray({ label, id, slot, shown, active, sub, onClick }) {
  const mark = sub ? null : glyph(id);
  return (
    <button
      type="button"
      onClick={onClick}
      /* The disc carries no visible text, so the name has to be stated. */
      aria-label={mark ? label : undefined}
      aria-current={active ? 'page' : undefined}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        /* Fully static. No transition and no keyframe: the document timeline does
           not advance in every context this runs in, and a both-filled animation
           or an unadvanced transition then holds its FROM value forever. The
           stagger in slot.d is kept in the data for hosts that animate this. */
        transform: shown ? `translate(${slot.x}px,${slot.y}px)` : CLOSED,
        opacity: shown ? 1 : 0,
        pointerEvents: shown ? 'auto' : 'none',
        background: mark ? (active ? ARC_INK.acc : ARC_INK.surf) : (active ? ARC_INK.ink : ARC_INK.surf),
        color: mark ? (active ? ARC_INK.onAcc : ARC_INK.ink) : (active ? ARC_INK.onInk : ARC_INK.ink),
        border: `1px solid ${mark ? (active ? ARC_INK.acc : ARC_INK.line) : (active ? ARC_INK.ink : ARC_INK.line)}`,
        borderRadius: 'var(--radius-pill)',
        /* An icon ray is a disc: nothing sets its width, so width and height are
           given outright and the text padding drops out. */
        width: mark ? 66 : undefined,
        height: mark ? 66 : undefined,
        /* Instrument Serif ships one weight and one cut, so the two levels are
           separated by size and colour rather than by an optical-size axis. */
        fontFamily: 'var(--font-display)',
        fontWeight: sub ? 600 : 400,
        fontSize: sub ? 'var(--text-base)' : 'var(--text-2xl)',
        lineHeight: sub ? 1 : 1.06,
        letterSpacing: sub ? 'var(--tracking-tight)' : 'var(--tracking-normal)',
        padding: mark ? 0 : (sub ? 'var(--space-3) var(--space-5)' : 'var(--space-3) var(--space-6)'),
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        boxShadow: mark && active
          ? 'var(--shadow-play), 0 0 0 5px color-mix(in oklab, var(--accent) 20%, transparent)'
          : 'var(--shadow-play)',
      }}
    >{mark || label}</button>
  );
}

export function ArcNav(props) {
  /* `nav` carries { expanded, section } as one object, and that is the form to
     use from a template. A boolean prop whose value merely flips does not always
     reach a mount — an object gets a fresh identity every render. */
  const { modules = [], activeModule, onNavigate, onClose } = props;
  const expanded = props.nav ? Boolean(props.nav.expanded) : Boolean(props.expanded);
  const bp = useArcBreakpoint();
  const level1 = ARC[bp].level1;

  React.useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose && onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, onClose]);

  return (
    <div style={{ position: 'absolute', left: 26, bottom: 26, width: 0, height: 0 }}>
      {modules.map((m, i) => level1[i] ? (
        <Ray
          key={m.id}
          id={m.id}
          label={m.label}
          slot={level1[i]}
          shown={expanded}
          active={m.id === activeModule}
          onClick={() => onNavigate && onNavigate(m)}
        />
      ) : null)}
    </div>
  );
}
