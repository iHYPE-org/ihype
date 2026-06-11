# iHYPE — Engineering reference for Claude Code

## ⚠️ INFRASTRUCTURE: Cloudflare Workers, NOT Vercel

**This app is deployed to Cloudflare Workers via OpenNext (`npm run cf:build` + `wrangler deploy`).**

- **Never reference Vercel** in code, comments, docs, or instructions. It is not used.
- Hosting: Cloudflare Workers
- Cron jobs: `wrangler.cron.toml` (not `vercel.json`)
- Edge headers: `cf-ipcity`, `cf-ipcountry`, `cf-iplongitude`, `cf-iplatitude` (not `x-vercel-ip-*`)
- Cache purge: Cloudflare Cache API with `CLOUDFLARE_ZONE_ID` secret
- KV storage: Cloudflare Workers KV (not Vercel KV)
- Deployment CI: `.github/workflows/deploy-production.yml` → `wrangler deploy`

## NextAuth v5 beta pinning

`next-auth` is pinned to **`5.0.0-beta.31`** (exact, no caret) and mirrored in
`overrides` so transitive installs can't pull a different beta.
`@auth/prisma-adapter` is pinned to **`2.11.2`** for the same reason — the
adapter interface and the auth package must be bumped together.

### Why exact pinning matters for beta packages

npm's semver resolution of `^5.0.0-beta.31` matches `>=5.0.0-beta.31 <6.0.0`,
which includes future betas and the eventual stable release. NextAuth v5 betas
have shipped breaking changes to:
- `callbacks.jwt` / `callbacks.session` argument shapes
- `NextAuthConfig` cookie option names
- `PrismaAdapter` model expectations
- The `auth()` server-component helper return type

An unexpected bump during `npm install` can break the login flow silently if the types still compile.

### Upgrade procedure

1. Read the [NextAuth releases](https://github.com/nextauthjs/next-auth/releases)
   for every beta between the current pin and the target version.
2. Check the `@auth/prisma-adapter` changelog for the matching release.
3. Update both version strings in `package.json` — the `dependencies` entry
   **and** the `overrides` entry.
4. Run `npm install` locally and verify `node_modules/next-auth/package.json`
   shows the expected version.
5. Test the OTP login flow end-to-end (challenge creation → OTP verify →
   session cookie → `auth()` in a server component → `useSession` in a client
   component).
6. Verify `session.user.role` is still populated via the `jwt` / `session`
   callbacks in `src/lib/auth.config.ts`.
7. Deploy to a preview environment and confirm Prisma adapter migrations are
   not needed for the `Account`, `Session`, or `VerificationToken` models.

## Deployment guardrails

### Before every commit that touches pages or routes

1. **Run `npx next build` locally** — catches TypeScript errors, missing imports,
   and invalid `next.config.mjs` options before deployment.
2. **When deleting a page**, do all of the following in the same commit:
   - Search `next.config.mjs` for the path in `source:` or `destination:` and
     update/remove those entries.
   - Search the whole `src/` tree for hardcoded `href` values pointing to that
     path and update them.
   - Remove it from `public/manifest.json` shortcuts if present.
3. **Never point a redirect `destination:` at a path that has no page.**
   `next build` does not validate redirect destinations; broken ones silently
   404 in production.

### Merge conflict rule

When resolving a merge conflict in a large component file
(`WorkbenchShell.tsx`, `workbench/page.tsx`, etc.) **never take one side
wholesale**. Manually merge both sets of changes. If uncertain, list the
commits that would be lost from each side and ask before proceeding.

### `next.config.mjs` redirect hygiene

- A `source` that matches an existing `src/app/.../page.tsx` route causes a
  build error (redirect conflicts with the page). Always remove the redirect
  when the page is created.
- Keep redirects pointing to deleted pages updated in the same PR that deletes
  the page.

## Workbench-only UI rule — DO NOT VIOLATE

**`/home` with `WorkbenchShell` is the ONLY authenticated UI.** There is no other dashboard, no role-selection screen, no module picker.

- `/workbench` and `/dashboard` are legacy aliases only. Keep them redirected to `/home`; do not build new pages there.
- `/home` must stay `Cache-Control: no-store` and network-only in the service worker because it is user-specific.
- Every logged-in user (fan, artist, DJ, venue, admin) lands at `/home` and sees `WorkbenchShell`.
- `WorkbenchShell` is `position: fixed; inset: 0` — it is the entire screen. Do NOT render any content outside it in `home/page.tsx`.
- Do NOT create new standalone pages for authenticated features. Add a new `view` inside `WorkbenchShell` instead.
- Do NOT recreate `/artists`, `/promoters`, `/venues`, `/fans`, `/discover`, `/playlists`, `/collab`, `/settings`, or `/radio` as full pages for authenticated users. The middleware already redirects logged-in users from these paths to `/home`.
- The old role-based layout with separate user-type pages and module choices is permanently retired. Never restore it.

### Two workbench surfaces — features must mount in BOTH

`home/page.tsx` renders two separate UIs, CSS-toggled by viewport:
`WorkbenchShellV2` (desktop) and `WorkbenchMobile` + the
`src/components/workbench/MobileScreen*` files (phone). They do not share
screen composition. **Any user-facing workbench feature must be mounted in
both surfaces in the same PR** — a component added only to the desktop shell
is invisible to every phone user, and vice versa. This has silently dropped
features twice (setlist voting existed only in mobile; the daily discovery
card shipped desktop-only). Before finishing a workbench feature, grep for
its component name in both `WorkbenchShellV2.tsx` and the `MobileScreen*`
files and verify it renders in each.

### Build script

`npm run build` (and `cf:build`) does **not** run migrations. Migrations run in
the **deploy workflow** (`.github/workflows/deploy-production.yml`), which calls
`prisma migrate deploy` with a retry loop before the build step. The script
`scripts/prisma-migrate-retry.mjs` is a standalone helper that can be invoked
directly but is not wired into any npm build script. A migration failure blocks
the deploy; the old grep-on-status approach (fail-open) must never be
reintroduced.

## Database & migrations

- **Production database:** Supabase (Postgres 17, us-east-1). The old Neon
  database is deprecated and pending decommission; do not reference or use it.
- **GitHub Actions secrets:** `DATABASE_URL` and `DIRECT_URL` both hold the
  Supabase **session pooler** string
  (`aws-1-us-east-1.pooler.supabase.com:5432`, username `postgres.<ref>`)
  because the Supabase direct host is IPv6-only and Actions runners lack IPv6.
- **schema.prisma** reads `env("DIRECT_DATABASE_URL")` for the direct/migration
  URL. The deploy workflow maps `secrets.DIRECT_URL` into that env var:
  `DIRECT_DATABASE_URL: ${{ secrets.DIRECT_URL }}`.
- **Baseline:** The DB was baselined on 2026-06-10. `_prisma_migrations` now
  tracks all migrations. `prisma migrate deploy` is always safe to run.
- **Runtime DB access (Workers):** `src/lib/db.ts` prefers the Cloudflare
  Hyperdrive binding (`HYPERDRIVE`) and falls back to `DATABASE_URL` when
  running outside Workers.
- **Rate limiting:** `RateLimiterDO` Durable Object defined in `worker.js`
  (binding `RATE_LIMITER_DO`); KV fallback for local dev.
- **RLS:** Supabase Row Level Security is enabled deny-all on all public tables
  as defense-in-depth. The app uses Prisma as table owner; PostgREST/Data API
  is unused. New tables created outside Prisma migrations must have RLS enabled
  explicitly.
- **Search:** `pg_trgm` powers the trigram indexes used by `/api/search`.
- **Email:** Non-transactional email must use `sendMarketingEmail`
  (`src/lib/mailer.ts`) so unsubscribe footers and preferences are applied.
