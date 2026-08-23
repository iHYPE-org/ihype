# Where production's design actually stands

Read from `src/app/mmm.css` (112KB), `design/DRIFT_AUDIT_2026-08-10.md` and the
repo tree at `iHYPE-org/ihype@main`. This corrects my earlier assumption — in
`STRATEGY.md` — that production carries three contradictory design generations
and needs a clean route tree.

**It does not.** The picture is much better than that, and the gap is not where
I said it was.

---

## Production is already token-disciplined

`mmm.css` states its own rule, and it is the rule this whole handoff has been
arguing for:

> **Colour comes from tokens, never the handoff's literals.** This is why the
> Bulletin overhaul cost this file nothing: the ground moved from warm
> near-black to ink navy in `globals.css` and every surface here followed,
> because none of them names a hex. Keep it that way — a literal typed in here
> is a surface that will miss the next re-anchor and the light theme at the same
> time.

That is the opposite of the component library, where 31 of 37 files read zero
tokens. **The app CSS is the well-behaved part; the design system's own
components were the drifted part.** My Phase 3 token-swap does not apply to
`mmm.css` — there is nothing to swap.

Evidence it already survived a re-anchor: the file uses `--ink-on-accent`,
`--accent-text`, `--radius-panel`, `--radius-pill`, warm shadows
(`rgba(28,20,8,0.28)`), and carries the accent-as-copy note verbatim —

> Ink ON the accent fill, never white — 3.27:1 against 5.58:1.

— on the date picker's Done button. Production got the trap right. Four of the
design system's own components did not.

## Production is AHEAD of the design system in three places

These are newer than anything in the bundle I was handed, and the design system
does not describe them:

| Shipped | Where |
|---|---|
| **The dock is a real bar** — full width, brass lip, three controls in a flex row, driven by one figure (`--mmm-knob: 74px`) | `mmm.css`, citing `design/handoff-console-2026-08-21/README.md`: "both knobs are 74px, matched … if one is smaller the dock looks broken" |
| **Map date picker** — the five day-cards and the DATES readout are gone, replaced by a calendar popover at the end of the search field (2026-08-22) | `.mmm-datepick*` |
| **Layer chips moved into the dock's tuner**, and "Near me" removed "when the map started where you are" | `.mmm-map-controls` note |

The old floating three-piece chrome (`--mmm-chrome-gap`, `--mmm-dial-w`,
`--mmm-player-left`) is **deleted** — "layout does the work the calc chain used
to." My `PlayerPill` still takes `left`/`bottom`/`width` docking props for
that retired geometry.

**So the console controls I just built need reconciling against the shipped
dock, not dropped into it.** Specifically: two matched 74px knobs, not one
172px knob and a separate 360px joystick plate. That is a real conflict and it
is mine to fix, not production's.

## Where production is genuinely behind

From the drift audit, still open as far as the tree shows:

| Gap | Detail |
|---|---|
| **ArcNav is structurally wrong** | Renders **text label pills**, not 66px icon discs. And it has **two levels** — `section === 'music'` opens a 5-item arc the design deliberately removed, so there are two undesigned routes to the same five tabs. Slot coordinates differ on both breakpoints. |
| **FullPlayer not built** | No counterpart in `src/`. `onExpand` has nowhere to go. |
| **PlayerPill missing ~12 props** | `onSearch`, `onExpand`, `wake`, the whole queue panel, `artistOpen`/`albumOpen`, `compact`, `reduceMotion`, `seconds`. |
| **NavHint, ModulePane, IconAction, TicketQR not built** | Panes are ad-hoc; `Scrim` is inline in `MmmNav` rather than shared. |
| **HYPE on phone** | Design drops it at `narrow`; code keeps it. |

Two audit items are now **stale and already fixed** — worth not re-doing:

- "Nothing in `HypeButton.tsx` or `/api/hype` implements a window."
  `src/lib/hype-window.ts` exists now and is correct.
- The map's three missing controls were partly fixed in PR #676, and two of the
  three ("Near me", layer chips) were then **removed by design** rather than
  built.

---

## The corrected diagnosis

The original complaint was "Code makes so many changes the design is useless."
Three rounds in, here is what the evidence actually supports:

1. **Not a token problem in the app.** `mmm.css` is more disciplined than the
   design system's components were.
2. **A stale-source problem, twice over.** `engineering/openapi.yaml` and
   `engineering/schema.sql` describe a backend that does not exist.
   `mmm.css`'s header still names DS8 "Bulletin" as its source of truth while
   the file itself has moved to the console direction. **Both fooled me, and
   both will fool Code.**
3. **A structural gap, not a styling gap.** ArcNav's second level and the four
   unbuilt components are missing *architecture*. No amount of token
   enforcement produces a `FullPlayer` that was never written.
4. **A two-way drift.** Production shipped a console dock, a date picker and a
   tuner the design system has no record of. So "implement the design" is the
   wrong instruction in those three places — the design needs to catch up.

## What to do instead of my STRATEGY.md plan

**Do not build a clean route tree.** `(legacy)`/`(console)` was the right
answer to a problem production does not have. Withdrawn.

Instead:

1. **Fix the two stale sources first — a one-hour job with the highest
   leverage in this whole document.** Delete `engineering/openapi.yaml` and
   `engineering/schema.sql`. Correct `mmm.css`'s header to name the console
   handoff instead of DS8.
2. **Vendor the three shipped-ahead surfaces INTO the design system**: the
   74px twin-knob dock, the date picker, the tuner-hosted layer chips. Until
   then every design pass will keep proposing to undo them.
3. **Reconcile my three console controls against the shipped dock** — twin 74px
   knobs on a bar, not free-floating instruments. Mine are currently a
   contradiction, and I would rather say so than let you find out by building.
4. **Then the drift audit's order**: ArcNav discs and drop level 2, PlayerPill's
   missing props, FullPlayer, the shared components.
5. **Drop `PlayerPill`'s `left`/`bottom`/`width` props** in the re-anchored
   copy. They position chrome that no longer floats.

## One note from the audit worth repeating

> Read the `.d.ts` **and then the `.jsx`** — not one or the other. … the prop
> comment summarised what `narrow` drops, the implementation dropped more, and
> trusting the summary alone produced a confidently-worded finding that was
> false.

That is the same mistake I made with `engineering/`, and it is the failure mode
of this entire project: **a document that reads as current and is not.**
