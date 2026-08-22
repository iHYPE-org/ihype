# Back to Claude Design — thirteen fixes, measured in the app

**From:** `iHYPE-org/ihype`, 2026-08-22, after adopting
`design_handoff_ihype_console` (DESIGN_SYNC rows 288–289).
**To:** the design system project this bundle came from.

The console dock is live: `RotaryNav`, `TunerDial` and `JoystickTransport` are
mounted from the bundle's own component sources, generated on every build rather
than ported by hand, exactly as the README asks. Nine things had to be corrected
on this side to ship them, and three more are wrong in the bundle but not yet
blocking. Each one below is a defect **in the design system**, not a preference:
fixing it upstream deletes code here.

Items 9–12 were added on 2026-08-22 after the dock and the map were driven on a
real iPhone. Three of the four were invisible to every check that runs here and
to every desktop browser — an emoji glyph substitution, a missing stylesheet the
components depend on but do not contain, and a filter whose output had to be
computed to be believed.

Everything is measured. Ratios and filter outputs are computed, not quoted; pixel
figures come from `npm run measure:dock` and `npm run measure:datepick`, which
drive Chromium against the real stylesheets.

---

## 1 · The knob cap cannot hold "MUSIC" at your own type floor · **blocking, worked around**

`components/shell/RotaryNav.jsx` draws the module readout at
`fontSize: Math.max(8, size * 0.115)` — **8.5px** at the specified 74px knob.
ADHERENCE rule 3 forbids that in the same bundle: "a dial readout, a form label,
an error message and a button label are all *content* and may not sit below
[15px]".

Raised to 15px, `MUSIC` measures **52px inside a 42px cap — a 10px overflow**, on
the one control that says where you are. Neither escape works:

- growing the knob needs **102px** for the cap to fit, which makes the dock
  121px tall — 14% of a 852px phone, for a bar;
- abbreviating contradicts the README: the cap reads the module "by NAME, not
  initial".

**Shipped instead:** the cap takes the tracked-mono metadata floor — 11px at
`.14em` — on the reasoning that an engraved hardware legend is metadata, not
prose. Measured at 41px in 42.

**Ask:** decide the cap's real scale for a 74px knob and state it. If 11px
tracked is right, put it in the component and this override disappears.

## 2 · The dial's neighbour hints cost more than the destination name · **blocking, worked around**

`TunerDial.jsx` insets the current station `left: 22%; right: 22%` to leave room
for two shoulder hints at `fontSize: 8.5`. Under the same 15px floor those hints
stop being hints, and the 44% they cost **ellipsised "Recommended" by 18px at
393px and 59px at 320px** — a destination name you cannot read, which is the
exact failure the dial exists to fix ("a strip … can name none of them legibly").

**First shipped:** the shoulders stood down and the name took the face.

**Now shipped (2026-08-22), because the owner asked for the hints back:** they
are on the **scale row** instead of beside the name, at the ends of the
graduations, at 11px tracked mono. The name keeps its full 24px and the whole
width. Measured: both hints render in full from 393px up, the name is unclipped
from 375px up.

The arithmetic for why they cannot sit beside the name, measured in Chromium
against the real faces:

| | width |
|---|---|
| `"Recommended"`, Instrument Serif 15px / 20px / 24px | 90px / 120px / **144px** |
| `"Playlists"`, JetBrains Mono 700 at 11px / `.14em` | **74px** |
| dial content box at 375px / 393px / 430px | 171px / 189px / 226px |

The hints sit 24px in from the content edge to clear the 26px chevrons, so two of
them cost `2 x (24 + width)`. At **393px**, holding the name at 20px leaves each
hint **20px — two characters**. At **375px there is no combination of sizes at
which all three fit.** The bundle's own 22%/20% split overlaps the name; it was
drawn at desktop width, where 1100px of dial hides the problem.

**Ask:** put the hints on the scale row in the component, or state a shoulder
scale that leaves an eleven-character station name readable at 375px. Note that
moving them from CSS here means defeating the `overflow: hidden` on a wrapper
with no class, selected structurally as the dial's one child that is not
`.tuner-scale` — fragile by construction, and only safe because
`npm run measure:dock` now fails if the hints are clipped, off the scale row, or
raised above 11px.

## 3 · `tokens/colors.css` re-lightens four role hues below AA · **do not adopt**

Measured on the bundle's own cream ground `#f0dfb8`:

| Role | Bundle | Ratio | Shipped | Ratio |
|---|---|---|---|---|
| Fan | `#8a4fd6` | **3.83:1** | `#5b3d8f` | 6.36:1 |
| Venue | `#0f8f80` | **3.03:1** | `#0f6b62` | 4.83:1 |
| Promoter | `#c81866` | **4.22:1** | `#a3175f` | 5.61:1 |
| Advertiser | `#a5760a` | **3.07:1** | `#8a5a06` | 4.50:1 |

All four fail AA as text; all four shipped values pass. The bundle's own
`ADHERENCE.md` §32 rejects white-on-accent at 3.27:1 for exactly this reason, so
this is the system disagreeing with itself rather than with us.

**Ask:** adopt the four shipped values, or state that these hues are fills only
and publish a `*-text` pair for each. The app already keeps that distinction
(`--accent` vs `--accent-text`).

## 4 · Components hardcode brand colour instead of reading their own tokens

42 literals across the seven console components — `#ff5029`, `rgba(255,80,41,…)`,
white sheens — where `--accent` and friends exist. A hardcoded hex cannot follow
the ground it is dropped onto, which is the whole point of having a token layer.
Full list: `VENDOR_REPORT.md` in this directory.

**Ask:** read the tokens. This also removes the reason `src/components/ds/` is
exempt from the app's colour audit.

## 5 · Components hardcode font families, which resolve to nothing here

`fontFamily: "'Instrument Serif',serif"` and `"'JetBrains Mono',monospace"`.
This app has **no `@font-face` anywhere**: every face is loaded by
`next/font/local` under a generated family name and reached through a custom
property. Left literal, the dial's engraved station name — the console's
signature — renders in the browser's default serif.

**Ask:** use the type tokens (`--font-serif` / `--font-mono` or the bundle's own
names). The app's generator currently rewrites these on every vendor run.

## 6 · `TicketQR` needs a warning in its own name or docstring

It draws a QR-*shaped* matrix from the code string. Its docstring is honest about
this — "a representation of the door credential, not an encoder" — but the
component is called `TicketQR` and sits beside a ticket template, which is a
trap: on a real stub it produces a block no scanner can read, and the failure is
invisible until someone is standing at a door.

**Ask:** rename to `TicketQRPlaceholder`, or make the docstring's first line the
warning. The app refuses to mount it and says why in its file header.

## 7 · The bundle contradicts itself about the navigation model

`README.md` replaces the arc nav with the dock knob ("**There is no tab bar.** One
walnut dock … carries the entire navigation"). `ADHERENCE.md` rule 6 still says
the only persistent chrome is "the logo trigger, the player pill and the nav
hint, all bottom-left/bottom-right" — the model the dock replaced.

Rules 10, 11 and 12 are also arc-specific (five level-2 slots, closed items not
tabbable, per-index transforms) and describe a control that no longer exists.

**Ask:** rewrite rules 6 and 10–12 for the dock. As it stands, a session that
applies ADHERENCE faithfully rebuilds the arc, and would be right to.

## 8 · 31 of 41 templates break rules this bundle publishes

From `npm run audit:design`, which tests the design system against its own
ADHERENCE:

| Finding | Count | Templates | Rule |
|---|---|---|---|
| Emoji | 71 | 17 | §29 — no emoji, anywhere |
| DJ role | 39 | 7 | §4 — there is no DJ role (deleted 2026-08-06) |
| Promoter as a role | 31 | 7 | §3 — promoter is not an account type |
| White on the accent fill | 44 | 22 | §32 — 3.27:1, fails AA |

`role-dashboard` and `profile-page` still ship a full `isDj` variant. This matters
more than a styling defect because the templates are the source of truth: a
session told to apply the template faithfully re-introduces a deleted role.

`templates/landing/` is the one to fix first — it pitches an open "Join beta —
free" signup while the product is invite-only and the live page says so, so
translating it faithfully would regress `/`.

---

## 9 · `\u25c0` and `\u25b6` render as EMOJI on iOS · **fixed here in the generator**

`JoystickTransport.jsx` writes its prev hint, its next hint and its play nub as
`\u25c0` / `\u25b6`, and `FullPlayer.jsx` writes its play button the same way.
Both characters carry `Emoji=Yes` — an emoji variant exists — even though their
default is text presentation, and WebKit serves the colour glyph from Apple Color
Emoji anyway.

On a real iPhone the joystick therefore drew **three blue rounded squares in a
row**, while `\u25b2` and `\u25bc` (no emoji variant) came through as the intended
engraved triangles. Reported from a phone with a screenshot; a desktop browser
shows the bundle's own glyphs and cannot see it.

**Fixed here:** `vendor:ds` appends **U+FE0E**, VARIATION SELECTOR-15, to those
two glyphs — 4 occurrences across 2 components. FE0E requests *text*
presentation and is the opposite of the FE0F that ADHERENCE §29's no-emoji rule
is about, so this does not make them emoji.

**Ask:** carry the selector in the components. Then the transform finds nothing.

## 10 · `.tuner-dial`'s VU backlight is in `tokens/console.css` and in no component

`tokens/console.css` calls the dock "orange backlit VU" and gives `.tuner-dial`
a lamp gradient rising off its bottom edge plus `inset 0 -9px 16px -4px
rgba(255,124,20,.55)`, and `.tuner-scale` an inner `rgba(255,143,45,.35)`. None
of it is in `TunerDial.jsx`, which paints no background at all — so a consumer
that mounts the component without also adopting that stylesheet gets flat cream
glass in a brass ring, which is what shipped here and what was reported ("should
be continuously flow with vu under lighting").

**Fixed here:** the gradient and both inner glows are applied to the dock's dial
in `mmm.css`, using this app's `--lamp` / `--accent` / `--bg` for the bundle's
`#ffb066` / `#ff8f2d` / `--bg-base`.

**Ask:** either put the lit face in the component, or say in the README that
`tokens/console.css` is required rather than optional for these seven components.
Note the bundle also references `--lamp-rgb`, which is defined in
`tokens/colors.css` but not exported anywhere a consumer would find it — writing
`rgba(var(--lamp-rgb), …)` against a project that lacks it drops the whole
declaration silently.

## 11 · `#search`'s `min(460px, 72vw)` overflows the control column it sits in

`map.html` sizes the search field `min(460px, 72vw)`. Both halves are wrong once
it is a real overlay, measured here:

- above the bundle's own 620px breakpoint the control block caps at 420px, so a
  **460px field overflows its column by 52px**;
- `72vw` leaves **93px of empty pane** to the right at 375px while squeezing the
  field, and a right-anchored popover inside it lands at **-56px**.

**Fixed here:** `min(460px, calc(100% - 24px))`, which resolves against the pane
below 620px and the 420px column above it.

**Ask:** size it against the column rather than the viewport.

## 12 · The map filter clips before the tone lands — the ORDER is the defect

`map.html` filters its tiles `sepia(.92) saturate(.52) contrast(1.06)
brightness(1.04) hue-rotate(-8deg)`. Run over OSM's own palette — which that
file loads — in sRGB, as CSS filters are specified:

| | before | after |
|---|---|---|
| water | `#aad3df` | `#fffee4` |
| land | `#f2efe9` | `#ffffff` |
| **water/land contrast** | | **1.02:1** |
| **hue separation** | | **0 degrees** |

The harbour and the land come out the same colour. **This entry previously
concluded "do not adopt the sepia", and that was wrong** — the fault is not the
sepia, it is that `brightness` is applied LAST. The sepia matrix has row sums of
1.35 (red) and 1.20 (green), so a near-white basemap tile clips at 255 in both
channels and emerges white with a faint yellow cast; `brightness(1.04)`
guarantees it.

**Shipped here instead:** `brightness(.72) sepia(1) saturate(1.1)
contrast(1.15)` — darken first, so the tone has somewhere to live. Measured on
CARTO voyager and rendered in Chromium with the grain overlay composited:

| | water | land | water/land | land hue / sat |
|---|---|---|---|---|
| this bundle's order | `#fff6df` | `#ffffff` | 1.02–1.08:1 | 60° / 0% |
| darken-then-sepia | `#c8ae7f` | `#ffe3a7` | **1.71:1** | 41° / 35% |

So full sepia separates land from water BETTER than the hue-preserving tone it
replaces, because the separation becomes tonal rather than chromatic — which is
what a sepia print is. Pin ink stays at 12.7:1 on land and 7.5:1 on water.

The ruled chart grid from the same file IS adopted verbatim and is the cue that
makes it read as a survey chart rather than a filtered map.

**Ask:** move `brightness` to the front of the chain and take it below 1. The
tone this bundle is reaching for is available; the order is what withholds it.

## 13 · `TunerDial` cannot step twice before its `active` prop catches up

`go()` resolves the next station from `stations[idx + 1]`, where `idx` comes from
the `active` **prop**. In this app that prop arrives from the URL, so two clicks
of the step chevron that land before the router settles both resolve from the
same stale index and both go to the *same* station — one step for two taps.

Caught as a CI flake (two polls at `discover`, eleven at `radio`, then a timeout
waiting for `charts`), which is the same thing a member gets by double-tapping.

**Worked around in the test** by asserting each step before the next. Not
worked around in the app, because the fix is optimistic local state inside the
component and forking it is the one thing `src/components/ds/` exists to prevent.

**Ask:** keep a local index that leads the prop, reconciling when it arrives —
so a second step is relative to the first rather than to whatever the parent last
said.

## What the app fixed on its own side, for the record

- The dock's geometry: `--mmm-knob` (74px) is the origin, `--mmm-chrome-size` is
  what content clears, and there is no phone branch — a flex bar re-fits itself.
- MAP's dial tunes the map's **layers**, not the four date stations
  `console-shell` draws. The shipped date strip is a multi-select day picker and a
  dial names one station, so wiring dates to it would have deleted a working
  filter.
- A page's own sections (a profile's tab set) reach the dock's dial through a
  provider, so there is genuinely one dial per screen.
