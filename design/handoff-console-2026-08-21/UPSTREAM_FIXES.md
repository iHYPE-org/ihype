# Back to Claude Design — eight fixes, measured in the app

**From:** `iHYPE-org/ihype`, 2026-08-22, after adopting
`design_handoff_ihype_console` (DESIGN_SYNC rows 288–289).
**To:** the design system project this bundle came from.

The console dock is live: `RotaryNav`, `TunerDial` and `JoystickTransport` are
mounted from the bundle's own component sources, generated on every build rather
than ported by hand, exactly as the README asks. Six things had to be corrected
on this side to ship them, and two more are wrong in the bundle but not yet
blocking. Each one below is a defect **in the design system**, not a preference:
fixing it upstream deletes code here.

Everything is measured. Ratios are computed, not quoted; pixel figures come from
`npm run measure:dock`, which drives Chromium against the real stylesheets.

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

**Shipped instead:** the shoulders stand down and the name takes the face, inset
16px to clear the 26px chevrons.

**Ask:** a shoulder scale that is legible AND leaves a five-word station name
readable at 375px. If the shoulders are worth their cost, the centre needs more
room than 56%; if they are not, drop them from the component.

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

## What the app fixed on its own side, for the record

- The dock's geometry: `--mmm-knob` (74px) is the origin, `--mmm-chrome-size` is
  what content clears, and there is no phone branch — a flex bar re-fits itself.
- MAP's dial tunes the map's **layers**, not the four date stations
  `console-shell` draws. The shipped date strip is a multi-select day picker and a
  dial names one station, so wiring dates to it would have deleted a working
  filter.
- A page's own sections (a profile's tab set) reach the dock's dial through a
  provider, so there is genuinely one dial per screen.
