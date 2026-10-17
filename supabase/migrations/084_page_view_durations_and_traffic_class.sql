-- Migration 084: one page_views row per view + a traffic_class estimate (2026-10-17, analytics-001, expand step)
--
-- Until now the tracker's leave beacon INSERTed a second page_views row ({path, session_id, duration_seconds}) for
-- every page a reader left by in-app navigation, so multi-page human visits counted twice. From this release:
--   * the browser creates the view's id (page_views.id) and sends it with the load and with every duration update;
--   * record_page_view_load() inserts the view once (a repeated id is a no-op — the primary key is the guarantee);
--   * record_page_view_duration() raises that row's duration_seconds (monotonic, never a new row). A duration that
--     arrives before its load waits in page_view_pending_durations and is applied when the load lands; both
--     functions lock the view id, so the two orders cannot lose it;
--   * record_legacy_page_view_duration() serves browser tabs still running the old tracker (no view id): it updates
--     that session + path's latest load of the last 2 hours instead of inserting.
-- duration_updated_at is set ONLY by these functions. So, whenever it is read, a row with a duration and no
-- duration_updated_at was inserted by the old beacon — the discriminator the clean-up migration (after the deploy)
-- relies on, independent of when old server instances drain.
--
-- traffic_class (page_views + analytics_events) is an estimate, kept apart from bot_name (confirmed crawlers):
--   'datacenter:<provider>'  request IP in a hosting network's published ranges (lib/analytics/datacenter.ts)
--   'suspected_fleet' / 'suspected_datacenter'  retro-classified history (a later migration, heuristic)
--   'suspected_test'  analytics_events only, unchanged since 065
-- Human totals keep counting these rows (bot_name IS NULL); dashboards show them as a separate estimate.
--
-- Replay: applies on an empty database (new columns, a new empty table, functions). Service role only.

ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS traffic_class text,
  ADD COLUMN IF NOT EXISTS duration_updated_at timestamptz;

ALTER TABLE public.page_views
  ADD CONSTRAINT page_views_traffic_class_check CHECK (
    traffic_class IS NULL
    OR traffic_class IN ('suspected_fleet', 'suspected_datacenter')
    OR traffic_class ~ '^datacenter:[a-z0-9_-]{1,40}$'
  );

ALTER TABLE public.analytics_events DROP CONSTRAINT analytics_events_traffic_class_check;
ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_traffic_class_check CHECK (
    traffic_class IS NULL
    OR traffic_class IN ('suspected_test', 'suspected_fleet', 'suspected_datacenter')
    OR traffic_class ~ '^datacenter:[a-z0-9_-]{1,40}$'
  );

-- A duration that reached the server before its view's load. Applied (and deleted) by record_page_view_load();
-- rows whose load never arrives are removed after a day by record_page_view_duration().
CREATE TABLE public.page_view_pending_durations (
  view_id uuid PRIMARY KEY,
  session_id text,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 86400),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX page_view_pending_durations_created_at_idx ON public.page_view_pending_durations (created_at);
ALTER TABLE public.page_view_pending_durations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.page_view_pending_durations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_view_pending_durations TO service_role;

-- The view's load. Returns true when inserted, false when this id was already recorded (a repeated send).
CREATE FUNCTION public.record_page_view_load(
  p_id uuid, p_path text, p_referrer text, p_user_agent text, p_ip_hash text, p_user_id uuid, p_country text,
  p_city text, p_device_type text, p_session_id text, p_utm_source text, p_utm_medium text, p_utm_campaign text,
  p_utm_id text, p_bot_name text, p_traffic_class text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_inserted boolean;
  v_pending integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 84));

  INSERT INTO public.page_views (id, path, referrer, user_agent, ip_hash, user_id, country, city, device_type,
    session_id, utm_source, utm_medium, utm_campaign, utm_id, bot_name, traffic_class)
  VALUES (p_id, p_path, p_referrer, p_user_agent, p_ip_hash, p_user_id, p_country, p_city, p_device_type,
    p_session_id, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_id, p_bot_name, p_traffic_class)
  ON CONFLICT (id) DO NOTHING;
  v_inserted := FOUND;
  IF NOT v_inserted THEN
    RETURN false;
  END IF;

  DELETE FROM public.page_view_pending_durations
  WHERE view_id = p_id AND session_id IS NOT DISTINCT FROM p_session_id
  RETURNING duration_seconds INTO v_pending;
  IF v_pending IS NOT NULL THEN
    UPDATE public.page_views SET duration_seconds = v_pending, duration_updated_at = now() WHERE id = p_id;
  END IF;
  RETURN true;
END;
$$;

-- Visible seconds so far for a view (the browser sends a running total). Only ever raises the value.
-- Returns 'updated', 'pending' (the load has not landed yet) or 'ignored' (the view belongs to another session).
CREATE FUNCTION public.record_page_view_duration(p_id uuid, p_session_id text, p_seconds integer)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_seconds IS NULL OR p_seconds < 1 OR p_seconds > 86400 THEN
    RAISE EXCEPTION 'record_page_view_duration: seconds out of range';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 84));

  UPDATE public.page_views
  SET duration_seconds = greatest(coalesce(duration_seconds, 0), p_seconds), duration_updated_at = now()
  WHERE id = p_id AND session_id IS NOT DISTINCT FROM p_session_id;
  IF FOUND THEN
    RETURN 'updated';
  END IF;
  -- The view exists under another session: not this tab's view — ignore (never queue it).
  IF EXISTS (SELECT 1 FROM public.page_views WHERE id = p_id) THEN
    RETURN 'ignored';
  END IF;

  DELETE FROM public.page_view_pending_durations WHERE created_at < now() - interval '1 day';
  INSERT INTO public.page_view_pending_durations (view_id, session_id, duration_seconds)
  VALUES (p_id, p_session_id, p_seconds)
  ON CONFLICT (view_id) DO UPDATE
    SET duration_seconds = greatest(page_view_pending_durations.duration_seconds, excluded.duration_seconds)
    WHERE page_view_pending_durations.session_id IS NOT DISTINCT FROM excluded.session_id;
  RETURN 'pending';
END;
$$;

-- Old tracker (no view id): the latest load of this session + path in the last 2 hours that has no duration yet.
-- Returns true when a row was updated; otherwise the duration is dropped (never inserted as a row).
CREATE FUNCTION public.record_legacy_page_view_duration(p_session_id text, p_path text, p_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_session_id IS NULL OR p_path IS NULL OR p_seconds IS NULL OR p_seconds < 1 OR p_seconds > 86400 THEN
    RETURN false;
  END IF;
  UPDATE public.page_views SET duration_seconds = p_seconds, duration_updated_at = now()
  WHERE id = (
    SELECT id FROM public.page_views
    WHERE session_id = p_session_id AND path = p_path
      AND duration_seconds IS NULL AND duration_updated_at IS NULL
      AND created_at >= now() - interval '2 hours'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  );
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_page_view_load(uuid, text, text, text, text, uuid, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_page_view_duration(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_legacy_page_view_duration(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_page_view_load(uuid, text, text, text, text, uuid, text, text, text, text, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_page_view_duration(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_legacy_page_view_duration(text, text, integer) TO service_role;
