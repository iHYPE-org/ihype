const _AN = {
  surf: 'rgba(18,27,46,.96)', ink: '#eef1f6', bg: '#0b1220',
  line: 'rgba(238,241,246,.13)', acc: '#ff5029', fd: "'Bricolage Grotesque',sans-serif",
  /* The three destinations are the nameplate, so they get a face of their own:
     Yeseva One, a high-contrast display serif with heavy bracketed serifs. A
     radial nav of three words is a masthead, not a toolbar. One weight, one
     place — the sub-items stay in the grotesque, so the two levels differ by
     voice rather than by size alone. */
  fs: "'Yeseva One',Georgia,serif",
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
 * The travel is applied statically and the reveal is a staggered keyframe rather
 * than a transition — see ADHERENCE 23 for why a transition cannot own this.
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

/* One glyph per module, drawn on a common 24 grid at a common 1.9 stroke so the
   three read as a set rather than three borrowed icons. Keyed by module id — an
   id with no glyph falls back to its text label, so a fourth module never
   renders an empty disc. */
function glyph(id) {
  /* The mark is BIGGER than the disc it sits in: the disc is a 66px target and a
     colour field, the drawing is 92px (the pin 100px, having the least ink of the
     three) and breaks its edge on every side, so the
     nav reads as three objects sitting on the frame rather than three buttons in
     a row. Nothing clips them — the button keeps overflow visible and the fan is
     spaced for that footprint.

     All three are LINE art at one weight. Solid fills at this size turned into
     silhouettes: past about 60px a filled notehead or a filled figure stops
     being a drawing and becomes a blob, and the three blobs did not look like a
     set. Outlines keep the detail legible and let the accent field read through.

     Centring is by a declared OPTICAL anchor, not by bounding box. Bounding-box
     centring measures the protrusions — the map's pin, the note's beam, the
     figure's shoulders — and pushes the body of the drawing off in the opposite
     direction, which put the disc in a corner looking as though it had slipped.
     Each mark instead names the point that should land dead centre: the fold of
     the map, the waist of the notes, the head of the figure. The overhangs then
     fall where they fall, which is the whole point of drawing them oversized. */
  const VB = { x: -1.5, y: -3, w: 27.5, h: 30 };
  const svg = (children, anchor, size) => {
    const dx = VB.x + VB.w / 2 - anchor[0];
    const dy = VB.y + VB.h / 2 - anchor[1];
    /* Absolutely centred on the disc, not laid out inside it. `place-items:
       center` on a grid whose ITEM is bigger than its track resolves to the
       start edge — that is CSS's overflow-alignment safety, and it is why an
       84px mark in a 66px button sat 9px down and right of centre while the same
       mark centred correctly in isolation. Pinning 50/50 and pulling back half
       its own size is immune to that. */
    return React.createElement('svg', {
      viewBox: VB.x + ' ' + VB.y + ' ' + VB.w + ' ' + VB.h,
      width: size || 92, height: size || 92, 'aria-hidden': 'true',
      style: {
        display: 'block', overflow: 'visible', position: 'absolute',
        left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      },
    }, React.createElement('g', {
      transform: 'translate(' + dx.toFixed(2) + ' ' + dy.toFixed(2) + ')',
      fill: 'none', stroke: 'currentColor', strokeWidth: 1.55,
      strokeLinecap: 'round', strokeLinejoin: 'round',
      /* Embossed: one dark stroke pushed down and one light stroke pulled up,
         both behind the mark itself, so the line reads as pressed into the
         surface rather than drawn on it. Done with drop-shadow filters rather
         than duplicated paths — a filter follows whatever the mark's geometry
         is, so a redrawn glyph needs no second copy kept in sync, and it costs
         nothing on the active disc where the accent behind it is opaque.
         Sub-pixel offsets on purpose: at 1.55 stroke a full pixel of relief
         turns into a visible double line. */
      style: {
        filter: 'drop-shadow(0 1px 0.7px rgba(4,8,18,.7)) drop-shadow(0 -0.8px 0.6px rgba(255,255,255,.3))',
      },
    }, children));
  };

  if (id === 'map') {
    /* A pin, alone. The folded map behind it was doing the same job twice and
       it was the part that read as boxy — the pin already means place, and the
       module it opens IS the map. */
    return svg([
      React.createElement('path', { key: 'pin', d: 'M12-1.4a7.7 7.7 0 0 0-7.7 7.7c0 6 7.7 14.7 7.7 14.7s7.7-8.7 7.7-14.7A7.7 7.7 0 0 0 12-1.4Z' }),
      React.createElement('circle', { key: 'dot', cx: 12, cy: 6.3, r: 2.9 }),
    ], [12, 10.4], 100);
  }
  if (id === 'music') {
    /* A tied pair — two heads under one beam — with the beam as two rules rather
       than a slab so it carries the weight of everything else. */
    return svg([
      React.createElement('ellipse', { key: 'h1', cx: 3.6, cy: 19.4, rx: 4.3, ry: 3.3, transform: 'rotate(-20 3.6 19.4)' }),
      React.createElement('ellipse', { key: 'h2', cx: 16.4, cy: 17, rx: 4.3, ry: 3.3, transform: 'rotate(-20 16.4 17)' }),
      React.createElement('path', { key: 's1', d: 'M7.6 18V2.4' }),
      React.createElement('path', { key: 's2', d: 'M20.4 15.6V0' }),
      React.createElement('path', { key: 'b1', d: 'M7.6 2.4 20.4 0' }),
      React.createElement('path', { key: 'b2', d: 'M7.6 6.1 20.4 3.7' }),
    ], [12.1, 12.8]);
  }
  if (id === 'me') {
    /* Head and shoulders. The headphones came off for the same reason the map
       did: two ideas in one mark, and the cups were the fiddliest thing in the
       set at this size. */
    return svg([
      React.createElement('circle', { key: 'head', cx: 12, cy: 7.4, r: 5.5 }),
      React.createElement('path', { key: 'body', d: 'M1.2 26.6c0-6 4.8-10.8 10.8-10.8s10.8 4.8 10.8 10.8' }),
    ], [12, 15.2]);
  }
  return null;
}

function ray({ label, id, slot, shown, active, sub, onClick, key }) {
  const mark = sub ? null : glyph(id);
  return React.createElement('button', {
    key, type: 'button', onClick,
    /* The disc carries no visible text, so the name has to be stated. */
    'aria-label': mark ? label : undefined,
    'aria-current': active ? 'page' : undefined,
    'aria-hidden': !shown,
    tabIndex: shown ? 0 : -1,
    style: {
      position: 'absolute', left: 0, bottom: 0,
      /* Fully static. No transition and no keyframe: the document timeline does
         not advance in every context this runs in, and a both-filled animation
         or an unadvanced transition then holds its FROM value forever — leaving
         the fan invisible while the inline style and React props both read
         "open". See ADHERENCE 23. The stagger in slot.d is kept in the data for
         hosts that animate this themselves. */
      transform: shown ? 'translate(' + slot.x + 'px,' + slot.y + 'px)' : CLOSED,
      opacity: shown ? 1 : 0,
      pointerEvents: shown ? 'auto' : 'none',
      background: mark ? (active ? _AN.acc : _AN.surf) : (active ? _AN.ink : _AN.surf),
      color: mark ? (active ? '#fff' : _AN.ink) : (active ? _AN.bg : _AN.ink),
      border: '1px solid ' + (mark ? (active ? _AN.acc : _AN.line) : (active ? _AN.ink : _AN.line)),
      borderRadius: 9999,
      /* An icon ray is a disc: nothing sets its width, so width and height are
         given outright and the text padding drops out. */
      width: mark ? 66 : undefined,
      height: mark ? 66 : undefined,
      /* Bricolage is loaded as a variable font with an optical-size axis, so
         the two levels are set at their own optical size rather than one size
         scaled twice: the module labels get the display cut (heavier joins,
         tighter apertures) and the sub items get the text cut. That, plus the
         weight and tracking split, is what separates a destination from a
         chip — the pill shape alone was doing all the work before. */
      fontFamily: sub ? _AN.fd : _AN.fs,
      fontWeight: sub ? 600 : 400,
      fontSize: sub ? 15.5 : 34,
      lineHeight: sub ? 1 : 1.06,
      letterSpacing: sub ? '-.022em' : '.002em',
      fontVariationSettings: sub ? "'opsz' 16" : 'normal',
      padding: mark ? 0 : (sub ? '12px 21px' : '12px 26px 14px'),
      whiteSpace: 'nowrap', cursor: 'pointer',
      boxShadow: mark && active
        ? '0 16px 38px rgba(4,8,18,.6), 0 0 0 5px rgba(255,80,41,.2)'
        : '0 14px 34px rgba(4,8,18,.55)',
    },
  }, mark || label);
}

export function ArcNav(props) {
  /* `nav` carries { expanded, section } as one object, and that is the form to
     use from a template. A boolean prop whose value merely flips does not always
     reach a mount — an object gets a fresh identity every render, so the update
     is never missed. The flat props remain for direct React callers. */
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

  return React.createElement('div', {
    style: { position: 'absolute', left: 26, bottom: 26, width: 0, height: 0 },
  },
    modules.map((m, i) => level1[i] ? ray({
      key: m.id, id: m.id, label: m.label, slot: level1[i], shown: expanded,
      active: m.id === activeModule,
      onClick: () => onNavigate && onNavigate(m),
    }) : null)
  );
}

