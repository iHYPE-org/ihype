-- ============================================================================
-- VERIFY BEFORE APPLYING — see the checklist at the bottom.
--
-- Makes RLS state reproducible from migrations.
--
-- The problem this fixes: only three tables have ever had RLS enabled by a
-- migration in this repository —
--   20260709210000_enable_rls_native_device_and_passkey_bootstrap
--     ("NativeDeviceToken", "PasskeyBootstrapToken")
--   20260721210000_enable_rls_advertiser_account ("AdvertiserAccount")
-- — yet 20260710230000_drop_permissive_newsletter_policy describes deny-all
-- as "the same posture as every other table". If that is accurate, the other
-- ~60 tables were switched on outside version control (Supabase dashboard or
-- an MCP call), which means the setting does not survive a rebuild: any
-- environment provisioned by `prisma migrate deploy` alone — a staging stack,
-- a disaster-recovery restore, a contributor's Supabase project — comes up
-- with RLS OFF on those tables, readable and writable through PostgREST's
-- anon/authenticated roles.
--
-- Why this is safe for the application: Prisma connects as the table owner,
-- and owners bypass RLS. This is the same reasoning the two migrations above
-- already rely on in production. Enabling RLS with no policies attached is
-- default-deny for the PostgREST API roles only.
--
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent, so tables that
-- already have it on are unaffected. The loop covers every current and future
-- table in the public schema rather than a hardcoded list, so a new model
-- can't silently ship without RLS the way AdvertiserAccount did.
-- ============================================================================

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'                      -- ordinary tables only
      AND c.relname <> '_prisma_migrations'    -- migration bookkeeping
      AND NOT c.relrowsecurity                 -- skip what's already enabled
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target.relname);
    RAISE NOTICE 'Enabled RLS on %', target.relname;
  END LOOP;
END
$$;

-- ============================================================================
-- BEFORE APPLYING TO PRODUCTION
--
-- This sandbox has no live database connection, so the statements below were
-- written against the schema but never executed — same caveat as every other
-- hand-written migration in this repository.
--
--   1. Confirm the app's role really is the table owner. If this returns any
--      row where the owner is not the role in DATABASE_URL, STOP — enabling
--      RLS would lock the application out of those tables:
--
--        SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public';
--
--   2. See what this will actually change (should be empty if the tables were
--      already switched on out-of-band, in which case this migration is pure
--      documentation and applies as a no-op):
--
--        SELECT relname FROM pg_class c
--        JOIN pg_namespace n ON n.oid = c.relnamespace
--        WHERE n.nspname = 'public' AND c.relkind = 'r'
--          AND NOT c.relrowsecurity AND c.relname <> '_prisma_migrations';
--
--   3. Confirm no table depends on a permissive policy for a real access path.
--      There should be no remaining policies granting anon/authenticated
--      access; 20260710230000 dropped the last known one:
--
--        SELECT schemaname, tablename, policyname, roles FROM pg_policies
--        WHERE schemaname = 'public';
--
--   4. Apply, then smoke-test a signed-in page load and a ticket purchase.
-- ============================================================================
