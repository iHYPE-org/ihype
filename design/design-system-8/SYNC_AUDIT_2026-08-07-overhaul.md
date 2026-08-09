# Sync audit — 2026-08-07 (Music · Map · Me overhaul)

Audited `iHYPE-org/ihype@main` (tree `50ab28ac9801`) against this design system.

## Headline

**No new commits since the morning sync** — the tree hash is unchanged. The drift
runs the other way: the shipped app implements an app shell this design system
never carried. The design source the code followed is vendored in the repo at
`design/design-system-app-shell/templates/simple-app/SimpleApp.dc.html`; this
project still shipped the previous generation as `templates/simplified-app/`.

## Drift table

| Topic | Shipped code | This system, before | Resolution |
|---|---|---|---|
| App shell | `MmmShell` — no header, no tab bar; chrome is the bottom-left logo trigger, a pill player and a nav hint | Header + tab chrome | Rebuilt `templates/simplified-app/` as the Music · Map · Me shell |
| Nav | Radial arc, hand-placed coords, two breakpoints (`src/lib/mmm-nav.ts` `ARC`) | Vertical pill column | New `ArcNav` component; `ARC` table matches the code value for value |
| MUSIC tabs | Discover · Radio · Charts · **Recommended** · Playlists | Discover · Radio · Charts · Playlists · **Search** | Corrected. Search is now a persistent universal field, not a tab |
| Universal search | MAP has its own; MUSIC needed one | Search was a MUSIC tab | Persistent search field on every MUSIC surface, scoped across artists / tracks / venues / cities / playlists. ME has none, by design |
| ME | Flat. Settings · Info · Legal · Accessibility are in-page rows | Seven-item fan-out submenu | Flattened; the submenu is retired |
| State model | Module / tab / panel are **routes** (`/app/map`, `/app/music/radio`, `/app/me/settings`) | Component state | Prototype still holds state (one file), but ids and labels are the route segments verbatim |
| Map lifetime | Map is the base layer, stays mounted across module changes — mounted in the `/app` **layout**, the only place the App Router preserves a subtree | n/a | Documented in `ModulePane` and `MapSheet` contracts |
| Player | Presentation over shared playback state; owns no audio element. Hidden while nav is open, fades and drops rather than unmounting | n/a | `PlayerPill`, with `canHype` / `canTogglePlay` resolved upstream |
| Roles | Fan · Artist · Venue · Advertiser | `--role-dj` still present in some prose | No DJ, no Promoter account type. `--role-promoter` colors the 10% pool slice only |
| Shell components | 7 distinct pieces of chrome in `src/components/mmm/` | None in `components/core/` | Added `components/shell/` with a `.d.ts` per component |

## What changed in this project

- **New visual direction ("Bulletin").** Ground warm near-black → ink navy
  `#0b1220`; ink warm cream → cool off-white `#eef1f6`; display Syne →
  Bricolage Grotesque; body DM Sans → Work Sans. Accent `#ff5029` and the four
  role hues carried over unchanged, at the user's direction.
- Re-anchored across **86 files** — 22 core components, 8 guideline cards, 46
  templates, the project thumbnail and index.
- Token additions: `--radius-card` (18px), `--radius-pill`, `--radius-trigger`,
  `--shadow-trigger`, `--opsz-*`, `--tracking-display`, `--leading-*`.
- `--radius-sm/md/lg`, `--ease` and `--duration-slow` were deliberately left
  alone: they are the three scales that cannot be reconciled by name against
  the codebase, and renumbering them would add drift rather than remove it.
- AA re-measured on the new grounds. `--ink-3` holds 4.91:1 worst case on dark
  (`--bg-overlay`) and 4.74:1 worst case on light.

## What the code should change

Ordered by cost, cheapest first.

1. **`src/app/globals.css` token values.** Re-anchor the ground and ink hues to
   the table above. Every token *name* is unchanged, so this is a value-only
   edit — no selector or component churn.
2. **Font loading.** Swap the Syne and DM Sans faces for Bricolage Grotesque
   (variable, `opsz` 12..96) and Work Sans. Bricolage needs `opsz` fed the pixel
   size and `letter-spacing: -.035em` at headline sizes, or headings read loose.
3. **`src/components/mmm/*` inline values.** The components hardcode a few
   colors; point them at the tokens rather than re-typing the new hexes.
4. **Radius.** New work should use `--radius-card` (18px) and pill; the shell
   trigger is a 76px tile with a 26px corner.
5. **Nothing structural.** The shell's structure was already correct — this
   overhaul brought the design system up to the code, not the reverse.

## Visual pass, second round

Applied after reviewing the first build of the shell:

- Module headlines dropped from 46px/two lines to 28px/one line. Editorial scale
  stays on `/about`, `/charter` and the landing page; a surface you visit daily
  does not get a marketing headline.
- Three stacked control rows became one: tabs and the universal search field
  share a row, and the six scope chips appear only while the field has focus.
- The player pill runs in `compact` mode on the module panes (artwork and play
  only) — at full width it parked itself on top of the content column.
- Accent restrained to two jobs: the logo trigger and the current selection.
  Hype counts, pin heat and chart bars moved onto the heat scale
  (`--heat-cold` → `--heat-warm` → `--heat-fire`), which existed and was unused.
- Panes are now translucent with a blur and a top hairline, so the map reads as
  still being beneath them — which matters, because the map staying mounted is
  the architectural point of the shell.
- Chart rows narrowed to 900px and each carries a heat bar. Four columns across
  the full frame left a dead middle and did not look like a chart.
- The injected theme-toggle button is hidden in the shell; ME → Appearance owns
  that control.

## The map is now a real map

The MAP module was a drawn lattice with fake pins. It is now Leaflet +
OpenStreetMap tiles in `templates/simplified-app/map.html`, embedded by the
shell, with the tile pane darkened in CSS so light OSM raster tiles sit under a
navy UI without a second tile source.

The precision rule is the design decision worth carrying into the code:

- **Venues carry a real street address** and their pin lands on it. Six real
  venues with real coordinates — SPACE (Portland, ME), Elsewhere (Brooklyn),
  Mohawk (Austin), The Echo (LA), Empty Bottle (Chicago), Corsica Studios
  (London).
- **Artists and promoters carry a city of origin only.** Their pins sit on the
  city centroid, are drawn differently (dashed, softer, no address line), and the
  sheet says so outright. The product never collects an address for them, so the
  map must not invent one.
- The map opens at street zoom on one city, not fitted to all six venues: at
  world zoom the pin-lands-on-the-door precision is invisible and the markers
  collide. Switching to the artists layer fits the city bounds instead.
- The map is a separate document and posts selections to the shell
  (`ihype:select`), because a Design Component confines scripts to `<helmet>`
  and that mount timing races the map container.

## Map interactions and the player

**Map.** Each layer answers a different question, so each behaves differently:

- **Events** shows a date strip (only events have a date). Tapping a venue opens
  that night at that venue — the lineup in playing order with times, support and
  prices — plus a link to the venue page. Venues with nothing booked on the
  selected date drop off the map rather than sitting there as dead pins.
- **Artists** places one pin per artist on its city of origin, offset
  deterministically so two artists from one city do not stack. Tapping one opens
  every date they play anywhere and fits the map to all of them, which usually
  means zooming out of the city they came from.
- **Venues** reveals a search field beneath the three selectors, with the
  magnifier at the far right inside the field as a real button. It matches name,
  city and street; results dismiss on click-out. It searches venues only — this
  bar belongs to the venues layer, and matching an artist would send you to a pin
  that does not exist.

**Player.** Docked immediately right of the logo trigger, sharing its baseline:
marquee title and artist/album lines that scroll only on overflow, prev/play/next,
a click-to-seek scrub bar, a volume track, and a queue button that opens upcoming
tracks with history greyed below a rule. Queue and history are one ordered list
split at the current index, so skipping moves a track from one to the other with
nothing to keep in sync. Opening the nav dims it with everything else.

The trigger now carries the iHYPE bolt from `assets/logo/icon.svg`, drawn inline
so it inherits `--ink-on-accent` and does not depend on a relative asset path.

## Later corrections

- **The player carries both HYPE and favourite.** They are different acts: HYPE
  spends from your balance and pushes the artist up the local chart, the heart
  only saves the track. One heart doing both had quietly removed the mechanic the
  product is named after. The HYPE control is the bolt from the mark drawn as SVG
  — the obvious glyph is an emoji, and the system does not use emoji.
- **Prev/next are single chevrons** (`‹` `›`), not doubled.
- **Discover is the Seed module.** Its deck now mixes proximity seeds with
  hype-history recommendations and labels every card with which one put it there.
  Recommended is the same recommendation items on their own, filtered from the
  one list rather than a second copy.
- **`ds-base.js` cache-busts the bundle.** The compiler rewrites
  `_ds_bundle.js` at the same URL, so without a version query the browser kept
  serving the copy it already had and the page silently rendered the previous
  generation of every component.
- **`ArcNav` and `Scrim` take their state as an object** (`nav={expanded,
  section}`, `state={visible}`). A bare boolean prop whose value merely flips was
  not reaching every mount; an object gets a fresh identity each render and cannot
  be missed. Flat props still work for direct React callers.

## The arc-nav defect, and what it was

Three rounds of this overhaul reported the arc nav as fixed when it was not. The
cause was never prop propagation:

`requestAnimationFrame` does not fire in some embedded preview contexts, so the
document timeline never ticks. A CSS transition then sits at `currentTime: 0`
with `fill: backwards` forever — holding its FROM value. The ray's React props,
its inline `style` attribute and `ArcNav`'s committed `nav` prop all read
`opacity: 1` and the open transform, while `getComputedStyle` returned
`opacity: 0` and the closed matrix. Every check that looked at props or at a
screenshot passed; only `getComputedStyle` caught it.

Three attempted fixes failed for the same reason before the right one landed:

1. Keep the transition — frozen at `currentTime: 0`.
2. Gate the transition on one `requestAnimationFrame` — a single frame can be
   delivered without the timeline ever ticking, so the flag went true and the
   transition still froze.
3. Swap transitions for `@keyframes` — identically frozen. Screenshots had
   suggested keyframes worked, but `html-to-image` re-renders the DOM and ignores
   animation state; `getComputedStyle` showed the Discover cards and the queue
   panel were both sitting at `opacity: 0`.

The fix is that **no reveal is animated at all**. Rays, scrim, player undim, queue
panel, seed cards and the pin sheet are authored at their final values, and
appearance is a state change. `ih-marquee` is the one surviving animation because
its FROM state is the readable one and it never fills.

A second cache bug hid behind the first: `ds-base.js` only versioned
`_ds_bundle.js`, so the token CSS was served from cache and edits to
`tokens/base.css` appeared to do nothing. It now versions every asset.

Three rules came out of this, in `ADHERENCE.md` 23–25.

## Known follow-ups

- `tokens/fonts.css` loads Bricolage Grotesque and Work Sans through the CSS2
  API rather than pinned `@font-face` blocks, so the compiler does not register
  them as project fonts. Pin real `woff2` files for offline bundles.
- **Reserved-attribute props.** `open` and `hidden` never reach a component when
  set from a template, and camelCase attribute names are lowercased by the HTML
  parser. The shell components take `expanded`, `dimmed` and kebab-case props as
  a result. Recorded in `ADHERENCE.md` rule 16.
- The 46 re-anchored templates got color and type, not layout. The Bulletin
  direction's card radius, whitespace and editorial hierarchy are applied in the
  app shell; the remaining surfaces still carry their old layout.
