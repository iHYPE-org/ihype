> **SUPERSEDED IN PART — read `api/RECONCILIATION.md` first.**
>
> Sections 1 and 4 of this document are WRONG. They were written against the
> design system's `engineering/` sketch, before I read the real repo.
> Production already implements the 24h HYPE window (`src/lib/hype-window.ts`),
> already dropped the DJ role, already has per-order processing fees and a full
> Stripe Connect payout ledger. And the API is camelCase Prisma, not snake_case
> — §4's hydrate layer is unnecessary.
>
> Sections 5, 6, 7 and 8 (the component data contract, state matrix, write
> paths and the guarantees) stand.

# Backend implementation guide

Grounded in `engineering/openapi.yaml` (v0.1.0-beta) and the design system's
PRODUCT SYNC. Read §1 before writing any endpoint code — three items there are
blocking, and two of them mean the current API contract cannot drive the
shipped UI.

---

## 1. The API contract has drifted from the product

Same failure as the components: the spec is a generation behind the facts. Each
of these is a decision that has to be made before wiring, not during.

### 1a. HYPE — the spec says weekly budget, the product says 24h per target

**BLOCKING.** These cannot both be true.

```yaml
# openapi.yaml, as written
/hype:      429 "Weekly budget exhausted"   →  { hypes_left: integer }
/hype/budget: GET                            →  { left, resets_at }
```

The product sync is explicit and much more specific:

> **HYPE resets every 24 hours, per target.** A member can keep hyping an artist
> they keep coming back to, but only once a day. Implemented as a timestamp per
> target (never a boolean), so the wait can be stated — the control shows the
> time remaining ("17h 40m") and refuses the tap rather than letting the API
> reject it. Coarse to the minute on purpose.

Four components take `hypeLocked` and `hypeLabel` props — `HypeButton`,
`PlayerPill`, `SeedDeck`, `FullPlayer`. **The current API cannot supply either
one.** A global `hypes_left` counter tells you nothing about whether *this
artist* is on cooldown or when it lifts.

What the UI actually needs:

```
GET /hype/state?target_type=artist&target_id=abc
  → { hyped: boolean, next_at: string|null }     # ISO 8601, null = hypeable now

POST /hype
  → 200 { hyped: true, next_at: "2026-08-23T14:40:00Z" }
  → 409 { next_at: "..." }   # NOT 429 — this is a per-target conflict,
                             # not a rate limit on the caller
```

And feed responses should inline it, so a deck of 20 seeds is one request rather
than 21: every artist/track/show object carries `hype: { hyped, next_at }`.

The client derives `hypeLabel` from `next_at` — **coarse to the minute, never
seconds.** The design system says why: "a second-by-second countdown turns a
fairness rule into a game to be timed."

### 1b. The `dj` role is still in the enums, and `advertiser` is missing

**BLOCKING for auth and profiles.** DJ was deleted 2026-08-06. The account types
are Fan, Artist, Venue, Advertiser.

```yaml
# Wrong, in three places:
/waitlist         role: enum [fan, artist, dj, venue]
User.roles        items: enum [fan, artist, dj, venue]
/ops/invite-codes role: enum [fan, artist, dj, venue, any]

# Should be:
                  enum [fan, artist, venue, advertiser]
```

Related: **do not add a `promoter` role.** The 10% promoter slice is money, not
an account type — every account promotes through its HYPE Link. `/referrals`
and `/me/referrals` are the right shape already; they need no role behind them.

### 1c. Tickets have no serialized id in the spec

The product has a real route at `/app/me/tickets/[serializedId]`, and
`TicketQR` takes a `code` it renders deterministically. But `/me/tickets` is
documented only as "Wallet (QR tokens)" with no schema.

```
Ticket needs, minimum:
  serialized_id   string   # the human-quotable id, and the URL segment
  code            string   # the signed wallet payload the scanner reads
  status          enum [valid, transferred, scanned, refunded, void]
  scans           integer
  holder_id       string
  order_id        string
```

`serialized_id` and `code` must be **different values**. The id goes in URLs and
support conversations; the code is a credential. Putting the credential in the
URL means every ticket ever screenshotted is a working ticket.

---

## 2. Endpoints the design needs that do not exist

Templates exist for all of these; the API has nothing behind them.

| Surface | Needs |
|---|---|
| Payout settings / history | `GET/PUT /me/payout-settings`, `GET /me/payouts`. The readme says both are real live pages — they are absent from the spec. |
| Profile pages | `GET /artists/{slug}`, `GET /venues/{slug}`, `GET /promoters/{slug}`. Fixed per-type schema; no generation. |
| Booking inbox | `GET /me/booking-requests`, `POST /booking-requests/{id}/{accept\|decline}` |
| Event cancellation | `POST /events/{id}/cancel` with a refund preview: `GET /events/{id}/cancel-preview` |
| Lineup & split | `GET/PUT /events/{id}/lineup`, `POST /events/{id}/lineup/sign` |
| Advertiser signup | `POST /advertisers` (music-industry gate), `GET /me/campaigns` |
| Support tickets | `GET/POST /me/support-tickets` |
| Map pins | `GET /map/pins?bbox=…` — `MapSheet` needs venue-at-address vs artist-at-city-centroid distinguished, per the shell's map notes. |

## 3. Endpoints that may be dead

`/library`, `/crate`, `/crate/{trackId}`, `/sfx`, `/radio-shows`,
`/radio-shows/{id}/publish` are all `tags: [studio]`. **`/studio` is a retired
route** — it redirects to `/listen`, and the Workbench concept is gone. Confirm
whether the crate/radio feature survived the retirement before building against
these. If it did, they need a home that is not `/studio`.

---

## 4. The naming boundary — where snake_case stops

The API is snake_case. **Every component prop in this library is camelCase**,
and none of them should ever see a raw API object.

```
API (snake_case)  →  hydrate layer  →  component props (camelCase)
price_cents           /lib/hydrate.js      priceCents
display_name                               displayName
starts_at                                  startsAt
target_type                                targetType
next_at                                    hypeLocked + hypeLabel
```

Keep the mapping in one file. Two rules that pay for themselves:

- **Money stays in cents, as an integer, until the moment it is rendered.**
  `price_cents: 1800` → `"$18"` at the leaf. Never a float anywhere.
- **Times stay ISO 8601 UTC until rendered.** The 24h HYPE label, doors time,
  set times — all formatted at the leaf in the member's timezone.

## 5. Component data contract

What each component needs from the server. Props are the existing declared
signatures — see `_adherence.oxlintrc.json`.

| Component | Prop | Source |
|---|---|---|
| `PlayerPill` / `FullPlayer` | `track.{title,artist,album,initial,seconds}` | `/feed/listen` item, or the now-playing record |
| | `progress`, `volume` | client-only; never persisted server-side |
| | `hyped`, `hypeLocked`, `hypeLabel` | `hype.{hyped,next_at}` on the track's artist |
| | `queue`, `history` | client session state |
| | `canHype` | resolved upstream: false when no linked profile, not discoverable, or your own |
| | `canTogglePlay` | false until an audio source is attached |
| `SeedDeck` | `items[].{artist,song,album,initial,c1,c2,why}` | `GET /seeds`. `c1`/`c2` are the artist's own palette — **never a stock image** |
| | `savedCount` | `/me` playlist count |
| `HypeButton` | `count`, `trend` | target's hype total + rate |
| | `disabled`, `disabledReason` | derived from `next_at` |
| | `roleColor` | the target's account type |
| `MapSheet` | `target.{title,kind,meta,body,rows,lines,action}` | `GET /map/pins` detail |
| | `target.action.href` | **the one outbound link, and only a domain the account owns** |
| `TicketQR` | `code` | the signed wallet payload, not the serialized id |
| `StatCard` | `value`, `label`, `delta` | per-surface analytics |
| `StatusPill` | `tone` | map server status → `ok\|pending\|warn\|neutral` in the hydrate layer, not in the view |
| `Tabs` | `tabs` | **fixed client-side.** MUSIC is Discover · Radio · Charts · Recommended · Playlists. Never server-driven — a nav that can change shape cannot be designed. |
| `Toast` | `variant` | map error classes → `success\|warn\|error\|info` |

## 6. State matrix

Every surface has four states. The design has components for all of them, and
backends surface all of them, so decide per screen up front rather than
discovering the empty case in production.

| State | Component | Rule |
|---|---|---|
| Loading | `Skeleton` / `SkeletonText` | Only on first load. A refetch keeps stale data visible — flashing a skeleton over content you already have reads as a fault. |
| Empty | `EmptyState` | Honest copy, never fake rows. "No tickets yet · Shows you buy will land here." |
| Error | `Toast` variant `error` | Says what failed and what to do. Never "Something went wrong." |
| Partial | render what arrived | A missing avatar is not a failed screen. |

Two cases with specific answers already in the design:

- **HYPE refused.** Never surfaces as an error. The control is already locked
  client-side from `next_at` and states the wait. If a 409 still arrives, trust
  the server's `next_at` and re-lock silently — no toast.
- **Payment declined (`402`).** Toast `error`, keep the checkout state intact,
  do not clear the form. The only charge above face value is Stripe's fee at
  cost — if a decline message ever implies an iHYPE fee, that is a copy bug with
  legal weight.

## 7. Write paths

Five mutations. Each needs an explicit optimistic-UI decision.

| Action | Endpoint | Optimistic? | On failure |
|---|---|---|---|
| Hype | `POST /hype` | **Yes** — flip instantly, it is the signature interaction | Revert count, adopt server `next_at` |
| Save to playlist | `POST /crate` (or successor) | Yes | Revert the heart, toast `warn` |
| Buy ticket | `POST /tickets` | **No** — never optimistic on money | Stay on checkout, toast `error` |
| Transfer ticket | (needs endpoint) | No | Ticket stays in wallet |
| Publish event | `POST /events/{id}/publish` | No — **freezes the charter split** | Stay in review step |

`POST /tickets` takes `referral_code`. It must be **attributed from the HYPE
Link that brought the buyer in**, carried through the whole session, not read at
the last step. That 10% is real money to a real person.

## 8. Things the UI guarantees, so the API must too

Getting these wrong is worse than a bug — they are financial and legal claims
the interface makes on your behalf.

- **70/20/10, 0% iHYPE.** Frozen at publish (`Event.split`), calculated per
  event at settlement. The UI shows the split on every purchase; the number it
  shows must be the frozen one, not recomputed at read time.
- **Stripe's fee is the only charge above face value** — 2.9% + $0.30, AMEX
  3.5% + $0.30, passed through at cost. Return it as its own line, never folded
  into a total.
- **One outbound link per profile, on a domain the account owns.** Validate
  server-side. No streaming, social or link-in-bio hosts.
- **Audio only.** No video field, ever.
- **k≥5 on cohort queries.** The privacy copy states it; the query layer has to
  enforce it.

---

## Suggested order

1. Resolve §1a, §1b, §1c — three decisions, no code.
2. Fix the enums and the HYPE endpoints. Everything else depends on them.
3. Add `hype: { hyped, next_at }` to every feed item. This alone unblocks four
   components.
4. Ticket schema, then the wallet and the serialized-id route.
5. Payouts, then profiles, then the rest of §2 by traffic.
