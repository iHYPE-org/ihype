# MMM shell — drift against Design System 8

**Audited 2026-08-10.** Every live Music · Map · Me surface against its design
source. Written after discovering that the map has its own design file
(`templates/simplified-app/map.html`) that had never been opened — the controls
in the code were invented, not translated.

## How this was checked

The design system ships **contracts**, not just renders:
`components/shell/*.d.ts` declare every prop with a comment explaining why it
exists, and `*.jsx` carries the geometry. Those are the authority used here,
alongside `templates/simplified-app/map.html` for the map surface.

Nothing in this document is a matter of taste. Each row is a thing the design
states and the code does not do.

---

## 1 · Arc nav — structurally wrong

`components/shell/ArcNav.d.ts` is explicit on two points the code contradicts:

> "one 66px **icon disc** each, drawn from the id (`map`, `music`, `me`). There
> is **no second level**: Music's sections are tabs at the top of the Music
> pane. `items` is ignored here and kept only so the shell can hold the route
> table in one place."

| | design | live |
|---|---|---|
| item rendering | 66px icon disc, glyph from module id | **text label pill** |
| levels | one | **two** — `section === 'music'` opens a 5-item arc |
| `items` | ignored by the nav | drives level 2 |

The mark inside each disc is deliberately **larger than the disc** (92px mark,
66px target) — `ArcNav.jsx` carries a comment about a previous attempt where an
84px mark in a 66px button sat 9px off centre.

Slot coordinates also differ. Same shape, different numbers:

| breakpoint | design | live |
|---|---|---|
| wide | `(5,-192) (115,-152) (182,-48)` | `(6,-186) (118,-132) (182,-14)` |
| narrow | `(4,-176) (100,-132) (165,-43)` | `(4,-158) (92,-112) (138,-12)` |

`ARC_NARROW_MAX_WIDTH` agrees at 720. Delays agree at 60/30/0.

**Consequence:** level 2 is not a styling difference — it is a navigation layer
the design removed. Music's five sections are meant to be the tabs already built
in `MmmMusic`, which means the app currently offers two ways to the same five
destinations and one of them is undesigned.

---

## 2 · Player pill — most of the component is missing

`PlayerPill.d.ts` declares 30+ props. The live `MmmPlayer` implements the
transport and HYPE and **none of the following**, verified by grep:

| missing | what the design says it is |
|---|---|
| `onSearch` | "Phone only: search rides at the bar's left edge" |
| `onExpand` | "Phone only: the artwork opens the full-screen player" |
| `queue` / `history` / `queueOpen` / `onToggleQueue` / `onPickTrack` | the queue panel — "Up next", played tracks greyed below a rule |
| `wake` | returns the player from its retired disc; the shell bumps it when the logo is tapped |
| `artistOpen` / `albumOpen` / `onOpenArtist` / `onOpenAlbum` | artist and release are **separate destinations** in the meta line |
| `compact` | artwork + play only, for narrow frames |
| `reduceMotion` | stops the title marquee |
| `left` / `bottom` / `width` | docking: `left` = logo width + gap; width defaults to `min(760px, 100vw - 150px)` |
| `seconds` on the track | "Both the bar and the full player read it, so the two surfaces cannot disagree" |

**Correction (2026-08-10, after reading `PlayerPill.jsx`).** An earlier draft
of this document claimed `narrow` differed — that the design keeps seek on a
phone and the code drops it. **That was wrong, and acting on it would have
broken the design.** The `.d.ts` comment lists three things `narrow` drops, but
the implementation drops the entire scrub row (`narrow ? null :`, line 476) and
replaces it with a full-bleed progress line on the pill's own top edge — "the
scrub row below is for aiming; this is for knowing". The live code already does
exactly that. Read the `.jsx` as well as the `.d.ts`; the prop comment was a
summary, not the specification.

The one real `narrow` difference: the design drops **HYPE** on a phone
(`canHype && !compact && !narrow`) and the code keeps it.

**`FullPlayer` is not built at all** — `components/shell/FullPlayer.jsx` exists
in the design system and has no counterpart in `src/`.

---

## 3 · Map — three controls absent

Against `templates/simplified-app/map.html`:

| missing | detail |
|---|---|
| **Mini calendar** | Opens from the DATES pill, owns range picking. The strip beside it stays a toggle list, so a scattered Fri-and-Sun selection is still two taps and never needs the calendar. |
| **"Near me"** | `#near` / `#recentre` in `#row1`, beside the layer chips. |
| **Venue search** | `#searchwrap` — "Search venues by name, city or address", with a hits list. |

Fixed 2026-08-10 (PR #676): the invented scope and genre chip rows, the
invented "tap a pin" result line, and chip styling.

---

## 4 · Components with no counterpart

| component | status |
|---|---|
| `FullPlayer` | not built |
| `NavHint` | not built — the design's "only thing on screen that says where you are" |
| `ModulePane` | not built; panes are ad-hoc |
| `IconAction` | not built |
| `Scrim` | inline in `MmmNav`, not a shared component |
| `TicketQR` | not built in the MMM shell |
| `SeedDeck` | exists in `ListenHome` (legacy deck), not in MMM |
| `MapSheet` | built, as part of `MmmMap` |

---

## Suggested order

1. **Arc nav** — icon discs, drop level 2, correct the slots. Highest visible
   impact and removes an undesigned navigation layer.
2. **Player pill** — search, expand, wake, queue. NOT the `narrow` scrub row:
   see the correction in §2, the code is already right.
3. **`FullPlayer`** — the destination `onExpand` needs.
4. **Map** — calendar, Near me, venue search.
5. **`NavHint`**, then the smaller shared components.

---

# Design-system sync — 2026-08-11

Pulled from the live Claude Design project **"Design System"**
(`0a104bf9-bc92-45f4-aa81-48b29a6b9a93`), which is the DS8 bundle vendored at
`design/design-system-8/`. The older **"iHYPE Design System"** project
(`39bcce7b-…`) is the superseded pre-DS8 bundle — do not read it.

The update was a **mobile pass**. Vendored into `design/design-system-8/`:

| New file | What it is |
|---|---|
| `MOBILE.md` | The mobile spec. 375px floor, one breakpoint at 620px, 44px targets, `dvh`, permissions, offline, PWA, store notes |
| `guidelines/mobile-breakpoints.card.html` | The 375/620/desktop bar and the `auto-fit` grid rule |
| `guidelines/mobile-safe-areas.card.html` | `--pane-pad` / `--chrome-l` / `--player-l` |
| `guidelines/mobile-touch.card.html` | Hit areas and the four gestures |
| `guidelines/mobile-permissions.card.html` | Primer → OS prompt → denied fallback |

**Unchanged, verified by fetch rather than assumed:** `tokens/colors.css`,
`tokens/spacing.css`, `ROUTE_TEMPLATE_MAP.md`, `components/shell/ArcNav.jsx`.
Not vendored: `explorations/` (three abandoned directions and a logo/player
merge — history, not spec), and the design project's own app scaffolding
(`index.html`, `lib/`, `beta/`, `ui_kits/`, `screenshots/`).

## Fixed in this pass

- **`46vh` → `46dvh`** on the search dropdown (`mmm.css`). MOBILE.md: "Use
  `dvh`, never `vh`". It was the only non-`dvh` viewport unit in either shell.
- **The arc discs cast a shadow again.** `ArcNav.jsx` gives an inactive disc
  `0 14px 34px rgba(4,8,18,.55)` and an active one a deeper cast plus a 5px
  accent halo; the port had dropped both, so the discs sat flat in a nav whose
  whole conceit is three objects on the frame.
- **Hover no longer impersonates the current page.** `:hover` and
  `[aria-current]` shared one rule, so pointing at MUSIC from the map lit two
  discs as "here". Hover now moves the border only.
- **The map and date controls carry the 44px floor** (`mobile-fit.css`). The
  design's own `map.html` sizes `#recentre` at 6px/12px on 9px mono — 24px
  tall, against MOBILE.md's "44×44px minimum, always, including on desktop".
  Added as a floor, so the design's geometry survives on a mouse.

## Open — needs a product decision, not a translation

Two PRODUCT SYNC facts in the design system's `readme.md` describe features
this codebase still ships differently. Both are scope changes, so they are
flagged rather than done:

1. **"No AI page generation. Retired 2026-08-08."** `templates/page-creator/`
   was deleted from the design system and replaced by `templates/page-builder/`,
   a fixed per-type schema — same sections, order and layout for Artist, Venue
   and Advertiser, only the field set differing. `src/components/PageEditor.tsx`
   still has `generatePage()` wired to an AI Page Studio button. Removing a
   shipped feature is the owner's call.
2. **"HYPE resets every 24 hours, per target."** A timestamp per target, never
   a boolean, so the wait can be stated — the control shows the remaining time
   ("17h 40m") and refuses the tap rather than letting the API reject it, coarse
   to the minute on purpose. Nothing in `HypeButton.tsx` or `/api/hype`
   implements a window.

## Note for whoever picks this up

Read the `.d.ts` **and then the `.jsx`** — not one or the other. The correction
in §2 is exactly why: the prop comment summarised what `narrow` drops, the
implementation dropped more, and trusting the summary alone produced a
confidently-worded finding that was false. The prop comments state the
reasoning — why HYPE and favourite are two controls, why `expanded` rather than
`open`, why `null` renders nothing. Several of the divergences above are things
the design explicitly warns against, which means they were decided once and then
re-invented here.
