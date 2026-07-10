-- Prunes venue rows for /api/shows/nearby's bounding-box prefilter, so the
-- per-row Haversine trig only runs on candidates inside the requested box.
CREATE INDEX "Profile_latitude_longitude_idx" ON "Profile"("latitude", "longitude");
