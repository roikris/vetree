-- Migration 079: trim anon / authenticated grants to what the policies allow (2026-10-11, infra-002)
--
-- Until now anon and authenticated held every privilege (incl. TRUNCATE, TRIGGER, REFERENCES, MAINTAIN) on
-- almost every public table — Supabase's default — so RLS was the only wall. Rule applied here: a role keeps
-- a command on a table only when a policy for that role (or PUBLIC) allows that command. Where no policy
-- allows it RLS already denies it, so no result changes; a denied request now gets "permission denied"
-- (42501) instead of an empty result. TRUNCATE ignores RLS entirely and is not needed by anyone but the
-- service role, so nobody else keeps it.
--
-- anon keeps: SELECT on articles ("Anon reads published articles"), and SELECT on saved_articles — the
-- homepage Trending action (app/actions/trending.ts) reads it with the cookie client for guests too and gets
-- 0 rows from RLS; kept until Trending is fixed (backlog), so guest homepage renders don't log 42501.
-- authenticated keeps the commands of its policies (admin-only and own-row policies), per table below.
-- The app's search RPCs are SECURITY DEFINER and unaffected. Every policy that looks up another table reads
-- user_roles, where authenticated keeps SELECT. service_role and postgres are unchanged.
--
-- feature_flags "Public read flags" (USING true) is dropped: every reader and writer uses the service role.
-- Tables that are already service role only (topic_syntheses, growth_article_scores,
-- growth_recommendation_sets, analytics_maintenance_log) are not touched.

DROP POLICY IF EXISTS "Public read flags" ON public.feature_flags;

REVOKE ALL ON public.analytics_daily_snapshot FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_daily_snapshot TO authenticated;

REVOKE ALL ON public.analytics_events FROM anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;

REVOKE ALL ON public.analytics_insight_feedback FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_insight_feedback TO authenticated;

REVOKE ALL ON public.analytics_insights FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_insights TO authenticated;

REVOKE ALL ON public.analytics_opportunities FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_opportunities TO authenticated;

REVOKE ALL ON public.analytics_signals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_signals TO authenticated;

REVOKE ALL ON public.articles FROM anon, authenticated;
GRANT SELECT ON public.articles TO authenticated;
GRANT SELECT ON public.articles TO anon;

REVOKE ALL ON public.articles_blacklist FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles_blacklist TO authenticated;

REVOKE ALL ON public.digest_logs FROM anon, authenticated;
GRANT SELECT ON public.digest_logs TO authenticated;

REVOKE ALL ON public.digest_runs FROM anon, authenticated;
GRANT SELECT ON public.digest_runs TO authenticated;

REVOKE ALL ON public.digest_sent_articles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_sent_articles TO authenticated;

REVOKE ALL ON public.feature_flags FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;

REVOKE ALL ON public.followed_tags FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followed_tags TO authenticated;

REVOKE ALL ON public.growth_agent_memory FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_agent_memory TO authenticated;

REVOKE ALL ON public.growth_agent_preferences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_agent_preferences TO authenticated;

REVOKE ALL ON public.growth_tasks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_tasks TO authenticated;

REVOKE ALL ON public.linkedin_daily_metrics FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_daily_metrics TO authenticated;

REVOKE ALL ON public.linkedin_post_metrics FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_post_metrics TO authenticated;

REVOKE ALL ON public.page_views FROM anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;

REVOKE ALL ON public.reports FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;

REVOKE ALL ON public.saved_articles FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.saved_articles TO authenticated;
GRANT SELECT ON public.saved_articles TO anon;

REVOKE ALL ON public.search_logs FROM anon, authenticated;
GRANT SELECT ON public.search_logs TO authenticated;

REVOKE ALL ON public.security_reports FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_reports TO authenticated;

REVOKE ALL ON public.sync_skipped_articles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_skipped_articles TO authenticated;

REVOKE ALL ON public.synthesis_feedback FROM anon, authenticated;
GRANT SELECT ON public.synthesis_feedback TO authenticated;

REVOKE ALL ON public.user_consents FROM anon, authenticated;
GRANT SELECT ON public.user_consents TO authenticated;

REVOKE ALL ON public.user_preferences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;

REVOKE ALL ON public.user_roles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

REVOKE ALL ON SEQUENCE public.analytics_maintenance_log_id_seq FROM anon, authenticated;
