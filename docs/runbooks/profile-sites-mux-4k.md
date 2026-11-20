# Artist/Venue sites + Mux Basic 4K

**Status:** code guarded, not live until this checklist and an approved deploy.
**Cost policy:** default 1080p, 4K explicitly chosen for each video; no live streams.

## Architecture

- Public `/site/[slug]` is rendered by the existing Next.js/Cloudflare Worker.
  Content is queried from the existing artist/venue Profile, approved Shows and
  published artist audio; no separate websites or domains need to be provisioned.
- The owner opens Website + video from `/app/me/profiles`, edits a strict JSON
  theme/section config, previews instantly, saves drafts, or publishes after
  identity/ownership verification. No HTML, scripts, or external embeds accepted.
- Videos use Mux Direct Uploads at the browser. Max 2 GiB/file, **15 minutes per video**, 12 videos/profile,
  max 8 new uploads/account/hour, 1080p default, 2160p opt-in. Mux `basic`
  with `max_resolution_tier: "2160p"` supports true 4K on demand.
- The signed Mux asset-ready webhook enforces the duration cap: videos over 15 minutes are blocked and their Mux assets
  deleted. Processing costs may already have been incurred before rejection.
- An emergency upload kill switch must **not** block existing users from
  unpublishing or deleting hosted videos. Provider credentials are still required for external deletion.
- Mux assets have **zero playback IDs** until the verified owner explicitly
  publishes the ready video. Publish adds a public playback ID; unpublish revokes
  it with Mux before clearing the app's published state.
- Mux webhook HMAC-SHA256 is verified against the raw body with 5-minute drift.
  Never add a bypass for testing. Provider errors don't publish anything.

## Account setup before activating

1. Create a Mux account for iHYPE. Apply for Mux nonprofit credits first and
   verify their award and expiration. Enable billing alerts and a conservative
   spending cap (or provider-imposed alert). Costs depend on stored and delivered
   minutes, including 4K 4x pricing vs 720p in Basic. Do not assume unlimited
   free streaming.
2. Create Mux API access token with Video permissions in its dashboard. Configure
   the live webhook destination
   `https://ihype.org/api/webhooks/mux`, subscribing at minimum to:
   `video.upload.asset_created`, `video.asset.created`,
   `video.asset.ready`, `video.asset.errored`,
   `video.upload.errored`, `video.asset.deleted`.
3. Install the following **Cloudflare Worker secrets** out of band (NEVER
   commit values, and do not use NEXT_PUBLIC_*):
   - `MUX_TOKEN_ID`
   - `MUX_TOKEN_SECRET`
   - `MUX_WEBHOOK_SECRET` (webhook endpoint signing secret, not API token).
4. Keep `FEATURE_ENABLE_VIDEO_UPLOADS = "false"` in wrangler.toml until
   production smoke tests pass. Uploads also require all three Mux secrets.
5. The migration `20261119190000_profile_sites_and_mux_videos` must be
   deployed through the existing migration workflow before the new routes
   are made available. A default draft is not persisted until the owner saves.

## Production release / QA gates

- Confirm dev/staging database migration, Prisma client generation,
  `npm run lint`, `npm test`, `npm run cf:build`, Playwright Chromium smoke.
- Confirm fan profiles never receive the site editor.
- Confirm unauthenticated and other-user GET/PATCH/POST/DELETE return 401/404;
  an unverified artist can edit drafts but cannot publish. A pending-verified
  artist can request uploads but only a fully verified profile can publish.
- Check contact information is OFF in defaults and hidden from public pages
  unless owner enables it; public site 404s if unpublished.
- Send a signed Mux test event and check raw-body signature verification;
  check the 15-minute boundary, out-of-order events, unknown assets and
  non-owner/anonymous operations. The unit tests cover these cases;
  reject invalid signatures, expired timestamps, replayed state regressions.
- Start with a **Mux Test Asset** via a separately configured non-production
  environment and `test: true` on a test Direct Upload, if available. Mux
  documents that these are free, watermarked, limited to 10 seconds, and
  deleted automatically after 24 hours. They check API wiring but do not
  establish billing or long-form 4K delivery cost. Never enable `test: true`
  on ordinary member uploads in production.
- Upload short 1080p and 2160p samples by direct signed upload URL from browser.
  Wait for webhook READY, then publish and play on `/site/[slug]`.
  Verify selecting 2160p actually makes a 4K rendition available when the
  source itself is 4K; smaller source is not magically upscaled to 4K.
- Unpublish and confirm revoked playback ID stops future playback, then test
  deletion, upload cancellation, malformed file inputs, large-file rejection,
  request limits, and mobile network interruption.
- Verify CSP permits Mux iframe player on `/site/*` and direct Google
  Cloud Storage transfer from the owner editor only.
- Check on iPhone and desktop, with show/music/player controls, mobile nav,
  reduced-motion and keyboard navigation. Measure Cloudflare Worker costs.
- Deploy with upload feature flag still FALSE to confirm migration and existing
  audio/profile behavior is unaffected; only then explicitly enable it in a
  reviewed config change after the account's costs and webhooks are confirmed.

## Access and revenue

iHYPE is free for every user. Publishing, accessing, and playing content on
iHYPE are free. Music-related, radio-style advertising is iHYPE’s only paid
service. iHYPE covers its own media hosting and delivery costs.

## Rollout and scale plan

**Launch:** Include artist and venue sites, direct video uploads, 1080p and
4K playback, publishing, unpublishing, and deletion in the launch scope.
Keep uploads disabled during deployment and enable them for public launch
after staging QA, credential rotation, and cost controls pass. Access and
publishing remain free.

Use 1080p as the default and offer 4K as an explicit choice. Apply the same
launch quotas to eligible creators and keep the 15-minute cap. Before enabling
uploads, agree on a monthly provider budget and confirm which limits Mux
can enforce. Set alerts below that budget and use a conservative global
upload allowance alongside per-profile limits. Treat alerts as notifications.
Pausing new uploads does not stop charges from retained assets or playback.
If a strict ceiling is required, verify controls for those costs before
launch and record what staff should do when a threshold is reached.

**Grow:** after measuring usage, adjust upload quotas for verified artists and venues within the operating
budget, adopt the Mux resumable upload client to handle large unstable-network
uploads, implement central video moderation/copyright scanning and automated
takedown. Add custom domains only after SSR host validation and certificate
provisioning are independently tested.

**Controls:** use provider cost alerts, cap file count and size, periodically
remove unneeded assets, make privacy/user deletion remove videos from Mux.
Video playback is public only after an owner publishes it. Mux Basic 4K
delivery has higher per-minute provider costs than 1080p. Pilot limits keep
those costs manageable while access stays free.

## Manual validation (provider credentials required)

In Mux dashboard, verify:
- API token is restricted to the intended environment.
- Webhook signing secret belongs to the endpoint above.
- Direct upload and first Mux asset are ready.
- 4K file is encoded with max_resolution_tier 2160p.
- Billing and storage totals agree with the expected usage.


## Audit notes — 2026-11-20

- Original PR head passed full CI (2,124 unit tests in 254 files), CodeQL for
  JS/TS, Swift, Java/Kotlin and Actions, authenticated Playwright, Workerd
  security smoke and Cloudflare build.
- Code review fixed: undiscoverable/demo profile exposure, Mux video duration
  and orphan-upload controls, privacy exports missing videos, and the emergency switch preventing
  deletion/unpublishing.
- The original Worker total was **8.91 MiB gzip against a 9 MiB internal
  budget**; future features need bundle-size reductions before expanding.
- The original Lighthouse run returned **NO_FCP** on all attempts. CI's
  performance step reported this warning but did not measure a performance
  score. Treat Lighthouse performance as **UNVERIFIED**, even though CI passed.
  Reproduce and fix the measurement environment before claiming a performance
  pass for the new public sites.
- This audit did **not** exercise real Mux credentials or paid asset ingest.
  1080p, 2160p playback, webhook delivery, retention, and spend caps
  still need an approved staged provider test. Do not enable the feature flags
  solely because the unit tests are green.


## Navigation/security acceptance (additional checks)

- Browser tests exercise My Page -> Website + video -> Edit theme -> Save
  draft -> Publish -> public site -> Contact opt-in -> Unpublish -> Back to
  Profiles for a verified artist, and draft-only workflow for an unverified
  venue. They also assert cross-owner/anonymous authorization and mobile
  button visibility. This spec is mandatory in the Workerd test allowlist.
- iHYPE's owner editor provides **one** return action to Profiles. Profile
  action buttons wrap on phone widths; no hidden offscreen Website + video
  link. Permit canceling a Mux transfer with provider cleanup.
- Show dates use the `Show.timeZone` organizer/venue clock, never the
  Worker's UTC default, so a late-night venue show isn't misdated.
- Mux has no direct-upload byte-size ceiling in the signed URL shown by the
  Direct Upload API, so the 2 GiB check remains a browser-validated pilot
  limit, **not a hard server-side cap**. A malicious client can misreport
  size. The trusted ready-webhook duration ceiling runs after Mux ingest and
  can incur processing cost before rejection. Operator spend monitoring and
  further abusive-upload protections are mandatory before launch.
- A signed Mux asset error now hides a previously-public video and attempts
  to revoke its public playback ID. A failed public-ID database save triggers
  compensating deletion of the newly-issued public ID. Both retry on errors.


## Final release gates (updated 2026-11-20)

### Safe deployment without video activation

1. The feature branch must pass **all** mandatory CI, Workerd security, browser,
   database migration, Worker size and CodeQL checks at the **same head SHA**.
2. Land the additive Prisma migration using the existing production pre-deploy
   backup and migration sequence; do not manually ALTER production tables.
3. Deploy with `FEATURE_ENABLE_VIDEO_UPLOADS = "false"`. Confirm artist/venue builders
   load, drafts are owner-only, and approved/discoverable published pages are
   reachable to signed-out guests.
4. Verify the public `/site/<slug>` route remains depth-limited in middleware,
   a hidden or unpublished page cannot leak its title/contact/video, and a
   non-owner never receives the editor content (including in streamed 200/404
   responses). The Workerd integration suite asserts these.
5. Existing iHYPE audio, ticketing, profile editing and core MMM navigation
   must still pass the production smoke and mobile fit checks.

### Mandatory provider activation (separate, explicit operator gate)

- **Rotate exposed Mux credentials.** API and webhook signing values previously
  shared in an interactive channel must be regenerated before production use.
  Add their replacements directly as encrypted Worker secrets; never use
  `NEXT_PUBLIC_`, `wrangler.toml`, CI test variables, or repository content.
- Verify Mux webhook environment/destination and subscriptions, API permission
  scope, nonprofit credits, provider cost alerts/limits and consent/rights
  attestation. A data/environment key is not an API credential.
- Create a free Mux test asset in a dedicated test environment and validate
  direct upload, HMAC delivery, completed processing and playback-ID lifecycle.
  Then perform **approved** real 1080p and source-4K/2160p samples in staging,
  recording billable ingest, storage and playback minutes. No automatic live
  test should spend money or use the user's shared chat credentials.
- Test phone interruption/retry, 2 GiB boundary, 15-minute-duration rejection,
  owner/cross-owner permissions, abuse handling, copyright takedown, and
  published-video deletion after a provider outage. A malicious browser can
  lie about uploaded byte size, so rate limits and post-ingest duration checks
  are **not** a hard pre-ingest storage/processing cost ceiling.
- Only after provider tests and human moderation policy are approved, flip
  `FEATURE_ENABLE_VIDEO_UPLOADS` with a separate reviewed change.

### Privacy semantics

- Mux public playback IDs are issued **only** after the verified profile is
  discoverable and the website itself is published. A conditional database
  update fences a simultaneous unpublish so a late Mux response cannot create
  an orphaned public ID.
- Unpublishing the website hides the page in Prisma immediately, then attempts
  to revoke all linked public playback IDs. Turning off discoverability via
  ME > Settings or the profile editor uses the same revocation helper.
  On provider failure, the public page stays hidden and the old playback ID is
  retained for retry; a visible warning says that direct Mux URLs could still
  be playable. Never claim full revocation until Mux confirms.
- An errored/overlong asset retains its provider playback ID for emergency
  cleanup if Mux deletion fails. The **Unpublish** action remains reachable
  even when uploads are disabled or the asset is not READY.
- Disabling uploads must preserve the owner's ability to unpublish and delete videos.

### Performance and budget evidence

- The first full green integration CI reported ~8.92 MiB gzip Worker size
  against iHYPE's 9 MiB internal budget (10 MiB Cloudflare hard limit). Bundle
  headroom is <0.1 MiB and must be watched on every commit.
- Lighthouse repeatedly produced `NO_FCP` under headed Chrome in xvfb,
  although public Playwright rendered the same pages. The audit now defaults
  to `--headless=new` even if DISPLAY exists. **Do not** mark performance
  verified until a run produces actual numeric scores; the existing
  performance job is reporting-only, not a blocking budget gate.
- No GitHub-only test proves external Mux credentials work or verifies real
  user playback cost. Those provider checks stay explicitly UNVERIFIED until
  performed against the intended Cloudflare/Mux accounts.

### Rollback and incident response

- Video incident: immediately disable **new** Mux uploads,
  leave owner unpublish/delete available, revoke any published playback IDs,
  and review unprocessed signed webhooks. Keep provider secrets active until
  external assets are cleaned up; removing the token first strands cleanup.
- Website incident: stop new publications while preserving owner access to
  hidden drafts; use a separate reviewed release if further site changes are
  required. The migration is additive and should not be rolled back by
  dropping columns containing user content.
- Operator verifies provider asset count, old public playback URLs, data
  deletion retries, 4K billable minutes and Cloudflare usage before re-enable.
