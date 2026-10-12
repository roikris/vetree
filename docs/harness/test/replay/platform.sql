-- Replay environment (infra-003), applied as supabase_admin BEFORE any migration: the Supabase PROJECT settings
-- production has, which no migration records (the dashboard / platform sets them). Compared afterwards like the
-- rest of supabase/schema.json (extensions, event triggers, roles), so if production's settings change, the
-- replay shows it. Never applied to production.
-- GraphQL is turned off in production: no pg_graphql extension, no graphql_watch_* event triggers.
DROP EXTENSION IF EXISTS pg_graphql CASCADE;
DROP EVENT TRIGGER IF EXISTS graphql_watch_ddl;
DROP EVENT TRIGGER IF EXISTS graphql_watch_drop;
-- The platform role production's postgres belongs to (INHERIT, SET; no ADMIN).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_privileged_role') THEN
    CREATE ROLE supabase_privileged_role NOLOGIN;
  END IF;
END $$;
GRANT supabase_privileged_role TO postgres WITH INHERIT TRUE, SET TRUE;
