# iHYPE — Backend Data Model & API Surface

> Engineering handoff spec. Maps the front-end prototype (`ui_kits/fan-app/`) to a real backend.
> **Status:** payments/payouts blocked on nonprofit status → banking. Everything else can start now.
> Version: 0.1.0-beta · Jun 2026

---

## 0. Roles & the money mechanic

Four user types. A single account can hold **multiple roles**.

| Role | Core ability |
|------|-------------|
| **Fan** | Listen, hype, buy tickets, attend |
| **Artist** | Upload tracks, host live shows, sell tickets (receives 70% gate) |
| **DJ** | Build radio shows from free-use library + voice + SFX; can promote |
| **Venue** | List events, manage door, receive gate split |

**Promoter mechanic (not a 5th role — it's a capability of DJs *and* Fans):**
A promoter shares a **referral link** for an event. When a buyer purchases through that link, the promoter earns **up to 10% of that ticket's price**, scaled by how much of the *total gate* they drove:

```
promoter_share_pct = min(0.10, 0.10 × (referred_gross_by_promoter / event_total_gross))
```

So a promoter who drove 100% of sales gets the full 10%; one who drove a sliver gets proportionally less. Cut comes out of the **platform/operator slice**, never the artist's 70%.

**Gate split (locked per-event in the "charter" at publish time):**
- Artist: 70%
- Venue: configurable (default 20%)
- Platform/operator: 0% — iHYPE takes nothing; card-processing fees (Stripe 2.9% + $0.30; AMEX 3.5% + $0.30) are charged to the buyer above face value, passed through at cost
- Promoter pool: up to 10%, its own dedicated 10% slice

> ⚠️ Splits are **immutable once an event publishes** ("locked in charter"). Store the split snapshot on the event row, not by reference.

---

## 1. Data model

### users
| field | type | notes |
|-------|------|-------|
| id | uuid pk | |
| handle | citext unique | `@nyla` |
| display_name | text | |
| email | citext unique | magic-link auth |
| phone | text null | SMS receipts |
| avatar_url | text | |
| city | text | drives "Local" feed |
| genres | text[] | taste prefs from onboarding |
| roles | role[] | `{fan,artist,dj,venue}` — multi |
| verified | bool | the ✓ badge; operator-approved |
| created_at | timestamptz | |

### artists *(profile extension; 1:1 with a user holding `artist` role)*
| field | type | notes |
|-------|------|-------|
| user_id | uuid fk → users | |
| bio | text | |
| hype_total | bigint | denormalized counter, see §3 |
| monthly_listeners | int | |
| payout_account_id | uuid null fk → payout_accounts | **null until banking live** |

### tracks
| field | type | notes |
|-------|------|-------|
| id | uuid pk | |
| artist_id | uuid fk | |
| title | text | |
| audio_url | text | |
| artwork_url | text | |
| license | enum | `all_rights` \| `free_use_limited` |
| free_use | bool | DJs may only crate tracks where `license='free_use_limited'` |
| duration_s | int | |

### events
| field | type | notes |
|-------|------|-------|
| id | uuid pk | |
| artist_id | uuid fk | headliner |
| venue_id | uuid fk null | null = livestream-only |
| title | text | |
| starts_at | timestamptz | |
| city | text | |
| capacity | int | drives sold-out/waitlist |
| price_cents | int | |
| status | enum | `draft\|published\|live\|ended\|cancelled` |
| **split** | jsonb | **frozen charter snapshot** `{artist:0.70, venue:0.20, platform:0, promoter_max:0.10}` |
| total_gross_cents | bigint | denormalized; source of promoter math |

### tickets
| field | type | notes |
|-------|------|-------|
| id | uuid pk | |
| event_id | uuid fk | |
| buyer_id | uuid fk → users | |
| referral_code | text null | → promoter attribution |
| price_cents | int | snapshot at purchase |
| status | enum | `valid\|used\|refunded\|waitlist` |
| qr_token | text | signed, rotated; QR wallet |
| created_at | timestamptz | |

### referrals
| field | type | notes |
|-------|------|-------|
| code | text pk | shareable, e.g. `nyla-fri-x7k2` |
| event_id | uuid fk | |
| promoter_id | uuid fk → users | DJ or Fan |
| gross_driven_cents | bigint | sum of tickets bought via this code |
| earned_cents | bigint | computed at settlement (§4) |
| status | enum | `accruing\|locked\|paid` |

### radio_shows *(DJ output)*
| field | type | notes |
|-------|------|-------|
| id | uuid pk | |
| dj_id | uuid fk | |
| title | text | |
| segments | jsonb | ordered: `[{type:'track',track_id}, {type:'voice',clip_url}, {type:'sfx',sfx_id}]` |
| duration_s | int | |
| status | enum | `draft\|published` |

### crate_items *(DJ's working set)*
`(dj_id, track_id)` — join table; only `free_use=true` tracks allowed (enforce in API + DB check).

### sfx_library
Preloaded royalty-free SFX. `{id, name, url, license_source, duration_s}`. Static seed data — no user uploads.

### hypes (event-sourced — see §3)
`{id, user_id, target_type:'artist'|'track'|'show', target_id, week, created_at}`

### payout_accounts ⛔ *banking-gated*
| field | type | notes |
|-------|------|-------|
| id | uuid pk | |
| user_id | uuid fk | |
| provider | enum | `stripe_connect` (recommended for nonprofit splits) |
| external_id | text | Stripe acct id |
| status | enum | `pending\|verified\|restricted` |

---

## 2. API surface

REST, JSON, bearer-token (magic-link → JWT). All `/v1`.

### Auth
```
POST /v1/auth/magic-link      { email }            → 204 (sends link)
POST /v1/auth/verify          { token }            → { jwt, user }
POST /v1/auth/beta-redeem     { code }             → 204 | 403   (invite gate)
```

### Feed / discovery
```
GET  /v1/feed/listen          ?city&genres         → tracks + artists (taste-filtered)
GET  /v1/feed/events          ?city&scope=local|foryou
GET  /v1/search               ?q                    → {artists,events,tracks,venues}
GET  /v1/charts/hype          ?window=week          → ranked artists
GET  /v1/seeds                ?city                 → swipe-deck candidates
```

### Hype
```
POST /v1/hype                 { target_type, target_id }   → { hypes_left }
GET  /v1/hype/budget                                       → { left, resets_at }  (weekly cap)
```

### Events & ticketing
```
GET  /v1/events/:id
POST /v1/events               (artist)  { ...charter }     → freezes split
POST /v1/events/:id/publish   (artist)                     → status=published, split locked
GET  /v1/events/:id/tickets/availability                   → { remaining, waitlist }
POST /v1/tickets              { event_id, referral_code? } → ⛔ payment intent (banking-gated)
GET  /v1/me/tickets                                        → wallet (QR tokens)
```

### Referrals / promoter
```
POST /v1/referrals            { event_id }          → { code, share_url }
GET  /v1/me/referrals                               → accruing/locked/paid + earnings
GET  /v1/referrals/:code/preview                    → public landing (event + promoter)
```

### DJ radio studio
```
GET  /v1/library             ?free_use=true         → crateable tracks
POST /v1/crate               { track_id }            → 201 | 422 (rejects non-free-use)
DELETE /v1/crate/:track_id
GET  /v1/sfx                                          → royalty-free SFX seed
POST /v1/radio-shows          { title, segments }    → draft
POST /v1/radio-shows/:id/publish
```
> Voice clips upload to object storage (presigned PUT), URL stored in the segment.

### Live shows
```
POST /v1/events/:id/go-live   (artist)               → status=live
WS   /v1/live/:event_id                                → listener count, chat, hype pulse
POST /v1/live/:event_id/chat  { text }                → moderated
```

### Payouts ⛔ *banking-gated*
```
POST /v1/payout-accounts/onboard                      → Stripe Connect onboarding URL
GET  /v1/me/balance                                   → { available, pending }
POST /v1/payouts             { amount_cents }         → payout request
```

### Ops / moderation
```
POST /v1/ops/verify          (operator) { user_id }   → grants ✓
POST /v1/reports             { target_type, target_id, reason }
GET  /v1/ops/reports         (operator)
POST /v1/ops/users/:id/role  (operator) { role }
```

### Telemetry
```
POST /v1/events/track        { event, props }         → 204   (replaces the localStorage track() stub)
```

---

## 3. Hype counters (scale note)
Hype is high-write. Don't `UPDATE artists SET hype_total = hype_total+1` under load.
- Append to `hypes` (event log) for audit + the weekly leaderboard.
- Keep `hype_total` as a **periodically-reconciled** denormalized counter (Redis `INCR` → flush to PG every N sec).
- Weekly budget cap (`GET /hype/budget`) enforced in Redis with a per-user weekly key.

---

## 4. Settlement job (the money loop) ⛔ *banking-gated*
Runs when an event hits `ended`:
1. Freeze `event.total_gross_cents`.
2. For each referral: `earned = ticket_gross_via_code × min(0.10, 0.10 × gross_driven/total_gross)`. Set `status=locked`.
3. Compute artist 70%, venue 20%; promoter earnings come from the dedicated 10% pool. Unclaimed promoter pool rolls to the artist.
4. Create ledger entries → Stripe Connect transfers once accounts are `verified`.
5. Flip referral + payout rows to `paid` on transfer success.

Keep a double-entry **ledger** table (`debit_account, credit_account, amount, event_id, idempotency_key`). Never compute balances on the fly from tickets.

---

## 4b. Settlement edge cases

### Cancellations
When an event is cancelled after tickets have sold:
1. Set `event.status = 'cancelled'`.
2. Issue full refunds via Stripe reverse-transfer to all buyers.
3. **Do not run the promoter settlement job.** All referral rows → `status = 'cancelled'`; `earned_cents` stays 0.
4. Platform absorbs Stripe processing fees on cancelled events (operator decision — document in ToS).

### Partial refunds
Not supported in beta. A ticket is either `valid`, `used`, or `refunded` (full). No partial. Revisit post-MVP.

### Chargebacks
1. Stripe notifies via webhook `charge.dispute.created`.
2. Reverse the ledger entry: `debit platform, credit chargeback_reserve`.
3. If dispute loses: deduct from artist's `pending` balance proportionally to their split.
4. Cap artist chargeback exposure at their 70% of the disputed ticket — the remainder is absorbed proportionally by the venue and promoter slices.
5. Flag buyer `users.chargeback_count++`; at 3 → suspend account pending review.

### Waitlist → ticket upgrade
When a `waitlist` ticket converts to `valid` (e.g. cancellation opens a spot):
1. Charge the buyer (or authorize held card) at the **original charter price** — price cannot change after publish.
2. Attribute to whichever referral code the buyer used at waitlist-join time (stored on the ticket row).
3. Recalculate promoter shares only after settlement job runs at show-end.

### Referral timing — canonical answer
`event.total_gross_cents` is **snapshotted at door-close** (when `status → ended`), not at real-time during sales.

Rationale: a promoter who drives 100% of early sales would earn less if later organic sales diluted their share mid-event. Snapshotting at close gives a fair, predictable payout based on final totals.

```
settlement trigger: event.status = 'ended' AND event.starts_at < now()
snapshot:           event.total_gross_cents = SUM(tickets.price_cents WHERE event_id = X AND status IN ('valid','used'))
promoter share:     min(0.10, 0.10 × referral.gross_driven_cents / event.total_gross_cents)
```

If `total_gross_cents = 0` (free event): skip settlement; no promoter payout.

## 5. What's blocked on nonprofit status → banking

| Can build NOW | Blocked until EIN + bank/Stripe |
|---------------|--------------------------------|
| Auth, beta gate, users, roles | `payout_accounts`, Stripe Connect onboarding |
| Feed, search, charts, seeds | `POST /tickets` real charge (use **$0 / test mode** now) |
| Hype + budgets | Settlement job transfers |
| Events, charter/split snapshot | Promoter payout (math can run; transfer can't) |
| Tickets as **records** (free/test) | `POST /payouts` |
| DJ library, crate, radio studio | — |
| Live shows + chat + moderation | — |
| Reports / ops / verify | — |
| Telemetry endpoint | — |

**Unblock checklist once nonprofit lands:**
1. EIN → Stripe Connect (nonprofit/platform account; ask Stripe about reduced nonprofit pricing).
2. Set up Connect **Express** sub-accounts for artists/venues/DJs (handles their KYC).
3. Flip `POST /tickets` from test → live payment intents.
4. Enable the settlement job's transfer step.
5. Money-transmitter review — since you hold funds briefly and split them, confirm whether Connect's liability model covers you or you need an MTL. **Get legal eyes on this before live charges.**

---

## 6. Recommended stack (nonprofit-friendly)
- **Postgres** (Supabase or RDS) — relational integrity for the ledger is non-negotiable.
- **Redis** — hype counters, budgets, live presence.
- **Stripe (direct)** — Zeffy retired. Processing fee 2.9% + $0.30/txn (AMEX 3.5% + $0.30) charged to buyer above face value at cost; the 70/20/10 split applies to face value.
- **Object storage** (S3/R2) — audio, voice clips, artwork.
- **WebSocket** layer (Ably/Pusher or self-hosted) — live shows.
- Start test-mode end-to-end; the *only* thing the EIN unblocks is real money movement.
