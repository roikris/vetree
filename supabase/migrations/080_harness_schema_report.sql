-- Migration 080: read-only report of the public schema's structure (2026-10-12, infra-003)
--
-- Nine public tables were created in the dashboard and exist in no migration, so a database rebuilt from
-- supabase/migrations/ cannot match production (infra-003). Before the rebuild can be fixed and checked, the
-- harness needs production's structure as data: this report reads PostgreSQL's own catalog — never a row of
-- data, never a sequence value, never a password — and returns it as ONE jsonb value (so no PostgREST row limit
-- can cut it short). `node docs/harness/harness.mjs schema-audit` compares it with supabase/schema.json, exactly.
--
-- Covered (the contract — anything else in public is listed under "unsupported" and makes the audit
-- UNVERIFIED): relations (r, p, v, m, S, f) with owner, full ACL incl. grant options, RLS flags, options,
-- columns, constraints, indexes, triggers, view definitions, sequence settings and ownership; routines (f, p);
-- enum / domain / composite types; schema public's owner and ACL; extensions; default privileges; the
-- Supabase roles' attributes and memberships; event triggers; publications. Generated dependents (a relation's
-- row type, array types, index relations of covered tables) are classified, not counted as unsupported.
-- Policies are 075's (supabase/rls.json). Objects that belong to an extension are covered by the extension.
--
-- SECURITY INVOKER like 074 / 075 (the catalogs are readable by any role); every catalog reference is
-- schema-qualified and search_path is fixed, so the deparsed text (names, types, expressions) is stable.
-- CREATE FUNCTION, not CREATE OR REPLACE: if a function of this name already exists, the migration fails
-- instead of replacing it. Service role only.

BEGIN;

CREATE FUNCTION public.harness_schema_report()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
WITH
pub AS (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public'),
-- every object that belongs to an extension (covered by the extensions section)
ext_member AS (
  SELECT d.classid, d.objid FROM pg_catalog.pg_depend d WHERE d.deptype = 'e'
),
rel AS (
  SELECT c.* FROM pg_catalog.pg_class c
  WHERE c.relnamespace = (SELECT oid FROM pub)
    AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_class'::pg_catalog.regclass AND e.objid = c.oid)
),
fn AS (
  SELECT p.* FROM pg_catalog.pg_proc p
  WHERE p.pronamespace = (SELECT oid FROM pub)
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass AND e.objid = p.oid)
),
typ AS (
  SELECT t.* FROM pg_catalog.pg_type t
  WHERE t.typnamespace = (SELECT oid FROM pub)
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_type'::pg_catalog.regclass AND e.objid = t.oid)
),
-- type classification: covered kinds, generated dependents, and the rest (unsupported)
typ_class AS (
  SELECT t.oid, t.typname,
    CASE
      WHEN t.typtype = 'e' THEN 'enum'
      WHEN t.typtype = 'd' THEN 'domain'
      WHEN t.typtype = 'c' AND tr.relkind = 'c' THEN 'composite'
      WHEN t.typtype = 'c' AND tr.oid IS NOT NULL
           AND (tr.oid IN (SELECT oid FROM rel)) THEN 'generated'
      WHEN t.typcategory = 'A' AND t.typelem <> 0
           AND (te.typnamespace <> (SELECT oid FROM pub)
                OR te.typtype IN ('e', 'd')
                OR (te.typtype = 'c' AND (ter.relkind = 'c' OR ter.oid IN (SELECT oid FROM rel)))
                OR EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_type'::pg_catalog.regclass AND e.objid = te.oid))
           THEN 'generated'
      ELSE 'unsupported'
    END AS class
  FROM typ t
  LEFT JOIN pg_catalog.pg_class tr ON tr.oid = t.typrelid
  LEFT JOIN pg_catalog.pg_type te ON te.oid = t.typelem
  LEFT JOIN pg_catalog.pg_class ter ON ter.oid = te.typrelid
),
unsupported AS (
  -- relations of other kinds (indexes count only when they index a covered relation; composite relations
  -- are their types' business)
  SELECT 'relation:' || c.relkind::text AS kind, c.relname::text AS name
  FROM pg_catalog.pg_class c
  WHERE c.relnamespace = (SELECT oid FROM pub)
    AND c.relkind NOT IN ('r', 'p', 'v', 'm', 'S', 'f', 'c')
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_class'::pg_catalog.regclass AND e.objid = c.oid)
    AND NOT (c.relkind IN ('i', 'I') AND EXISTS (
      SELECT 1 FROM pg_catalog.pg_index i WHERE i.indexrelid = c.oid AND i.indrelid IN (SELECT oid FROM rel)))
  UNION ALL
  SELECT 'type:' || t.typtype::text, t.typname::text FROM typ t JOIN typ_class k ON k.oid = t.oid WHERE k.class = 'unsupported'
  UNION ALL
  SELECT 'routine:' || p.prokind::text, p.proname::text FROM fn p WHERE p.prokind NOT IN ('f', 'p')
  UNION ALL
  SELECT 'rule', r.rulename::text FROM pg_catalog.pg_rewrite r JOIN rel c ON c.oid = r.ev_class
  WHERE NOT (r.rulename = '_RETURN' AND c.relkind IN ('v', 'm'))
  UNION ALL
  SELECT 'operator', o.oprname::text FROM pg_catalog.pg_operator o
  WHERE o.oprnamespace = (SELECT oid FROM pub)
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_operator'::pg_catalog.regclass AND e.objid = o.oid)
  UNION ALL
  SELECT 'operator class', oc.opcname::text FROM pg_catalog.pg_opclass oc
  WHERE oc.opcnamespace = (SELECT oid FROM pub)
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_opclass'::pg_catalog.regclass AND e.objid = oc.oid)
  UNION ALL
  SELECT 'operator family', ofa.opfname::text FROM pg_catalog.pg_opfamily ofa
  WHERE ofa.opfnamespace = (SELECT oid FROM pub)
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_opfamily'::pg_catalog.regclass AND e.objid = ofa.oid)
  UNION ALL
  SELECT 'collation', co.collname::text FROM pg_catalog.pg_collation co
  WHERE co.collnamespace = (SELECT oid FROM pub)
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_collation'::pg_catalog.regclass AND e.objid = co.oid)
  UNION ALL
  SELECT 'conversion', cv.conname::text FROM pg_catalog.pg_conversion cv
  WHERE cv.connamespace = (SELECT oid FROM pub)
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_conversion'::pg_catalog.regclass AND e.objid = cv.oid)
  UNION ALL
  SELECT 'text search configuration', x.cfgname::text FROM pg_catalog.pg_ts_config x
  WHERE x.cfgnamespace = (SELECT oid FROM pub)
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_ts_config'::pg_catalog.regclass AND e.objid = x.oid)
  UNION ALL
  SELECT 'text search dictionary', x.dictname::text FROM pg_catalog.pg_ts_dict x
  WHERE x.dictnamespace = (SELECT oid FROM pub)
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_ts_dict'::pg_catalog.regclass AND e.objid = x.oid)
  UNION ALL
  SELECT 'statistics object', s.stxname::text FROM pg_catalog.pg_statistic_ext s
  WHERE s.stxnamespace = (SELECT oid FROM pub)
  UNION ALL
  SELECT 'cast', pg_catalog.format_type(ca.castsource, NULL) || ' -> ' || pg_catalog.format_type(ca.casttarget, NULL)
  FROM pg_catalog.pg_cast ca
  WHERE (ca.castsource IN (SELECT oid FROM typ) OR ca.casttarget IN (SELECT oid FROM typ)
         OR ca.castfunc IN (SELECT oid FROM fn))
    AND NOT EXISTS (SELECT 1 FROM ext_member e WHERE e.classid = 'pg_catalog.pg_cast'::pg_catalog.regclass AND e.objid = ca.oid)
)
SELECT pg_catalog.jsonb_build_object(
  'format', 1,
  'server_version_num', pg_catalog.current_setting('server_version_num')::int,

  'relations', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', 'public.' || c.relname,
      'kind', CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned table' WHEN 'v' THEN 'view'
                             WHEN 'm' THEN 'materialized view' WHEN 'S' THEN 'sequence' WHEN 'f' THEN 'foreign table' END,
      'owner', pg_catalog.pg_get_userbyid(c.relowner)::text,
      'acl', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END,
                 'privilege', a.privilege_type, 'grantable', a.is_grantable)
               ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END, a.privilege_type)
        FROM pg_catalog.aclexplode(COALESCE(c.relacl, pg_catalog.acldefault(CASE WHEN c.relkind = 'S' THEN 's' ELSE 'r' END::"char", c.relowner))) a
      ), '[]'::jsonb),
      'rls', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'options', COALESCE(pg_catalog.to_jsonb(c.reloptions), '[]'::jsonb),
      'columns', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'name', att.attname::text,
                 'type', pg_catalog.format_type(att.atttypid, att.atttypmod),
                 'collation', CASE WHEN att.attcollation = 0 THEN NULL ELSE (
                   SELECT cn.nspname || '.' || co.collname FROM pg_catalog.pg_collation co
                   JOIN pg_catalog.pg_namespace cn ON cn.oid = co.collnamespace WHERE co.oid = att.attcollation) END,
                 'not_null', att.attnotnull,
                 'default', (SELECT pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) FROM pg_catalog.pg_attrdef ad
                             WHERE ad.adrelid = att.attrelid AND ad.adnum = att.attnum),
                 'identity', NULLIF(att.attidentity::text, ''),
                 'generated', NULLIF(att.attgenerated::text, ''),
                 'acl', COALESCE((
                   SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                            'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END,
                            'privilege', a.privilege_type, 'grantable', a.is_grantable)
                          ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END, a.privilege_type)
                   FROM pg_catalog.aclexplode(att.attacl) a
                 ), '[]'::jsonb))
               ORDER BY att.attnum)
        FROM pg_catalog.pg_attribute att
        WHERE att.attrelid = c.oid AND att.attnum > 0 AND NOT att.attisdropped
      ), '[]'::jsonb),
      'constraints', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'name', con.conname::text, 'type', con.contype::text,
                 'definition', pg_catalog.pg_get_constraintdef(con.oid),
                 'deferrable', con.condeferrable, 'deferred', con.condeferred, 'validated', con.convalidated)
               ORDER BY con.conname)
        FROM pg_catalog.pg_constraint con WHERE con.conrelid = c.oid
      ), '[]'::jsonb),
      'indexes', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'name', ic.relname::text,
                 'definition', pg_catalog.pg_get_indexdef(i.indexrelid),
                 'valid', i.indisvalid, 'ready', i.indisready,
                 'constraint', (SELECT con.conname::text FROM pg_catalog.pg_constraint con
                                WHERE con.conindid = i.indexrelid AND con.conrelid = c.oid AND con.contype IN ('p', 'u', 'x')))
               ORDER BY ic.relname)
        FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        WHERE i.indrelid = c.oid
      ), '[]'::jsonb),
      'triggers', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'name', tg.tgname::text, 'definition', pg_catalog.pg_get_triggerdef(tg.oid), 'enabled', tg.tgenabled::text)
               ORDER BY tg.tgname)
        FROM pg_catalog.pg_trigger tg WHERE tg.tgrelid = c.oid AND NOT tg.tgisinternal
      ), '[]'::jsonb),
      'view_definition', CASE WHEN c.relkind IN ('v', 'm') THEN pg_catalog.pg_get_viewdef(c.oid) END,
      'sequence', CASE WHEN c.relkind = 'S' THEN (
        SELECT pg_catalog.jsonb_build_object(
                 'type', pg_catalog.format_type(s.seqtypid, NULL),
                 'start', s.seqstart::text, 'increment', s.seqincrement::text,
                 'min', s.seqmin::text, 'max', s.seqmax::text, 'cache', s.seqcache::text, 'cycle', s.seqcycle,
                 'owned_by', (SELECT 'public.' || oc.relname || '.' || oa.attname || ' (' || d.deptype::text || ')'
                              FROM pg_catalog.pg_depend d
                              JOIN pg_catalog.pg_class oc ON oc.oid = d.refobjid
                              JOIN pg_catalog.pg_attribute oa ON oa.attrelid = d.refobjid AND oa.attnum = d.refobjsubid
                              WHERE d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.objid = c.oid
                                AND d.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass AND d.deptype IN ('a', 'i')
                              LIMIT 1))
        FROM pg_catalog.pg_sequence s WHERE s.seqrelid = c.oid) END)
      ORDER BY c.relname)
    FROM rel c
  ), '[]'::jsonb),

  'routines', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'signature', p.oid::pg_catalog.regprocedure::text,
      'kind', p.prokind::text,
      'language', (SELECT l.lanname::text FROM pg_catalog.pg_language l WHERE l.oid = p.prolang),
      'owner', pg_catalog.pg_get_userbyid(p.proowner)::text,
      'security_definer', p.prosecdef,
      'volatility', p.provolatile::text,
      'config', COALESCE(pg_catalog.to_jsonb(p.proconfig), '[]'::jsonb),
      'definition', pg_catalog.pg_get_functiondef(p.oid),
      'acl', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END,
                 'privilege', a.privilege_type, 'grantable', a.is_grantable)
               ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END, a.privilege_type)
        FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f'::"char", p.proowner))) a
      ), '[]'::jsonb))
      ORDER BY p.oid::pg_catalog.regprocedure::text)
    FROM fn p WHERE p.prokind IN ('f', 'p')
  ), '[]'::jsonb),

  'types', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', 'public.' || t.typname,
      'kind', k.class,
      'owner', pg_catalog.pg_get_userbyid(t.typowner)::text,
      'acl', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END,
                 'privilege', a.privilege_type, 'grantable', a.is_grantable)
               ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END, a.privilege_type)
        FROM pg_catalog.aclexplode(COALESCE(t.typacl, pg_catalog.acldefault('T'::"char", t.typowner))) a
      ), '[]'::jsonb),
      'labels', CASE WHEN k.class = 'enum' THEN COALESCE((
        SELECT pg_catalog.jsonb_agg(en.enumlabel::text ORDER BY en.enumsortorder)
        FROM pg_catalog.pg_enum en WHERE en.enumtypid = t.oid), '[]'::jsonb) END,
      'base_type', CASE WHEN k.class = 'domain' THEN pg_catalog.format_type(t.typbasetype, t.typtypmod) END,
      'not_null', CASE WHEN k.class = 'domain' THEN t.typnotnull END,
      'default', CASE WHEN k.class = 'domain' THEN pg_catalog.pg_get_expr(t.typdefaultbin, 0) END,
      'constraints', CASE WHEN k.class = 'domain' THEN COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'name', con.conname::text, 'definition', pg_catalog.pg_get_constraintdef(con.oid), 'validated', con.convalidated)
               ORDER BY con.conname)
        FROM pg_catalog.pg_constraint con WHERE con.contypid = t.oid), '[]'::jsonb) END,
      'attributes', CASE WHEN k.class = 'composite' THEN COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'name', att.attname::text, 'type', pg_catalog.format_type(att.atttypid, att.atttypmod))
               ORDER BY att.attnum)
        FROM pg_catalog.pg_attribute att
        WHERE att.attrelid = t.typrelid AND att.attnum > 0 AND NOT att.attisdropped), '[]'::jsonb) END)
      ORDER BY t.typname)
    FROM typ t JOIN typ_class k ON k.oid = t.oid
    WHERE k.class IN ('enum', 'domain', 'composite')
  ), '[]'::jsonb),

  'schema', (
    SELECT pg_catalog.jsonb_build_object(
      'owner', pg_catalog.pg_get_userbyid(n.nspowner)::text,
      'acl', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END,
                 'privilege', a.privilege_type, 'grantable', a.is_grantable)
               ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END, a.privilege_type)
        FROM pg_catalog.aclexplode(COALESCE(n.nspacl, pg_catalog.acldefault('n'::"char", n.nspowner))) a
      ), '[]'::jsonb))
    FROM pg_catalog.pg_namespace n WHERE n.nspname = 'public'),

  'extensions', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', x.extname::text, 'version', x.extversion,
      'schema', (SELECT n.nspname::text FROM pg_catalog.pg_namespace n WHERE n.oid = x.extnamespace))
      ORDER BY x.extname)
    FROM pg_catalog.pg_extension x
  ), '[]'::jsonb),

  'default_acls', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'role', pg_catalog.pg_get_userbyid(da.defaclrole)::text,
      'schema', (SELECT n.nspname::text FROM pg_catalog.pg_namespace n WHERE n.oid = da.defaclnamespace),
      'object_type', da.defaclobjtype::text,
      'acl', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END,
                 'privilege', a.privilege_type, 'grantable', a.is_grantable)
               ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee)::text END, a.privilege_type)
        FROM pg_catalog.aclexplode(da.defaclacl) a
      ), '[]'::jsonb))
      ORDER BY pg_catalog.pg_get_userbyid(da.defaclrole), da.defaclnamespace, da.defaclobjtype)
    FROM pg_catalog.pg_default_acl da
  ), '[]'::jsonb),

  'roles', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', r.rolname::text, 'superuser', r.rolsuper, 'inherit', r.rolinherit, 'create_role', r.rolcreaterole,
      'create_db', r.rolcreatedb, 'login', r.rolcanlogin, 'replication', r.rolreplication, 'bypass_rls', r.rolbypassrls,
      'member_of', COALESCE((
        SELECT pg_catalog.jsonb_agg(g.rolname::text ORDER BY g.rolname)
        FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles g ON g.oid = m.roleid
        WHERE m.member = r.oid), '[]'::jsonb))
      ORDER BY r.rolname)
    FROM pg_catalog.pg_roles r
    WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
  ), '[]'::jsonb),

  'event_triggers', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', et.evtname::text, 'event', et.evtevent::text, 'enabled', et.evtenabled::text,
      'function', et.evtfoid::pg_catalog.regprocedure::text,
      'tags', COALESCE(pg_catalog.to_jsonb(et.evttags), '[]'::jsonb))
      ORDER BY et.evtname)
    FROM pg_catalog.pg_event_trigger et
  ), '[]'::jsonb),

  'publications', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', pb.pubname::text, 'all_tables', pb.puballtables,
      'tables', COALESCE((
        SELECT pg_catalog.jsonb_agg(('public.' || pc.relname)::text ORDER BY pc.relname)
        FROM pg_catalog.pg_publication_rel pr JOIN pg_catalog.pg_class pc ON pc.oid = pr.prrelid
        WHERE pr.prpubid = pb.oid AND pc.relnamespace = (SELECT oid FROM pub)), '[]'::jsonb))
      ORDER BY pb.pubname)
    FROM pg_catalog.pg_publication pb
  ), '[]'::jsonb),

  'unsupported', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', u.kind, 'name', u.name) ORDER BY u.kind, u.name)
    FROM unsupported u
  ), '[]'::jsonb),

  -- independent counts, straight from the catalogs, for the client's completeness check
  'counts', pg_catalog.jsonb_build_object(
    'relations', (SELECT count(*) FROM rel),
    'columns', (SELECT count(*) FROM pg_catalog.pg_attribute att JOIN rel c ON c.oid = att.attrelid
                WHERE att.attnum > 0 AND NOT att.attisdropped),
    'constraints', (SELECT count(*) FROM pg_catalog.pg_constraint con JOIN rel c ON c.oid = con.conrelid),
    'indexes', (SELECT count(*) FROM pg_catalog.pg_index i JOIN rel c ON c.oid = i.indrelid),
    'triggers', (SELECT count(*) FROM pg_catalog.pg_trigger tg JOIN rel c ON c.oid = tg.tgrelid WHERE NOT tg.tgisinternal),
    'routines', (SELECT count(*) FROM fn WHERE prokind IN ('f', 'p')),
    'types', (SELECT count(*) FROM typ_class WHERE class IN ('enum', 'domain', 'composite')),
    'generated_types', (SELECT count(*) FROM typ_class WHERE class = 'generated'),
    'extensions', (SELECT count(*) FROM pg_catalog.pg_extension),
    'default_acls', (SELECT count(*) FROM pg_catalog.pg_default_acl),
    'event_triggers', (SELECT count(*) FROM pg_catalog.pg_event_trigger),
    'publications', (SELECT count(*) FROM pg_catalog.pg_publication),
    'unsupported', (SELECT count(*) FROM unsupported))
)
$$;

REVOKE ALL ON FUNCTION public.harness_schema_report() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.harness_schema_report() TO service_role;

COMMIT;
