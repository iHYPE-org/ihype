# iHYPE Codex project instructions

## Project goal
This repository contains a production-oriented Next.js app for local-music discovery, artist and venue profiles, audio hosting, events, account support, hype voting, and Prisma/Postgres data storage.

## Working agreements
- Prefer small, reviewable changes over broad refactors.
- Keep the app compatible with Prisma migrations.
- Preserve the current stack unless a task explicitly requires a replacement.
- Treat environment variables and secrets as external configuration. Never hardcode secrets.
- Music · Map · Me is the only design system permitted in the application. Do not use, restore, extend, or expose an older shell, design generation, visual language, or component system in any runtime interface.
- `/app/map` is the canonical authenticated landing route. `/app/music/*`, `/app/map/*`, and `/app/me/*` are modules of the same authenticated application and must use the Music · Map · Me shell, tokens, primitives, and interaction patterns.
- Keep authentication redirects pointed at `/app/map`. Treat `/listen`, `/home`, `/workbench`, and `/dashboard` only as compatibility aliases that redirect into the canonical Music · Map · Me application; they must never render an alternate or legacy authenticated experience.
- Delete or port every implementation of `ModuleDeckMockup`, the older full-screen module deck, or another superseded design. Do not retain legacy shell components, styles, fixtures, or browser contracts as dormant code; compatibility routes may contain redirects only.

## Stack expectations
- Framework: Next.js App Router
- Language: TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Auth: Auth.js
- Media: audio only; video hosting and live-streaming providers are outside the product scope
- Profiles: artist, venue, listener, and private advertiser accounts only. DJ and promoter roles/profiles are retired and must not be reintroduced.
- Hosting target: Cloudflare

## Before changing code
- Read `README.md`, `package.json`, and `prisma/schema.prisma` first.
- Check `src/lib/env.ts` and any API route touched by the task for runtime assumptions.
- Prefer reusing existing utilities/components before adding new ones.

## After changing code
- Run the narrowest useful validation first.
- Run `npm run guard:design` after Claude/Codex UI syncs. It is intentionally wired into build/deploy to catch old-design regressions before they ship.
- For dependency or build changes, run:
  - `npm install`
  - `npx prisma generate`
  - `npm run build`
- For Prisma schema changes, also run:
  - `npx prisma migrate dev --name <descriptive_name>` locally
  - update seed logic if required

## Safety / deployment rules
- Do not commit `.env` files or real credentials.
- Keep `DATABASE_URL`, media-storage credentials, and auth secrets in environment variables only.
- Do not disable webhook verification in production code.
- Keep preview and production environment assumptions separate.

## Common task map
- Homepage and routing: `src/app/`
- API handlers: `src/app/api/`
- Shared utilities: `src/lib/`
- UI components: `src/components/`
- Data model and migrations: `prisma/`
- Deployment config: `.env.example`, `next.config.mjs`

## Priority when making tradeoffs
1. Correctness
2. Security
3. Deployability
4. Simplicity
5. Style polish
