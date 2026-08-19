# Restore point — 2026-08-19, before the console redesign

Taken before starting the move to the vintage-console design direction.

## What is pinned

| | |
|---|---|
| Production commit | `06a07dd` (merge of PR #727) |
| Pinned at | `origin/backup/prod-2026-08-19-pre-console` |
| Applied migrations | 117 |
| Latest migration | `20260817150000_drop_video_stream_columns` |

A **branch**, not a tag: this session's credentials return 403 on
`refs/tags` pushes. A branch pinned at a commit is an identical revert point;
it is only weaker in that a branch can be moved. Do not move it.

### Reverting the application

```
git fetch origin
git checkout -b revert/pre-console origin/backup/prod-2026-08-19-pre-console
# open a PR to main
```

Never force-push `main`. `deploy-production.yml` deploys whatever `main`
points at, so a merged revert PR is the whole procedure for code.

## What this does NOT cover — read before relying on it

A git ref is a backup of **code**. It is not a backup of production.

- **Database.** Reverting code does **not** revert schema. Migrations apply
  automatically on every push to `main` and this repo has no down-migrations;
  a schema change made after this point must be undone by a new forward
  migration, or restored from Supabase's own backup. Verify PITR is enabled in
  the Supabase dashboard — this session cannot check or take a database backup
  (the MCP server is pinned `read_only=true`, by design).
- **R2 bucket `ihype-media`** — uploaded audio, artwork and verification
  documents. Not covered. Needs `rclone`/`aws s3 sync` against the bucket.
- **KV namespace `b6330641874a4420b240d3a82760a9aa`** — runtime flags. Not
  covered. `wrangler kv key list` to export.
- **Worker secrets.** Not covered, and deliberately not in the repo.

## Database state at this point

Verified by direct query, so a restore can be sanity-checked against it.

| Table | Rows |
|---|---|
| User | 14 |
| Profile | 15 |
| Show | 8 |
| ArtistMediaAsset | 26 |
| TicketOrder | 0 |
| Ticket | 0 |
| Ad | 0 |
| AccountsPayableEntry | 0 |

**Nothing has ever been sold.** Zero orders, zero tickets, zero ad campaigns,
zero payable entries — consistent with live-mode Stripe holding no
PaymentIntents. The 14 users are the launch seed and the team.

This is the single most useful fact about the risk of the redesign: there is
almost no production data to lose, and no customer whose purchase could be
disrupted. The expensive, irreversible thing a redesign could damage does not
exist yet. It is therefore a good moment to make a large change, and a bad
moment to spend days building elaborate data-backup machinery for a database
whose entire contents are a seed script.

## Migration health

`_prisma_migrations` carries one row with `finished_at IS NULL`:
`20260726120000_add_advertiser_category_pitch`. It also carries
`rolled_back_at = 2026-07-28` — this is the resolved remnant of the P3009
incident documented in CLAUDE.md, not a live blocker. A rolled-back row does
not stop `prisma migrate deploy`, and 20 migrations have applied since.
Deploys are healthy.
