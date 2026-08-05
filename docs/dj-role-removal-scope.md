# Dropping the DJ role — scope and open decisions

**Status: SCOPED, NOT STARTED. Needs operator sign-off before any code is written.**

> **Update 2026-08-05 — three of the four operator decisions are now cheap.**
> Production row counts were taken (decision 1) and show 3 DJ profiles, all
> internal, none verified, none with uploads, none with a Connect account, and
> zero lineup slots or payable entries anywhere. This is a cleanup, not a
> migration. Decisions 2 and 4 lose their sting as a result — see the notes
> under each. **Decision 3 (who owns radio after DJs) is unchanged and is the
> only genuinely open one**, because it is a question about the future rather
> than about existing rows: advertiser spots need somebody able to build a
> radio show, and `RadioShowCreator` / `show-composer`'s ad-interjection engine
> is DJ-shaped end to end.
>
> The window for the easy version closes when real DJs sign up.

`design/handoff-music-map-me/BACKEND_REWRITE.md` §1 specifies dropping the DJ
role, and §1 itself says "**Audit first.** Count affected accounts and confirm
the reassignment with the operator before running." This document is that audit,
written 2026-08-05 against `main`. It deliberately stops short of implementing
anything: the decisions below change what existing accounts can do, and two of
them are irreversible.

## The single most important finding: the spec does not match this schema

§1 is written against a `user_roles` table with a lowercase `role` enum of
`('fan','artist','dj','venue')`. **No such table exists here.** This codebase
carries DJ in *two independent enums*, and the spec's migration addresses
neither:

| Where | Enum | Values |
|---|---|---|
| `User.role` | `Role` | `FAN, ARTIST, DJ, VENUE, ADMIN, ADVERTISER` |
| `Profile.type` | `ProfileType` | `ARTIST, DJ, VENUE, LISTENER` |

There is no many-to-many role table, so §1's "fan is implicit and permanent"
trigger has nothing to attach to either — a user has exactly one `Role` and zero
or more `Profile` rows. Anyone starting from §1's SQL will write a migration
against a table that does not exist. The real change is two `ALTER TYPE`
rewrites plus every read of both columns.

Postgres cannot remove an enum value in place, so each one needs the
rename-create-cast-drop dance, and **both are in the same transaction as data
movement** — this is not a mechanical migration.

## Footprint

- **103 files** reference the DJ role across `src/`, `prisma/`, `e2e/`.
- Concentrated in `src/lib` (18 files), `src/components` (14), and the
  translation dictionaries (10 — all 12 locales carry DJ-facing copy).
- **Four call sites filter on `type: 'DJ'` directly** in `src/app/api` and
  `src/lib`.
- Whole surfaces are DJ-only and would need a destination or a redirect:
  `/promoters/[slug]` and its three subpages (`dashboard`, `analytics`,
  `onboarding`), `/djs/[slug]` (already an alias), `/radio/studio`.

### Systems that would stop working, not just look different

These are the ones that make this a product change rather than a rename:

1. **`RadioShowCreator` + `src/lib/show-composer.ts`.** The ad-interjection
   engine is DJ-shaped end to end: a DJ builds a `productionPlan`,
   `buildResolvedSequence()` injects AD breaks, and `resolveAdBreakClips()`
   fills them server-side. Advertiser money flows through this path —
   `ShowSequencePlayer` firing `POST /api/ads/impression` is what actually
   spends a campaign budget. If DJs stop existing, **someone still has to be
   able to make a radio show**, or self-serve ad campaigns have nowhere to air.
2. **The free-use crate.** `Profile.freeUseEnabled` means "opt into the DJ
   crate". If there are no DJs, the field's meaning evaporates — and note this
   is the same field row 268(c) flags as *not* the spec's `radio_eligible`
   (this one is an opt-IN defaulting false; the spec describes an opt-OUT
   defaulting true). Removing DJs and renaming that field are two changes that
   look like one.
3. **Payout splits.** `ShowLineupSlot` and `buildPayableEntries()` route the
   artist share; DJ-owned profiles hold `stripeConnectAccountId` values. A
   reassigned account keeps its Connect account, so this is real money attached
   to a row whose type changed underneath it.

## Decisions only an operator can make

1. **How many accounts are actually affected?** ~~Unanswerable from here.~~
   **ANSWERED 2026-08-05** — the Supabase connector was authorized and the
   counts were taken against production:

   | Query | Count |
   |---|---|
   | `User WHERE role = 'DJ'` | **2** |
   | `Profile WHERE type = 'DJ'` | **3** |
   | …`AND "stripeConnectOnboarded"` | **0** |
   | …`AND "verificationStatus" = 'VERIFIED'` | **0** |
   | …`AND "songUploadCount" > 0` | **0** |
   | `ShowLineupSlot` (all rows) | **0** |
   | `AccountsPayableEntry` (all rows) | **0** |

   Against 10 users total. And none of the three is an outside user:

   | slug | name | created | account |
   |---|---|---|---|
   | `south-loop-signal` | South Loop Signal | 2026-06-23 | `@ihype.org` — the June 23 launch seed |
   | `suzike` | Test DJ | 2026-07-11 | gmail, named "Test DJ" |
   | `buruka` | Brynn Atwood | 2026-07-17 | icloud, shares the operator's surname |

   **So this is a cleanup, not a migration.** Per this section's own test —
   "if these are near zero, this is a cleanup" — nothing is on the other end
   of it. That collapses the stakes of decisions 2 and 4 below, and it means
   the "real money attached to a row whose type changed underneath it" risk in
   §3 above is currently hypothetical: zero DJ profiles hold a Connect account,
   and there are no lineup slots or payable entries in the database at all.

   Re-run these counts immediately before acting. They are true as of
   2026-08-05, pre-alpha, and the whole point is that they stop being true once
   real users arrive.

2. **DJ → ARTIST, or DJ → LISTENER?** §1 says artist, to preserve upload
   rights. But it also warns that "a DJ who never uploaded a track shouldn't
   silently gain artist verification standing." This codebase makes that sharper
   than the spec anticipated: `/api/verify` gates on real evidence and
   `/api/artist-media` allows `ARTIST` **or** `DJ` to upload. A blanket
   promotion hands artist standing to accounts nobody reviewed as artists.
   §1's own suggestion — reassign but force `verified = false` — costs verified
   DJs their standing and makes them re-apply. Both options harm someone; pick
   deliberately.

   **Defused by the counts above (2026-08-05).** "Both options harm someone"
   was written assuming real DJs existed. None of the three is verified, none
   has uploads, none has a Connect account, and none is an outside user — so
   neither branch harms anyone today. Pick whichever is simpler to implement
   and move on. This reasoning expires the moment a real DJ signs up, which is
   an argument for doing it before alpha rather than after.

3. **Who owns radio after DJs?** See system 1 above. Nothing in the handoff
   answers this, and advertiser revenue depends on the answer.

4. **What happens to the DJ-only URLs?** `/promoters/[slug]` is linked from
   real profiles and possibly from outside the site. Redirect to an artist
   profile, or 410?

   **Low stakes as of 2026-08-05:** three slugs exist, all internal (see the
   table in decision 1), and the site is pre-launch with no external inbound
   links to speak of. A redirect is the cheap, safe default; this does not
   need to be litigated.

## Sequencing, if it goes ahead

The order matters, because the enum rewrite is the irreversible step:

1. Take the counts above. Get sign-off on decisions 2–4 in writing.
2. Land the *code* changes first, while both enum values still exist — reads
   tolerant of both, DJ-only routes redirected, `--role-dj` alias removed
   (it exists today precisely so the DJ surface doesn't repaint early).
3. Migrate data (`UPDATE` rows to their new type) as its own deploy, verified.
4. Only then rewrite the enums, gated through `prisma/migrations-pending/`
   per the repo's own workflow — never applied blind.

Steps 3 and 4 must not share a deploy with step 2. A failed migration blocks
*every* production deploy (see CLAUDE.md's P3009 incident: production shipped
nothing for a day), and this one touches two enums and live payout rows.

## What is already true today

`--role-dj` survives in `globals.css` as a same-value alias of
`--role-promoter`, added by row 267 specifically so the ~7 DJ-coloured surfaces
do not repaint before this work lands. It is the one piece of DJ removal that is
already staged. Do not add new uses; do not remove it until step 2 above.
