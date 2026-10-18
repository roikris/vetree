-- Migration 085: merge the pre-084 leave-beacon rows into the views they measured (2026-10-18, analytics-001)
--
-- Until #139 (deployed 2026-10-17 ~18:18 UTC) the tracker's leave beacon INSERTed a second page_views row
-- {path, session_id, duration_seconds} for every page left by in-app navigation, so multi-page visits counted
-- twice. Those rows are exactly: duration_seconds IS NOT NULL AND duration_updated_at IS NULL — since 084 only
-- record_page_view_duration / record_page_view_load / record_legacy_page_view_duration write a duration, and they
-- always set duration_updated_at. (Production at 2026-10-18: 482 such rows, oldest 2026-03-09, none since the
-- deploy, none without a session_id.)
--
-- In one statement block, on a frozen set of ids:
--   1. each legacy row is matched to the latest earlier load of the same session + path that has no duration
--      (A → B → A: the first A ping matches the first A load, the second the second);
--   2. the matched loads get the duration (the largest when two rows map to one load) and duration_updated_at =
--      the legacy row's created_at;
--   3. every legacy row is deleted, by id. Unmatched ones (no earlier load in the session) are deleted too, not
--      archived: they are not views, and a copy would hold ip_hash / user_id outside the 12-month purge and the
--      GDPR deletion function. Counts go to analytics_maintenance_log.
-- Re-runnable: a second run finds no legacy rows. On an empty database (replay) every count is 0.

DO $$
DECLARE
  v_legacy integer;
  v_matched integer;
  v_loads integer;
  v_deleted integer;
BEGIN
  CREATE TEMP TABLE _legacy_pings ON COMMIT DROP AS
    SELECT id, session_id, path, created_at, duration_seconds
    FROM public.page_views
    WHERE duration_seconds IS NOT NULL AND duration_updated_at IS NULL;
  SELECT count(*) INTO v_legacy FROM _legacy_pings;

  CREATE TEMP TABLE _legacy_matches ON COMMIT DROP AS
    SELECT DISTINCT ON (p.id) p.id AS ping_id, l.id AS load_id, p.duration_seconds, p.created_at AS ping_at
    FROM _legacy_pings p
    JOIN public.page_views l
      ON l.session_id = p.session_id
     AND l.path = p.path
     AND l.created_at <= p.created_at
     AND l.duration_seconds IS NULL
     AND l.id NOT IN (SELECT id FROM _legacy_pings)
    ORDER BY p.id, l.created_at DESC, l.id DESC;
  SELECT count(*) INTO v_matched FROM _legacy_matches;

  UPDATE public.page_views v
  SET duration_seconds = m.duration_seconds, duration_updated_at = m.ping_at
  FROM (
    SELECT load_id, max(duration_seconds) AS duration_seconds, max(ping_at) AS ping_at
    FROM _legacy_matches GROUP BY load_id
  ) m
  WHERE v.id = m.load_id AND v.duration_seconds IS NULL;
  GET DIAGNOSTICS v_loads = ROW_COUNT;

  DELETE FROM public.page_views WHERE id IN (SELECT id FROM _legacy_pings);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO public.analytics_maintenance_log (action, details)
  VALUES ('085_merge_legacy_duration_rows', jsonb_build_object(
    'legacy_rows', v_legacy, 'matched', v_matched, 'loads_updated', v_loads,
    'unmatched_deleted', v_legacy - v_matched, 'deleted', v_deleted));
  RAISE NOTICE '085: legacy rows %, matched %, loads updated %, deleted % (unmatched %)',
    v_legacy, v_matched, v_loads, v_deleted, v_legacy - v_matched;
END;
$$;
