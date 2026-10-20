-- Migration 087: the daily purge also removes orphaned pending durations (2026-10-20, analytics-001, Codex NB)
--
-- page_view_pending_durations (084) holds a duration that reached /api/analytics/track before its view's load. The
-- load applies and deletes it; one that never gets its load was deleted only when the NEXT early duration was queued
-- (record_page_view_duration), so without traffic it could stay indefinitely. purge_expired_logs() (pg_cron daily
-- 03:15 UTC, 069) now deletes those older than a day. The rest of the function is 070's, unchanged; CREATE OR
-- REPLACE keeps its owner, SECURITY DEFINER and grants (re-stated below as in 070).

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
  DELETE FROM public.analytics_opportunities WHERE suggested_at < cutoff; GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('analytics_opportunities', n);
  -- 087: a duration that beat its load and whose load never came (tab closed mid-load) — 084 only deletes these when
  -- the next early duration arrives, so on a quiet day they stayed. Same age limit as record_page_view_duration().
  DELETE FROM public.page_view_pending_durations WHERE created_at < now() - interval '1 day'; GET DIAGNOSTICS n = ROW_COUNT; result := result || jsonb_build_object('page_view_pending_durations', n);

  INSERT INTO public.analytics_maintenance_log (action, details) VALUES ('purge_expired_logs', result);
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_logs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_expired_logs() TO service_role;
