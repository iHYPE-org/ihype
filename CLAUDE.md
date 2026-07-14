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
| `src/components/RadioShowCreator.tsx` | `GET /api/radio/ad-plan` for AI ad-scope sizing; free-use crate from `initialCrate` prop; `POST`/`PATCH /api/shows` for draft/schedule/go-live |
| `src/app/radio/page.tsx` | `GET /api/shows?radioShows=1`; localStorage position + bookmark persistence |
| `src/app/api/shows/route.ts` | Full show CRUD; rate limiting; 45/45/10 enforcement; radioShows filter |
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
| `src/app/api/artist-media/route.ts` | Every track upload (not just free-use ones) now runs AI metadata vetting via `vetFreeUseSample()` — fail-open, still publishes on a flag, but raises a `ContentReport` (`targetType: 'track'`) into the existing `/admin/moderation` queue. |
| `src/lib/image-vetting.ts` | `vetImageUpload()` — vision-model AI screening (`runVisionAI` in `src/lib/ai.ts`, `@cf/llava-hf/llava-1.5-7b-hf`) for uploaded image bytes. Fail-open, same `{cleared, requiresManualReview, reasoning}` shape as `vetFreeUseSample`. Wired into `src/app/api/profile/upload-graphic/route.ts` (avatar/hero/logo/gallery — raises `ContentReport` `targetType: 'profile-image'` on flag) and `src/app/api/ads/upload/route.ts` (creative image — flags force `AdSubmission.status` to `manual_review` even if ad copy passed, and raise `ContentReport` `targetType: 'ad-creative'`). `src/app/api/verify/route.ts` (ownership proof documents) is deliberately left un-AI-vetted — it already requires mandatory human review via `/admin/verifications`. |
| `src/app/api/admin/moderation/[id]/route.ts` | The moderation queue's "approve" action now takes real enforcement action (`enforceRemoval()`) keyed by `ContentReport.targetType`, not just a status flip: `track` → unpublishes the `ArtistMediaAsset`; `comment` → soft-deletes the `ShowComment`; `show` → cancels the `Show`; `ad-creative` → rejects the `AdSubmission`; `profile-image` → nulls the specific flagged `Profile` field (`heroImage`/`avatarImage`/`logoImage`/`galleryImage` — the field name is encoded in `ContentReport.reason` as `auto_flag_image:<field>` by `upload-graphic/route.ts`). `profile` still has no automated action (free-text bio/content, not a single field) — an admin has to look. |
| `src/components/admin/AdminShell.tsx` | Added an `SUBNAV` strip (below the top bar, above page content) so every real `/admin/*` subpage is reachable by a click — not just Overview/Users/Content/Finance/Ads/Support/System/Growth. `/admin/flagged` (dead `loading.tsx`-only directory, no `page.tsx`) was deleted outright. `/admin/verifications` still has no `page.tsx`/route either, but its directory holds `AdminVerificationQueue.tsx`, which is actively imported by `/admin/review/page.tsx` — left in place, not deleted. `/admin/device-register` is intentionally unlinked — reached only via an emailed one-time-token link during device re-registration. |
| `src/app/audit/page.tsx` | Public Trust & Safety report — aggregate `ContentReport`/`AdSubmission`/verification counts only, no PII, no content IDs. Categories with fewer than 5 reports (`K_ANON_FLOOR`) are folded into "Other" so a small bucket can never identify a specific user or piece of content. Distinct from `/transparency` (financial stats) and `/status` (system health, not audited here — still has no auth gate, a pre-existing separate concern). |

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
- **Split:** 45% artist / 45% venue / 10% promoters / 0% iHYPE — locked in charter
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
| DJProfile.dc.html | /promoters/[slug] | src/app/promoters/[slug]/page.tsx — despite living in the `/artists/[slug]` file per the original design mapping, real DJ profiles are gated `profile.type !== 'DJ' → notFound()` at `/promoters/[slug]` (see the "Additional live routes" table below); `artists/[slug]/page.tsx` is ARTIST-only (`profile.type !== 'ARTIST' → notFound()`) |
| WebRadio.dc.html | /radio | src/app/radio/page.tsx |
| Pages.dc.html | /pages | src/app/pages/page.tsx |

**Retired:** Studio.dc.html (the generic creator workbench) is gone — `/studio` is now a bare `redirect('/listen')` with no auth gate, no `StudioDashboard` component, and nothing in the app links to it. Its former responsibilities live on Listen (discovery/radio), EventCreator (event creation), and WebRadio (DJ radio management).

**Retired:** Home.dc.html (the role-switching Fan/Artist/Venue/DJ single-dashboard mockup) has no live route — the Workbench/Home dashboard it depicted was superseded by the Listen/Events/Pages tab architecture; `/home` is now just a `redirect('/listen')` alias for old bookmarks/links. Its Fan section's responsibilities live on Listen (`ListenHome.tsx`); its Artist/Venue/DJ sections live on Pages' role toolkit (`PageRoleModules.tsx`) and each role's own profile page.

**Retired (2026-07-13):** Beta.dc.html was deleted from Claude Design — no design source exists for a standalone `/beta` marketing page anymore. `/beta` is now a bare `redirect('/register')`, matching the Studio.dc.html precedent; its former invite-code CTA content is fully covered by `/register` itself.

### Venue & Promoter
| .dc.html | Route | src/app path |
|---|---|---|
| Venue.dc.html | /venues/[slug] | src/app/venues/[slug]/page.tsx |
| PromoterHome.dc.html | /me/promote | src/app/me/promote/page.tsx |

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
| /h/[code] | src/app/h/[code]/page.tsx | Short HYPE Link redirect — records the click, hands off to `/register?ref=` |
| /invite/[code] | src/app/invite/[code]/page.tsx | Invite-code landing page |
| /embed/[hexId] | src/app/embed/[hexId]/route.ts | Embeddable audio-track widget (iframe) |
| /playlist/[slug] | src/app/playlist/[slug]/page.tsx | Public playlist page |
| /djs/[slug] | src/app/djs/[slug]/page.tsx | Redirect alias → `/promoters/[slug]` (DJ profiles live there — see below) |
| /promoters/[slug] | src/app/promoters/[slug]/page.tsx | DJ/promoter profile hero — despite the route name, this is the live DJ profile page (`dj-hero-actions`, radio tie-in) |
| /me/booking | src/app/me/booking/page.tsx | Venue's "demand radar" — artist booking recommendations |
| /me/wrapped | src/app/me/wrapped/page.tsx | "My Scene" — Spotify-Wrapped-style yearly recap |

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
| Keep split as 45/45/10 / 0% iHYPE | Change the revenue split in any copy |
| Use audio-only for radio/live | Add video hosting or live video |
| Reference `ihype.org` only | Use any other domain |
| Preserve auth gates and DB queries on UI updates | Remove or replace backend logic during UI syncs |
