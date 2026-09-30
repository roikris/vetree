-- Migration 069: keep usage and diagnostic logs for 12 months (owner's decision, 2026-09-30)
--
-- The Privacy Policy states a 12-month retention period for logs. This function deletes older rows
-- and runs daily via pg_cron. Account data (profile, saved articles, follows, reports, consent
-- records) is not a log: it is kept while the account exists and deleted with it.
--
--   page_views, search_logs, analytics_events          usage logs                 created_at
--   digest_logs                                        email delivery records      sent_at
--   synthesis_feedback, topic_syntheses                AI feedback / cached output created_at
--   analytics_signals, analytics_daily_snapshot        derived analytics          date
--   analytics_insights                                 derived analytics          generated_at
-- Each run is recorded in analytics_maintenance_log (migration 065). Service role only.

CREATE OR REPLACE FUNCTION public.purge_expired_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cutoff timestamptz := now() - interval '12 months';
  result jsonb := '{}'::jsonb;
  n integer;
BEGIN
  DELETE FROM public.page_views        WHERE created_at < cutoff;  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('page_views', n);
  DELETE FROM public.search_logs       WHERE created_at < cutoff;  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('search_logs', n);
  DELETE FROM public.analytics_events  WHERE created_at < cutoff;  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('analytics_events', n);
  DELETE FROM public.digest_logs       WHERE sent_at    < cutoff;  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('digest_logs', n);
  DELETE FROM public.synthesis_feedback WHERE created_at < cutoff; GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('synthesis_feedback', n);
  DELETE FROM public.topic_syntheses   WHERE created_at < cutoff;  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('topic_syntheses', n);
  DELETE FROM public.analytics_signals WHERE date < cutoff::date;  GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('analytics_signals', n);
  DELETE FROM public.analytics_daily_snapshot WHERE date < cutoff::date; GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('analytics_daily_snapshot', n);
  DELETE FROM public.analytics_insights WHERE generated_at < cutoff; GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('analytics_insights', n);

  INSERT INTO public.analytics_maintenance_log (action, details) VALUES ('purge_expired_logs', result);
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_logs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_expired_logs() TO service_role;

-- Daily at 03:15 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-expired-logs';
SELECT cron.schedule('purge-expired-logs', '15 3 * * *', 'SELECT public.purge_expired_logs()');
