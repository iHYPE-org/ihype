# ihype.org production app starter

A production-oriented Next.js application for hosting artist, DJ, and venue pages with streaming shows as the homepage focus, account support, hype/upvotes, and backend logic for livestream provisioning.

## Stack

- Next.js App Router and Route Handlers for the web app and API endpoints. Route Handlers are supported inside the `app` directory in current Next.js docs. citeturn0search1turn0search10turn0search16
- Prisma ORM with a PostgreSQL datasource for typed data access. Prisma documents `provider = "postgresql"` in the datasource block and uses `DATABASE_URL` for the connection string. citeturn0search2turn0search11turn0search14turn0search17
- Auth.js credentials auth with Prisma adapter for user accounts.
- Mux live streaming integration. Mux documents creating live streams via the `/live-streams` endpoint and explains that each stream has a unique stream key and playback ID workflow. citeturn0search3turn0search6turn0search9turn0search12

## Features

- Streaming shows are the main homepage content.
- Pages for artists, DJs, and venues.
- Fan pages with AI sprite-companion generation for 13+ fans, with family-friendly character output.
- Platform-wide profile hex IDs for fans, artists, promoters, and venues, plus universal share links at `/profiles/<hexId>`.
- Curated in-app launch-readiness page for the Chicago pilot and September 6, 2026 launch target.
- Public integrity page plus transparency snapshot endpoint with versioned feed heuristics and explainable show surfacing.
- Account registration and login.
- Password reset by emailed six-digit passcode with a 5-minute reset window.
- Essential auth cookies only, with session cookies shortened and non-session auth cookies scoped to `/api/auth`.
- Hype button that works like an upvote, one hype per account per show.
- Authenticated API route for creating shows.
- Authenticated API route for provisioning a Mux live stream and storing playback info.
- Mux webhook endpoint to flip show status between `LIVE` and `ENDED`.
- Prisma schema and seed data for quick local startup.
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

## Demo users

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

## Important production notes

- Use a real OAuth provider, email verification, password reset flow, and bot protection before launch.
- Put the app behind a CDN and WAF.
- Add object storage for poster images and media uploads.
- Replace the simple webhook verification helper with the exact provider-recommended verification flow for your chosen streaming vendor.
- Add observability, background jobs, chat moderation, and rate limiting before trusting the internet with it. The internet is not a serious place.

## Cookie posture

- The app only keeps essential authentication cookies.
- The session cookie is limited to a 12-hour max age.
- Transient auth cookies such as callback and CSRF cookies are scoped to `/api/auth` and expire quickly.

## Launch readiness page

- Route: `/launch-readiness`
- Focus: executive launch gates, Chicago pilot plan, hype/fraud architecture, legal and operational readiness, and top launch risks.
- Source: curated from the extended HYPE Network launch-readiness package rather than copied verbatim, so the highest-signal launch material is visible in-product.

## Integrity and transparency

- Route: `/integrity`
- API: `/api/transparency`
- What it adds:
  - versioned public feed heuristics
  - plain-language “Why are you seeing this?” explanations on show surfaces
  - aggregate transparency counters for shows, profiles, hype, and venue requests
  - product commitments around explainability and non-targeted trust posture

## Vercel deployment quick start

1. Import the repo into Vercel as a Next.js project.
2. Add the environment variables from `.env.example` to Production and Preview.
3. Use a separate PostgreSQL database for Preview deployments so preview migrations do not touch Production.
4. Connect a managed PostgreSQL database such as Neon and set `DATABASE_URL` per environment.
5. Add your Mux credentials and webhook secret.
6. Add `OPENAI_API_KEY` if you want fan avatar generation enabled.
7. Add SMTP delivery settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) if you want live password reset emails enabled.
8. Deploy with the included `vercel.json`, which runs `npm run vercel-build`.
9. Point your production domain to Vercel and verify auth callbacks, password reset email delivery, show creation, hype voting, Mux webhooks, fan avatar generation, and the integrity/transparency routes.

### Vercel config refresh

- `package.json` now uses `postinstall: prisma generate` so Prisma Client is regenerated during Vercel installs.
- `package.json` now exposes `vercel-build` to keep the Vercel build pipeline explicit: `prisma generate && prisma migrate deploy && next build`.
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
