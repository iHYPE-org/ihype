# Artist/Venue sites + Mux Basic 4K + optional private R2 originals

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
- The browser checks the 15-minute duration before uploading when local
  video metadata can be read. The signed Mux asset-ready webhook is the
  authoritative guard: videos over 15 minutes are blocked and their Mux assets
  deleted. Processing costs may already have been incurred before rejection.
- An emergency upload kill switch must **not** block existing users from
  unpublishing/deleting hosted videos or aborting in-progress private R2
  archives. Provider credentials are still required for external deletion.
- Mux assets have **zero playback IDs** until the verified owner explicitly
  publishes the ready video. Publish adds a public playback ID; unpublish revokes
  it with Mux before clearing the app's published state.
- Mux webhook HMAC-SHA256 is verified against the raw body with 5-minute drift.
  Never add a bypass for testing. Provider errors don't publish anything.
- Optional R2 originals use the EXISTING Worker R2 binding (bucket `ihype-media`)
  via multipart 8 MiB chunks and a private `video-originals/` prefix. The
  public `/cdn/` handler must never allow that prefix. Only the owner can
  download the original through the authenticated archive route.

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
4. Keep `FEATURE_ENABLE_VIDEO_UPLOADS = "false"` and
   `FEATURE_ENABLE_R2_VIDEO_ARCHIVE = "false"` in wrangler.toml until
   production smoke tests pass. The video-uploads flag also checks all three
   secrets and refuses requests otherwise.
5. The EXISTING `R2` Worker binding needs no API credentials. Before enabling
   source archival, verify private bucket policy, retention, R2 quota and the
   2 GiB multipart test. Enable only if preserving originals is worth the
   additional storage expense. It is not required for Mux playback.
6. The migration `20261119190000_profile_sites_and_mux_videos` must be
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
- Optional R2 test: archive a > 8 MiB file in parts, download only when
  signed in as owner, check that `/cdn/video-originals/...` returns 404,
  cancel an unfinished archive, and delete a completed archive with its video.
- Verify CSP permits Mux iframe player on `/site/*` and direct Google
  Cloud Storage transfer from the owner editor only.
- Check on iPhone and desktop, with show/music/player controls, mobile nav,
  reduced-motion and keyboard navigation. Measure Cloudflare Worker costs.
- Deploy with upload feature flag still FALSE to confirm migration and existing
  audio/profile behavior is unaffected; only then explicitly enable it in a
  reviewed config change after the account's costs and webhooks are confirmed.

## Rollout and scale plan

**Pilot:** free one-page sites; limit uploads as above (including 15-minute
maximum duration), 1080p default,
4K available deliberately, 12 video records/profile and 2 GiB/file.
Keep original archiving disabled; let Mux retain what is needed for delivery.

**Grow:** after measuring usage, increase upload quota by verified artist/venue
tier, adopt the Mux resumable upload client to handle large unstable-network
uploads, implement central video moderation/copyright scanning and automated
takedown. Add custom domains only after SSR host validation and certificate
provisioning are independently tested. Move archival to presigned R2
multipart URLs if direct Worker chunks become expensive.

**Controls:** use provider cost alerts, cap file count and size, periodically
remove unneeded assets, make privacy/user deletion remove media from Mux and R2.
Video playback is public only after an owner publishes it. Mux Basic 4K
delivery has higher per-minute rates than 1080p. Do not call the feature free
or unlimited.

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
  and orphan-upload controls, privacy exports missing videos, R2 multipart
  cleanup and unbounded chunk reads, and the emergency switch preventing
  deletion/unpublishing.
- The original Worker total was **8.91 MiB gzip against a 9 MiB internal
  budget**; future features need bundle-size reductions before expanding.
- The original Lighthouse run returned **NO_FCP** on all attempts. CI's
  performance step reported this warning but did not measure a performance
  score. Treat Lighthouse performance as **UNVERIFIED**, even though CI passed.
  Reproduce and fix the measurement environment before claiming a performance
  pass for the new public sites.
- This audit did **not** exercise real Mux credentials or paid asset ingest.
  1080p, 2160p playback, webhook delivery, retention, spend caps and R2 billing
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
  link. Distinguish Mux transfer failure from optional R2 archive failure,
  and permit canceling a transfer with provider cleanup.
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
