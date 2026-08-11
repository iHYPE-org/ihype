# iHYPE on mobile

iHYPE is a phone product that also runs on a desktop, not the other way round. There is
**no separate mobile build** — `templates/simplified-app/` IS the app; Capacitor wraps that
exact page in a WKWebView and an Android WebView, and the browser serves it as an
installable PWA. Anything you build here has to hold at **375px** (iPhone SE) before it is
allowed to be good at 1440.

---

## The floor: 375px

375 is the narrowest width we support, and it is the width to design at first. After the
24px pane padding on each side you have **327px of content**. Two things follow:

- Never write a fixed `width:` over 320px on a content element. Decorative
  absolutely-positioned glows are exempt — they sit under `overflow:hidden`.
- Never write a rigid multi-column grid. `grid-template-columns:1fr 420px` cannot collapse
  and will overflow. Use `repeat(auto-fit,minmax(min(100%,320px),1fr))`, which is two
  columns when there is room and one when there is not, with no media query.

## Safe areas

The shell reads the real notch and home-indicator insets through a probe element, because
`env()` cannot be read from JS any other way. Consume them through the shell's custom
properties rather than re-deriving them:

| Property | What it is |
|---|---|
| `--pane-pad` | Full pane padding: `calc(16px + safeT) 16px (chrome + 22px)` under 620px, `30px 40px 142px` above |
| `--chrome-l` / `--chrome-r` | Trigger inset + safe left/right |
| `--player-l` | Where the player bar starts — trigger inset + size + gap |

A fixed overlay owns its own safe area (it sits outside the padded pane). A scrolling pane
inherits `--pane-pad` and must not add its own top padding.

## Breakpoint

**One breakpoint: 620px.** Below it the app is "phone": 56px chrome square, 14px insets,
10px gap, the full-screen player exists, the arc nav uses its tight ARC table. Above it,
88px / 26px / 12px and the desktop pill. Do not invent a second breakpoint — if something
needs one, it is usually a rigid grid that should have been `auto-fit`.

## Touch targets

**44×44px minimum**, always, including on desktop. Where a control cannot be 44px tall in
the layout, grow its vertical padding rather than its font size — the horizontal axis is
the constrained one on a phone, never the vertical. The music tab pills do exactly this:
`--tab-pad` shrinks horizontally under 620px and grows vertically to hold the target.

Icon-only buttons are 40px discs minimum and must name themselves on hover or long press
(`IconAction`) — a bare glyph is a guess until you tap it.

## Type

The mono eyebrow scale (9–12px, tracked 0.14–0.22em) is a brand foundation, not a bug —
it is metadata, never content, and it never carries meaning that is not repeated elsewhere.
**Body text never goes below 12.5px.** Titles hold their size on a phone; it is the
padding and the column count that give way, not the type.

## Gestures

- **Swipe** is used for exactly one thing: the seed deck (left skips, right saves).
- **Edge swipe** closes a sheet on iOS (left <28px, drag 60px right).
- **Long press** is the touch equivalent of hover for icon labels.
- Never build a gesture as the *only* route to an action. Every swipe has a button.
- `overscroll-behavior:none` on the shell, `contain` on scrollers, so a scroll inside a
  sheet never drags the page behind it.

## Scrolling and viewport units

Use `dvh`, never `vh` — mobile browser chrome resizes the viewport and `vh` leaves modals
either clipped or floating. The shell sets `height:100%` with `overflow:hidden` on
`html,body` and scrolls inside `ModulePane`, so the address bar cannot collapse mid-gesture.

## Native capabilities

Every capability needs three designed states: the **primer** (why we're asking, before the
OS prompt), the **granted** path, and the **denied fallback** that still works. See
`guidelines/permissions.card.html`.

| Capability | Used for | Denied fallback |
|---|---|---|
| Notifications | Show reminders, promoter payouts, ticket transfers | In-app notification centre; nothing is lost |
| Location | "Near me" on the map, local radio | Falls back to the home city from Settings |
| Camera | QR check-in at the door | Venue scans the fan's code instead |
| Apple Pay / Google Pay | Checkout | Card entry via Stripe |
| Share sheet | HYPE Links | Clipboard copy with a confirmation |
| Offline storage | Ticket wallet | Online-only; codes re-fetch on connect |

**Ask at the moment of use, never on launch.** The notification primer fires after a first
ticket purchase, not during onboarding.

## Offline

`sw.js` + `offline.html` + `lib/db.js` (IndexedDB). The rule: **a ticket already bought
must open with no network.** Wallet codes are stored locally and rendered from the code
itself (`TicketQR` derives the block, it is not a fetched image). Everything else may
degrade to the offline page.

## PWA

`manifest.webmanifest` at the root: standalone, portrait, `#0b1220` ground, 192/512 icons
plus a maskable variant, and three shortcuts (My tickets, Map, Charts). The head needs
`viewport-fit=cover`, both `theme-color` variants, and the `apple-mobile-web-app-*` trio —
copy the block from `index.html`.

## Store notes

Ticket sales are **physical/event goods**, so Stripe is correct and In-App Purchase does not
apply — this is the single most likely review question. The full submission kit is
`templates/app-store-kit/` with a `kind` tweak: **screenshots** (4 marketing frames),
**copy** (title/subtitle/description/keywords), **review** (reviewer notes, demo account,
verbatim permission strings, privacy labels, age rating). Capacitor config and the native
plumbing live in `templates/mobile-app/`.
