-- Three read paths scanned whole tables (final pre-launch scan, 2026-09-24,
-- DESIGN_SYNC row 513). All additive; IF NOT EXISTS keeps a re-run from
-- leaving a failed row in _prisma_migrations, which would block every later
-- deploy.
--
-- MediaListen(mediaId): every listener count (the artist pane on every view,
-- the track page, the stat boards, the owner's insights) filters on the track,
-- and mediaId led no index.
-- HypeEvent(createdAt): POST /api/hype counts the last five seconds of show
-- hypes before every hype.
-- ProfileHypeEvent(createdAt): the recommender groups the last seven days of
-- profile hypes for momentum.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaListen_mediaId_idx" ON "MediaListen"("mediaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HypeEvent_createdAt_idx" ON "HypeEvent"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProfileHypeEvent_createdAt_idx" ON "ProfileHypeEvent"("createdAt");
