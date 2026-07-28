-- Supabase database-linter (advisor) findings, 2026-07-28. Five WARNs, two
-- distinct problems, and they are not equally real. Both are addressed here;
-- the reasoning is recorded because the advisory text overstates one of them.
--
--
-- 1. public.rls_auto_enable() is EXECUTE-able by anon and authenticated
--    (advisories 0028 / 0029)
--
-- The grants are real: the ACL reads
--   {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,
--    service_role=X/postgres}
-- so PUBLIC, anon, authenticated and service_role all hold EXECUTE, and the
-- function is SECURITY DEFINER owned by postgres.
--
-- The advisory's stated consequence -- "can be executed by the anon role via
-- /rest/v1/rpc/rls_auto_enable" -- does not hold. The function RETURNS
-- event_trigger, and PostgreSQL refuses to invoke such a function outside the
-- event-trigger manager. Verified against this database:
--   ERROR: 0A000: trigger functions can only be called as triggers
-- That error comes from the function manager before any of the body runs, so
-- there is no reachable path -- via PostgREST or plain SQL -- where anon
-- executes this body. The grants are wrong, not exploitable.
--
-- Revoked anyway. It costs nothing and removes a privilege that would become
-- exploitable the moment someone rewrites this helper into a normally-callable
-- function -- it does DDL as postgres, so that would be a live privilege
-- escalation. Revoking cannot break the feature: the function's real caller is
-- the `ensure_rls` event trigger (owner postgres, enabled), and PostgreSQL
-- checks EXECUTE on a trigger function when the trigger is created, not each
-- time it fires.
--
--
-- 2. stripe.set_updated_at / set_updated_at_metadata / check_rate_limit have a
--    mutable search_path (advisory 0011)
--
-- Lower severity than the label suggests: all three are SECURITY INVOKER, so
-- they run with the caller's own privileges and the usual search_path
-- hijacking payoff (run attacker code as the definer) is not available. The
-- residual risk is narrower -- a privileged role writing to a stripe table
-- fires `handle_updated_at`, whose unqualified calls resolve through that
-- caller's search_path. Every name they use is a pg_catalog builtin and the
-- one table reference is already schema-qualified, so pinning search_path to
-- '' is behaviour-preserving.
--
-- Note what this schema is: the Supabase Stripe Sync Engine, which ships its
-- own migration system (stripe._migrations) and owns these functions. A future
-- sync-engine upgrade may CREATE OR REPLACE them and silently drop the setting
-- below -- reverting to today's state, not breaking anything. The durable fix
-- belongs upstream. Re-run the advisor after any sync-engine upgrade.
--
--
-- Why every statement is wrapped in an exception handler
--
-- ALTER FUNCTION and REVOKE require ownership. These four functions are owned
-- by `postgres`; this migration runs as whatever role DIRECT_URL authenticates
-- as, which could not be confirmed from where it was written. A plain failure
-- here would leave a failed migration in _prisma_migrations and block every
-- subsequent production deploy -- a much worse outcome than the warnings it is
-- trying to clear. So a permission failure degrades to a warning in the deploy
-- log instead.
--
-- This means success is NOT implied by a green deploy. Re-run the Supabase
-- advisor afterwards: if these five findings are gone it applied, and if they
-- are still listed the deploy role does not own the functions and someone with
-- ownership needs to run the statements by hand.

DO $$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated, service_role';
  RAISE NOTICE 'hardening: revoked EXECUTE on public.rls_auto_enable()';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'hardening SKIPPED: not the owner of public.rls_auto_enable(); revoke it manually as postgres';
  WHEN undefined_function THEN
    RAISE NOTICE 'hardening: public.rls_auto_enable() does not exist here, nothing to revoke';
  WHEN undefined_object THEN
    -- One of the Supabase-provided roles is absent (a non-Supabase Postgres,
    -- e.g. the local CI database this migration also runs against).
    RAISE NOTICE 'hardening: anon/authenticated/service_role not present here, nothing to revoke';
END $$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'stripe.set_updated_at()',
    'stripe.set_updated_at_metadata()',
    'stripe.check_rate_limit(text, integer, integer)'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = %L', fn, '');
      RAISE NOTICE 'hardening: pinned search_path on %', fn;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE WARNING 'hardening SKIPPED: not the owner of %; pin it manually as postgres', fn;
      WHEN undefined_function OR invalid_schema_name THEN
        RAISE NOTICE 'hardening: % does not exist here, nothing to pin', fn;
    END;
  END LOOP;
END $$;
