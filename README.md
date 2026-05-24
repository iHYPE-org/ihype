# ihype.org production app

A production-oriented Next.js application for hosting artist, promoter, venue, and fan pages with beta-safe public pages, account support, hype/upvotes, Prisma/Postgres storage, and Cloudflare deployment.

## Stack

- Next.js App Router and Route Handlers for the web app and API endpoints.
- Prisma ORM with PostgreSQL.
- Auth.js credentials auth with Prisma adapter for user accounts.
- Audio media playback and uploads.
- Cloudflare hosting through GitHub Actions.

## GitHub Source Of Truth

GitHub is the production source of truth for code.

Local checkouts are for editing, testing, and committing only. Production deploys must come from the committed GitHub `main` branch through `.github/workflows/deploy-production.yml`.

The deploy guard in `scripts/guard-github-deploy-source.mjs` makes `npm run cf:deploy` and `npm run cf:deploy:cron` refuse to run outside the GitHub Actions production workflow. That prevents a local working tree from publishing code that is not stored in GitHub.

## Features

- The Promise is the main public start page while the product is in beta.
- Pages for artists, DJs, and venues.
- Fan pages with preset-based customization, profile styling, hype tracking, and public fan pages.
- Platform-wide profile hex IDs for fans, artists, promoters, and venues, plus universal share links at `/profiles/<hexId>`.
- Public integrity page plus transparency snapshot endpoint with versioned feed heuristics and explainable show surfacing.
- Account registration and login.
- Password reset by emailed six-digit passcode with a 5-minute reset window.
- Essential auth cookies only, with session cookies shortened and non-session auth cookies scoped to `/api/auth`.
- Hype button that works like an upvote, one hype per account per show.
- Public health endpoint at `/api/health` for uptime monitors and beta launch checks.
- Admin beta console for verification review, content reports, support requests, CSV exports, email/MFA delivery, integration readiness, and audit activity.
- Support intake at `/support` for login, verification, takedown, safety, and ticketing issues.
- Authenticated API routes for shows, media, profile management, ticketing, and admin workflows.
- Prisma schema and seed data for local startup.

## Local Setup

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

## Local Demo Users Only

- `fan@ihype.org`
- `promoter@ihype.org`
- `artist@ihype.org`
- `venue@ihype.org`
- `admin@ihype.org`

Password for all demo users:

```text
demo12345
```

These demo accounts are for local development and controlled staging only. Production should not expose shared demo credentials, and the app locks demo logins by default in production unless `FEATURE_ENABLE_DEMO_LOGINS=true` is explicitly set.

## Cloudflare Deployment

1. Add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, and app runtime secrets to GitHub secrets or the production GitHub environment.
2. Commit the change.
3. Push or merge to GitHub `main`.
4. GitHub Actions checks out the exact pushed SHA.
5. The workflow runs Prisma generation, migrations, `npm run cf:build`, the Cloudflare Pages deploy, and the cron Worker deploy.

Do not deploy production from a local checkout. Use GitHub `main` as the only production code source.

## Important Production Notes

- Use real OAuth/email verification/password reset settings and bot protection before launch.
- Put the app behind Cloudflare CDN/WAF controls.
- Use configured R2 storage for poster images and audio uploads.
- Keep webhook verification enabled in production code.
- Public signup reserves `@ihype.org` email addresses for internal use only.
- Optional invite-only signup is controlled by `FEATURE_REQUIRE_INVITE_CODE=true` and comma-separated `BETA_INVITE_CODES`.
- Auth, signup, and account pages are intentionally marked `noindex`.
- The Prisma seed is for local/demo data only and refuses production runs unless `ALLOW_PRODUCTION_SEEDING=true` is explicitly set.

## Cookie Posture

- The app only keeps essential authentication cookies.
- The session cookie is limited to a 12-hour max age.
- Transient auth cookies such as callback and CSRF cookies are scoped to `/api/auth` and expire quickly.

## Included Deployment Files

- `.github/workflows/deploy-production.yml` for the GitHub Actions production deploy.
- `scripts/guard-github-deploy-source.mjs` for blocking local production deploys.
- `wrangler.toml` and `wrangler.cron.toml` for Cloudflare configuration.
- `.env.example` for required runtime variables.
- `next.config.mjs` for production-safe Next.js config.
