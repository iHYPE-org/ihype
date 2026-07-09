-- Supabase security advisor (2026-07-09): these two tables — the only ones
-- added since the platform-wide RLS enablement — were created without RLS,
-- leaving them readable through PostgREST's anon role. NativeDeviceToken
-- additionally exposes a sensitive push "token" column. The app itself is
-- unaffected: Prisma connects as the table owner, which bypasses RLS, same
-- as every other table. Enabling RLS with no policies = default-deny for
-- the PostgREST API roles, matching the rest of the schema.
ALTER TABLE "NativeDeviceToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasskeyBootstrapToken" ENABLE ROW LEVEL SECURITY;
