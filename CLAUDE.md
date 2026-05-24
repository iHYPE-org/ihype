# iHYPE Engineering reference for Claude Code

## NextAuth v5 beta pinning

`next-auth` is pinned to **`5.0.0-beta.31`** (exact, no caret) and mirrored in
`overrides` so transitive installs can't pull a different beta.
`@auth/prisma-adapter` is pinned to **`2.11.2`** for the same reason: the
adapter interface and the auth package must be bumped together.

### Why exact pinning matters for beta packages

npm's semver resolution of `^5.0.0-beta.31` matches `>=5.0.0-beta.31 <6.0.0`,
which includes future betas and the eventual stable release. NextAuth v5 betas
have shipped breaking changes to:

- `callbacks.jwt` / `callbacks.session` argument shapes
- `NextAuthConfig` cookie option names
- `PrismaAdapter` model expectations
- The `auth()` server-component helper return type

An unexpected bump during `npm install` on a fresh GitHub Actions deploy can
break the login flow silently if the types still compile.

### Upgrade procedure

1. Read the [NextAuth releases](https://github.com/nextauthjs/next-auth/releases)
   for every beta between the current pin and the target version.
2. Check the `@auth/prisma-adapter` changelog for the matching release.
3. Update both version strings in `package.json`: the `dependencies` entry
   **and** the `overrides` entry.
4. Run `npm install` locally and verify `node_modules/next-auth/package.json`
   shows the expected version.
5. Test the OTP login flow end-to-end (challenge creation, OTP verify, session
   cookie, `auth()` in a server component, `useSession` in a client component).
6. Verify `session.user.role` is still populated via the `jwt` / `session`
   callbacks in `src/lib/auth.config.ts`.
7. Deploy from GitHub and confirm Prisma adapter migrations are not needed for
   the `Account`, `Session`, or `VerificationToken` models.

## Deployment guardrails

### GitHub source of truth

GitHub is the production source of truth for code. Production deploys must run
from the committed GitHub `main` branch through `.github/workflows/deploy-production.yml`.
Local checkouts are for editing, testing, and committing only.

`scripts/guard-github-deploy-source.mjs` blocks `npm run cf:deploy` and
`npm run cf:deploy:cron` unless they are running inside the GitHub Actions
production deploy workflow for `colinatwood/ihype` on `refs/heads/main`.

Do not bypass that guard with raw local `wrangler deploy` commands.

### Before every commit that touches pages or routes

1. **Run `npx next build` locally** - catches TypeScript errors, missing imports,
   and invalid `next.config.mjs` options before GitHub Actions sees them.
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
