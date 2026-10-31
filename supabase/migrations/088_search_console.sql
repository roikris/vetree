-- Migration 088: Google Search Console data for Admin → Analytics (2026-10-31, analytics-001)
--
-- A daily GitHub Action (.github/workflows/search-console.yml) reads the domain property sc-domain:vetree.app with a
-- read-only service account and writes one Pacific-time day at a time through replace_search_console_day(). Three
-- data sets, one Search Console request each, never summed into each other — Google aggregates them differently:
--   search_console_daily    dimensions [date]          the property's own totals (what the Search Console UI shows)
--   search_console_queries  dimensions [date, query]   top queries Google provides (anonymised queries omitted)
--   search_console_pages    dimensions [date, page]    per page (a result showing two of our pages counts for both)
-- search_console_import_days records every day the job was asked to import: 'ok' (incl. days with no data — rows 0
-- means imported and empty, not missing), 'failed' (retried by every later run) or 'expired' (beyond Google's
-- 16-month retention, never retried). final = Google said the day's data is complete in all three responses.
--
-- Service role only: RLS on, no policies; the job and GET /api/admin/analytics/search-console use the service role.
-- No personal data (Search Console reports aggregates). No purge: a few thousand rows a month.
-- Replay: new empty tables + functions; applies on an empty database.

CREATE TABLE public.search_console_daily (
  day date PRIMARY KEY,
  clicks integer NOT NULL CHECK (clicks >= 0),
  impressions integer NOT NULL CHECK (impressions >= 0),
  ctr double precision,
  position double precision
);

CREATE TABLE public.search_console_queries (
  day date NOT NULL,
  query text NOT NULL,
  clicks integer NOT NULL CHECK (clicks >= 0),
  impressions integer NOT NULL CHECK (impressions >= 0),
  ctr double precision,
  position double precision,
  PRIMARY KEY (day, query)
);

-- page_url is Google's URL verbatim (the key: URLs that differ only by query string or host stay distinct); host
-- and path are derived by the job for display and for joining vetree.app pages to page_views.path.
CREATE TABLE public.search_console_pages (
  day date NOT NULL,
  page_url text NOT NULL,
  host text NOT NULL,
  path text NOT NULL,
  clicks integer NOT NULL CHECK (clicks >= 0),
  impressions integer NOT NULL CHECK (impressions >= 0),
  ctr double precision,
  position double precision,
  PRIMARY KEY (day, page_url)
);
CREATE INDEX search_console_pages_path_day_idx ON public.search_console_pages (path, day);

CREATE TABLE public.search_console_import_days (
  day date PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('ok', 'failed', 'expired')),
  final boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  imported_at timestamptz,
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 200),
  daily_rows integer NOT NULL DEFAULT 0,
  query_rows integer NOT NULL DEFAULT 0,
  page_rows integer NOT NULL DEFAULT 0,
  query_truncated boolean NOT NULL DEFAULT false,
  page_truncated boolean NOT NULL DEFAULT false
);

ALTER TABLE public.search_console_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_console_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_console_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_console_import_days ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.search_console_daily FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.search_console_queries FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.search_console_pages FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.search_console_import_days FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON public.search_console_daily TO service_role;
GRANT SELECT, INSERT, DELETE ON public.search_console_queries TO service_role;
GRANT SELECT, INSERT, DELETE ON public.search_console_pages TO service_role;
-- The job marks pending / failed / expired days directly (upsert); successful days go through the function
GRANT SELECT, INSERT, UPDATE ON public.search_console_import_days TO service_role;

-- Replaces one day in all three data sets and marks it 'ok', in one transaction (a rerun is idempotent; rows Google
-- later drops disappear). Rows get day = p_day whatever the payload says. A malformed payload or a duplicate key
-- raises, and nothing changes.
CREATE FUNCTION public.replace_search_console_day(
  p_day date, p_final boolean, p_daily jsonb, p_queries jsonb, p_pages jsonb,
  p_query_truncated boolean, p_page_truncated boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_daily integer;
  v_queries integer;
  v_pages integer;
BEGIN
  IF p_day IS NULL OR p_final IS NULL OR p_query_truncated IS NULL OR p_page_truncated IS NULL THEN
    RAISE EXCEPTION 'replace_search_console_day: null argument';
  END IF;
  IF jsonb_typeof(p_daily) IS DISTINCT FROM 'array' OR jsonb_typeof(p_queries) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_pages) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'replace_search_console_day: payloads must be JSON arrays';
  END IF;
  IF jsonb_array_length(p_daily) > 1 THEN
    RAISE EXCEPTION 'replace_search_console_day: more than one daily total';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_daily || p_queries || p_pages) e WHERE jsonb_typeof(e) <> 'object') THEN
    RAISE EXCEPTION 'replace_search_console_day: array elements must be objects';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('search_console:' || p_day::text, 88));

  DELETE FROM public.search_console_daily WHERE day = p_day;
  DELETE FROM public.search_console_queries WHERE day = p_day;
  DELETE FROM public.search_console_pages WHERE day = p_day;

  INSERT INTO public.search_console_daily (day, clicks, impressions, ctr, position)
  SELECT p_day, r.clicks, r.impressions, r.ctr, r.position
  FROM jsonb_to_recordset(p_daily) AS r(clicks integer, impressions integer, ctr double precision, position double precision);
  GET DIAGNOSTICS v_daily = ROW_COUNT;

  INSERT INTO public.search_console_queries (day, query, clicks, impressions, ctr, position)
  SELECT p_day, r.query, r.clicks, r.impressions, r.ctr, r.position
  FROM jsonb_to_recordset(p_queries)
    AS r(query text, clicks integer, impressions integer, ctr double precision, position double precision);
  GET DIAGNOSTICS v_queries = ROW_COUNT;

  INSERT INTO public.search_console_pages (day, page_url, host, path, clicks, impressions, ctr, position)
  SELECT p_day, r.page_url, r.host, r.path, r.clicks, r.impressions, r.ctr, r.position
  FROM jsonb_to_recordset(p_pages)
    AS r(page_url text, host text, path text, clicks integer, impressions integer, ctr double precision,
         position double precision);
  GET DIAGNOSTICS v_pages = ROW_COUNT;

  INSERT INTO public.search_console_import_days AS d
    (day, status, final, attempted_at, imported_at, last_error, daily_rows, query_rows, page_rows,
     query_truncated, page_truncated)
  VALUES (p_day, 'ok', p_final, now(), now(), NULL, v_daily, v_queries, v_pages, p_query_truncated, p_page_truncated)
  ON CONFLICT (day) DO UPDATE SET
    status = 'ok', final = EXCLUDED.final, attempted_at = EXCLUDED.attempted_at, imported_at = EXCLUDED.imported_at,
    last_error = NULL, daily_rows = EXCLUDED.daily_rows, query_rows = EXCLUDED.query_rows,
    page_rows = EXCLUDED.page_rows, query_truncated = EXCLUDED.query_truncated,
    page_truncated = EXCLUDED.page_truncated;

  RETURN jsonb_build_object('day', p_day, 'daily', v_daily, 'queries', v_queries, 'pages', v_pages, 'final', p_final);
END;
$$;

-- The dashboard's read: totals per day, top queries and top pages over [p_from, p_to] (impression-weighted position,
-- CTR = clicks / impressions, deterministic order), and every day in the window that is not 'ok' and final.
CREATE FUNCTION public.search_console_summary(p_from date, p_to date, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 120 THEN
    RAISE EXCEPTION 'search_console_summary: window must be 1..121 days';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'search_console_summary: limit must be 1..100';
  END IF;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'daily', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'clicks', d.clicks, 'impressions', d.impressions,
                                          'ctr', d.ctr, 'position', d.position) ORDER BY d.day)
      FROM public.search_console_daily d WHERE d.day BETWEEN p_from AND p_to), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
        'clicks', coalesce(sum(d.clicks), 0),
        'impressions', coalesce(sum(d.impressions), 0),
        'position', sum(d.position * d.impressions) / nullif(sum(d.impressions) FILTER (WHERE d.position IS NOT NULL), 0))
      FROM public.search_console_daily d WHERE d.day BETWEEN p_from AND p_to),
    'queries', coalesce((
      SELECT jsonb_agg(to_jsonb(q) ORDER BY q.impressions DESC, q.clicks DESC, q.query)
      FROM (
        SELECT s.query, sum(s.clicks)::integer AS clicks, sum(s.impressions)::integer AS impressions,
               sum(s.clicks)::double precision / nullif(sum(s.impressions), 0) AS ctr,
               sum(s.position * s.impressions) / nullif(sum(s.impressions) FILTER (WHERE s.position IS NOT NULL), 0) AS position
        FROM public.search_console_queries s WHERE s.day BETWEEN p_from AND p_to
        GROUP BY s.query
        ORDER BY sum(s.impressions) DESC, sum(s.clicks) DESC, s.query
        LIMIT p_limit) q), '[]'::jsonb),
    'pages', coalesce((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.impressions DESC, p.clicks DESC, p.page_url)
      FROM (
        SELECT s.page_url, min(s.host) AS host, min(s.path) AS path,
               sum(s.clicks)::integer AS clicks, sum(s.impressions)::integer AS impressions,
               sum(s.clicks)::double precision / nullif(sum(s.impressions), 0) AS ctr,
               sum(s.position * s.impressions) / nullif(sum(s.impressions) FILTER (WHERE s.position IS NOT NULL), 0) AS position
        FROM public.search_console_pages s WHERE s.day BETWEEN p_from AND p_to
        GROUP BY s.page_url
        ORDER BY sum(s.impressions) DESC, sum(s.clicks) DESC, s.page_url
        LIMIT p_limit) p), '[]'::jsonb),
    -- Days in the window that are missing, failed, expired, preliminary or hit Google's row cap
    'incomplete_days', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'day', g.day::date,
               'status', CASE WHEN i.day IS NULL THEN 'missing'
                              WHEN i.status <> 'ok' THEN i.status
                              WHEN NOT i.final THEN 'preliminary'
                              ELSE 'ok' END,
               'query_truncated', coalesce(i.query_truncated, false),
               'page_truncated', coalesce(i.page_truncated, false)) ORDER BY g.day)
      FROM generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') AS g(day)
      LEFT JOIN public.search_console_import_days i ON i.day = g.day::date
      WHERE i.day IS NULL OR i.status <> 'ok' OR NOT i.final OR i.query_truncated OR i.page_truncated), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_search_console_day(date, boolean, jsonb, jsonb, jsonb, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_console_summary(date, date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_search_console_day(date, boolean, jsonb, jsonb, jsonb, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_console_summary(date, date, integer) TO service_role;
