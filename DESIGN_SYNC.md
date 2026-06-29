# iHYPE Design Sync Workflow
# ──────────────────────────────────────────────────────────
# How each design iteration flows from Claude Design → ihype.org
#
# PIPELINE:
#   Claude Design (.dc.html) → GitHub (src/app/*.tsx) → Cloudflare → ihype.org
#
# AGENTS:
#   Claude Design  — owns .dc.html files + design system
#   Claude Code    — owns src/app/ + API + database
#   Both           — read this file to stay in sync

---

## Step 1 · Design changes in Claude Design

When a page is updated, this file is edited:
  - DESIGN_SYNC.md → add entry to [PENDING CHANGES] below
  - .dc.html page updated
  - Ready for Claude Code to implement

---

## Step 2 · Claude Code reads DESIGN_SYNC.md

Claude Code checks [PENDING CHANGES] and for each entry:
  1. Opens the .dc.html URL listed
  2. Translates HTML/CSS/JS → Next.js page + components
  3. Wires the API calls listed under each change
  4. Marks the entry as [DONE] with commit SHA

---

## Step 3 · GitHub → Cloudflare → ihype.org (automatic)

  git push origin main
  → GitHub Actions: deploy-production.yml runs
  → OpenNext builds → Cloudflare Workers deploys
  → Live at ihype.org within ~2 minutes

---

## Page Map · .dc.html → Next.js route

| Design File          | Next.js Route              | src/app path                    |
|----------------------|----------------------------|---------------------------------|
| Index.dc.html        | /                          | src/app/page.tsx                |
| About.dc.html        | /about                     | src/app/about/page.tsx          |
| Auth.dc.html         | /login + /register         | src/app/auth/*/page.tsx         |
| Join.dc.html         | /register                  | src/app/register/page.tsx       |
| Privacy.dc.html      | /privacy                   | src/app/privacy/page.tsx        |
| Terms.dc.html        | /terms                     | src/app/terms/page.tsx          |
| Transparency.dc.html | /transparency              | src/app/transparency/page.tsx   |
| Legal.dc.html        | /terms + /privacy          | src/app/legal/page.tsx          |
| Home.dc.html         | /home                      | src/app/home/page.tsx           |
| FanHome.dc.html      | /home (role=fan)           | src/app/home/page.tsx           |
| Profile.dc.html      | /profile                   | src/app/profile/page.tsx        |
| Studio.dc.html       | /studio                    | src/app/studio/page.tsx         |
| Show.dc.html         | /shows/[slug]              | src/app/shows/[slug]/page.tsx   |
| Artist.dc.html       | /artists/[slug]            | src/app/artists/[slug]/page.tsx |
| Tickets.dc.html      | /me/tickets                | src/app/tickets/page.tsx        |
| Radio.dc.html        | /radio                     | src/app/radio/page.tsx          |
| WebRadio.dc.html     | /radio/live                | src/app/radio/live/page.tsx     |
| Discover.dc.html     | /discover                  | src/app/discover/page.tsx       |
| Payout.dc.html       | /payout/[eventId]          | src/app/payout/[id]/page.tsx    |
| PromoterHome.dc.html | /home (role=promoter)      | src/app/home/page.tsx           |
| EventCreator.dc.html | /events/new                | src/app/events/new/page.tsx     |
| Verification.dc.html | /verify                    | src/app/verify/page.tsx         |
| AdminDash.dc.html    | /admin                     | src/app/admin/page.tsx          |
| Beta.dc.html         | /beta                      | src/app/beta/page.tsx           |
| DJProfile.dc.html    | /artists/[slug] (role=dj)  | src/app/artists/[slug]/page.tsx |
| Notifications.dc.html| /me/notifications          | src/app/notifications/page.tsx  |
| Support.dc.html      | /support                   | src/app/support/page.tsx        |
| Search.dc.html       | /search                    | src/app/search/page.tsx         |
| Settings.dc.html     | /me/settings               | src/app/settings/page.tsx       |
| FanProfile.dc.html   | /fans/[slug]               | src/app/fans/[slug]/page.tsx    |
| Venue.dc.html        | /venues/[slug]             | src/app/venues/[slug]/page.tsx  |
| Welcome.dc.html      | /welcome                   | src/app/welcome/page.tsx        |
| Offline.dc.html      | /offline + /_error         | src/app/not-found.tsx + error   |
| Charter.dc.html      | /charter                   | src/app/charter/page.tsx        |
| Sitemap.dc.html      | — design nav only —        | —                               |
| Mobile.dc.html       | — design reference only —  | mobile/ (React Native)          |
| Deck.dc.html         | — marketing only —         | —                               |
| Email.dc.html        | — email templates —        | src/lib/email/templates/        |

---

## Design Token Map · DS → Next.js globals.css

Claude Code: copy these into src/app/globals.css

```css
/* iHYPE Design Tokens — auto-synced from DS 39bcce7b */

:root {
  /* Backgrounds */
  --bg:  #0a0805;
  --bg2: #100d09;
  --bg3: #1a1611;
  --bg4: #241d18;

  /* Text */
  --ink:  #f0ebe5;
  --line: rgba(255, 255, 255, 0.06);

  /* Brand */
  --accent:    #ff5029;   /* iHYPE orange-red */

  /* Roles */
  --fan:       #b983ff;   /* purple */
  --venue:     #22e5d4;   /* teal */
  --promoter:  #ff3e9a;   /* pink */
  --artist:    #ff5029;   /* same as accent */

  /* Typography */
  --font-display: 'Syne', sans-serif;         /* 800 weight only */
  --font-body:    'DM Sans', sans-serif;       /* 400/500 */
  --font-mono:    'JetBrains Mono', monospace; /* labels, ALL CAPS */
  --font-serif:   'Instrument Serif', serif;   /* italic, editorial */

  /* Radius */
  --radius-sm:  8px;
  --radius-md:  10px;
  --radius-lg:  24px;
  --radius-xl:  32px;
  --radius-pill: 9999px;

  /* Motion */
  --ease-spring: cubic-bezier(0.2, 0.7, 0.3, 1);
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;
}
```

---

## API Client · lib/api.js → src/lib/api.ts

Claude Code: the design API client (lib/api.js) maps 1:1 to the Next.js API routes.
For server components, use `db.*` directly. For client components, use fetch or SWR.

```typescript
// Pattern used in all .dc.html pages:
const shows = await API.events.list({ city: 'San Francisco' });

// Next.js server component equivalent:
const shows = await db.event.findMany({
  where: { city: 'San Francisco', status: 'PUBLISHED' },
  orderBy: { startsAt: 'asc' }
});
```

---

## Sync Rules

1. **Design is source of truth for:** layout, copy, colors, component structure
2. **Code is source of truth for:** data shapes, auth logic, business rules
3. **Never diverge on:** 45/45/10 split, $0 fees copy, role colors
4. **Always sync on:** major layout changes, new pages, removed features

---

## PENDING CHANGES
<!-- Claude Design adds entries here. Claude Code marks them [DONE]. -->

| # | Page | What Changed | API Calls | Status |
|---|------|-------------|-----------|--------|
| 1 | Sitemap.dc.html | New main app hub — Listen/Events/Pages tabs | GET /api/transparency | ✅ N/A — design-nav only, no Next.js route |
| 2 | Studio.dc.html | Full creator dashboard — event wizard, demand radar, earnings | POST /api/events, GET /api/studio | ✅ 9063400 |
| 3 | Show.dc.html | 45/45/10 split bar added | GET /api/events/:id | ✅ ebb8fdd |
| 4 | All pages | lib/api.js + lib/nav.js injected | — | ✅ N/A — design reference only, nav.js is a no-op |
| 5 | Radio.dc.html | Full DJ Studio rewrite — accordion sections (Details/Setup/Deck/Archive), dual deck player, crossfader, FX buttons, live audio, voiceover, recording, auto-save shows | GET /api/radio/shows, POST /api/radio/live, POST /api/radio/record | ✅ 9063400 |
| 6 | WebRadio.dc.html | Live audio player + saved shows + schedule tabs; bookmark per show persists to localStorage; playback position saved per show | GET /api/radio/shows, GET /api/radio/shows/:id/replay | ✅ c1f0462 |
| 7 | About.dc.html | Timeline corrected — all dates now 2026 (Portland ME founding), removed pre-founding 2025 dates | — | ✅ ebb8fdd |
| 8 | All web pages (26) | Global NavShell added — fixed top nav with wordmark, nav links, role pill, skeleton overlay, footer auto-injected. lib/shell.css + lib/NavShell.js | — | ✅ c1f0462 |
| 9 | mobile/*.jsx (14 files) | All DS namespace refs updated 0c4241 → 39bcce; hex colors → DS tokens; px values → rem; ResizeObserver suppressed | — | ✅ N/A — React Native files, not in Next.js repo |
| 10 | Charter.dc.html | New standalone charter page at /charter | GET /api/transparency | ✅ ebb8fdd |
| 11 | Join.dc.html | New 4-step onboarding: role picker → city → genres → confirm | POST /api/auth/register | ✅ c1f0462 |
| 12 | NavShell (all pages) | Single nav only — desktop top bar (logo left · Listen\|Events\|Pages center · Log In + Sign Up right), mobile fixed bottom tabs. lib/nav.js is now a no-op. | — | ✅ c1f0462 |
| 13 | Join.dc.html | Step 4 submit now routes → Welcome.dc.html (not FanHome). Welcome routes role-aware: Fan→FanHome, Artist→Studio, Venue→Venue, DJ→DJProfile | — | ✅ ebb8fdd |
| 14 | Offline.dc.html | New 503/offline fallback page. Handles ?code=offline\|503\|500. Auto-retries on window.online event. | — | ✅ ebb8fdd |
| 18 | Index.dc.html | Add "What's a HYPE?" section between Features and Final CTA — eyebrow, H2, lead paragraph, hype-fire chip, 3 steps in 2-col grid | — | ✅ pending commit |
| 19 | WebRadio.dc.html | Live/Replay pills, 44-bar waveform scrubber (click to seek), hype mechanic at timestamp, DJ identity block (follow/tip), up-next crate queue (live only), schedule rail with notify-me toggle, offline/no-show state | GET /api/shows?radioShows=1 | ✅ pending commit |

---

## DONE
<!-- Completed syncs with commit SHA -->

| # | Page | Commit | Date |
|---|------|--------|------|
| — | — | — | — |

---

## Quick Commands for Claude Code

```bash
# Pull latest design files from this project
# (Claude Design exports; Claude Code imports)

# 1. Check what changed
cat DESIGN_SYNC.md | grep "⏳ Pending"

# 2. View the design page
open https://claude.ai/projects/[project-id]/[page].dc.html

# 3. Implement + commit
git add src/app/[route]/page.tsx
git commit -m "sync: implement [page] from design — DESIGN_SYNC #[n]"
git push origin main

# 4. Verify live
open https://ihype.org/[route]

# 5. Mark done in DESIGN_SYNC.md
# Change ⏳ Pending → ✅ [commit SHA]
```
