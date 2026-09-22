-- iHYPE reaches Postgres only through its server-side Prisma connection. It
-- does not use Supabase's Data API, so the platform-default grants to `anon`
-- and `authenticated` are unnecessary attack surface. RLS already denies
-- access because these tables intentionally have no policies; revoke the
-- underlying privileges as defense in depth so a future policy cannot expose
-- data accidentally.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    -- Stock Postgres used by CI and restore drills has no Supabase roles.
    -- Keep the migration portable instead of weakening those environments.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);

      -- Preserve the server-only contract for objects created later by the
      -- same migration role.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
