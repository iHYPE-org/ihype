# Handoff: iHYPE — Music / Map / Me simplification + backend rewrite

## Overview

iHYPE is a nonprofit live-music platform. Every ticket splits **70% artist / 20% venue / 10% promoter pool / 0% iHYPE**, locked in the founding charter. This handoff covers a significant simplification of the app shell and the corresponding backend rewrite.

**What changed in this round:**

1. The entire app collapsed from a tab-bar-plus-header layout into **three modules** — Music, Map, Me — reached from a single floating logo trigger.
2. The **top header was removed** entirely; nav icon + music player are the only persistent chrome.
3. The **DJ role was deleted from the product.** Radio is now station-based rather than DJ-hosted.
4. The **fan page creator was removed.** Fans share a HYPE link instead of maintaining a page.
5. **Auth collapsed to a single step** — one email field for both sign-in and sign-up.
6. An **Advertiser role** was added alongside Artist and Venue.

Items 3–6 are breaking changes for the backend. `BACKEND_REWRITE.md` in this folder is the authoritative migration spec.

---

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy directly.**

They are authored as "Design Components" (`.dc.html`) in a bespoke prototyping runtime with its own template syntax (`<sc-if>`, `<sc-for>`, `{{ hole }}`, a `renderVals()` logic class). **That runtime is a prototyping tool and should not be reproduced.** Read the files for layout, exact values, copy, and interaction logic; then rebuild in the target codebase's real environment using its established patterns.

If no frontend environment exists yet, React with a real router is the natural fit — the module structure maps cleanly onto nested routes.

## Fidelity

**High-fidelity.** Colors, typography, spacing, animation timings, and copy are final. Recreate pixel-perfectly. Every hex value and duration in this document is the intended production value.

---

## Screens / Views

### Shell

The app is a single full-height frame, `max-height: 880px`, `background #0d0b0a`, `overflow: hidden`. Everything is absolutely positioned inside it. There is **no top header and no bottom tab bar** — this was deliberate, to reclaim vertical space.

Persistent chrome, both pinned bottom-left-ish:

**Logo trigger** — `position: absolute; left: 14px; bottom: 14px`, 58×58px circle, `background #0d0b0a`, `border: 2px solid #ff5029`, `box-shadow: 0 0 22px rgba(255,80,41,.42)`, `border-radius: 50%`. Contains the word "iHYPE" in Syne 800 at `.66rem`, `letter-spacing: -.02em`, color `#f0ebe5`. Below the wordmark, when audio is playing, three 2px-wide equalizer bars in `#ff5029` animate on a `.9s` ease-in-out loop staggered 0 / .15s / .3s, each oscillating between 2px and 7px tall.

**Music player** — `position: absolute; left: 80px; right: 12px; bottom: 16px`. `background rgba(13,11,10,.84)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(240,235,229,.12)`, `border-radius: 12px`, `padding: 7px 11px 7px 8px`. Flex row, `gap: 9px`:
- 36×36px artwork square, `border-radius: 8px`, `linear-gradient(135deg, #ff5029, #7a2412)`, centered initial in Syne 800 `.88rem` `#140f0d`
- Track title — DM Sans 600 `.79rem` `#f0ebe5`, truncates with ellipsis
- Artist line — JetBrains Mono `.57rem`, `letter-spacing: .05em`, `#8a807a`, truncates
- Hype toggle — `♡` / `🔥` at `.88rem`
- Play/pause — 29×29px circle, `background #ff5029`, `#140f0d` glyph at `.68rem`, `▶` / `❚❚`

The player is rendered only when the nav is closed, so opening the nav hides it behind the scrim. This was an explicit requirement: the nav dims *everything*, player included.

### Navigation (two-level radial fan)

Tapping the logo opens the nav. A **scrim** covers the whole frame: `position: fixed; inset: 0`, `background rgba(8,6,5,.62)`, `backdrop-filter: blur(3px)`, fading in over `.2s`. Tapping the scrim or the logo again closes.

**Level 1** — three pills stack upward from the logo at `left: 16px; bottom: 84px`, `flex-direction: column-reverse`, `gap: 9px`. Order bottom-to-top: **MAP, MUSIC, ME**. Labels are Syne 800 `.92rem`, `letter-spacing: .06em`, horizontal (not rotated). Active module: `background rgba(255,80,41,.16)`, `border: 1px solid rgba(255,80,41,.5)`, text `#ff5029`. Inactive: `background rgba(13,11,10,.86)`, `border: 1px solid rgba(240,235,229,.16)`, text `#f0ebe5`. MUSIC and ME show a `▸` chevron because they have submenus; MAP navigates directly.

**Level 2** — selecting MUSIC or ME replaces the pills with that module's submenu: a back chip (`◂` plus the module name in `#ff5029`) above a wrapping flex row of item pills, `gap: 7px`, `border-radius: 10px`, `padding: 9px 14px`, DM Sans `.84rem`.

- **MUSIC** → Discover, Radio, Charts, Playlists, Search
- **ME** → Stats, Add roles, Settings, Accessibility, Community, Info, Legal

**Animation.** Each item flies out from the logo's position. The `.ray` class animates from `translate(-26px, 34px) scale(.4)` to rest, `.34s cubic-bezier(.22,1.4,.36,1)`, staggered per item. In the prototype the stagger comes from `nth-child` rules feeding a `--nd` custom property; in production just compute the delay per index — `index * 70ms` for level 1, `index * 50ms` for level 2.

> **Implementation note:** the nav overlay must fill the frame (`inset: 0`). An earlier version constrained it to a 260×260 box, which clipped 5 of 7 ME items and made three of them unreachable. Do not put `overflow` on the submenu wrapper either — the items' rest transform sits slightly outside the wrapper bounds and gets cut.

### Map module

Real slippy map, `background #12100e`, `touch-action: none`, `cursor: grab` / `grabbing` while dragging. CARTO dark raster tiles over OpenStreetMap data; attribution "© OpenStreetMap · CARTO" bottom-right in JetBrains Mono `.5rem` `rgba(240,235,229,.42)`. Pinch-zoom and scroll-wheel zoom, drag to pan.

Controls float at `top: 10px` in two scrollable rows:
- Row 1 — layer chips (Events / Venues / Artists), a 1px divider, then scope chips (County / State / Country / Global)
- Row 2 — genre chips in JetBrains Mono `.63rem`

Active chip: `rgba(255,80,41,.16)` fill, `rgba(255,80,41,.5)` border, `#ff5029` text. Inactive: `rgba(13,11,10,.62)` fill, `rgba(240,235,229,.16)` border, `#8a807a` text. All chips `border-radius: 999px`, `backdrop-filter: blur(8px)`.

**Pins.** Event pins are price pills (`$28`) with a 2px leader line. Hot events (>75% sold) invert to a solid `#ff5029` fill with `#140f0d` text; normal events are `#16120f` with an `rgba(255,80,41,.75)` border. Venue and artist layers use circular bubbles, `rgba(255,80,41,.92)` with a 2px white border.

Two behaviors matter here:
- **Viewport culling** — drop pins more than 80px outside the frame before placing them, and don't include them in the hit-test array.
- **Collision de-clustering** — at county zoom, pins within 46×26px of an already-placed pin fan outward on a widening arc (`ring * 30px` radius, 6 slots per ring, y-axis squashed to 0.72) until clear, max 24 attempts. Offset pins get a longer 12px leader line so the true location stays readable. Without this, dense areas collapse into an unreadable blob.

Tapping any pin opens a **detail sheet** — bottom sheet, `background #16120f`, `border-radius: 18px 18px 0 0`, `padding: 18px 18px 22px`, sliding up `.22s` from `translateY(18px)`. Contains a drag handle, avatar (circle for artists/events, `border-radius: 11px` for venues), kind eyebrow in `#ff5029` JetBrains Mono `.56rem`, title in Syne 800 `1.32rem`, verified checkmark if applicable, a three-stat row bounded by hairline rules, a related-items list, the charter split line, and CTAs — primary `#ff5029` with `#140f0d` text, secondary outlined in `rgba(255,80,41,.4)`, plus an `✕` dismiss.

Below the chips sits a result line at `bottom: 74px`: JetBrains Mono `.58rem` `#8a807a` on `rgba(13,11,10,.72)` with `blur(10px)`, reading e.g. "6 events · all · tap a pin for their page".

### Music module

Full-bleed pane over the map, `background #0d0b0a`, `padding: 14px 16px 96px` (the generous bottom padding clears the player and nav). Five tabs across the top as equal-flex buttons, `border-radius: 10px`:

- **Discover** — the Seeds swipe deck
- **Radio** — station rows (see below)
- **Charts** — ranked list
- **Playlists** — user and shared playlists
- **Search** — genre / location / hype filters

**Radio is station-based, not DJ-hosted.** This is the key change. Each row: 44×44px artwork (`border-radius: 9px`; playing station gets the `#ff5029` gradient, idle gets `linear-gradient(140deg, #3a2230, #1b1218)`), a `▶` glyph, title in DM Sans 600 `.9rem`, subtitle in `.76rem` `#8a807a`, and a track count in JetBrains Mono `.58rem`. The eight stations:

| Station | Subtitle |
|---|---|
| For you | Built from what you hype and replay |
| Local · Portland | Everything within 40 miles of you |
| New this week | Fresh uploads across every genre |
| Recommended by friends | Nyla, Maya + 4 others shared these |
| Dream-pop | Genre station |
| Punk | Genre station |
| Hip-hop | Genre station |
| Electronic | Genre station |

### Me module

Role-aware dashboard. A role switcher chips between the roles the account actually holds. Stats grid, activity list, and split visualization all vary by role.

**HYPE link card** — `border: 1px solid rgba(255,80,41,.22)`, `background rgba(255,80,41,.05)`, `border-radius: 12px`, `padding: 15px`. Shows `ihype.org/h/<handle>` with a copy button. For fans this is the primary surface, with the framing: *"Share it — friends see what you hype, and shows you can go to together."*

**Page editor card** — Artist and Venue only. Fans do not get a page creator; this was removed deliberately.

**Add roles view** — reached from ME → Add roles.

Opens with: *"Every account is a Fan already — that never goes away. Add a role to unlock the tools that come with it."*

A locked Fan row sits first — `border: 1px solid rgba(185,131,255,.32)`, `background rgba(185,131,255,.07)`, 🎶 icon, labeled `ALWAYS ON` in `#b983ff`. Then three addable cards:

| Role | Icon | Split line | Description |
|---|---|---|---|
| Artist | 🎤 | 70% of every ticket | Upload tracks, publish shows, run your own tour. Keeps 70% of face value, locked by charter. |
| Venue | 🏛 | 20% of every ticket | List your room, book from the demand radar, scan tickets at the door. 20% guaranteed. |
| Advertiser | 📣 | Music-industry only | Buy radio and map placement. Labels, gear, ticketing, merch and tour support only — screened before it runs. |

Active roles show an `ACTIVE` badge and a "Manage this role" outline button; inactive show a solid `#ff5029` apply CTA. Footer note: *"Artist and Venue roles need verification (~48h). Advertiser needs a music-industry check. Promoting needs no role at all — share your HYPE link."*

**Settings sections** — Settings, Accessibility, Community, Info, and Legal are all routed from the ME submenu via a `meView` discriminator. They render as grouped rows: section label in JetBrains Mono `.6rem` uppercase `#6f6660`, then a bordered card of label/value rows.

### Auth

**One step.** With magic links there is no meaningful difference between signing in and signing up — the same email field produces the same link, and the backend already knows whether the account exists.

- Single email input. No password. No display-name field (onboarding collects that).
- Heading: "Continue with email". Subhead: *"One field. New or returning, the link signs you in either way."*
- CTA: "Email me a sign-in link →", becoming "Sending link…" while in flight.
- Three modes only: `start`, `magic` (link-sent confirmation), `invite` (pre-filled from an invite code).
- No login/register toggle, and no footer link switching between them.

---

## Interactions & behavior

| Interaction | Behavior |
|---|---|
| Tap logo | Opens nav at level 1, scrim fades in `.2s`, player hides |
| Tap logo again / tap scrim | Closes nav, resets to level 1, player returns |
| Tap MAP | Navigates immediately, closes nav |
| Tap MUSIC / ME | Swaps to level 2 submenu, nav stays open |
| Tap back chip | Returns to level 1 |
| Tap submenu item | Navigates, closes nav, resets section to root |
| Map drag | Pans; `cursor: grabbing` |
| Map scroll / pinch | Zooms; repaint is debounced and re-entrancy-guarded |
| Tap pin | Opens detail sheet, slides up `.22s` |
| Tap sheet scrim / ✕ | Closes sheet |
| Tap play/pause | Toggles playback; logo equalizer starts/stops |
| Tap ♡ | Toggles hype on the current track |
| Tap copy on HYPE link | Copies, shows transient "Copied!" |

**Animation reference:**
- `.ray` fan-out — `.34s cubic-bezier(.22,1.4,.36,1)` from `translate(-26px,34px) scale(.4)`
- Scrim fade — `.2s ease`
- Sheet rise — `.22s ease` from `translateY(18px)`, opacity 0→1
- Equalizer — `.9s ease-in-out infinite`, height 2px↔7px
- Pin pulse ring — `scale(.7) opacity(.85)` → `scale(2.1) opacity(0)`

---

## State management

```
tab          'events' | 'listen' | 'dash' | 'settings' | 'roles'
navOpen      boolean
navSection   'root' | 'music' | 'me'
listen       'seeds' | 'radio' | 'charts' | 'playlists' | 'search'
meView       'stats' | 'roles' | 'account' | 'access' | 'community' | 'info' | 'legal'
scope        'county' | 'state' | 'country' | 'global'
layer        'events' | 'venues' | 'artists'
genre        string
role         'artist' | 'venue' | 'fan'   (active dashboard role)
sheet        null | { type, data }
playing      boolean
hyped        boolean
```

In production, `tab` / `navSection` / `listen` / `meView` should be **routes**, not state — the module structure is a natural URL hierarchy (`/map`, `/music/radio`, `/me/settings`). Only `navOpen`, `sheet`, `playing`, and `hyped` are genuinely ephemeral UI state.

Map view state (`{ lng, lat, z }`) is held outside React state in the prototype and painted imperatively; keep that separation, since routing map pans through React state causes a repaint per frame.

---

## Design tokens

**Colors**

| Token | Value | Use |
|---|---|---|
| Accent | `#ff5029` | Primary brand, active states, CTAs |
| Accent deep | `#7a2412` | Gradient partner |
| Base | `#0d0b0a` | App background |
| Surface | `#16120f` | Sheets, menus, cards |
| Map void | `#12100e` | Behind map tiles |
| Ink 1 | `#f0ebe5` | Primary text |
| Ink 2 | `#c9c1ba` | Secondary text |
| Ink 3 | `#8a807a` | Tertiary / meta |
| Ink 4 | `#6f6660` | Faintest labels |
| On accent | `#140f0d` | Text on `#ff5029` |
| Role · fan | `#b983ff` | Fan role |
| Role · venue | `#22e5d4` | Venue role |
| Role · promoter | `#ff3e9a` | 10% promoter slice in split bars |
| Scrim | `rgba(8,6,5,.62)` | Nav overlay |
| Hairline | `rgba(240,235,229,.1)` | Borders, dividers |

> The promoter token was previously named `--role-dj`. It was only ever used decoratively for the 10% slice, so it was renamed rather than deleted. There is no DJ role.

**Typography** — Syne (700/800) for display and labels; DM Sans (400/500/600/700) for body and UI; JetBrains Mono (400/500) for meta, eyebrows, and counts; Instrument Serif italic for editorial pull quotes. CJK/Arabic/Devanagari fall back to the matching Noto Sans families.

Scale in use: `.5rem` (attribution) · `.56–.6rem` (eyebrows, badges) · `.63–.66rem` (chips) · `.72–.8rem` (meta, secondary) · `.84–.92rem` (body, buttons) · `1.05–1.14rem` (stat values) · `1.3–1.32rem` (sheet and view titles).

**Radius** — `6px` hint pills · `8–9px` artwork, small buttons · `10px` chips, submenu items · `11–12px` cards, player · `14px` menus · `18px 18px 0 0` bottom sheets · `999px` pill chips · `50%` logo, avatars, play button.

**Shadows** — logo glow `0 0 22px rgba(255,80,41,.4)` · pin `0 3px 12px rgba(0,0,0,.55)` · hot pin `0 3px 14px rgba(255,80,41,.5)`.

**Spacing** — 4px base. Common: `gap: 6–9px` between chips, `padding: 13–15px` in cards, `16px` pane gutters, `96px` bottom pane padding to clear the player and nav.

---

## Internationalization

The prototype ships **11 locales beyond English** — es, fr, pt, de, it, ru, zh, ko, hi, ar, ja — at **1,468 keys each**, verified at full parity. Locale chunks live in `lib/i18n-data/<lang>.js` and load on demand.

- **Arabic sets `dir="rtl"`** and mirrors layout, including chevrons and directional icons.
- **Legal pages** (Privacy, Terms, Charter, DMCA — 68 blocks each) are translated, but every non-English view carries a notice that **the English version is the legally binding text.** Keep that notice. These translations still need review by counsel per market before launch.
- Device mockups and internal artifacts are **intentionally English-only** by decision — don't treat them as gaps.

Reuse the existing translation data rather than re-translating; it represents substantial verified work.

---

## Files in this bundle

| File | What it is |
|---|---|
| `SimplifiedApp.dc.html` | **Primary reference.** The whole Music/Map/Me shell, map engine, nav, player, all modules |
| `Auth.dc.html` | Single-step magic-link auth |
| `RoleSettings.dc.html` | Role switching and per-role settings |
| `Legal.dc.html` | Privacy / Terms / Charter / DMCA with the translation notice |
| `colors.css`, `type.css`, `spacing.css` | Design tokens |
| `i18n.js` | Locale loader with the candidate-chain base resolution |
| `BACKEND_REWRITE.md` | **Authoritative backend migration spec** |
| `FRONTEND_GOTCHAS.md` | Bugs already found and fixed — read before implementing |
| `schema.sql`, `openapi.yaml`, `seed_data.json` | Current backend contract (pre-rewrite) |

---

## Assets

No bitmap images. All iconography is either a Unicode glyph (`▶ ❚❚ ♡ 🔥 ✓ ▸ ◂ ✕`) or an emoji in the role cards (`🎶 🎤 🏛 📣`). Artwork placeholders are CSS gradients. Map tiles come from CARTO's dark basemap over OpenStreetMap data — attribution is required and already present.

If you swap emoji for an icon set, keep the role colors as the differentiator.
