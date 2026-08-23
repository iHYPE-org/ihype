# Apply this

The path from here, in order. Steps 1 and 2 are the ones that matter.

## 1 · Fix the two stale sources — one hour, highest leverage in this package

Both read as current and are not. Both fooled me for multiple rounds, and they
will fool Claude Code exactly the same way.

```bash
# In the design system project:
rm engineering/openapi.yaml engineering/schema.sql
#   Production runs Prisma with 130+ migrations. These describe a backend that
#   does not exist. If you want them as history, move them somewhere that does
#   not read as spec — a superseded design that is still on disk gets read, and
#   then built from twice. (mmm.css's own words.)
```

Then in `iHYPE-org/ihype`, correct `src/app/mmm.css`'s header. It currently says:

> Source of truth since 2026-08-09: `design/design-system-8/` — Design System 8
> ("Bulletin") … Design System 8 is the ONLY design source.

The file itself has moved on: it cites `design/handoff-console-2026-08-21/` for
the knob figure, uses `--radius-panel`, warm shadows and `--ink-on-accent`, and
draws a sepia map. Name the console handoff as the source and DS8 as superseded.

## 2 · Replace the design system's component sources, then recompile

Your own handoff README has the rule: *"If you find yourself writing a component
that already exists in `_ds_bundle.js`, stop and mount the existing one
instead."* That is correct — which means the fix belongs at the source, not in
the app. Production keeps consuming the bundle it already consumes; the bundle
just gets compiled from files that read tokens.

```bash
# From this package, into the design system project:
cp components/core/*.jsx   <design-system>/components/core/
cp components/shell/*.jsx  <design-system>/components/shell/
cp components/console-controls.keyframes.css  <design-system>/tokens/
#   then add its @import to styles.css
```

**Keep every existing `.d.ts` and `.prompt.md`.** Prop signatures are unchanged,
so those contracts — and `_adherence.oxlintrc.json` — stay valid. Replace the
`.jsx` only.

Recompile the bundle. Nothing in production changes; every consumer inherits the
fix at once.

Before/after, from `VERIFICATION.md`: components reading any token go from
**6 of 37 to 36 of 37**; token references from ~25 to 877; sub-floor fonts 44 →
0; white-on-accent 4 → 0.

## 3 · Vendor the three shipped-ahead surfaces INTO the design system

Production shipped these and the design system has no record of them, so every
future design pass will keep proposing to undo them:

| Surface | Where it is now |
|---|---|
| The dock — one bar, twin 74px knobs, dial between, 3px brass lip | `Console Dock.dc.html` in this project; geometry from `--mmm-knob`/`--mmm-dock-pad`/`--mmm-dock-lip` |
| Map date picker — calendar popover at the end of the search field, replacing five day-cards | `.mmm-datepick*` in `mmm.css` |
| Layer chips inside the dock's tuner; "Near me" removed | `.mmm-map-controls` note in `mmm.css` |

`Console Dock.dc.html` is the reference for the first. The other two need
lifting out of `mmm.css` into the design system as components.

## 4 · Then the drift audit's order

`design/DRIFT_AUDIT_2026-08-10.md`, minus the two items now stale (the HYPE
window exists; the map's "Near me" was removed by design rather than built):

1. **ArcNav** — icon discs not text pills, drop level 2, correct the slot
   coordinates. Already done in `components/shell/ArcNav.jsx` here: 66px discs,
   one level, the design's own ARC table, and the `opsz` axis removed.
2. **PlayerPill** — `onSearch`, `onExpand`, `wake`, the queue panel,
   `artistOpen`/`albumOpen`, `compact`, `reduceMotion`, `seconds`. All present
   in the re-anchored file. **Drop `left`/`bottom`/`width`** — they position
   floating chrome that the dock replaced.
3. **FullPlayer** — not built in `src/` at all. `onExpand` currently has nowhere
   to go. `components/shell/FullPlayer.jsx` here is the reference.
4. **NavHint, ModulePane, IconAction, TicketQR** — the shared components.
   `TicketQR` needs its decorative matrix swapped for `uqr`'s real encoding of
   the verification URL (see `api/RECONCILIATION.md`).
5. **HYPE on phone** — the design drops it at `narrow`; the code keeps it.

## 5 · Wire HYPE — nothing to build

`src/lib/hype-window.ts` already exists and is correct.
`formatHypeWait()` produces the components' `hypeLabel` verbatim.

```ts
import { hypeWaitMs, formatHypeWait } from '@/lib/hype-window';
const wait = hypeWaitMs(lastHypedAt);
<HypeButton disabled={wait > 0} disabledReason={formatHypeWait(wait)} … />
```

Use `hypeWaitUntil(nextAt)` for the API's 429 payload — that function exists
precisely for callers holding `nextAt`.

---

## What not to do

- **Don't build a clean route tree.** `STRATEGY.md` is withdrawn. Production is
  already token-disciplined; that plan solved a problem you don't have.
- **Don't port components by hand into `src/`.** Mount the bundle.
- **Don't migrate the schema.** `api/openapi.yaml`, `api/schema.sql` and the
  migration are deleted from this package. Production already has all of it.
- **Don't re-do the two stale drift-audit items** — the HYPE window and the
  map's "Near me".
