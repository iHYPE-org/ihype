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
| `src/app/home/page.tsx` | Workbench shell; WorkbenchData from DB via `getWorkbenchData()` |
| `middleware.ts` | HTTPS enforcement; www→apex redirect; auth protection for /home /dashboard /admin |
| `src/lib/permissions.ts` | `isAdminSession()` — checks `role === 'ADMIN'` |
| `src/lib/runtime-flags.ts` | Feature flags: invite codes, demo logins, media storage |

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
| Beta.dc.html | /beta | src/app/beta/page.tsx |
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
| FanHome.dc.html | /home | src/app/home/page.tsx |
| Discover.dc.html | /discover | src/app/discover/page.tsx |
| Search.dc.html | /search | src/app/search/page.tsx |
| Notifications.dc.html | /me/notifications | src/app/notifications/page.tsx |
| FanProfile.dc.html | /fans/[slug] | src/app/fans/[slug]/page.tsx |
| Tickets.dc.html | /me/tickets | src/app/tickets/page.tsx |
| Settings.dc.html | /me/settings | src/app/settings/page.tsx |

### Events
| .dc.html | Route | src/app path |
|---|---|---|
| Show.dc.html | /shows/[slug] | src/app/shows/[slug]/page.tsx |
| EventCreator.dc.html | /events/new | src/app/events/new/page.tsx |
| Payout.dc.html | /payout/[eventId] | src/app/payout/[id]/page.tsx |

### Creator / Artist
| .dc.html | Route | src/app path |
|---|---|---|
| Artist.dc.html | /artists/[slug] | src/app/artists/[slug]/page.tsx |
| DJProfile.dc.html | /artists/[slug]?role=dj | src/app/artists/[slug]/page.tsx |
| WebRadio.dc.html | /radio | src/app/radio/page.tsx |
| Pages.dc.html | /pages | src/app/pages/page.tsx |

**Retired:** Studio.dc.html (the generic creator workbench) is gone — `/studio` is now a bare `redirect('/home')` with no auth gate, no `StudioDashboard` component, and nothing in the app links to it. Its former responsibilities live on Home (dashboard), EventCreator (event creation), and WebRadio (DJ radio management).

### Venue & Promoter
| .dc.html | Route | src/app path |
|---|---|---|
| Venue.dc.html | /venues/[slug] | src/app/venues/[slug]/page.tsx |
| PromoterHome.dc.html | /home?role=promoter | src/app/home/page.tsx |

### Admin
| .dc.html | Route | src/app path |
|---|---|---|
| AdminDash.dc.html | /admin | src/app/admin/page.tsx |

### Error / utility
| .dc.html | Route | src/app path |
|---|---|---|
| 404.dc.html | * (not found) | src/app/not-found.tsx |
| Offline.dc.html | /offline | src/app/offline/page.tsx |

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
