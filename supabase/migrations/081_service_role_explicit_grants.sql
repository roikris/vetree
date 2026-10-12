-- Migration 081: service_role's grants, explicit (2026-10-12, infra-003)
--
-- Supabase stops giving new tables and sequences automatic grants on 2026-10-30, and "new" means when a migration
-- RUNS — so a database rebuilt from supabase/migrations/ after that date would give service_role (the server-side
-- key: API routes, jobs) only what migrations grant explicitly. Rebuilt that way, 24 objects come out short of
-- production (supabase/access.json): analytics_events with nothing at all (every tracking write would fail with
-- 42501), 22 tables without TRUNCATE / REFERENCES / TRIGGER / MAINTAIN, and analytics_maintenance_log_id_seq
-- without UPDATE. Found by the replay (docs/harness/replay.sh, new defaults).
--
-- ADDITIVE ONLY — grants exactly what is missing, no REVOKE: on production every one of these privileges is
-- already held, so this changes nothing there (acl-audit and schema-audit before and after prove it); existing
-- grant options stay as they are. In a rebuild it is the last word on service_role's privileges.

BEGIN;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.analytics_events TO service_role;
GRANT UPDATE ON SEQUENCE public.analytics_maintenance_log_id_seq TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.articles TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.digest_logs TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.digest_runs TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.digest_sent_articles TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.feature_flags TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.followed_tags TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.growth_agent_memory TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.growth_agent_preferences TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.growth_tasks TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.linkedin_daily_metrics TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.linkedin_post_metrics TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.page_views TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.reports TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.saved_articles TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.search_logs TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.security_reports TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.sync_skipped_articles TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.synthesis_feedback TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.topic_syntheses TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.user_consents TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.user_preferences TO service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON public.user_roles TO service_role;

COMMIT;
