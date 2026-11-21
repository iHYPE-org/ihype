# iHYPE staging

The staging Worker is `ihype-staging`. The intended hostname is
`staging.ihype.org`. The GitHub Actions workflow **Build and deploy iHYPE
staging** validates the bundle on pull requests that change its config. Only
a manual run on `main` deploys it, using the GitHub environment
`Staging – ihype` and its `STAGING_CLOUDFLARE_API_TOKEN`,
`STAGING_CLOUDFLARE_ACCOUNT_ID`, and `STAGING_DATABASE_URL` secrets.

## First deployment

1. Use the separate **iHYPE Staging** Supabase project
   (`rayldncrvaqvzygsdnjr`). Its `pg_trgm` and `citext` extensions are
   installed. Add its direct or session-pooler Postgres URL with TLS
   (`sslmode=require`) as `STAGING_DATABASE_URL` in the staging GitHub
   environment. The workflow rehearses the migrations on empty Postgres
   before applying them to the staging project.
2. Run the manual GitHub workflow to migrate and create the Worker. Install Worker secrets
   using `wrangler secret put <NAME> --config wrangler.staging.toml`,
   including a staging runtime `DATABASE_URL` and a unique `AUTH_SECRET`.
   Configure a staging sign-in method and disposable verified artist and
   venue accounts before browser QA. Attach a separate staging media bucket
   when testing audio uploads.
3. Configure Cloudflare Access for staff on `staging.ihype.org`, then attach
   that hostname to the staging Worker. Verify an unauthenticated request is
   challenged. The Worker configuration disables `workers.dev` and version
   preview URLs.
4. In the admins-only **iHYPE Staging** Mux environment, create staging-only
   Video credentials and a webhook for
   `https://staging.ihype.org/api/webhooks/mux`. Configure Access for that
   exact machine endpoint to accept Mux delivery. Keep the app's signature
   verification enabled. Install `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, and
   `MUX_WEBHOOK_SECRET` on the staging Worker. Verify a valid signed event is
   accepted and an unsigned request is rejected.
5. Enable video uploads in `wrangler.staging.toml` for the provider QA run.
   Use Mux API test assets for a free provider smoke test. The regular iHYPE
   uploader creates standard assets, so authorize any 1080p and native 4K
   uploads before testing app-level ingest, playback and cleanup. See
   [profile sites and Mux](profile-sites-mux-4k.md) for the test cases.
   Mux staging and production share billing.

The staging workflow accepts database URLs only for the staging project and uses staging credentials.
Ticket payments and R2 video archival are disabled in staging.
