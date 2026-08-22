# iHYPE on mobile

iHYPE is a phone product that also runs on a desktop, not the other way round. There is
**no separate mobile build** — `templates/simplified-app/` IS the app; Capacitor wraps that
exact page in a WKWebView and an Android WebView, and the browser serves it as an
installable PWA. Anything you build here has to hold at **375px** (iPhone SE) before it is
allowed to be good at 1440.

## The floor: 375px

375 is the narrowest width we support, and it is the width to design at first. After the
24px pane padding on each side you have **327px of content**.

- Never write a fixed `width:` over 320px on a content element. Decorative
  absolutely-positioned glows are exempt — they sit under `overflow:hidden`.
- Never write a rigid multi-column grid. `grid-template-columns:1fr 420px` cannot collapse
  and will overflow. Use `repeat(auto-fit,minmax(min(100%,320px),1fr))`.

## Safe areas

Consume through the shell's custom properties rather than re-deriving them:

| Property | What it is |
|---|---|
| `--pane-pad` | Full pane padding: `calc(16px + safeT) 16px (chrome + 22px)` under 620px, `30px 40px 142px` above |
| `--chrome-l` / `--chrome-r` | Trigger inset + safe left/right |
| `--player-l` | Where the player bar starts — trigger inset + size + gap |

A fixed overlay owns its own safe area. A scrolling pane inherits `--pane-pad` and must not
add its own top padding.

## Breakpoint

**One breakpoint: 620px.** Below it: 56px chrome square, 14px insets, 10px gap, full-screen
player, tight ARC table. Above it: 88px / 26px / 12px and the desktop dock.

## Touch targets

**44×44px minimum**, always, including on desktop. Grow vertical padding, not font size,
when a control can't be 44px tall. Icon-only buttons are 40px discs minimum and must name
themselves on hover or long press (`IconAction`).

## Type

Mono eyebrow scale (11–13px on this system's raised floor, tracked 0.14–0.22em) is metadata,
never content. **Body text never goes below the 15px content floor.**

## Gestures

- **Swipe**: one thing only — the seed deck (left skips, right saves).
- **Edge swipe** closes a sheet on iOS (left <28px, drag 60px right).
- **Long press** is the touch equivalent of hover for icon labels.
- Never build a gesture as the only route to an action — every swipe has a button.
- `overscroll-behavior:none` on the shell, `contain` on scrollers.

## Scrolling and viewport units

Use `dvh`, never `vh`.

## Native capabilities

Three designed states per capability: **primer** (ours, before the OS prompt), **granted**,
**denied fallback** that still works.

| Capability | Used for | Denied fallback |
|---|---|---|
| Notifications | Reminders, promoter payouts, ticket transfers | In-app notification centre |
| Location | "Near me" on the map, local radio | Home city from Settings |
| Camera | QR check-in at the door | Venue scans the fan's code |
| Apple Pay / Google Pay | Checkout | Card entry via Stripe |
| Share sheet | HYPE Links | Clipboard copy with confirmation |
| Offline storage | Ticket wallet | Online-only; codes re-fetch on connect |

**Ask at the moment of use, never on launch.**

## Offline

A ticket already bought must open with no network. Wallet codes render from the code itself
(`TicketQR` derives the block, not a fetched image).

## PWA

Standalone, portrait, `--bg-base` ground, 192/512 icons plus maskable, three shortcuts
(My tickets, Map, Charts). `viewport-fit=cover`, both `theme-color` variants.

## Store notes

Ticket sales are physical/event goods — Stripe is correct, In-App Purchase does not apply.
