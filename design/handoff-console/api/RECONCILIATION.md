# Backend reconciliation — production vs. the design system's copy

**Read this instead of anything I said earlier about the API.** I first wrote a
"corrected" `openapi.yaml`, `schema.sql` and migration against
`engineering/` in the design system. Then I read the actual repo
(`iHYPE-org/ihype@main`, 2132 files, 130+ Prisma migrations) and found that
**production already has all of it, in better shapes than I proposed.** Those
files are deleted. Following them would have been actively harmful.

The design system's `engineering/openapi.yaml` and `engineering/schema.sql`
are a **stale hand-written sketch**, not the backend. Production runs Prisma
with a real migration history. Treat `engineering/` as documentation debt and
delete or clearly mark it — it is the same failure as the components: a stale
copy that reads as current.

---

## Everything I flagged as blocking is already shipped

### HYPE — already 24h per target, and the implementation is good

`src/lib/hype-window.ts` exists and its header states the rule verbatim:

> HYPE resets every 24 hours, per target. … It is a TIMESTAMP per target, never
> a boolean. The boolean it replaced had no notion of when, so a hype was
> permanent until toggled off — and "hyped" meant "has ever hyped".

It exports `nextHypeAt`, `hypeWaitMs`, `hypeWaitUntil`, `canHype` and
`formatHypeWait`, pure and dependency-free, "so both the API (which enforces
the window) and the button (which states the remaining wait rather than letting
the API reject the tap) compute from the same functions."

**`formatHypeWait()` produces exactly the `hypeLabel` the components want** —
`"17h 40m"`, `"40m"`, `"1m"`, coarse to the minute, and never `"0m"` because
"a control that says zero and refuses the tap reads as broken."

So the wiring is:

```ts
import { nextHypeAt, hypeWaitMs, formatHypeWait, canHype } from '@/lib/hype-window';

const wait = hypeWaitMs(lastHypedAt);
<HypeButton
  active={hyped}
  count={hypeCount}
  disabled={wait > 0}
  disabledReason={formatHypeWait(wait)}
  onToggle={…}
/>
```

Two notes from the source rather than from me:

- The API returns **429** with `nextHypeAt` (not 409 as I proposed). Use
  `hypeWaitUntil(nextAt)` for that shape — it exists precisely because callers
  holding `nextAt` were "reconstructing a timestamp it never had in order to
  derive one it already did."
- `HypeLedgerEntry` gives durable accounting with an `idempotencyKey` unique
  index. My `hypes` + `hype_state` design was reinventing this, worse.

### The DJ role is already gone

`20260806160000_drop_dj_enum_values` dropped it from both enums, with
`DO $$` guards that raise a clear exception rather than letting the type rebuild
fail halfway. The real enums:

```sql
Role        = FAN | ARTIST | VENUE | ADMIN | ADVERTISER
ProfileType = ARTIST | VENUE | LISTENER
```

**I had this wrong twice.** `ADMIN` is a real role I omitted, and `ProfileType`
is a separate axis from `Role` with `LISTENER` rather than `FAN`. Advertiser
landed earlier, in `20260719120000_add_advertiser_role_and_account`.

The migration file is worth reading for its own sake — it documents why an enum
rewrite is gated behind verified row counts, and that a failed migration leaves
a `finished_at IS NULL` row in `_prisma_migrations` that makes every subsequent
deploy fail with P3009.

### Processing fee — already per-order

`20260812190000_add_order_processing_fee` added
`TicketOrder.processingFeeCents`, with the reasoning I would have written:

> iHYPE is a nonprofit and absorbs no fee of any kind: the charter's 70/20/10
> splits FACE VALUE, the platform takes $0 … existing rows read 0, which is
> exactly right — they were charged before the fee existed, and backfilling a
> computed figure would be inventing a charge nobody paid.

### Payouts — far more built than my `payouts` table

`src/lib/show-payouts.ts` runs real per-entry Stripe Connect transfers over
`AccountsPayableEntry`, with categories `VENUE_PAYOUT`, `ARTIST_PAYOUT`,
`PROMOTER_AFFILIATE` and `TAX_LOCAL/STATE/COUNTRY/INTERNATIONAL`. Tax entries
deliberately have no `profileId` and stay `PENDING` for manual remittance.
Status is `PENDING → RELEASED` with `paidAt` and `stripeTransferId`, and the
split rows are computed **at order-capture time**, not at settlement.

My proposed table had none of the tax categories and would have been a
regression.

---

## Where I was actually wrong about the design

### The ticket QR encodes a URL, not an opaque credential

I said "`serialized_id` and `code` must be different values — put the
credential in the URL and every screenshotted ticket is a working ticket."

**That advice does not apply here.** `src/lib/tickets.ts`:

```ts
export function buildTicketVerificationUrl(serializedId: string) {
  return `${getAppUrl()}/tickets/${serializedId}`;
}
// QR is that URL, encoded with uqr, ECC 'M', 2-module quiet zone
```

The QR **is** the verification URL containing the serialized id. Validation
happens server-side at that route, against `TicketStatus` and the scan count —
so possession of the id is not possession of entry. That is a legitimate design
and it is simpler than what I proposed.

Consequence for the component library: `TicketQR` should be passed the
**verification URL**, not a bare code — and it currently draws a *decorative*
deterministic matrix, not a real encoding. For production, replace its matrix
with `uqr`'s `renderSVG` output (already a dependency, Workers-compatible) or
render the server-built data URL. Keep the component's brass-plate framing; swap
the payload.

```
serialized id = createHexId(12)      // src/lib/tickets.ts
status        = VALID | SCANNED | VOID  (formatTicketStatus)
```

### The naming boundary section in BACKEND.md was wrong

I wrote that the API is snake_case and a hydrate layer maps to camelCase. **It
is not.** Production is Prisma + Next.js: models are PascalCase, fields are
camelCase (`processingFeeCents`, `stripeConnectAccountId`, `lastHypedAt`),
enums are SCREAMING_SNAKE. The components' camelCase props line up with the
database directly, and **no hydrate/rename layer is needed** — which is a real
simplification, not a gap.

Enum values are the one place a map is needed, and only for display:

```ts
// StatusPill tone ← Prisma enum
const TONE = { VALID: 'ok', PENDING: 'pending', SCANNED: 'neutral',
               VOID: 'warn', RELEASED: 'ok', FAILED: 'warn' } as const;
```

---

## What is genuinely still missing

Almost nothing on the endpoint list I gave you. Production has
`/api/booking-requests`, `/api/shows/[showId]/cancel`,
`/api/shows/[showId]/lineup` (+ `/respond`), `/api/advertise/register`,
`/api/advertise/campaigns`, `/api/support`, `/api/map/{artists,venues,events}`,
`/api/tickets/[serializedId]/{transfer,scan,qr,reassign,list-resale}`,
`/api/stripe/connect/*`, `/api/stripe/webhook`, and 20+ cron routes.

Two real gaps, both small:

1. **No single map-pins endpoint.** There are three — `/api/map/artists`,
   `/api/map/venues`, `/api/map/events`. `MapSheet` takes one `target`, so
   either add a merged `/api/map/pins` or have the client fan out and normalise.
   The fan-out is three round-trips for one pan; the merged route is better.
2. **No `/api/me/payouts` read route.** `show-payouts.ts` writes
   `AccountsPayableEntry` and the design system claims `/me/payouts` is a live
   page, but there is no API route for it in the tree. Worth confirming whether
   the page reads the DB directly via a server component — in which case there
   is nothing to add.

## Corrected order

1. **Delete or mark `engineering/openapi.yaml` and `engineering/schema.sql`
   in the design system.** They describe a backend that does not exist and they
   fooled me for two rounds.
2. Wire `hype-window.ts` into the four HYPE components. Nothing to build.
3. Swap `TicketQR`'s decorative matrix for a real `uqr` encoding of the
   verification URL.
4. Add the enum→tone display map.
5. Decide on merged map pins.

There is no schema work. The backend was not the problem — it is the most
finished part of the system, and the design system's copy of it was lying.
