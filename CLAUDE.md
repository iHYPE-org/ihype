# iHYPE — Claude Code Instructions
# ──────────────────────────────────────────────────────────
# Claude Code reads this file on every turn — these rules are always active.
# Sessions start cold with no memory of prior work. This file is the memory.

---

## CRITICAL: Never replace — only update the UI layer

**Every session starts with zero memory of previous work.**
The backend wiring, auth logic, DB queries, and API calls in each file were
built across many sessions. They must NEVER be lost.

### Rule: When a .dc.html arrives, do a surgical UI update — not a rewrite

**Before editing any file**, state out loud:
> "Update the UI layer in `[file]` to match the new design — preserve all backend wiring."

Then follow this sequence:

1. **Read the existing `.tsx` file first** — understand what backend logic is already there
2. **State explicitly what will be preserved** — list auth gates, API calls, DB queries present
3. **Identify only what changed visually** — layout, copy, colors, new components
4. **Edit only those parts** — use the Edit tool, not Write/overwrite
5. **Preserve everything else** — API fetches, auth checks, state management, error handling, DB queries

If a page needs a full rewrite because the design is fundamentally different,
explicitly list every piece of backend logic being preserved before touching anything.

### Files with critical backend wiring — never overwrite blindly

| File | What's wired |
|---|---|
| `src/components/RadioShowCreator.tsx` | `GET /api/radio/ad-plan` for AI ad-scope sizing; free-use crate from `initialCrate` prop; `POST`/`PATCH /api/shows` for draft/schedule/go-live; `openAdPreview()` now calls `GET /api/radio/ad-clips` for real, purchased marketplace ads first, falling back to the `builtInAdClips` placeholder catalog only when none exist for that scope |
| `src/lib/show-composer.ts` | `buildResolvedSequence()` is the real ad-interjection engine — resolves a `Show.productionPlan` into a playable sequence, auto-injecting AD breaks every `advertising.frequency` tracks. `ResolvedSequenceItem.adClipId` carries the underlying `ShowAdClip.clipId` through so a player can tell a real marketplace ad (`mkt_<Ad.id>`) apart from a placeholder (`0x...`, from `builtInAdClips`). **`advertising.clips` is now auto-filled server-side** (`src/lib/ad-clip-selection.ts`'s `resolveAdBreakClips()`, called from `POST /api/shows` and `PATCH /api/shows/[showId]`) whenever `advertising.enabled` is true but a DJ never manually confirmed an ad break in the timeline — previously "advertising enabled" with an empty `clips` array meant zero interjections ever actually happened, silently. |
| `src/app/api/radio/ad-clips/route.ts` | Real `Ad` marketplace rows (self-serve Coverage Builder campaigns, `status: APPROVED`, scope-matched, budget not exhausted, `audioUrl` set) mapped into `ShowAdClip` shape with `clipId: mkt_<Ad.id>` — feeds `RadioShowCreator`'s ad-break picker |
| `src/app/api/advertise/audio-upload/route.ts` | Uploads the audio spot for a self-serve ad campaign (magic-byte validated, server-computed duration via `src/lib/audio-duration.ts`, no AI content vetting — known gap, documented not silent) — returns a URL the campaign create call persists as `Ad.audioUrl`/`Ad.audioDurationSecs` |
| `src/components/ShowSequencePlayer.tsx` | Real playback for a DJ show's resolved sequence. When an AD item's `adClipId` starts with `mkt_` and playback is not a preview, fires `POST /api/ads/impression` once per play — this is what actually spends an advertiser's budget and increments `Ad.impressions`, closing the gap flagged in DESIGN_SYNC row 212 (self-serve campaigns were never actually served anywhere) |
| `src/app/radio/page.tsx` | `GET /api/shows?radioShows=1`; localStorage position + bookmark persistence |
| `src/app/api/shows/route.ts` | Full show CRUD; rate limiting; 70/20/10 enforcement; radioShows filter |
| `src/app/discover/page.tsx` | Live DB queries for artists, venues, upcoming shows |
| `src/app/pages/page.tsx` | Auth gate; live DB query for user's own profiles |
| `src/app/payout/[id]/page.tsx` | Auth gate; live show payout breakdown from DB |
| `src/app/shows/[slug]/page.tsx` | Full show detail; HypeButton; TicketSaleCard; ShowSequencePlayer |
| `src/app/artists/[slug]/page.tsx` | Artist/DJ profile; media assets; upcoming shows |
| `src/app/venues/[slug]/page.tsx` | Venue profile; calendar; show listing |
| `src/components/ListenHome.tsx` | Discovery/radio/charts tabs at `/listen` — the real post-auth landing page (`src/app/home/page.tsx` is now just a `redirect('/listen')` alias for old links) |
| `src/components/EventsHome.tsx` | Events tab at `/shows` — local/for-you feeds, My Tickets (QR/transfer/cancel/archive) |
| `src/components/PagesHome.tsx` + `PageEditor.tsx` | Pages tab at `/pages` — page customizer, AI Page Studio, role toolkit (`PageRoleModules.tsx`) |
| `middleware.ts` | HTTPS enforcement; www→apex redirect; auth protection for `/listen` (`WORKBENCH_PATH` in `src/lib/auth-redirects.ts`), `/dashboard`, `/admin`; CSP/security headers. **Do not rename to `proxy.ts`** — Next.js 16's `proxy` convention defaults to the Node.js runtime with no way to opt back into Edge (`runtime` config throws in proxy files), and this project's Cloudflare Workers deploy via OpenNext rejects Node.js-runtime middleware outright. The deprecation warning at build time is a known, accepted cost until OpenNext/Cloudflare supports it. |
| `src/lib/permissions.ts` | `isAdminSession()` — checks `role === 'ADMIN'` |
| `src/lib/runtime-flags.ts` | Feature flags: invite codes, demo logins, media storage |
| `src/lib/profile-stats-catalog.ts` | Pure stat-key catalog for the pinned-stats picker — dependency-light on purpose (no `@/lib/db` import) since `PageEditor.tsx` (a client component) imports it directly. Never add a `db`/Prisma import here; put DB-dependent logic in `src/lib/profile-stats.ts` instead. |
| `src/app/api/artist-media/route.ts` | **Now runs the full 4-layer scan pipeline (2026-07-15)** via `runTrackScanPipeline()` (`src/lib/media-vetting.ts`) for every upload: (0) real ID3v2 tag parse (`src/lib/id3-tags.ts`) checking embedded artist/copyright frames against the declared uploader — catches rips whose metadata still names the original commercial artist even if the form's title field doesn't; (1)/(2) acoustic fingerprinting and melodic/motif matching are honestly stubbed as `configured: false` (`src/lib/audio-fingerprint.ts`) — no licensed reference-audio service is wired up, and this never blocks a track or counts as a flag, it only shows "not configured" in the UI; (3) the existing lyrics-transcription check (`vetTrackAudioContent`). **Also fixed a real bug**: POST previously hard-required `profile.type === 'ARTIST'`, silently blocking every DJ from uploading — now allows `ARTIST` or `DJ` (matches GET, which always allowed both). Response now includes a `scan` array (per-layer results) consumed by the new upload UI. Fail-open, same as before. |
| `src/components/TrackUploadPanel.tsx` | **New (2026-07-15).** The upload UI that DESIGN_SYNC rows 80/81/83 assumed already existed — it didn't; there was no track/crate-upload form anywhere in the live app (only orphaned CSS: `.artist-media-upload-panel` etc., reused here). Renders on `/artists/[slug]` (Tracks tab, `profileType="ARTIST"`) and `/promoters/[slug]` (Crate tab, `profileType="DJ"`) for the owner only. Shows a staggered, sequential reveal of the 4 scan layers after upload — this animates the reveal of a result the server already computed synchronously (no background job queue exists in this codebase to genuinely poll against; the design spec's `POST returns async job` / `GET .../scan/:jobId` contract was not implemented as literal async infra for that reason). Also has an optional cover-art field (`ArtistMediaAsset.artworkUrl`, same image-vetting/storage pattern as profile graphics) rendered by `ArtistMediaPlaylist.tsx` via the pre-existing `previewImageUrl` field. |
| `src/lib/stripe.ts` + `src/lib/show-payouts.ts` | **Fixed a severe payout-routing bug (2026-07-14).** `createTicketPaymentIntent` used to set `transfer_data.destination` to a single Connect account (venue if present, else artist) with no `amount` sub-field — Stripe therefore transferred the ENTIRE captured charge to that one party, not the charter's 70/20/10 split; the other two parties' shares were only ever computed as `AccountsPayableEntry` rows that nothing ever actually paid out (`AccountsPayableStatus.RELEASED` was never set anywhere in the codebase). Fixed via the standard "separate charges and transfers" pattern: `createTicketPaymentIntent` no longer sets `transfer_data` at all (the full charge captures to the platform's own Stripe balance), and a new `createPayoutTransfer()` issues one real `stripe.transfers.create()` per `AccountsPayableEntry` (idempotent via the entry's own id). `triggerShowPayouts()` (the `show-payouts` cron job) was completely rewritten — it used to bypass `AccountsPayableEntry` entirely and just email an *estimate* computed from a different, wrong formula (hardcoded 5%/85% split); it now processes real PENDING entries for ended shows and actually pays them, emailing the real recipient once money has moved. Tax entries (no Connect account) stay `PENDING` — remittance is a manual accounting matter, out of scope. New `AccountsPayableEntry.stripeTransferId` field records the real transfer id. |
| `src/app/api/tickets/[serializedId]/transfer/route.ts` | **Fixed a real double-use bug (2026-07-14).** Transferring a ticket used to just email the recipient the *existing* serializedId — since every ticket lookup (QR page, both scan endpoints) has no ownership check beyond the id itself, the original buyer (who may have already opened/screenshotted/printed the QR before transferring) still held a fully valid, scannable copy; whoever scanned first won. Now reissues every ticket in the order with a brand-new `serializedId` (`createSerializedTicketId()`) on transfer — the old QR 404s immediately, only the freshly emailed one works. `holderName`/`holderEmail` update to the recipient; `reassignCount`/`reassignedAt` increment (the same fields the venue-staff "Venue reassignment" feature on `/tickets/[serializedId]` already used). |
| `src/app/api/shows/[showId]/scan/route.ts` | **Fixed a real scan-replay race (2026-07-14).** Used to `findFirst` then check `status` in JS then a separate `update` — two concurrent scans of the same ticket could both pass the check before either write landed, both reporting success. Now atomic via `updateMany({ where: { id, status: 'VALID' }, data: {...} })` and checking `result.count`, matching the pattern `/api/tickets/[serializedId]/scan/route.ts` already used correctly. |
| `src/lib/ticket-order-state.ts` + `src/app/api/shows/[showId]/lineup/*` | **Lineup & Split Agreement (2026-07-19, DESIGN_SYNC row 226) — real multi-act payout splits, built only after an explicit product decision** ("only applies when multiple acts are booked for a single event; splits are proposed by venue and accepted or rejected by artists"). New `ShowLineupSlot` model — a show with zero rows is completely unaffected, same single-headliner payout as always. When lineup slots exist, `buildPayableEntries()` splits `artistPayoutCents` across ACCEPTED slots proportionally (siblings sum to `Show.artistPayoutPercent`), last slot absorbing the rounding remainder so the split always sums exactly, no leakage. Booking-lock gating reuses the existing DRAFT-shows-are-private mechanism (`/shows/[slug]/page.tsx` already hides DRAFT shows) rather than a new visibility flag — a lineup-pending show stays DRAFT until every act accepts, then `PATCH .../lineup/respond` flips it straight to SCHEDULED in the same request as the deciding accept. Real UI at `/shows/[slug]/lineup` (split visualization, accept/decline, venue composer). |
| `src/app/api/tickets/[serializedId]/refund/route.ts` | **Refund is now real (2026-07-14).** Used to only file a `SupportRequest` and leave the order/tickets/capacity completely untouched — the UI told buyers "our support team will process your refund" but nothing further ever happened automatically. Now calls `refundTicketPaymentIntent()` (a real Stripe refund) for `CAPTURED` orders, or `cancelTicketPaymentIntent()` for `RESERVED` ones (never actually charged), then `refundCapturedTicketOrder()`/`voidReservedTicketOrder()` (`src/lib/ticket-order-state.ts`) void the order, void unscanned tickets, release sold capacity, and void any still-`PENDING` `AccountsPayableEntry` rows so the payout cron can never pay out a refunded order — safe by construction since payouts only run for `ENDED` shows and refunds are only allowed >48h before a show starts, so a refundable order's payable entries are guaranteed still `PENDING`. Blocks refund if any ticket in the order was already scanned. New `TicketOrder.refundedAt`/`stripeRefundId` fields. |
| `src/app/me/payouts/page.tsx` | **New (2026-07-14).** Real payout history for the signed-in user's own profiles — every `AccountsPayableEntry` that actually moved money via `triggerShowPayouts()`, split into Received (`RELEASED`) and Pending. Distinct from `/payout/[id]`, which shows a computed 70/20/10 projection for one show regardless of whether it's actually been paid out yet; linked from that page's footer. |
| `src/app/api/shows/[showId]/cancel/route.ts` | **Event Cancellation Flow (2026-07-19, DESIGN_SYNC row 227).** Organizer-initiated cancellation (gated on venue owner / headliner owner / show creator), distinct from the admin content-moderation cancel path. Refunds every `CAPTURED` order via a real `refundTicketPaymentIntent()` Stripe call before voiding it in the DB, cancels every `RESERVED` order's payment intent; skips (and reports as skipped) any order with an already-`SCANNED` ticket rather than refunding an attended show. Per-order failures don't abort the batch. Sets `Show.status = 'CANCELED'` plus new `cancellationReason`/`canceledAt` fields. Real UI at `/shows/[slug]/cancel` (`EventCancellationFlow.tsx`) shows the actual returned refunded/skipped/failed counts, not a blanket success message. |
| `src/app/me/payout-settings/page.tsx` | **New (2026-07-19).** Real Stripe Connect status per owned ARTIST/DJ/VENUE profile (`stripeConnectAccountId`/`stripeConnectOnboarded`, both real fields) with a genuine Connect/Reconnect button hitting the existing `POST /api/stripe/connect/onboard`. Deliberately omits "Add another account" (no multi-Connect-account support exists), "Payout Schedule" (payouts already run automatically via the real cron, no batching option exists), and "Email me on payout" (the cron already unconditionally emails on every real transfer, no per-user toggle exists) — each dropped with an inline comment rather than built as decorative UI. |
| `src/app/tracks/[hexId]/page.tsx` | **New (2026-07-19).** Real public Track Detail page, looked up by the same `hexId` `src/app/embed/[hexId]/route.ts` uses. Real play count (`MediaListen` count), real per-track "Copyright status" derived from the latest `ContentReport` for that track. The "Hype" button has no per-track backing anywhere in the schema (only profile-level `ProfileHypeEvent`/show-level `HypeEvent` exist) — honestly relabeled to hype the artist via the real existing `HypeButton`/`Profile.hypeCount`, with copy that says so. |
| `src/app/support/tickets/page.tsx` + `src/app/support/tickets/[id]/page.tsx` | **New (2026-07-19).** A signed-in user's own `SupportRequest` list/detail, both strictly checked against `requesterUserId === session.user.id` — a real per-user ownership boundary. Linked from the existing `/support` page (additive only). |
| `src/app/api/advertise/register/route.ts` + `src/app/advertise/register/page.tsx` | **New (2026-07-19, DESIGN_SYNC row 229) — real Advertiser Profile, a 5th account type separate from ARTIST/DJ/VENUE/LISTENER.** Private only (no public page) — new `Role.ADVERTISER` + `AdvertiserAccount` model (`companyName`/`contactName`/`website`, 1:1 `User`), no `Profile` row created. Sign-in reuses the existing passwordless magic-link mechanism (`src/lib/magic-link.ts`, shared with `/api/auth/magic-link`) rather than a new auth path; `GET /api/auth/magic` routes an `ADVERTISER`'s first sign-in straight to `/advertise/dashboard`. `Ad.advertiserId` still points at `User` directly — completely unaffected, so the existing campaign/vetting pipeline needed zero changes. `/advertise`'s "Open a 3rd-party account →" CTA (previously a dead anchor) now really links here. |
| `src/app/api/register/route.ts` (invite-gate) + `src/lib/registration-post-processing.ts` (`resolveReferrer`) | **Personal invite links now really bypass invite-only signup (2026-07-19, DESIGN_SYNC row 231) — explicit product decision.** While `FEATURE_REQUIRE_INVITE_CODE` is on, a user's own `/invite/[hexId]` link previously only fed referral-attribution (`?ref=`); their friend still hit the invite-code wall unless someone separately handed them an admin-minted `InviteCode`. `resolveReferrer()` (the same user/profile lookup `processReferral` always used, extracted so both can share it) now also satisfies `POST /api/register`'s invite-gate check when a real user/profile resolves — unlike an `InviteCode` this is never claimed/consumed, so one link invites unlimited friends. `GET /api/me` returns the caller's own `inviteHexId` (first-created `Profile`, any type — plain fans included), surfaced via a real "Invite Friends" copy/share section on `/settings`. |
| `src/lib/stripe.ts` (`createAdCampaignCheckoutSession`/`settleAdCampaignAuthorization`) + `src/lib/ad-settlement.ts` | **Real ad-spend billing — pre-auth-then-capture (2026-07-19, DESIGN_SYNC row 234), explicit user decision.** Closes the gap flagged since row 224: campaigns previously ran on a purely notional budget, no Stripe charge anywhere. A vetting-cleared campaign now lands in `AWAITING_PAYMENT`, not `APPROVED` — a Stripe Checkout Session (`capture_method: 'manual'`) authorizes the full quoted budget via Stripe's own hosted page (no client-side Stripe.js/Elements exists anywhere in this codebase, so this needed no new UI dependency). On successful authorization (`payment_intent.amount_capturable_updated` webhook) the campaign flips to real `APPROVED` and `startsAt`/`endsAt` are resolved from the stored `runDays` only then — a campaign awaiting review/checkout never loses run length to the wait. The new `ad-settlement` cron (shares `show-payouts`' daily 1pm UTC slot) captures only the actual `spentCents` delivered once a campaign's `endsAt` passes (capped at `budgetCents` — the impression route's non-atomic check-then-increment can drift `spentCents` a few cents over), or releases the hold outright if nothing aired; early self-serve cancellation runs the identical settlement. `PATCH /api/admin/ads`'s manual-approval path routes through the same flow. New `Ad.runDays`/`stripePaymentIntentId`/`authorizedAt`/`settledAt` fields. |
| `src/lib/image-vetting.ts` | `vetImageUpload()` — vision-model AI screening (`runVisionAI` in `src/lib/ai.ts`, `@cf/llava-hf/llava-1.5-7b-hf`) for uploaded image bytes. Fail-open, same `{cleared, requiresManualReview, reasoning}` shape as `vetFreeUseSample`. Wired into `src/app/api/profile/upload-graphic/route.ts` (avatar/hero/logo/gallery — raises `ContentReport` `targetType: 'profile-image'` on flag). `src/app/api/verify/route.ts` (ownership proof documents) is deliberately left un-AI-vetted — it already requires mandatory human review via `/admin/verifications`. |
| `src/app/api/admin/moderation/[id]/route.ts` | The moderation queue's "approve" action now takes real enforcement action (`enforceRemoval()`) keyed by `ContentReport.targetType`, not just a status flip: `track` → unpublishes the `ArtistMediaAsset`; `comment` → soft-deletes the `ShowComment`; `show` → cancels the `Show`; `ad-creative` → rejects the `AdSubmission` (harmless legacy case — the `AdSubmission` pipeline that created these reports is retired, see below); `profile-image` → nulls the specific flagged `Profile` field (`heroImage`/`avatarImage`/`logoImage`/`galleryImage` — the field name is encoded in `ContentReport.reason` as `auto_flag_image:<field>` by `upload-graphic/route.ts`). `profile` still has no automated action (free-text bio/content, not a single field) — an admin has to look. |
| `src/components/admin/AdminShell.tsx` | Added an `SUBNAV` strip (below the top bar, above page content) so every real `/admin/*` subpage is reachable by a click — not just Overview/Users/Content/Finance/Ads/Support/System/Growth. `/admin/flagged` (dead `loading.tsx`-only directory, no `page.tsx`) was deleted outright. `/admin/verifications` now has a real `page.tsx` — a thin redirect to `/admin/review?tab=verifications` (matching the `/studio`-style alias precedent), so the URL 404s no longer; its directory still also holds `AdminVerificationQueue.tsx`, actively imported by `/admin/review/page.tsx`, unchanged. `/admin/device-register` is intentionally unlinked — reached only via an emailed one-time-token link during device re-registration. |
| `src/app/audit/page.tsx` | Public Trust & Safety report — aggregate `ContentReport`/`Ad`/verification counts only, no PII, no content IDs. Categories with fewer than 5 reports (`K_ANON_FLOOR`) are folded into "Other" so a small bucket can never identify a specific user or piece of content. Distinct from `/transparency` (financial stats) and `/status` (system health, admin-gated). |
| **Retired and dropped:** `AdSubmission` "Supporter" ad system (text + optional image banner tiles) | iHYPE only ever runs radio-style audio ad spots — no visual/banner placements. `src/components/AdBanner.tsx`, `src/app/api/ads/upload/route.ts`, `src/app/api/ads/[id]/impression/route.ts`, `src/app/api/ads/[id]/click/route.ts`, and `src/app/api/ads/stripe-webhook/route.ts` were deleted outright — investigation found this pipeline had **zero live submission entry point** (no form anywhere ever called `ads/upload`) and `AdBanner`'s only mount point (`/shows/[slug]`) has been removed, so nothing broke. The `AdSubmission` Prisma model has since been **removed from schema.prisma**, with a hand-written drop migration (`prisma/migrations/20260714020000_drop_ad_submission`) — explicitly flagged in the migration's own comment as **not safe to apply blind**, since this sandbox can't confirm the table is actually empty in production; confirm row count and get owner sign-off before running it. `src/app/api/cron/route.ts`'s `expire-ads` job (and its entries in `workers/cron.ts`/`wrangler.cron.toml`) were removed along with it. The real, live ad system is the `Ad`/`AdSlot` self-serve Coverage Builder (`/advertise`, `src/app/api/advertise/campaigns/route.ts`) — audio-only, `audioUrl` now **required** to submit a campaign (`src/app/api/advertise/audio-upload/route.ts`), wired to real playback via `GET /api/radio/ad-clips`/`src/lib/ad-clip-selection.ts` (see the ad-interjection rows below), with both the campaign copy AND the audio spot itself now AI-vetted (`vetAdAudioContent()` in `src/lib/ad-vetting.ts`, transcribes via Workers AI Whisper then screens the transcript). `/admin/ads` reviews these real campaigns (`AdminAdsClient.tsx`, `src/app/api/admin/ads/route.ts`) instead of the retired `AdSubmission` queue, and `/advertise/dashboard` shows a 14-day daily impressions breakdown (no clicks/CTR — `Ad.clicks` is real schema but never incremented anywhere, an audio spot has no click-through UI the way a banner did, so showing a permanently-0 stat was removed rather than left misleading). Advertisers get email on every status change (`src/lib/ad-campaign-notify.ts`'s `notifyAdvertiser()`, called from both the initial AI vetting in `POST /api/advertise/campaigns` and an admin's manual decision in `PATCH /api/admin/ads`) and can self-serve cancel/pause/resume a running campaign (`PATCH /api/advertise/campaigns` with `{action: 'cancel'|'pause'|'resume'}`, `CampaignCancelButton.tsx` on the dashboard) — `CANCELLED`/`PAUSED` are `AdCampaignStatus` values set only by those actions, never by vetting; resuming shifts `endsAt` forward by however long the campaign was paused (`Ad.pausedAt`), so a pause never eats into the paid-for run length. `audioUrl` accepted by `POST /api/advertise/campaigns` must pass `isTrustedStorageUrl()` (`src/lib/object-storage.ts`) — a CodeQL-flagged SSRF (the route used to `fetch()` a client-submitted URL unvalidated for audio vetting) fixed same-day after the finding landed on an already-merged PR. `Ad.imageUrl` (dead field — ads are audio-only, nothing ever read it) was dropped the same way as `AdSubmission`: removed from `schema.prisma`, with a gated, unapplied drop migration (`prisma/migrations/20260714050000_drop_ad_image_url`) since historical rows from before this session's changes may have set it. |

---

## CRITICAL: UI source of truth

**Every page's UI already exists as a .dc.html file in Claude Design.**
Claude Code must NOT invent, redesign, or guess any UI.

The workflow is:
1. Read the current `.tsx` file to understand what's already wired
2. Open the .dc.html file listed for the page
3. Update only what changed — translate new HTML/CSS/React into the existing `.tsx`
4. Keep all data fetching, auth, and API wiring intact
5. Push — do not change layout, copy, colors, or components without a new .dc.html version

If a UI detail is unclear → ask Claude Design to clarify in the .dc.html. Never guess.

---

## Infrastructure (already configured — do not reconfigure)

- **Database:** Supabase Postgres at `db.bjkabtzvgfshsrmjhrkx.supabase.co` — 71 migrations applied, all tables exist
- **Cloudflare Worker:** `ihype` — deployed, secrets already set
- **Hyperdrive:** `03f39c51f80a45d3bb6792a9676e292e` — pooled Postgres connection
- **KV namespace:** `b6330641874a4420b240d3a82760a9aa` — runtime flags
- **R2 bucket:** `ihype-media` — media storage
- **Launch seed:** Already ran June 23 — demo accounts exist
- **Admin account:** `colinatwood@gmail.com` — role = ADMIN

---

## Brand constants (never change these in code)

- **Contact:** admin@ihype.org (only email)
- **Site:** ihype.org (only domain)
- **Founded:** Portland, ME · 2026
- **Split:** 70% artist / 20% venue / 10% promoters / 0% iHYPE — locked in charter
- **No video** — iHYPE does not host video, live streams, or recorded video. Audio only.
- **Radio shows** — DJs can go live (audio-only) and shows auto-save for on-demand replay
- **Colors:** accent `#ff5029` · venue `#22e5d4` · promoter `#b983ff` · fan `#b983ff`
- **Fonts:** Syne (display/headlines) · DM Sans (body) · JetBrains Mono (labels/mono)

---

## Page map — .dc.html → Next.js route

### Marketing / Public
| .dc.html | Route | src/app path |
|---|---|---|
| Index.dc.html | / | src/app/page.tsx |
| About.dc.html | /about | src/app/about/page.tsx |
| Charter.dc.html | /charter | src/app/charter/page.tsx |
| Legal.dc.html | /legal | src/app/legal/page.tsx |
| Privacy.dc.html | /privacy | src/app/privacy/page.tsx |
| Terms.dc.html | /terms | src/app/terms/page.tsx |
| Transparency.dc.html | /transparency | src/app/transparency/page.tsx |

### Auth & Onboarding
| .dc.html | Route | src/app path |
|---|---|---|
| Auth.dc.html | /login | src/app/auth/login/page.tsx |
| Join.dc.html | /register | src/app/auth/register/page.tsx |
| Welcome.dc.html | /welcome | src/app/welcome/page.tsx |
| Verification.dc.html | /verify | src/app/verify/page.tsx |

### Fan product
| .dc.html | Route | src/app path |
|---|---|---|
| FanHome.dc.html | /listen | src/app/listen/page.tsx (renders `ListenHome.tsx`) |
| Discover.dc.html | /discover | src/app/discover/page.tsx |
| Search.dc.html | /search | src/app/search/page.tsx |
| Notifications.dc.html | /me/notifications | src/app/me/notifications/page.tsx (renders `NotificationsList.tsx`) |
| FanProfile.dc.html | /fans/[slug] | src/app/fans/[slug]/page.tsx |
| Tickets.dc.html | /tickets | src/app/tickets/page.tsx (`/me/tickets` is a thin redirect alias to this) |
| Settings.dc.html | /settings | src/app/settings/page.tsx (`/me/settings` is a thin redirect alias to this) |

### Events
| .dc.html | Route | src/app path |
|---|---|---|
| Events.dc.html | /shows | src/app/shows/page.tsx (renders `EventsHome.tsx`) |
| Show.dc.html | /shows/[slug] | src/app/shows/[slug]/page.tsx |
| EventCreator.dc.html | /events/new | src/app/events/new/page.tsx |
| Payout.dc.html | /payout/[eventId] | src/app/payout/[id]/page.tsx |

### Creator / Artist
| .dc.html | Route | src/app path |
|---|---|---|
| Artist.dc.html | /artists/[slug] | src/app/artists/[slug]/page.tsx |
| ArtistDashboard.dc.html | /artists/[slug]/dashboard | src/app/artists/[slug]/dashboard/page.tsx (owner-only) |
| ArtistAnalytics.dc.html | /artists/[slug]/analytics | src/app/artists/[slug]/analytics/page.tsx (owner-only) |
| ArtistOnboarding.dc.html | /artists/[slug]/onboarding | src/app/artists/[slug]/onboarding/page.tsx (owner-only) |
| DJProfile.dc.html | /promoters/[slug] | src/app/promoters/[slug]/page.tsx — despite living in the `/artists/[slug]` file per the original design mapping, real DJ profiles are gated `profile.type !== 'DJ' → notFound()` at `/promoters/[slug]` (see the "Additional live routes" table below); `artists/[slug]/page.tsx` is ARTIST-only (`profile.type !== 'ARTIST' → notFound()`) |
| DJDashboard.dc.html | /promoters/[slug]/dashboard | src/app/promoters/[slug]/dashboard/page.tsx (owner-only) |
| DJAnalytics.dc.html | /promoters/[slug]/analytics | src/app/promoters/[slug]/analytics/page.tsx (owner-only) |
| DJOnboarding.dc.html | /promoters/[slug]/onboarding | src/app/promoters/[slug]/onboarding/page.tsx (owner-only) |
| WebRadio.dc.html | /radio | src/app/radio/page.tsx |
| Pages.dc.html | /pages | src/app/pages/page.tsx |

**Reversed (2026-07-19):** the per-role dashboard pattern that Home.dc.html/Studio.dc.html were retired for (see below) is back, by explicit design/product decision — Claude Design's new `templates/` tree (distinct from the legacy `uploads/iHYPE/*.dc.html` set) ships a real `artist-dashboard`/`dj-dashboard`/`venue-dashboard`/`fan-dashboard` template per role. These are NOT a revival of the old role-switching Home.dc.html single mockup — each is its own route, reachable as a "Dashboard" link from that profile's Pages toolkit (`PageRoleModules.tsx`) rather than being the post-login landing page; `/listen` remains the default landing surface. Built 2026-07-19: `src/app/artists/[slug]/dashboard`, `src/app/promoters/[slug]/dashboard` (DJ), `src/app/venues/[slug]/dashboard`, `src/app/me/dashboard` (fan, any authenticated user) — all owner-gated except the fan one, all real Prisma aggregates (no fabricated stats), no schema changes. `src/lib/artist-dashboard.ts`/`src/lib/venue-dashboard.ts` hold the month/week-scoped aggregate helpers that `getProfileInsights` didn't already cover.

**Retired:** Studio.dc.html (the generic creator workbench) is gone — `/studio` is now a bare `redirect('/listen')` with no auth gate, no `StudioDashboard` component, and nothing in the app links to it. Its former responsibilities live on Listen (discovery/radio), EventCreator (event creation), and WebRadio (DJ radio management).

**Retired:** Home.dc.html (the role-switching Fan/Artist/Venue/DJ single-dashboard mockup) has no live route — the Workbench/Home dashboard it depicted was superseded by the Listen/Events/Pages tab architecture; `/home` is now just a `redirect('/listen')` alias for old bookmarks/links. Its Fan section's responsibilities live on Listen (`ListenHome.tsx`); its Artist/Venue/DJ sections live on Pages' role toolkit (`PageRoleModules.tsx`) and each role's own profile page. Its role-switching *pattern* is back (see "Reversed" note above) but as separate per-role routes, not a single mockup page.

**Retired (2026-07-13):** Beta.dc.html was deleted from Claude Design — no design source exists for a standalone `/beta` marketing page anymore. `/beta` is now a bare `redirect('/register')`, matching the Studio.dc.html precedent; its former invite-code CTA content is fully covered by `/register` itself.

### Venue & Promoter
| .dc.html | Route | src/app path |
|---|---|---|
| Venue.dc.html | /venues/[slug] | src/app/venues/[slug]/page.tsx |
| VenueDashboard.dc.html | /venues/[slug]/dashboard | src/app/venues/[slug]/dashboard/page.tsx (owner-only) |
| VenueAnalytics.dc.html | /venues/[slug]/analytics | src/app/venues/[slug]/analytics/page.tsx (owner-only) |
| BookingInbox.dc.html | /venues/[slug]/booking-inbox | src/app/venues/[slug]/booking-inbox/page.tsx (owner-only) |
| VenueOnboarding.dc.html | /venues/[slug]/onboarding | src/app/venues/[slug]/onboarding/page.tsx (owner-only) |
| PromoterHome.dc.html | /me/promote | src/app/me/promote/page.tsx |
| PromoterAnalytics.dc.html | /me/promote/analytics | src/app/me/promote/analytics/page.tsx |
| FanDashboard.dc.html | /me/dashboard | src/app/me/dashboard/page.tsx (any authenticated user) |
| FanAnalytics.dc.html | /me/analytics | src/app/me/analytics/page.tsx (any authenticated user) |

### Admin
| .dc.html | Route | src/app path |
|---|---|---|
| AdminDash.dc.html | /admin | src/app/admin/page.tsx |

### Error / utility
| .dc.html | Route | src/app path |
|---|---|---|
| 404.dc.html | * (not found) | src/app/not-found.tsx |
| Offline.dc.html | /offline | src/app/offline/page.tsx |

### Additional live routes (no `.dc.html` source — built ahead of/without design, per the explicit-user-request precedent)
| Route | src/app path | What it is |
|---|---|---|
| /this-weekend | src/app/this-weekend/page.tsx | Shows happening near you this weekend |
| /for-you | src/app/for-you/page.tsx | Personalized artist recommendations with "why" reasons |
| /journal | src/app/journal/page.tsx (+ /journal/[slug]) | Editorial/blog content |
| /community | src/app/community/page.tsx | Platform updates, announcements, roadmap voting |
| /community-rules | src/app/community-rules/page.tsx | Community guidelines |
| /status | src/app/status/page.tsx | System status page |
| /audit | src/app/audit/page.tsx | Public Trust & Safety report — aggregate moderation/verification/ad-vetting counts, k-anonymity floor of 5. No `.dc.html` source (built ahead of design, explicit user request). |
| /launch | src/app/launch/page.tsx | Founding-cohort recruitment landing page |
| /walkthrough | src/app/walkthrough/page.tsx | "How a hype becomes a paid show" explainer |
| /copyright | src/app/copyright/page.tsx | Copyright policy |
| /dmca | src/app/dmca/page.tsx | DMCA takedown process |
| /ticket-policy | src/app/ticket-policy/page.tsx | Ticket refund/transfer policy |
| /aux-queue/[slug] | src/app/aux-queue/[slug]/page.tsx | Shared crowd-queue for a show/venue |
| /shows/[slug]/lineup | src/app/shows/[slug]/lineup/page.tsx | Lineup & Split Agreement (LineupSplit.dc.html) — venue proposes a multi-act split of the artist share, each act accepts/declines; booking locks (DRAFT→SCHEDULED) once everyone accepts |
| /h/[code] | src/app/h/[code]/page.tsx | Short HYPE Link redirect — records the click, hands off to `/register?ref=` |
| /invite/[code] | src/app/invite/[code]/page.tsx | Invite-code landing page |
| /embed/[hexId] | src/app/embed/[hexId]/route.ts | Embeddable audio-track widget (iframe) |
| /playlist/[slug] | src/app/playlist/[slug]/page.tsx | Public playlist page |
| /djs/[slug] | src/app/djs/[slug]/page.tsx | Redirect alias → `/promoters/[slug]` (DJ profiles live there — see below) |
| /promoters/[slug] | src/app/promoters/[slug]/page.tsx | DJ/promoter profile hero — despite the route name, this is the live DJ profile page (`dj-hero-actions`, radio tie-in) |
| /me/booking | src/app/me/booking/page.tsx | Venue's "demand radar" — artist booking recommendations |
| /me/wrapped | src/app/me/wrapped/page.tsx | "My Scene" — Spotify-Wrapped-style yearly recap |
| /me/payouts | src/app/me/payouts/page.tsx | Real payout history (RELEASED + PENDING AccountsPayableEntry rows) for the signed-in user's own profiles |
| /advertise/register | src/app/advertise/register/page.tsx | Advertiser Profile signup (5th account type, private-only, no Profile row) — explicit user request, no `.dc.html` source |

### Marketing assets (design-only, no Next.js route needed)
- Deck.dc.html — stakeholder pitch deck
- Email.dc.html — email templates
- EmailSequence.dc.html — welcome drip storyboard
- Social.dc.html — OG share card
- SocialPosts.dc.html — feed + story posts
- Screenshots.dc.html — App Store iPhone frames
- AppStoreCopy.dc.html — App Store copy
- PressKit.dc.html — brand press kit
- NotifDesigns.dc.html — iOS lock screen notifications
- LaunchChecklist.dc.html — pre-launch tracker
- Sitemap.dc.html — internal navigation hub

---

## Sync workflow

1. Check DESIGN_SYNC.md → [PENDING CHANGES] table for what needs implementing
2. For each row: open the .dc.html → translate to .tsx → wire API → push
3. Mark the row `✅ [commit SHA]` in DESIGN_SYNC.md when done
4. Run `node scripts/export-tokens.js > src/app/design-tokens.css` if DS tokens changed

## API client

`lib/api.js` — use this as the API route reference. All endpoints are listed there.
Never add a new API route without a corresponding design change in Claude Design.

## Navigation

All pages share a single nav:
- **Desktop:** fixed top bar — iHYPE logo left · Listen|Events|Pages center · Log In|Sign Up right
- **Mobile:** fixed bottom bar — Listen · Events · Pages with icons

Nav implementation: copy `lib/NavShell.js` + `lib/shell.css` from Claude Design.

## DO / DO NOT

| DO | DO NOT |
|---|---|
| **Read the existing .tsx before touching it** | **Overwrite a file without reading it first** |
| Use Edit tool for UI updates | Use Write tool to replace whole files |
| Translate .dc.html faithfully to .tsx | Invent UI not shown in .dc.html |
| Use `var(--*)` CSS tokens from design system | Hardcode colors or type sizes |
| Wire real API to existing mock data shapes | Change data structure without design update |
| Add `admin@ihype.org` for all contact | Use any other email address |
| Keep split as 70/20/10 / 0% iHYPE | Change the revenue split in any copy |
| Use audio-only for radio/live | Add video hosting or live video |
| Reference `ihype.org` only | Use any other domain |
| Preserve auth gates and DB queries on UI updates | Remove or replace backend logic during UI syncs |
