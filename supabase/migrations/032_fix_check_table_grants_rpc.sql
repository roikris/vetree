-- Migration 032: Fix check_table_grants RPC + re-apply explicit grants
--
-- The check_table_grants function was returning all 25 app tables as missing
-- authenticated grants even though migration 029 applied explicit GRANTs.
-- Root cause: the function had buggy logic that did not correctly query
-- information_schema.role_table_grants.
--
-- This migration:
--   1. Re-applies all GRANT statements from 029 (GRANT is idempotent in PG).
--   2. Replaces check_table_grants with a correct implementation that queries
--      the real grant state from information_schema.role_table_grants.
--
-- After this runs, check_table_grants should return 0 rows and the
-- security agent finding 'missing_grants' will no longer fire.

-- ================================================================
-- PART 1: Re-apply explicit grants (idempotent — safe to re-run)
-- ================================================================

GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon, service_role;

-- Publicly readable
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO postgres, service_role;
GRANT SELECT ON public.articles TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_syntheses TO postgres, service_role;
GRANT SELECT ON public.topic_syntheses TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO postgres, service_role;
GRANT SELECT ON public.feature_flags TO authenticated, anon;

-- Tracking tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_views TO postgres, service_role;
GRANT INSERT ON public.page_views TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_logs TO postgres, service_role;
GRANT INSERT ON public.search_logs TO authenticated, anon;

-- User-owned tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_articles TO postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.saved_articles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.followed_tags TO postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.followed_tags TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_consents TO postgres, service_role;
GRANT SELECT, INSERT ON public.user_consents TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.synthesis_feedback TO postgres, service_role;
GRANT SELECT, INSERT ON public.synthesis_feedback TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO postgres, service_role;
GRANT SELECT, INSERT ON public.reports TO authenticated;

-- Role table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO postgres, service_role;
GRANT SELECT ON public.user_roles TO authenticated;

-- Admin / service-role-only tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_daily_snapshot TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_daily_snapshot TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_insight_feedback TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_insight_feedback TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_insights TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_insights TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_opportunities TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_opportunities TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_signals TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_signals TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles_blacklist TO postgres, service_role;
GRANT SELECT ON public.articles_blacklist TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_logs TO postgres, service_role;
GRANT SELECT ON public.digest_logs TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_runs TO postgres, service_role;
GRANT SELECT ON public.digest_runs TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_agent_memory TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.growth_agent_memory TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_agent_preferences TO postgres, service_role;
GRANT SELECT, UPDATE ON public.growth_agent_preferences TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_tasks TO postgres, service_role;
GRANT SELECT ON public.growth_tasks TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_reports TO postgres, service_role;
GRANT SELECT ON public.security_reports TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_skipped_articles TO postgres, service_role;
GRANT SELECT ON public.sync_skipped_articles TO authenticated;

-- ================================================================
-- PART 2: Replace check_table_grants with correct implementation
-- ================================================================
-- The function checks whether each of the 25 known app tables has at least
-- one explicit grant for the 'authenticated' role.  A table is flagged only
-- if no row exists in information_schema.role_table_grants for that table +
-- 'authenticated' combination.  Returns 0 rows when all grants are in place.

CREATE OR REPLACE FUNCTION public.check_table_grants()
RETURNS TABLE(table_name text, missing_roles text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH app_tables(tname) AS (
    VALUES
      ('analytics_daily_snapshot'),
      ('analytics_insight_feedback'),
      ('analytics_insights'),
      ('analytics_opportunities'),
      ('analytics_signals'),
      ('articles'),
      ('articles_blacklist'),
      ('digest_logs'),
      ('digest_runs'),
      ('feature_flags'),
      ('followed_tags'),
      ('growth_agent_memory'),
      ('growth_agent_preferences'),
      ('growth_tasks'),
      ('page_views'),
      ('reports'),
      ('saved_articles'),
      ('search_logs'),
      ('security_reports'),
      ('sync_skipped_articles'),
      ('synthesis_feedback'),
      ('topic_syntheses'),
      ('user_consents'),
      ('user_preferences'),
      ('user_roles')
  ),
  granted AS (
    SELECT DISTINCT g.table_name
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.grantee = 'authenticated'
  )
  SELECT a.tname AS table_name,
         ARRAY['authenticated'] AS missing_roles
  FROM app_tables a
  WHERE NOT EXISTS (
    SELECT 1 FROM granted g WHERE g.table_name = a.tname
  )
  ORDER BY a.tname;
$$;

-- Allow service_role (used by security scan) to call this function
GRANT EXECUTE ON FUNCTION public.check_table_grants() TO service_role, authenticated;
