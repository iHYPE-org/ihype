# ihype.org production app starter

A production-oriented Next.js application for hosting artist, promoter, venue, and fan pages with beta-safe public pages, account support, hype/upvotes, Prisma/Postgres storage, and Cloudflare Workers deployment.

## Stack

- Next.js App Router and Route Handlers for the web app and API endpoints. Route Handlers are supported inside the `app` directory in current Next.js docs. citeturn0search1turn0search10turn0search16
- Prisma ORM with a PostgreSQL datasource for typed data access. Prisma documents `provider = "postgresql"` in the datasource block and uses `DATABASE_URL` for the connection string. citeturn0search2turn0search11turn0search14turn0search17
- Auth.js credentials auth with Prisma adapter for user accounts.
- Mux live streaming integration. Mux documents creating live streams via the `/live-streams` endpoint and explains that each stream has a unique stream key and playback ID workflow. citeturn0search3turn0search6turn0search9turn0search12

## Features

- The Promise is the main public start page while the product is in beta.
- Pages for artists, DJs, and venues.
- Fan pages with preset-based customization, profile styling, hype tracking, and public fan pages.
- Platform-wide profile hex IDs for fans, artists, promoters, and venues, plus universal share links at `/profiles/<hexId>`.
- Curated in-app launch-readiness page for beta launch gates, hype/fraud architecture, legal and operational readiness, and top launch risks.
- Public integrity page plus transparency snapshot endpoint with versioned feed heuristics and explainable show surfacing.
- Account registration and login.
- Password reset by emailed six-digit passcode with a 5-minute reset window.
- Essential auth cookies only, with session cookies shortened and non-session auth cookies scoped to `/api/auth`.
- Hype button that works like an upvote, one hype per account per show.
- Public health endpoint at `/api/health` for uptime monitors, launch blockers, and beta launch checks.
- Admin beta console for verification review, content reports, support requests, CSV exports, email/MFA delivery, integration readiness, and audit activity.
- Support intake at `/support` for login, verification, takedown, safety, and ticketing issues.
- Authenticated API route for creating shows.
- Authenticated API route for provisioning a Mux live stream and storing playback info.
- Mux webhook endpoint to flip show status between `LIVE` and `ENDED`.
- Prisma schema and seed data for quick local startup.
- Manual launch seed workflow for safe production starter content.
- Dockerfile and `docker-compose.yml` for local production-style runs.

## Local setup

1. Copy `.env.example` to `.env` and fill in values.
2. Start PostgreSQL.
3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client and apply migrations:

```bash
npx prisma migrate dev --name init
```

5. Seed the database:

```bash
npm run prisma:seed
```

6. Run the app:

```bash
npm run dev
```

## Local demo users only

- `fan@ihype.org`
- `promoter@ihype.org`
- `artist@ihype.org`
- `venue@ihype.org`
- `admin@ihype.org`

Password for all demo users:

```text
demo12345
```

Demo logins currently use email and password only.

These demo accounts are for local development and controlled staging only. Production should not expose shared demo credentials, and the app now locks demo logins by default in production unless `FEATURE_ENABLE_DEMO_LOGINS=true` is explicitly set.

## Important production notes

- Use a real OAuth provider, email verification, password reset flow, and bot protection before launch.
- Put the app behind a CDN and WAF.
- Add object storage for poster images and media uploads.
- Replace the simple webhook verification helper with the exact provider-recommended verification flow for your chosen streaming vendor.
- Add observability, background jobs, chat moderation, and rate limiting before trusting the internet with it. The internet is not a serious place.
- Public signup reserves `@ihype.org` email addresses for internal use only.
- Optional invite-only signup is controlled by `FEATURE_REQUIRE_INVITE_CODE=true` and comma-separated `BETA_INVITE_CODES`.
- Auth, signup, and workbench pages are intentionally marked `noindex`.
- The Prisma seed is for local/demo data only and refuses production runs unless `ALLOW_PRODUCTION_SEEDING=true` is explicitly set.
- Production starter content uses `.github/workflows/seed-launch-content.yml` and requires the manual confirmation phrase `seed ihype launch`.
- Admin bootstrap is disabled unless `ALLOW_ADMIN_SETUP=true` and `ADMIN_SETUP_SECRET` are set; disable both immediately after the first admin passkey is registered.
- Security hardening ties JWT sessions to `userSecurityVersion`, so deployments may force legacy sessions without that claim to sign in again.
- Post-deploy smoke tests run against `/api/health`, `/`, `/login`, `/shows`, and `/status`.

## Cookie posture

- The app only keeps essential authentication cookies.
- The session cookie is limited to a 12-hour max age.
- Transient auth cookies such as callback and CSRF cookies are scoped to `/api/auth` and expire quickly.

## Launch readiness page

- Route: `/launch-readiness`
- Focus: executive launch gates, beta pilot planning, hype/fraud architecture, legal and operational readiness, and top launch risks.
- Source: curated from the extended HYPE Network launch-readiness package rather than copied verbatim, so the highest-signal launch material is visible in-product.

## Integrity and transparency

- Route: `/integrity`
- API: `/api/transparency`
- Trust center: `/trust`
- Health endpoint: `/api/health`
- What it adds:
  - versioned public feed heuristics
  - plain-language “Why are you seeing this?” explanations on show surfaces
  - aggregate transparency counters for shows, profiles, hype, and venue requests
  - product commitments around explainability and non-targeted trust posture

## Cloudflare deployment quick start

1. Add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, and `DIRECT_URL` to the GitHub `Production - ihype` environment.
2. Push to `main`.
3. GitHub Actions runs migrations, builds the OpenNext Cloudflare bundle, deploys the Worker and cron Worker, then runs production smoke checks.
5. Add your Mux credentials and webhook secret.
6. Add `OPENAI_API_KEY` if you want fan avatar generation enabled.
7. Add SMTP delivery settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) for live sign-in MFA, sign-up verification, ticket emails, and password reset emails.
8. Add `BLOB_READ_WRITE_TOKEN` before allowing production media uploads.
9. Add `STRIPE_SECRET_KEY` before opening paid ticket capture. Ticket reservations are allowed, but capture is intentionally blocked until real payment processing is configured.
10. Configure email authentication for `ihype.org`: SPF, DKIM, and DMARC for whichever SMTP provider sends MFA, password reset, support, and ticket emails.
11. Enable Vercel Web Analytics, Speed Insights, and an uptime monitor pointed at `/api/health`.
12. Configure database backups and practice one restore into a Preview database before public beta.
13. Have counsel review nonprofit language, user-uploaded media terms, takedown process, ticketing/refund language, tax handling, and payment terms.
14. Deploy with the included `vercel.json`, which runs `npm run vercel-build`.
15. Point your production domain to Vercel and verify auth callbacks, password reset email delivery, show creation, hype voting, Mux webhooks, fan avatar generation, support intake, CSV exports, and the integrity/transparency routes.

## Smoke checks

After starting the app locally or deploying to production, run a lightweight public-route check:

```bash
SMOKE_BASE_URL=https://ihype.org npm run smoke
SMOKE_BASE_URL=https://ihype.org npm run smoke:flows
```

Without `SMOKE_BASE_URL`, the script checks `http://localhost:3000`.

## Beta operations checklist

- Monitoring: enable Vercel Web Analytics and Speed Insights, add an uptime check for `/api/health`, and review Vercel function errors after each deployment.
- Email delivery: verify SPF, DKIM, and DMARC for `ihype.org`; confirm MFA, reset, ticket, and support emails from the production SMTP provider.
- Ticketing: keep paid capture blocked until `STRIPE_SECRET_KEY` and webhook verification are configured; reconcile ticket orders with CSV exports.
- Backups: schedule database backups and test restoring a backup into the Preview database.
- Legal: review nonprofit positioning, uploaded-media rights, copyright/takedown flow, ticketing/refund terms, privacy, and tax/payment handling before public launch.
- Support: triage `/support` requests from the admin console and export support/report/audit CSVs for review.

### Vercel config refresh

- `package.json` now uses `postinstall: prisma generate` so Prisma Client is regenerated during Vercel installs.
- `package.json` now exposes `vercel-build` to keep the Vercel build pipeline explicit: `node scripts/prisma-migrate-retry.mjs && prisma generate && next build`.
- `vercel.json` now points `buildCommand` at `npm run vercel-build` and keeps the function duration override scoped to `src/app/api/**/route.{ts,js}`.
- The old `installCommand` override was removed so Vercel can use its framework-default install behavior.

### Preview database note

- Prisma recommends using a separate `DATABASE_URL` for Vercel Preview so schema migrations from pull requests do not modify the Production database.
- Set `DATABASE_URL` once for Production and again for Preview in the Vercel dashboard.

## Cloudflare nameserver handoff for `ihype.org`

- Cloudflare zone status is now active for `ihype.org`.
- Active nameservers: `sofia.ns.cloudflare.com` and `trace.ns.cloudflare.com`.
- Next step is not nameserver propagation anymore. The next step is adding the exact Vercel DNS records inside Cloudflare DNS.

## SSL/TLS for `ihype.org`

- This app now assumes HTTPS in production.
- Browser routes are redirected to HTTPS in production, and the app sends `Strict-Transport-Security` plus related security headers from `next.config.mjs`.
- If you are using Cloudflare in front of Vercel, set Cloudflare SSL/TLS encryption mode to `Full (strict)` so Cloudflare uses validated HTTPS to the origin.
- Vercel provisions and renews TLS certificates for custom domains automatically after the domain is correctly attached and DNS is pointed at Vercel.
- Keep `AUTH_URL` and `NEXT_PUBLIC_APP_URL` on `https://ihype.org` in Production so auth callbacks and generated absolute URLs stay on TLS.

## `ihype.org` registrar -> Cloudflare -> Vercel steps

1. In Vercel, add `ihype.org` to the project first, then add `www.ihype.org` if you want the `www` host to work explicitly or redirect.
2. In Cloudflare DNS, point the apex domain `ihype.org` to Vercel using the exact records Vercel shows for the project.
3. In Cloudflare DNS, point `www.ihype.org` to Vercel using the exact CNAME target Vercel shows for the project.
4. In Cloudflare SSL/TLS settings, use `Full (strict)` once the Vercel domain is attached and certificate issuance is active.
5. In Vercel, verify the domain configuration and set your preferred redirect between apex and `www`.
6. In Vercel Production environment variables, make sure `AUTH_URL` and `NEXT_PUBLIC_APP_URL` are both set to `https://ihype.org` unless you intentionally want `www` as the primary hostname.
7. In Vercel Preview environment variables, set a separate preview `DATABASE_URL`.
8. After DNS is live, verify HTTPS, login callbacks, integrity route responses, and any webhook URLs that depend on the final production domain.

## Included deployment files

- `.env.example` for required runtime variables
- `vercel.json` for install/build/function settings
- `next.config.mjs` for production-safe Next.js config
