# Security sweep — 2026-09-02

Six review passes over the whole tree (authentication and authorization on
every route; injection, XSS, SSRF and redirects; the money path and Stripe
webhooks; uploads and object storage; secrets, sessions, headers, rate limits
and logging; dependencies and CI/CD), each finding verified against the code
before it was acted on, plus the production signals in Sentry.

Everything marked **fixed** landed in the same change as this document. Items
marked **operator** need a dashboard or an account this repository cannot
reach. Items marked **accepted** or **follow-up** are recorded so the next
sweep can tell "reviewed" from "nobody looked".

## Fixed in this change

| Sev | Where | What was wrong | What changed |
|---|---|---|---|
| **High** | `POST /api/dmca` + `dmca-enforce` cron | Anyone, unauthenticated, could arm a 10-day auto-cancel on any show by naming its URL; the cron then set it CANCELED with no refunds, no counter-notice and no admin step. Nothing else ever wrote `dmcaStatus`. | The notice now files a `ContentReport` (`dmca_notice`) in the moderation queue, notifies the content owner, and emails the admin. The cron acts only on `dmcaStatus: 'CONFIRMED'`, which nothing sets automatically. |
| **High** | `/api/stripe/webhook` | A valid signature was treated as proof the event was about the order named in `metadata`. Connected accounts hold their own keys, so a venue could pay $0.50 on its own account with another order's `confirmationCode` and have that order finalized; the same with `metadata.adId` flipped a campaign to APPROVED. | `src/lib/stripe-webhook-guards.ts` (tested): the event's `account` must be the order's settlement account (venue for VENUE_DIRECT, none otherwise), the amount must cover `totalChargeCents`, ad events must be platform-account and hold at least the budget, and a live/test mode mismatch is refused. |
| **High** | `/api/newsletter/confirm` | `Profile.name` interpolated unescaped into a `text/html` response outside the CSP matcher — stored XSS for anyone clicking a real confirmation link. | `src/lib/html-escape.ts`; both `htmlPage()` helpers escape. |
| **High** | `isTrustedStorageUrl()` | Trusted any `*.r2.dev` / `*.r2.cloudflarestorage.com` host and any `data:` URL for the client-submitted ad `audioUrl`, so the upload route's checks could be skipped and the object swapped after vetting. | Client-submitted URLs must be our own `/cdn/` path. `isStoredMediaUrl()` keeps the legacy arms for DB-sourced delete paths only. |
| **High** | `POST /api/ads/impression` | Anonymous callers could spend a real advertiser's captured budget at 100 hits an hour per IP with no dedup; settlement captured it. | Sign-in required; one charge per listener per ad per day. |
| Medium | `/app/me/venues/[slug]/calendar` | No session check; listed DRAFT shows to any member. | Owner or admin only. |
| Medium | `/api/stripe/connect/return` | Unauthenticated; probed any profile's Connect state and flipped `stripeConnectOnboarded`. | Owner or admin only, like `refresh`. |
| Medium | `/verify-email` | `callbackUrl` pushed unchecked — open redirect after entering a real code. | `isSafeLocalRedirect`. |
| Medium | `/api/auth/magic-link` | Per-IP limit only; N addresses could bomb one inbox with live sign-in links. | Per-address limit of 3 per 15 min, answered `ok:true`. |
| Medium | Payout cron | Transfer then RELEASED write; a failed write plus a 24-hour idempotency window paid the entry twice next day. | `findPayoutTransfer()` asks Stripe for the entry's transfer before creating one. |
| Medium | Outbound email | Show titles, venue and artist names, member names interpolated unescaped into HTML mail (phishing-shaped links under the iHYPE sender). | `escapeHtml` on every member-derived value in `email-digest`, `mailer` (ticket email), `held-track-notice`, `ad-campaign-notify`, `artist-earnings-email`, `weekly-digest-email`, `onboarding-emails`, `dmca-enforce`. |
| Medium | Verification proof documents | Collected (ID, licence, passport page) and readable by **nobody** — no route ever selected `verificationProofUrl`. MIME trusted from the client. | Magic-byte sniff on ingest; admin-only, audited `GET /api/admin/verifications/[profileId]/proof` served as an attachment; queue shows whether a document is attached. |
| Medium | Service worker | Precached `/tickets` and cached `/settings`, `/payouts`, `/support/...` etc. into the Cache API — one account's page for the next person on a shared device. | Honours `Cache-Control: private/no-store`; wider network-only list; `/tickets` out of the precache. |
| Medium | `resolve-failed-migration.yml` | Free-text dispatch input expanded inside `run:` in a job holding the production `DIRECT_URL`; no protected environment. | Input via `env:`; `environment: Production – ihype`. |
| Medium | `backup-database.yml` | Floating `wrangler@4` install in a job holding the DB URL, backup passphrase and Cloudflare token. | Pinned to the lockfile's version. |
| Low | 6-digit codes | 24-hour lifetime against a 10-per-15-min guess limit; on `/api/me/email` a lucky guess binds someone else's address. | 30 minutes. |
| Low | `GET /api/auth/signout` | Cross-site logout via `<img src>`. | Refused when `Sec-Fetch-Site: cross-site`. |
| Low | Sentry | Refused-admin log carried the full email address. | Domain only. |
| Low | `workers/cron.ts` `/smoke` | `!==` compare, accepted `Bearer undefined` when unset. | Constant-time, fails closed (tested). |
| Low | `PATCH /api/admin/ads` | Approving an already-decided campaign reissued a checkout (second hold). | `PENDING` precondition, 409 otherwise. |
| Low | `/api/shows/[showId]/cancel` | Failed refunds left CAPTURED orders on a CANCELED show with nobody told. | Admin alert email when any refund fails. |
| Low | `clickUrl` on campaigns | Stored any scheme, any length; rendered as a link. | https only, ≤2048. |
| Low | `/cdn/[...key]` | Malformed escape threw a 500. | 404. |
| Low | Album cover key | Deterministic key behind a year-long immutable cache: a replaced cover stayed stale for a year. | Versioned key; previous object deleted. |
| Low | Upload size pre-check | Absent `Content-Length` skipped the check; a chunked body was buffered whole. | Chunked-with-no-length refused (tested). |
| Low | Admin moderation page | Checked `role === 'ADMIN'` rather than `isAdminSession()`. | Aligned. |
| Info | `docs/dependency-advisories.md` | Two dev-only `prisma` CLI advisories (`deepmerge-ts`, `mysql2`) undocumented. | Recorded with reasons; `npm audit --omit=dev` is 0. |

## Operator items (cannot be done from the repository)

1. **Stripe webhook secret.** Production logged 109 signature failures and 10
   "secret not configured" errors on 2026-08-26 to 08-30, every one from the
   same source address — inside Cloudflare's published `2a06:98c0::/29` range
   (WARP egress), not in Stripe's published webhook IP list, and the same
   address that browsed `/welcome` on 08-09. That is a `stripe listen
   --forward-to https://ihype.org/api/stripe/webhook` session on the owner's
   machine: the CLI signs with its own secret, so the endpoint's configured
   secret can never match it. Not an attack, and not a misconfiguration of the
   dashboard endpoint. To confirm: Stripe Dashboard → Developers → Webhooks →
   the endpoint's recent deliveries should show 2xx once real events flow. If a
   second endpoint listens to connected accounts, put its secret in
   `STRIPE_CONNECT_WEBHOOK_SECRET`.
2. **Self-hosted CI runner** executes PR-head code on a persistent machine with
   caches that survive between runs. Run it `--ephemeral` in a fresh container
   or VM per job, and keep "Require approval for all outside collaborators" on.
3. **Branch protection on `main`** must require the CI check *and* a review;
   the auto-merge workflow's safety argument rests on it, and it cannot be
   read from here. Consider `CODEOWNERS` for `.github/workflows/**`,
   `wrangler*.toml`, `scripts/**`, `prisma/migrations/**`, `package*.json`.
4. **Required reviewers on the `Production – ihype` environment**, since every
   deploy runs repository scripts with the production database URL, backup
   passphrase and Cloudflare token.
5. The admin allowlist refusals in Sentry (8, on 2026-08-09/10) were the
   owner's former personal address before the 08-13 allowlist fix. Nothing to do.

## Accepted or deferred, with reasons

- **Sign-out does not revoke the JWT** (12-hour lifetime). Bumping
  `userSecurityVersion` on sign-out would sign every device out at once, which
  is a product decision; a per-device denylist needs a store. Follow-up.
- **Passkey challenges live in an httpOnly cookie** with no server-side
  consumption, so a captured assertion could be replayed within 5 minutes by
  setting the cookie. Needs a KV-backed single-use record. Follow-up.
- **Magic link consumed on GET** — a link-previewing mail scanner can burn it.
  Follow-up (confirm page with auto-POST).
- **Impressions are self-reported by the player.** A signed-in member is now
  capped at one charge per ad per day; a signed play token minted with the
  station payload would make the charge provable. Follow-up. The always-on
  station does not report impressions at all today — station ads are unbilled,
  which is a revenue gap rather than an exposure.
- **Any signed-in member can park public audio under `ads/audio/`** without a
  campaign row. Bounded by 10 MB × 10/hour; a sweep of unreferenced keys is
  the fix. Follow-up.
- `/app/me/artists/[slug]/believers` and `/epk` render for any member; both are
  plausibly public by design (hypes are public; a press kit is for the press).
  Confirm intent.
- CSP does not reach `/api/*` (middleware matcher). Low impact for JSON; the
  one HTML-emitting API route is now escaped.

## Verified sound (so the next sweep need not start from zero)

Session cookie flags and JWT secret handling; `securityVersion` re-checked on
every `auth()`; magic-link token hashing, expiry, atomic single use and
no-enumeration answers; passkey rpId/origin/UV requirements and the atomic
bootstrap capability; Turnstile fail-closed in production; rate limiter denies
when both backends fail; CSP nonces with no `unsafe-inline`; HSTS/COOP/CORP/
nosniff/XFO; cron bearer constant-time and fail-closed; all 35 admin routes
behind `isAdminSession`/`requireAdminApi`; owner checks on every media, album,
profile, show and Connect mutation; `$queryRaw` everywhere tagged; no
`innerHTML`/`eval`; `/embed` escapes; `/cdn` prefix allowlist and `..`
refusal; every `uses:` in every workflow pinned to a SHA; lockfile v3 with
registry-only resolutions; no secrets in tracked files or `wrangler.toml`
vars; Supabase MCP `read_only` and feature pinning as CLAUDE.md states;
price/quantity/capacity integrity on ticket checkout; refund vs payout state
machine disjoint; ad-settlement capped at budget and idempotent.
