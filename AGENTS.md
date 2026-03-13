# iHYPE Codex project instructions

## Project goal
This repository contains a production-oriented Next.js app for hosting artist, DJ, and venue pages with live streaming shows, account support, hype voting, Prisma/Postgres data storage, and Vercel deployment config.

## Working agreements
- Prefer small, reviewable changes over broad refactors.
- Keep the app compatible with Vercel deployment and Prisma migrations.
- Preserve the current stack unless a task explicitly requires a replacement.
- Treat environment variables and secrets as external configuration. Never hardcode secrets.

## Stack expectations
- Framework: Next.js App Router
- Language: TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Auth: Auth.js
- Streaming: Mux
- Hosting target: Vercel

## Before changing code
- Read `README.md`, `package.json`, `vercel.json`, and `prisma/schema.prisma` first.
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
- Keep `DATABASE_URL`, Mux credentials, and auth secrets in environment variables only.
- Do not disable webhook verification in production code.
- Keep preview and production environment assumptions separate.

## Common task map
- Homepage and routing: `src/app/`
- API handlers: `src/app/api/`
- Shared utilities: `src/lib/`
- UI components: `src/components/`
- Data model and migrations: `prisma/`
- Deployment config: `vercel.json`, `.env.example`, `next.config.mjs`

## Priority when making tradeoffs
1. Correctness
2. Security
3. Deployability
4. Simplicity
5. Style polish
