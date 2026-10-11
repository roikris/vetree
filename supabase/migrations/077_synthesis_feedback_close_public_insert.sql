-- Migration 077: close direct inserts on synthesis_feedback; fix the scan's grant list (2026-10-11, infra-002)
--
-- 1. synthesis_feedback had "Anyone can insert" (INSERT to PUBLIC WITH CHECK (true)), and anon / authenticated
--    held INSERT. The only writer, app/api/synthesis/feedback, uses the service role (which bypasses RLS), so
--    the policy only let anyone holding the public key add votes directly, past the route's Redis one-vote
--    guard — skewing an experiment KPI. "Admins read" (the admin campaign page) is unchanged. The remaining
--    unused grants are trimmed with the other tables in a later step.
--
-- 2. check_table_grants() (032, security scan CHECK 9) flags a listed table when authenticated holds no
--    privilege on it. Since 076, topic_syntheses is service role only by design (like growth_article_scores,
--    which is not listed), so it is removed from the list. Same body otherwise; CREATE OR REPLACE keeps the
--    EXECUTE grants set by 064 (service_role only).

DROP POLICY IF EXISTS "Anyone can insert" ON public.synthesis_feedback;

REVOKE INSERT ON public.synthesis_feedback FROM PUBLIC, anon, authenticated;

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
