# iHYPE Codex project instructions

## Project goal
This repository contains a production-oriented Next.js app for hosting artist, DJ, and venue pages with audio shows, account support, hype voting, Prisma/Postgres data storage, and Cloudflare deployment config.

## Working agreements
- Prefer small, reviewable changes over broad refactors.
- Keep the app compatible with the GitHub Actions to Cloudflare deployment path and Prisma migrations.
- Preserve the current stack unless a task explicitly requires a replacement.
- Treat environment variables and secrets as external configuration. Never hardcode secrets.
- Preserve the newer signed-in visual schema. Do not replace the role landing pages with older inactive directory layouts.
- Keep auth redirects and role module links working while updating visuals. The safe path is to keep role pages wrapped by `ProfileDirectoryPage`, keep `RoleModuleSubheader`, and keep role-aware routing in `src/lib/account-routing.ts`.

## Stack expectations
- Framework: Next.js App Router
- Language: TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Auth: Auth.js
- Media: audio playback and uploads
- Hosting target: Cloudflare through GitHub Actions

## GitHub source of truth
- GitHub is the production source of truth for code.
- Local checkouts are for editing, testing, and committing only; they are not a production deployment source.
- Production deploys must run from `.github/workflows/deploy-production.yml` after code is pushed or merged to GitHub `main`.
- Do not bypass `scripts/guard-github-deploy-source.mjs` or run raw `wrangler deploy` commands from a local checkout.

## Before changing code
- Read `README.md`, `DEPLOY.md`, `package.json`, `.github/workflows/deploy-production.yml`, `wrangler.toml`, and `prisma/schema.prisma` first.
- Check `src/lib/env.ts` and any API route touched by the task for runtime assumptions.
- Prefer reusing existing utilities/components before adding new ones.

## After changing code
- Run the narrowest useful validation first.
- For dependency or build changes, run:
  - `npm install`
  - `npx prisma generate`
  - `npm run build`
- For Prisma schema changes, also run:
  - `npx prisma migrate dev --name <descriptive_name>` locally
  - update seed logic if required

## Safety / deployment rules
- Do not commit `.env` files or real credentials.
- Keep `DATABASE_URL` and auth secrets in environment variables only.
- Do not disable webhook verification in production code.
- Keep preview and production environment assumptions separate.

## Common task map
- Homepage and routing: `src/app/`
- API handlers: `src/app/api/`
- Shared utilities: `src/lib/`
- UI components: `src/components/`
- Data model and migrations: `prisma/`
- Deployment config: `.github/workflows/deploy-production.yml`, `wrangler.toml`, `wrangler.cron.toml`, `.env.example`, `next.config.mjs`

## Priority when making tradeoffs
1. Correctness
2. Security
3. Deployability
4. Simplicity
5. Style polish
