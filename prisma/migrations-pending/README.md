# Gated migrations

Migrations parked here are **not applied**. Prisma never looks in this
directory — only `prisma/migrations/`.

## Why this exists

`.github/workflows/deploy-production.yml` runs `prisma migrate deploy` against
production on every push to `main`. Anything in `prisma/migrations/` ships the
moment it merges.

For a long time this repo relied on a comment in the migration header —
`DO NOT APPLY BLIND`, followed by a checklist — to mark a migration as needing
human verification first. That never worked. There was no step anywhere that
read those comments, so all three migrations written that way were applied
automatically, including two that drop data:

| Migration | Intended gate | What happened |
|---|---|---|
| `20260714020000_drop_ad_submission` | Confirm `AdSubmission` row count, get owner sign-off | Applied on merge |
| `20260714050000_drop_ad_image_url` | Confirm no historical rows depend on `Ad.imageUrl` | Applied on merge |
| `20260727120000_enable_rls_all_tables` | Confirm the app's role owns the tables before enabling RLS | Applied on merge |

`scripts/check-gated-migrations.mjs` now enforces the convention: a migration
whose header carries a gate marker fails CI if it sits in `prisma/migrations/`.

Those three keep their misleading headers, deliberately. Prisma records a
checksum of every applied migration in `_prisma_migrations` and `migrate deploy`
aborts with a mismatch if the file changes afterwards — so editing an applied
migration, even just its comments, would block every future production deploy.
They are grandfathered by name in the checker instead. This file is the
accurate record; their headers are not.

## How to gate a migration

Write it as normal, then park it:

```
git mv prisma/migrations/<name> prisma/migrations-pending/<name>
```

Put the verification steps in the header, above the SQL, starting with a marker
the checker recognises (`@gated` is the explicit one):

```sql
-- @gated
-- Before applying:
--   1. <the thing someone must actually check>
--   2. <...>
```

## How to apply one

In its own commit, separate from any other change, once the checklist has
genuinely been carried out:

```
git mv prisma/migrations-pending/<name> prisma/migrations/<name>
```

Remove the `@gated` marker and record what was verified and by whom. The commit
moving the directory *is* the approval — keep it small enough to review at a
glance, and expect it to apply to production as soon as it merges.

## Ordering

Prisma applies migrations in lexicographic directory-name order and tracks what
it has already run in `_prisma_migrations`. A parked migration keeps its
original timestamp, so one held back across other releases will apply out of
timestamp order once unparked. That is fine for independent changes; if the
migration depends on schema that landed after it was written, rename it with a
current timestamp when moving it back.
