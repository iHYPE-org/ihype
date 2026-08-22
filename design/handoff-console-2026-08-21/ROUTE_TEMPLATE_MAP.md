# Route ↔ template map

Which design-system artifact governs which route in `iHYPE-org/ihype`. Use this
to decide what to rebuild when a route changes, and what to read before touching
a route's UI.

## App shell — `/app/*`

The shell itself is one template: `templates/simplified-app/` (DC name
`SimplifiedApp`, label "iHYPE App Shell"). Chrome comes from
`components/shell/`.

| Route | Surface in the template | Shell components |
|---|---|---|
| `/app/map` | MAP module — real Leaflet/OSM map in `map.html`, layer chips, result line, pin sheet | `MapSheet`, `Scrim`/`Vignette`, `LogoTrigger`, `ArcNav`, `NavHint`, `PlayerPill` |
| `/app/music/discover` | Discover cards + universal search | `ModulePane` |
| `/app/music/radio` | Five generated stations (genre · new · local · from others · your history) | `ModulePane` |
| `/app/music/charts` | Local chart rows, by hype | `ModulePane` |
| `/app/music/recommended` | Recommended cards | `ModulePane` |
| `/app/music/playlists` | Playlist cards | `ModulePane` |
| `/app/me` | ME surface — identity, stats, four in-page rows, appearance | `ModulePane` |
| `/app/me/settings` · `/info` · `/legal` · `/accessibility` | ME in-page panels | — |

Code: `src/app/app/layout.tsx`, `src/components/mmm/*`, `src/app/mmm.css`,
`src/lib/mmm-nav.ts`.

## Public and marketing

| Route | Template | Code |
|---|---|---|
| `/` | `templates/landing/` | `src/app/page.tsx`, `src/components/FanFirstLanding.tsx` |
| `/about`, `/info` | `templates/about/` | `src/app/about/page.tsx` |
| `/for-fans`, `/for-artists`, `/for-venues` | `templates/site-pages/` | `src/app/for-*/page.tsx` |
| `/charter` | `templates/charter/` | `src/app/charter/page.tsx` |
| `/transparency` | `templates/transparency/` | `src/app/transparency/page.tsx` |
| `/legal`, `/terms`, `/privacy`, `/copyright`, `/dmca` | `templates/legal/` | `src/app/legal|terms|privacy|copyright|dmca/page.tsx` |
| `/community-rules`, `/ticket-policy` | `templates/trust-policy/` | `src/app/community-rules|ticket-policy/page.tsx` |
| `/status` | `templates/status/` | `src/app/status/page.tsx` |
| `/support` | `templates/support-tickets/` | `src/app/support/page.tsx` |
| `/advertise` | `templates/advertise/`, `templates/advertiser-signup/` | `src/app/advertise/page.tsx`, `src/lib/station-breaks.ts` |
| `/audit` | `templates/audit/` | `src/app/audit/page.tsx` |
| `/beta` | `templates/beta-launch-deck/`, `beta/*` | `src/app/beta/page.tsx` |

## Auth and onboarding

| Route | Template | Code |
|---|---|---|
| `/login`, `/register` | `templates/auth/` | `src/app/login|register/page.tsx` |
| `/register/<role>` | `templates/role-onboarding/` | `src/app/register/*` |
| `/verify`, `/verify-email` | `templates/verify/` | `src/app/verify|verify-email/page.tsx` |
| `/welcome`, `/walkthrough` | `templates/welcome/` | `src/app/welcome|walkthrough/page.tsx` |

Role picker: **Fan · Artist · Venue · Advertiser**. No Promoter, no DJ.

## Profiles, shows, money

| Route | Template | Code |
|---|---|---|
| `/artists/[slug]`, `/venues/[slug]`, `/fans/[slug]` | `templates/profile-page/` | `src/app/artists|venues|fans/[slug]/*` |
| `/shows`, `/this-weekend` | `templates/discover/` | `src/app/shows|this-weekend/page.tsx` |
| `/shows/[slug]` | `templates/show-detail/` | `src/app/shows/[slug]/*` |
| `/tickets/*` | `templates/show-detail/` (ticket card) | `src/app/tickets/page.tsx`, `/api/tickets/*` |
| lineup splits | `templates/lineup-split/` | `src/lib/show-payouts.ts` |
| `/payouts`, `/me/payout-settings` | `templates/payouts/` | `src/app/payouts/page.tsx` |
| `/settings` | `templates/role-settings/` | `src/app/settings/page.tsx` |
| creator dashboards | `templates/role-dashboard/` | `src/app/admin/*`, `src/app/for-you/page.tsx` |
| `/pages` (page builder) | `templates/page-builder/` | `src/app/pages/page.tsx`, `/api/page-builder/*` |
| booking | `templates/booking-inbox/` | `/api/shows/*` |
| `/collab-board`, `/community` | `templates/site-pages/` | `src/app/collab-board|community/page.tsx` |

## Notifications, email, social

| Artifact | Template |
|---|---|
| Transactional email | `templates/email/` |
| Push / in-app notifications | `templates/notif-designs/` |
| Event cancellation | `templates/event-cancel/` |
| Social cards | `templates/social/` |
| Press / artist / venue / fan / app-store kits | `templates/press-kit/`, `templates/artist-kit/`, `templates/venue-kit/`, `templates/fan-kit/`, `templates/app-store-kit/` |

## Native shells

| Artifact | Template | Code |
|---|---|---|
| iOS | `templates/mobile-app/` | `ios/App/*`, `capacitor.config.ts` |
| Android | `templates/mobile-app/` | `android/app/*` |
| Offline | `engineering/offline.html` | `src/app/offline/page.tsx`, `public/sw.js` |

## Mobile

There is no separate mobile build. `templates/simplified-app/` IS the mobile app:
it reads `env(safe-area-inset-*)` through a probe element, drops to a 66px
chrome under 620px wide, and sizes modals in `dvh`. Capacitor wraps that page
unchanged. `templates/mobile-app/` frames it in iOS and Android bezels and
carries the `capacitor.config.ts`, the permission list and the App Store note
about Stripe vs In-App Purchase.

`templates/ios-app/`, `templates/android-app/` and `templates/android-screen/`
were deleted 2026-08-08: all three described the retired four-tab structure
(Home · Charts · Shows · You) and two cited the DJ referral, a role removed from
the charter on 2026-08-06. There is no per-platform template now, by design —
`templates/mobile-app/` frames the real shell at 393 × 852 and 412 × 892 with
the notch, punch-hole and gesture-bar geometry of each, so the phone build is
the desktop build at a phone width. Formerly flagged, not
touched.

## Removed

Retired 2026-08-08 to keep the system to surfaces that exist:
`templates/page-creator/` (the AI page generator — replaced by
`templates/page-builder/`, a fixed per-type schema: generation cost tokens on
every page and still produced pages that had to be hand-edited into a common
shape),
`templates/fan-app/` (the pre-shell three-tab app, superseded by
`templates/simplified-app/`), `templates/workbench/` and
`templates/workbench-screen/` (the role-switching single dashboard, gone from the
product — `/studio` and `/home` redirect to `/listen`), `templates/track-detail/`
(no track route), and the `templates/sitemap/` and `templates/product-brief/`
internal docs. `design_handoff_music_map_me/` went with them — a dated bundle
whose copies had drifted from live, and whose `lib/i18n-data/` was being compiled
into the bundle a second time alongside `lib/`.
