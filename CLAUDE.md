# iHYPE — Engineering reference for Claude Code

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

### Build script

The build runs migrations through `scripts/prisma-migrate-retry.mjs` before
`prisma generate` and `next build`. The retry wrapper handles transient
Postgres migration-lock contention, but a real migration failure must block the
deployment so the app is not published against an incompatible schema.
