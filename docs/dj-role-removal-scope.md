# Dropping the DJ role — scope and open decisions

**Status: SIGNED OFF 2026-08-05. Step 1 (close the signup door) is LANDED.
Steps 2–4 remain.**

> ## Operator decision, 2026-08-05 — all four answered
>
> **"Delete the DJ role altogether. It is too complicated."** Radio is instead
> generated per listener from their own listening history, locality, favourites
> and playlists, with deliberate reach into genres outside their taste. Their
> discovery builds their personal algorithm, **which is never shared with
> anyone**. Playlists — and only playlists — are shareable, with friends, via a
> HYPE code.
>
> | Decision | Answer |
> |---|---|
> | 1. How many accounts? | 3 DJ profiles, all internal. Cleanup, not migration. |
> | 2. DJ → ARTIST or LISTENER? | Whichever is simpler; the counts defused this. |
> | 3. **Who owns radio after DJs?** | **Nobody. Radio is computed, not authored.** |
> | 4. DJ-only URLs? | Redirect. `/for-djs` → `/for-artists` is done. |
>
> **Decision 3 was the blocker and it is now answered — and most of it was
> already built.** `src/lib/stations.ts` computes stations at request time with
> no DJ anywhere in the path; its own opening line calls it "the replacement for
> DJ-hosted radio shows". Its five kinds are the operator's description almost
> exactly: `for_you` (history and hypes), `local` (40 miles), `new` (fresh
> uploads *across every genre* — the reach outside taste), `friends` (shared by
> accounts you follow), and `genre`. Served by `GET /api/stations`.
>
> **The one thing decision 3 does NOT answer, and the real remaining work:
> where advertising airs.** Ad interjection is DJ-shaped end to end —
> `show-composer`'s `buildResolvedSequence()` injects AD breaks into a DJ's
> `productionPlan`, and `ShowSequencePlayer` firing `POST /api/ads/impression`
> is what actually spends an advertiser's budget. Remove DJs without moving
> that, and self-serve campaigns — which hold **real pre-authorised Stripe
> funds** — have nowhere to run. A computed station is also just a sequence of
> tracks, so the engine ports to it; but that is a build, not a deletion, and it
> must land before the DJ radio path is torn out.
>
> **DONE 2026-08-05 — ads air on the always-on station now**
> (`src/lib/station-breaks.ts`), and `RadioShowCreator` has been retired on the
> back of it. `show-composer` and `ad-clip-selection` stay: they are no longer
> DJ-only, since the station imports `ShowAdClip` and calls
> `resolveAdBreakClips()`, and `show-composer` is the production-plan engine
> behind `ShowSequencePlayer` and `/shows/[slug]` as well. Deleting them would
> break show playback, not DJ authoring. See step 2a/2b in Sequencing.
>
> **A privacy rule falls out of this and is now binding:** the per-listener
> algorithm is private. `for_you` and any future personalisation must never be
> exposed as another user's view, never be published on a profile, and never be
> shared through a HYPE code. The HYPE code shares **playlists**, which are
> explicit user-authored objects. The `friends` station is compatible with this
> — it surfaces tracks *other people chose to share*, not a model of them.

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

## Sequencing

The order matters, because the enum rewrite is the irreversible step:

1. ~~Take the counts above. Get sign-off on decisions 2–4 in writing.~~
   **DONE 2026-08-05.** Counts taken; all four decisions answered above.

   **Step 1a — LANDED: the signup door is closed.** `roleOptions` no longer
   offers DJ, `/api/register`'s zod enum rejects `role: 'DJ'` outright, `/join`
   drops the DJ card, and `/for-djs` redirects to `/for-artists`. `RoleOption`
   and both Prisma enums still carry DJ on purpose, so the three existing
   profiles keep resolving. This was done first and separately because it is
   the only part that stops the problem growing: the whole "cleanup, not
   migration" finding expires the moment a real DJ signs up, and now one
   cannot.

2. Land the rest of the *code* changes, while both enum values still exist —
   reads tolerant of both, DJ-only routes redirected, `--role-dj` alias removed
   (it exists today precisely so the DJ surface doesn't repaint early).

   **Step 2a — DONE: the advertising port.** Ad breaks now air on the
   always-on station (`src/lib/station-breaks.ts`, `radioStation.ts`), and
   `AlwaysOnStation` reports the impression that spends a budget. This was the
   blocker: advertising is the platform's only revenue and it could previously
   air in exactly one place, inside a DJ's show.

   **Step 2b — DONE: the Radio Show Creator is retired.** `RadioShowCreator`
   (1048 lines), `/radio/studio` and `/api/radio/ad-clips` (its only consumer)
   are deleted; `/radio/studio` 307s to `/radio`. Every entry point went with
   it — the app shell's DJ-gated "Show Creator" destination, the drawer entry,
   the `/radio` tile, the Pages role module, the fan dashboard's `dj`
   workspace, and both links on the DJ dashboard.

   **`show-composer` and `ad-clip-selection` deliberately STAY.** They are no
   longer DJ-only: `station-breaks.ts` imports `ShowAdClip` and the station
   calls `resolveAdBreakClips()`, and `show-composer` is also the production
   plan engine behind `ShowSequencePlayer`, `/shows/[slug]` and the show CRUD
   routes. Removing them would break show playback, not just DJ authoring.

   **Step 2c — DONE: the DJ profile surfaces are gone.** `/promoters/[slug]`
   and its `dashboard`/`analytics`/`onboarding` subpages and the `/djs/[slug]`
   alias are deleted; both now redirect to `/artists/*` from
   `next.config.mjs` (a catch-all, and config-level so the redirect is a real
   status code rather than one streamed after the response begins — these are
   public indexable profile URLs). `getProfilePathForType` no longer emits
   `/promoters`, and the eleven inline `type === 'DJ' ? … : …` link ternaries
   were collapsed rather than left pointing at a redirect.
   `DJOnboardingWizard.tsx` went with the onboarding route that was its only
   mount point.

   Done in the SAME deploy as step 3 on purpose: every one of those pages
   gated on `profile.type !== 'DJ' -> notFound()`, so the moment the data
   migration runs they serve nothing. Splitting them would have 404'd three
   live URLs in between.

   **Step 2d — DONE: the sweep.** `--role-dj` and `--role-dj-text` are gone
   (they were same-value aliases of `--role-promoter`, kept only so the DJ
   surface would not repaint early); the `dj` badge tone is renamed
   `promoter`, which is what it always described — the 10% pool. Every
   remaining `'DJ'` branch went with them across ~40 files. Three were not
   cosmetic: `/api/radio` was querying DJ-authored radio shows (production
   holds **zero** `isRadioShow` rows and none can be created, and its
   `stations` output had no consumer, so the query and its DJ-shaped joins are
   deleted); `/api/radio/ad-plan` and `src/lib/ai-dj-ads.ts` are deleted
   outright, orphaned when the Show Creator that was their only caller went;
   and `POST /api/shows` no longer requires a promoter profile to be DJ-typed
   — ownership, checked immediately after, is the constraint that actually
   matters. `/api/discover` and `/api/referral` dropped `djs` and `djLink`,
   response fields that could only ever be empty and that nothing read.
3. ~~Migrate data (`UPDATE` rows to their new type) as its own deploy, verified.~~
   **DONE — `prisma/migrations/20260806130000_reassign_dj_profiles`.** Counts
   re-taken against production immediately beforehand and unchanged from the
   2026-08-05 audit: 3 profiles, 2 users, and zero of everything that would
   have made this a migration rather than a cleanup (verified, uploads,
   Connect accounts, lineup slots, payable entries, shows headlined,
   followers, hypes, listens — all 0). Reassigned to **ARTIST**, settling
   decision 2: all three are music acts with public pages, and ARTIST keeps
   those pages resolving. Checked first that neither table carries a trigger
   or check constraint that the update could trip. Both enums keep their `DJ`
   value here, so this step is reversible on its own.
4. ~~Only then rewrite the enums, gated through `prisma/migrations-pending/`
   per the repo's own workflow — never applied blind.~~
   **Code half DONE; the migration is WRITTEN AND PARKED, not applied.**
   `DJ` is out of both enums in `schema.prisma`, so nothing can construct one.
   The DDL sits at `prisma/migrations-pending/20260806160000_drop_dj_enum_values`
   marked `@gated`; `npm run guard:migrations` fails the build if it reaches
   `prisma/migrations/`, and applying it is a deliberate `git mv` in its own
   commit. **Verify the two counts are still 0 immediately before moving it.**

   It was executed against a throwaway Postgres 16 before being parked, both
   ways: on a clean fixture it rebuilds both types, restores `User.role`'s
   `'FAN'` default (a default is bound to the old type and is silently lost
   otherwise) and leaves rows intact; on a fixture holding one straggler DJ
   row it raises a named exception and leaves the enum **untouched**, rather
   than failing halfway through a type rebuild. That distinction is the whole
   point — a partially applied enum swap is exactly the P3009 shape that
   blocks every subsequent production deploy.

Steps 3 and 4 must not share a deploy with step 2. A failed migration blocks
*every* production deploy (see CLAUDE.md's P3009 incident: production shipped
nothing for a day), and this one touches two enums and live payout rows.

## What is already true today

`--role-dj` survives in `globals.css` as a same-value alias of
`--role-promoter`, added by row 267 specifically so the ~7 DJ-coloured surfaces
do not repaint before this work lands. It is the one piece of DJ removal that is
already staged. Do not add new uses; do not remove it until step 2 above.
