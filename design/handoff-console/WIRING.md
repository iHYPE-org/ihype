# WIRING.md — each screen's real data contract (read from src/app, 2026-08-24)

Grounded in the actual page.tsx files, not the API docs. Where production has
already translated a reference screen, that is noted — do not re-do those.

## Already wired in production (verified by reading the source)

- **S6 Artist profile** — `/app/artists/[slug]` IS the reference translation
  (its comments cite `reference/s6-profile-artist.html`). Real `HypeButton`
  (cooldown + optimistic count), `FollowButton`, `ARTIST_TABS` (6 tabs:
  albums/tour/bio/merch/contact/press), `MmmPlayHere` feeds the dock's
  joystick with the artist's published releases. Its three deviations are
  correct and documented in-file: no per-page dock (shell owns it), no 430px
  card frame (pane owns width), 6 tabs not 3 (content preservation).
  **Adopt this file as the model for every remaining screen translation.**
- **S8 Payouts** — `/app/me/payouts` is a real tabbed hub citing
  `Payouts.dc.html`: tabs History / Settings / This show (`?tab=`), data =
  `AccountsPayableEntry` RELEASED + PENDING (take 100, include show
  title/slug), creator's shows (take 50), Stripe Connect per profile
  (`stripeConnectAccountId`, `stripeConnectOnboarded`), gated on
  ARTIST|VENUE profiles.

## To wire (contract per screen)

### MAP — /app/map
`page.tsx` returns **null**; the map is the LAYOUT's base layer so it stays
mounted across module changes. The treasure skin (reference/map-treasure.html)
therefore lands in the layout's map component, not this route.

### MUSIC — /app/music/[tab]
Query params: `genre`, `city`, `q`, `focus` (focus=search comes from the
player pill's search control). Tab allowlist = `MMM_MUSIC_TABS` from
`src/lib/mmm-nav.ts`; unknown tab renders `MmmMissing`, never falls back.
The dock's thumbwheel must navigate within this allowlist — same source of
truth as `SECTIONS` in ConsoleDock.tsx.

### ME — /app/me
Server-gated (`auth()` → redirect /login?callbackUrl=). Data =
`loadMmmMe(userId, role?, isAdmin)` from `src/lib/mmm-me`; `?role=` switches
the account lens; admin sessions add the Admin console row (screenshot 3
shows it — keep it).

### S1 Sign in — /login
Mounts `LoginScreen` with `initialIdentifier` and `justRegistered`
(`?registered=1` after signup). The console skin goes into
`components/AuthScreens.tsx`, not the route.

### S5 Ticket — /app/me/tickets/[serializedId]
The design shows 6 stats; production renders **11** — carry all of them:
holder, order code, artist, per-ticket value, order status, scan time,
passed on (reassignCount, accent when > 0), venue ZIP, total tax,
processing fee (Stripe, per ORDER not per ticket — the comment explains the
arithmetic must close), total charge. Plus: QR from
`buildTicketQrCodeDataUrl(serializedId)` (encodes the verification URL),
status pill (`formatTicketStatus`), venue-only reassignment form
(`canManageOwnedResource` gate), links to venue + show. Extend the S5
reference with the 5 missing stats rather than dropping them.

### S4 Checkout / S7 Event create / S9 Show detail
Not re-read this pass (58KB/29KB files). Their contracts are in NAV_MAP.md;
translate the same way S6 was — keep every hook, replace the return.

## The one recurring rule

Every route re-checks auth server-side even though the layout gates it —
keep that in every translation. And `notFound()` is returned as
`<MmmMissing>`, never thrown (async layout has flushed).
