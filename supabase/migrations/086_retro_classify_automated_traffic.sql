-- Migration 086: tag the likely-automated page views recorded before traffic_class existed (2026-10-19, analytics-001)
--
-- Since #139 (deployed 2026-10-17 ~18:18 UTC) /api/analytics/track tags requests from hosting networks
-- (traffic_class = 'datacenter:<provider>'), and Admin → Analytics leaves signed-out tagged rows out by default (#142).
-- Older rows have no raw IP to look up, so they are tagged here from what the tagged traffic since the deploy showed
-- (production read 2026-10-19, Roi's yes), with fixed bounds:
--
--   suspected_fleet       signed out, SG / CN, no referrer, no duration, 2026-09-01 → deploy. Since the deploy this
--                         rule matches all 287 datacenter:tencent rows and 1 untagged row. Before it: 356 rows.
--   suspected_datacenter  signed out, US / IE / SE, in a town that is mostly datacenters (Meta, Microsoft, AWS,
--                         Google sites; Vercel stores the city URL-encoded). Since the deploy every view from these
--                         towns was tagged. Before it: 1,372 rows (Meta's link scanners, facebook.com referrer).
--
-- Only rows with traffic_class IS NULL, bot_name IS NULL and user_id IS NULL change — a signed-in reader is never
-- tagged. It is an estimate, like the live tag: rows are kept, the dashboard can include them again.
-- Reversible: analytics_maintenance_log keeps the ids per class; undo =
--   UPDATE public.page_views SET traffic_class = NULL
--   WHERE id IN (SELECT jsonb_array_elements_text(details -> 'fleet_ids')::uuid FROM public.analytics_maintenance_log
--                WHERE action = '086_retro_classify_automated_traffic')
--   (and the same for 'datacenter_ids').
-- Re-runnable: a second run finds no untagged matching rows. On an empty database (replay) every count is 0.

DO $$
DECLARE
  v_fleet uuid[];
  v_dc uuid[];
  v_fleet_n integer;
  v_dc_n integer;
BEGIN
  SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO v_fleet
  FROM public.page_views
  WHERE traffic_class IS NULL AND bot_name IS NULL AND user_id IS NULL
    AND created_at >= '2026-09-01 00:00:00+00' AND created_at < '2026-10-17 18:18:00+00'
    AND country IN ('SG', 'CN')
    AND coalesce(referrer, '') = ''
    AND coalesce(duration_seconds, 0) = 0;

  SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO v_dc
  FROM public.page_views
  WHERE traffic_class IS NULL AND bot_name IS NULL AND user_id IS NULL
    AND created_at < '2026-10-17 18:18:00+00'
    AND country IN ('US', 'IE', 'SE')
    AND city IN ('Boardman', 'Boydton', 'Prineville', 'Lule%C3%A5', 'Clonee', 'Forest%20City', 'Altoona',
                 'Gallatin', 'Council%20Bluffs', 'Des%20Moines', 'Fort%20Worth')
    AND NOT (id = ANY (v_fleet));

  UPDATE public.page_views SET traffic_class = 'suspected_fleet'
  WHERE id = ANY (v_fleet) AND traffic_class IS NULL;
  GET DIAGNOSTICS v_fleet_n = ROW_COUNT;

  UPDATE public.page_views SET traffic_class = 'suspected_datacenter'
  WHERE id = ANY (v_dc) AND traffic_class IS NULL;
  GET DIAGNOSTICS v_dc_n = ROW_COUNT;

  INSERT INTO public.analytics_maintenance_log (action, details)
  VALUES ('086_retro_classify_automated_traffic', jsonb_build_object(
    'fleet', v_fleet_n, 'datacenter', v_dc_n,
    'fleet_ids', to_jsonb(v_fleet), 'datacenter_ids', to_jsonb(v_dc)));
  RAISE NOTICE '086: suspected_fleet %, suspected_datacenter %', v_fleet_n, v_dc_n;
END;
$$;
