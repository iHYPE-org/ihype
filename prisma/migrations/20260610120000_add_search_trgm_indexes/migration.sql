-- Trigram + array GIN indexes for /api/search.
-- The search endpoint runs ILIKE '%q%' OR-chains across these columns;
-- Postgres can only use a BitmapOr plan when every OR arm is indexed,
-- so each searched column gets a trigram index.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Profile_name_trgm_idx" ON "Profile" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Profile_headline_trgm_idx" ON "Profile" USING GIN ("headline" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Profile_bio_trgm_idx" ON "Profile" USING GIN ("bio" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Profile_city_trgm_idx" ON "Profile" USING GIN ("city" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Profile_stateRegion_trgm_idx" ON "Profile" USING GIN ("stateRegion" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Profile_hometown_trgm_idx" ON "Profile" USING GIN ("hometown" gin_trgm_ops);

-- Array-overlap index for genres: { hasSome: [...] } filters
CREATE INDEX IF NOT EXISTS "Profile_genres_gin_idx" ON "Profile" USING GIN ("genres");

CREATE INDEX IF NOT EXISTS "ArtistMediaAsset_title_trgm_idx" ON "ArtistMediaAsset" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ArtistMediaAsset_notes_trgm_idx" ON "ArtistMediaAsset" USING GIN ("notes" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Show_title_trgm_idx" ON "Show" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Show_description_trgm_idx" ON "Show" USING GIN ("description" gin_trgm_ops);
