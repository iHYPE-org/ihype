# Handoff: iHYPE Console — the exact design system

## Read this first

The goal here is **not** to reinterpret a design. This bundle contains the
design system itself — the real token stylesheets and the real compiled
components. The way to make the app look exactly like the mockups is to
**consume these files**, not to rebuild what they describe.

Almost all visual drift in a handoff comes from one habit: reading a spec,
then writing a fresh `Button` or `Card` that approximates it. Every
approximation is a small divergence, and they compound. If you find yourself
writing a component that already exists in `_ds_bundle.js`, stop and mount the
existing one instead.

**Fidelity: high.** Colors, type, spacing, radii, shadows and motion are final.
Match them exactly.

---

## The fastest correct path

Two files carry the whole look:

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

`styles.css` is an `@import` manifest for the eight files in `tokens/` — keep
them together and load only `styles.css`. Loading the token files individually
*as well* fetches the whole layer twice.

`_ds_bundle.js` exposes every component on one global:

```js
const { RotaryNav, TunerDial, JoystickTransport, FullPlayer, SeedDeck,
        HypeButton, TicketQR, Card, Button, Badge } = window.IHYPEDesignSystem_99d6e8;
```

They are plain React function components — no build step, no CSS-in-JS runtime,
no peer dependencies beyond React itself. `_ds_manifest.json` lists everything
available with its props.

If your target is React, this is the whole integration. **Do not port the
components by hand.** If you must (a non-React target: SwiftUI, Vue, native),
read the originals in `component-source/` and carry the values across
literally — those files are the truth, this README is only a summary of them.

> `component-source/` holds the component sources with flattened names and a
> `.txt` suffix (`components__shell__TunerDial.jsx.txt`). The `__` separators are
> directory slashes. They are text on purpose: a `.jsx` beside a matching
> `.d.ts` is treated as a component definition by the design-system compiler
> wherever it sits, so a verbatim copy inside a handoff folder registers a
> second definition of every component and collides with the original.

---

## The three rules that keep it looking right

These are not stylistic preferences. Breaking any one of them is visible
immediately, and the shipped app lints against them
(`_adherence.oxlintrc.json`, rationale in `ADHERENCE.md`).

### 1. Three materials, and ink belongs to its material

The design is not one palette. It is three surfaces, each with its own ink:

| Material | Surface tokens | Ink tokens |
|---|---|---|
| **The board** (cream page ground) | `--bg-base` `--bg-surface` `--bg-raised` | `--ink-1` `--ink-2` `--ink-3` |
| **Walnut** (console chrome: dock, player, nav, map frame) | `--walnut` `--walnut-2` `--walnut-3` | `--ink-on-walnut` `-2` `-3` |
| **Brass / lamp** (bezels, transport keys, pilot lights) | `--brass` `--brass-deep` `--lamp` | dark ink — `#2b1a0c` |

Never put `--ink-1/2/3` on a walnut surface. `--ink-1` is `#1c1408`, nearly the
same value as `--walnut-3` — the text disappears. Reach for the `-on-walnut`
set, and for a *word* never go past `--ink-on-walnut-3` (5.51:1); the next stop
down is for hairlines.

### 2. `--accent` is a fill, never text

`--accent` (`#ff5029`) on the cream board measures **2.48:1** and fails AA. It
is the pointer, the pilot lamp, the HYPE fill. For accent-coloured *text* use
`--accent-text` (`#923319`, 5.89:1). Ink on top of an accent fill is
`--ink-on-accent` (`#1c1408`) — dark, not white; white-on-accent is 3.27:1 and
fails everywhere.

### 3. Content has a 15px floor

`--text-base` is 15px. A dial readout, a form label, an error message and a
button label are all *content* and may not sit below it. The single exception
is the tracked-mono eyebrow: 11px (`--text-xs`), uppercase, mono, letterspaced
`--tracking-widest`, and metadata only — never a sentence.

---

## Type

Three families, each with one job. All are Google Fonts, declared as
`@font-face` in `tokens/fonts.css` pointing straight at `gstatic` URLs — no
`@import` chain, so the font requests start immediately.

| Token | Family | Used for |
|---|---|---|
| `--font-display` / `--font-serif` | **Instrument Serif** 400 | Every heading, the dial readout, prices, track titles |
| `--font-body` | **Work Sans** 400/500/600 | Body copy, row labels, descriptions |
| `--font-mono` | **JetBrains Mono** 400/500/700 | Eyebrows, metadata, all figures, button labels |

Instrument Serif ships a single weight and is already tight — do not set a
weight above 400 on it and do not apply `--tracking-display` to it. That token
exists for older marketing templates that still load Bricolage Grotesque
themselves; Bricolage is retired from the console direction entirely.

CJK and Arabic faces are **not** in the global stylesheet. They load on demand
via `__ihypeLoadLocaleFont` when a member picks a locale that needs one, so a
Latin-locale page downloads none. Twelve languages are supported this way.

Scale: `--text-xs` 11 · `--text-sm` 13 · `--text-base` 15 · `--text-md` 17 ·
`--text-lg` 21 · `--text-xl` 28 · `--text-2xl` 38 · `--text-3xl` 54.

---

## The navigation model

This is the part most likely to be rebuilt wrong, because it replaces a pattern
every developer has muscle memory for. **There is no tab bar.** One walnut dock
sits at the bottom of every screen and carries the entire navigation:

| Control | Component | Behaviour |
|---|---|---|
| Left | `RotaryNav` | Brass knob, three detents: **MAP · MUSIC · ME**. Tap steps, drag snaps to nearest, arrow keys step. The cap reads out the current module. |
| Centre | `TunerDial` | Backlit dial tuning the **sections of whatever you are looking at**. Drag travels continuously through stations — one long drag crosses the whole scale — and the tick band scrolls with the whole gesture. |
| Right | `JoystickTransport` | Tap play/pause · drag ◀ prev · ▶ next · ▲ open `FullPlayer` · ▼ dismiss it. The cap tilts in 3D toward the drag with a shadow that tracks it. |

Two things to preserve:

- **One dial per screen, and it is the dock's.** On a profile the dock dial
  tunes that artist's own tab set; on Info it tunes the six sections. An
  in-page tab strip alongside it puts two identical-looking dials on screen
  meaning different things.
- **The knob still reports the module.** "MAP + Albums" reads as *a profile,
  opened from the map* — the dock states where you are as well as where you
  can go.

Sizing: both knobs are **74px**, matched. They are the same brass body by
design; if one is smaller the dock looks broken.

---

## Screens in this bundle

Each is a reference implementation. `templates/<name>/` contains the screen;
open the `.dc.html` in a browser to see it run.

| Template | Screen |
|---|---|
| `console-shell/` | The app. Papyrus OpenStreetMap venue map (real Leaflet + OSM data under a sepia filter, in `map.html`), Discover seed deck, Charts, Radio, Playlists, full player |
| `console-checkout/` | Ticket purchase: face value, Stripe processing, the 70/20/10 split, then the serialized ticket |
| `console-ticket/` | The ticket stub: QR, status, stat grid, transfer, HYPE Link |
| `console-profile/` | Public artist and venue profiles, fixed tab sets, honest empty states |
| `console-settings/` | Payout/payment, profile, notifications, passkeys, privacy, invite, danger zone |
| `console-info/` | Support, the charter, transparency, terms, privacy, DMCA |

`templates/console-shared/show-data.js` holds the one show all of these
describe — facts and prices in a single place so no two screens can quote
different money. Keep that shape in the real app: derive every figure from one
price, don't retype it per screen.

The map is a separate plain HTML file rather than part of the shell component,
because map libraries need a settled DOM before they initialise. Keep real geo
data — the sepia filter and parchment grain are CSS over genuine OSM tiles, not
a drawn map. Note that OSM's public tile servers rate-limit; production needs a
keyed tile provider.

---

## Money, and three product rules that are not negotiable

These come from the project charter and appear in copy, so getting them wrong
is a correctness bug, not a wording preference.

- **iHYPE's fee is $0**, locked in the charter. Stripe's processing is a
  **separate** charge: 2.9% + $0.30 per transaction, 3.5% + $0.30 for Amex.
  Show them as two lines and never merge them into one number — and never imply
  iHYPE charges processing. Stripe's flat fee is per *transaction*, so it is
  charged once per order however many tickets are in it.
- **The 70/20/10 split** (artist / venue / promoter pool) is shown against
  **face value only**. Against the total it would imply the artist's 70%
  includes money Stripe took.
- **"Promoter" is not an account role.** There is no promoter signup or
  verification. Any Fan, Artist, Venue or DJ promotes by sharing their HYPE
  Link; when someone buys through it, the referrer earns a share of the 10%
  pool. Never add Promoter to a role picker.

---

## Motion

Restrained and mechanical — these are physical controls, so travel is short and
settles with a slight overshoot. Tokens are in `tokens/motion.css`.

- Detents and control returns: `cubic-bezier(.28,1.5,.35,1)`, 180–280ms
- Panels and sheets: `cubic-bezier(.22,.9,.3,1)`, 260–340ms
- Hover/tint changes: 160ms ease

Every keyframe animation sits behind `@media (prefers-reduced-motion: reduce)`.
Keep that.

One implementation note carried from the components: drive animation from React
state or CSS transitions, not from a re-rendered inline `animation:` property —
a re-render restarts the animation mid-flight.

---

## Layout

Mobile-first, and the desktop view stays close to it rather than reflowing into
a different product. The phone column is a fixed **430px** with
`max-width:100%`, centred.

Two things that cost real debugging time here:

- Give the column a **definite width** (`width:430px; max-width:100%`), not
  `width:100%`. A full-width flex basis leaves no free space, so
  `justify-content:center` and `margin:auto` both silently do nothing.
- The column needs `contain: layout paint` if anything inside it uses
  `position:fixed` — `FullPlayer` does. Without it the overlay resolves against
  the viewport and paints outside the phone frame.

Hit targets are never below **44px**. The dock controls are 74px.

---

## What not to bring across

- **`sw.js`** — a service worker. It is deliberately a self-unregistering
  no-op. An earlier version cached the app shell; registering it made the
  worker intercept every request and pages stopped settling entirely. If the
  real app wants offline caching, write it against that app's own routes and
  test it there. Do not register this file.
- **`lib/i18n.js`** and `lib/i18n-data/*.json` — the translation layer, if your
  app already has one. The dictionaries are `.json` rather than `.js` on
  purpose: as `.js` they were compiled into the bundle, so every page carried
  ~820KB of translations it never read while the loader separately fetched the
  one language the member wanted.
- **`.dc.html` templates** as production code. They are reference screens.
  Recreate the screens in your framework, consuming the same tokens and
  components.

---

## Files

```
styles.css                    load this one; @imports the eight below
tokens/                       fonts · colors · typography · spacing
                              base · console · motion · breakpoints
_ds_bundle.js                 compiled components, window.IHYPEDesignSystem_99d6e8
_ds_manifest.json             every component and its props
ADHERENCE.md                  the rules above, with rationale
_adherence.oxlintrc.json      lint config enforcing them
templates/                    six reference screens + shared show data
component-source/             console component sources as .txt (see note above)
readme.md                     the design system's own documentation
ROUTE_TEMPLATE_MAP.md         which screen governs which app route
MOBILE.md                     iOS/Android specifics
github.md                     the app repo these were built against
```

`readme.md` is the design system's full documentation and goes deeper than this
summary on individual components. `ROUTE_TEMPLATE_MAP.md` is the one to read
before wiring screens to routes — it records which template governs which route
in `iHYPE-org/ihype`.
