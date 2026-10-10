-- Migration 075: read-only report of row-level security on every public table (2026-10-10, infra-002)
--
-- The access audit (migration 074, supabase/access.json) checks table privileges only. Today anon and
-- authenticated hold ALL privileges on most tables, so row-level security is what actually protects the data —
-- and eight tables were created outside migrations, so the repo cannot say whether they have it. This report
-- reads PostgreSQL's own catalog (never a row of data) so the harness can show, and later enforce, the real
-- RLS state.
--
-- harness_rls_report() returns one 'table' row per public table (relkind r, p) with rls_on / rls_forced, plus
-- one 'policy' row per policy on those tables (name, command, roles, permissive, USING and WITH CHECK
-- expressions as PostgreSQL prints them). SECURITY INVOKER (the catalogs are readable by any role); every
-- catalog reference is schema-qualified so nothing on the search path can shadow it. Service role only.

CREATE OR REPLACE FUNCTION public.harness_rls_report()
RETURNS TABLE(
  object text, kind text, rls_on boolean, rls_forced boolean,
  policy text, command text, roles text[], permissive boolean, using_expr text, check_expr text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH rels AS (
    SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  )
  SELECT 'public.' || r.relname, 'table', r.relrowsecurity, r.relforcerowsecurity,
         NULL::text, NULL::text, NULL::text[], NULL::boolean, NULL::text, NULL::text
  FROM rels r

  UNION ALL

  SELECT 'public.' || r.relname, 'policy', NULL::boolean, NULL::boolean,
         p.polname::text,
         CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
                       WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END,
         CASE WHEN p.polroles = '{0}'::pg_catalog.oid[] THEN ARRAY['PUBLIC']::text[]
              ELSE ARRAY(SELECT ro.rolname::text FROM pg_catalog.pg_roles ro
                         WHERE ro.oid = ANY (p.polroles) ORDER BY 1) END,
         p.polpermissive,
         pg_catalog.pg_get_expr(p.polqual, p.polrelid),
         pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)
  FROM rels r
  JOIN pg_catalog.pg_policy p ON p.polrelid = r.oid;
$$;

REVOKE ALL ON FUNCTION public.harness_rls_report() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.harness_rls_report() TO service_role;
