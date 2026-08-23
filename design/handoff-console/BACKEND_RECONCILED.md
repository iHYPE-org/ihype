# Backend reconciled against the real source

Read `src/app/api/hype/route.ts` (16.5KB) and the route tree at
`iHYPE-org/ihype@21d46ffb9ac3`, 2026-08-23.

**Supersedes `api/openapi.yaml` and `api/schema.sql` in this package.** Both
were written against `engineering/openapi.yaml`, which is stale. Do not apply
them. Keep them only as a record of what I got wrong.

---

## The correction I was most confident about was already built

I said: *"HYPE is specified wrong — the spec has a global weekly budget. Four
components take `hypeLocked` and `hypeLabel`, and the current API can supply
neither."*

The stale spec did say that. **The running code does not.** `/api/hype` imports

```ts
import { formatHypeWait, hypeWaitMs, nextHypeAt } from '@/lib/hype-window';
```

…and both branches — show and profile — gate on it:

```ts
const showWait = hypeWaitMs(existing?.createdAt);
if (showWait > 0) {
  return NextResponse.json({
    error: `You already hyped this show. You can hype it again in ${formatHypeWait(showWait)}.`,
    code: 'HYPE_WINDOW_OPEN',
    nextHypeAt: nextHypeAt(existing?.createdAt)?.toISOString(),
    retryAfterMs: showWait,
  }, { status: 429, headers: { 'Retry-After': String(Math.ceil(showWait / 1000)) } });
}
```

Per target, from a timestamp, with the remaining wait pre-formatted for the
button, and `nextHypeAt` returned on **success** too so the client can arm the
countdown without a second call. That is the rule as designed, implemented, in
production. There was nothing to respecify.

The code comment even reasons through the consequence I never got to:

> `hypeCount` is a running total and stopped being a headcount the day HYPE
> started resetting every 24h — one member hyping daily used to be
> indistinguishable from a hundred members hyping once.

Rank now comes from the believer rows, unique on `user+profile`. That is a
second-order correctness bug someone found and fixed after shipping the window.

## Where production chose better than my proposal

I proposed `409 Conflict`, arguing a per-target cooldown is a conflict rather
than a rate limit. Production returns **`429` with a real `Retry-After`
header**, and that is the better call: `Retry-After` is the standard mechanism
for *"wait this long,"* it is machine-readable, and proxies and clients already
understand it. A 409 carries no wait. Adopt production's.

## The `hypeBalance` I dismissed

I treated the weekly budget as pure drift. It isn't — there is a **ledger**:

```ts
import { applyHypeEntry, InsufficientHypeError } from '@/lib/hype-ledger';
```

Every hype writes a `-1` entry keyed `show-hype:<id>` / `profile-hype:<id>` and
returns `hypeBalance`. `InsufficientHypeError` → `409 INSUFFICIENT_HYPE`.

So **both** mechanisms are real and they answer different questions: the ledger
is *how many do you have*, the window is *can you spend one on this target
today*. My spec deleted one of them. Keep both.

Note the idempotency subtlety, which is load-bearing — the row is **deleted and
recreated**, not updated:

> Updating in place would reuse `show-hype:<id>`, and the ledger would swallow
> every repeat spend as a duplicate — a free hype, every day, forever.

## What the components actually need

My `HypeButton` props were right; the mapping is trivial. From the 429 body,
or from `nextHypeAt` on a success:

| Prop | Source |
|---|---|
| `hypeLocked` | `Date.parse(nextHypeAt) > Date.now()` |
| `hypeLabel` | `formatHypeWait(retryAfterMs)` — server already formats it |
| `hypeCount` | `hypeCount` |
| `hypeBalance` | `hypeBalance` |

Read `src/lib/hype-window.ts` and reuse `formatHypeWait` rather than writing a
client formatter — one source for the wait string keeps the button and the
error message identical.

Four states the button needs, not two: **spendable** · **window open**
(`HYPE_WINDOW_OPEN`, show the wait) · **out of hype**
(`INSUFFICIENT_HYPE`, different copy — waiting won't help) · **your own**
(`409`, hide it; you cannot hype your own show or profile).

## Endpoints: 197, not 53

I listed eight endpoints as "missing." Spot-checking the tree, they exist —
`/api/profiles`, `/api/booking-requests`, `/api/support`,
`/api/referrals/stats`, `/api/map/{venues,artists,events}`,
`/api/tickets`, `/api/shows/[showId]/lineup`. Plus a large surface I never
guessed at: 20 admin routes, 18 cron jobs, a device-authorization system,
privacy export/request, DMCA, push with VAPID, `page-builder`, journal,
collab-board, setlist templates, anomaly detection, backup verification.

`src/app/api/` **is** the API documentation. It is complete, current, and
executable. A hand-written spec beside it will drift again within a month —
generate one from the routes if you want a document, or point people at the
tree.

## What I got right

- The three surfaces production is ahead on (dock, map date picker, tuner
  layer chips) — confirmed, in `DESIGN_GAP.md`.
- The re-anchored components — 31 of 37 read no tokens, four had
  white-on-accent. That was a real audit of real files and it stands.
- `mmm.css` is more token-disciplined than the design system's own components.
- The two stale files are the root cause. **They fooled me three separate
  times** into confidently correcting things that were already correct.

## The one thing to do

Delete `engineering/openapi.yaml` and `engineering/schema.sql`, or put a header
on each pointing at `src/app/api/` and `prisma/schema.prisma`.

They are not merely out of date — they describe a *different, worse* design
than the one running, and they read as authoritative. Every reader who trusts
them argues for regressions and calls it a fix. I did it three times in one
sitting with the real repo one call away.
