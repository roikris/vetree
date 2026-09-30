-- Migration 070: close two gaps between the Privacy Policy and the implementation (Codex, 2026-09-30)
--
-- 1. analytics_opportunities holds search terms (derived analytics) but was not in the 12-month
--    purge (migration 069). Added, by suggested_at.
-- 2. Account deletion now DELETES the person's cached syntheses (their search text and generated
--    content) instead of only unlinking them; the cache regenerates on demand.

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

  INSERT INTO public.analytics_maintenance_log (action, details) VALUES ('purge_expired_logs', result);
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_logs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_expired_logs() TO service_role;

CREATE OR REPLACE FUNCTION public.delete_user_account(user_id_to_delete uuid)
RETURNS void AS $$
BEGIN
  -- Analytics / logs
  DELETE FROM public.page_views         WHERE user_id = user_id_to_delete;
  DELETE FROM public.search_logs        WHERE user_id = user_id_to_delete;
  DELETE FROM public.analytics_events   WHERE user_id = user_id_to_delete;
  DELETE FROM public.digest_logs        WHERE user_id = user_id_to_delete;

  -- The person's cached syntheses (their search text and generated content)
  DELETE FROM public.topic_syntheses    WHERE user_id = user_id_to_delete;

  -- Preferences / consent
  DELETE FROM public.user_preferences   WHERE user_id = user_id_to_delete;
  DELETE FROM public.user_consents      WHERE user_id = user_id_to_delete;

  -- Feedback
  DELETE FROM public.synthesis_feedback WHERE user_id = user_id_to_delete;

  -- Social / saved content
  DELETE FROM public.followed_tags      WHERE user_id = user_id_to_delete;
  DELETE FROM public.saved_articles     WHERE user_id = user_id_to_delete;

  -- Reports & roles
  DELETE FROM public.reports            WHERE user_id = user_id_to_delete;
  DELETE FROM public.user_roles         WHERE user_id = user_id_to_delete;

  -- Auth record
  DELETE FROM auth.users                WHERE id = user_id_to_delete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;
