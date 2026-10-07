-- Migration 074: read-only report of who may touch every public table, view and sequence
-- (2026-10-07, infra-001)
--
-- On 2026-10-30 Supabase stops granting anon / authenticated / service_role on NEW tables and
-- sequences in public (existing ones keep their grants). A new object without explicit grants fails
-- at runtime with 42501. Instead of reading migration SQL, the access audit
-- (`node docs/harness/harness.mjs acl-audit`) compares this report — PostgreSQL's own catalog — with
-- the checked-in expectation supabase/access.json, exactly.
--
-- harness_acl_report() returns, for EVERY relation in public with relkind r, p, v, m, S, f, exactly
-- four rows — anon, authenticated, service_role, PUBLIC — each with its privileges (sorted, distinct;
-- an explicit empty array when the role has none). The inventory comes first and is never derived
-- from the ACL, so a new object with a NULL, empty or owner-only ACL still appears (with empty arrays —
-- except for an audited role that OWNS the object, which shows the owner's privileges).
-- A NULL ACL means "the owner's defaults": acldefault() reports them. Grantee oid 0 = PUBLIC.
-- Plus informational rows (kind 'default:tables' / 'default:sequences') from pg_default_acl for the
-- public schema and the global defaults — shows the Oct-30 rollout; the audit never enforces them.
--
-- Checks direct relation ACLs only: not role membership, column grants, RLS, schema USAGE or grant
-- options. SECURITY INVOKER (the catalogs are readable by any role); every catalog reference is
-- schema-qualified so nothing on the search path can shadow it. Service role only.

CREATE OR REPLACE FUNCTION public.harness_acl_report()
RETURNS TABLE(object text, kind text, grantee text, privileges text[])
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH rels AS (
    SELECT c.oid, c.relname, c.relkind, c.relowner, c.relacl
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  ),
  grantees(name) AS (
    VALUES ('anon'), ('authenticated'), ('service_role'), ('PUBLIC')
  ),
  named AS (
    SELECT r.oid,
           CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE ro.rolname::text END AS grantee,
           a.privilege_type
    FROM rels r
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      coalesce(r.relacl,
               pg_catalog.acldefault(
                 (CASE WHEN r.relkind = 'S' THEN 's' ELSE 'r' END)::pg_catalog."char",
                 r.relowner))) AS a
    LEFT JOIN pg_catalog.pg_roles ro ON ro.oid = a.grantee
  )
  SELECT 'public.' || r.relname,
         CASE r.relkind
           WHEN 'r' THEN 'table'
           WHEN 'p' THEN 'partitioned table'
           WHEN 'v' THEN 'view'
           WHEN 'm' THEN 'materialized view'
           WHEN 'S' THEN 'sequence'
           WHEN 'f' THEN 'foreign table'
         END,
         g.name,
         coalesce(
           array_agg(DISTINCT nm.privilege_type ORDER BY nm.privilege_type)
             FILTER (WHERE nm.privilege_type IS NOT NULL),
           '{}'::text[])
  FROM rels r
  CROSS JOIN grantees g
  LEFT JOIN named nm ON nm.oid = r.oid AND nm.grantee = g.name
  GROUP BY r.oid, r.relname, r.relkind, g.name

  UNION ALL

  SELECT 'defaults ' || CASE WHEN d.defaclnamespace = 0 THEN 'global' ELSE dn.nspname::text END
           || ' by ' || pg_catalog.pg_get_userbyid(d.defaclrole),
         CASE d.defaclobjtype WHEN 'r' THEN 'default:tables' WHEN 'S' THEN 'default:sequences' END,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE coalesce(ro.rolname::text, a.grantee::text) END,
         array_agg(DISTINCT a.privilege_type ORDER BY a.privilege_type)
  FROM pg_catalog.pg_default_acl d
  LEFT JOIN pg_catalog.pg_namespace dn ON dn.oid = d.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS a
  LEFT JOIN pg_catalog.pg_roles ro ON ro.oid = a.grantee
  WHERE d.defaclobjtype IN ('r', 'S')
    AND (d.defaclnamespace = 0 OR dn.nspname = 'public')
  GROUP BY 1, 2, 3;
$$;

REVOKE ALL ON FUNCTION public.harness_acl_report() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.harness_acl_report() TO service_role;
