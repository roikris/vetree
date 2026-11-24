-- analytics-002 (Roi 2026-11-23): per-post LinkedIn numbers carry the date range they were counted over.
--
-- Why: a LinkedIn analytics export's "Top posts" sheet counts each post's impressions / engagements over the
-- EXPORT'S date range only, and lists only the top 50 posts of that range (two separate lists: by engagements
-- and by impressions). The upload overwrote each row with the latest export's numbers, so an old post listed in
-- a quiet week went from thousands to a handful (the 2026-06-11 maropitant post: stored 4 impressions with 108
-- engagements; LinkedIn shows 9,375 impressions). From now on the upload keeps, per metric, the HIGHEST value any
-- export reported (a lower bound of the post's lifetime number) and the export range it came from
-- (lib/linkedin/postMetrics.ts). A number typed in by hand is the post page's all-time figure (range: post date →
-- that day). NULL range = written before this migration, or by an export without a daily sheet.
--
-- The keep-the-higher comparison runs inside the UPDATE (apply_linkedin_post_metrics below), against each row's
-- current values, so a manual correction made while an upload is running is never replaced by a lower number
-- (Codex review, PR #163 round 1).
--
-- Additive only: four nullable columns + one function; no backfill, no data changed.

ALTER TABLE public.linkedin_post_metrics
  ADD COLUMN IF NOT EXISTS impressions_period_start date,
  ADD COLUMN IF NOT EXISTS impressions_period_end   date,
  ADD COLUMN IF NOT EXISTS engagements_period_start date,
  ADD COLUMN IF NOT EXISTS engagements_period_end   date;

COMMENT ON COLUMN public.linkedin_post_metrics.impressions_period_start IS
  'First day of the LinkedIn export range the stored impressions were counted over (a typed-in number: the post date; NULL: unknown)';
COMMENT ON COLUMN public.linkedin_post_metrics.impressions_period_end IS
  'Last day of that export range';
COMMENT ON COLUMN public.linkedin_post_metrics.engagements_period_start IS
  'First day of the LinkedIn export range the stored engagements were counted over (a typed-in number: the post date; NULL: unknown)';
COMMENT ON COLUMN public.linkedin_post_metrics.engagements_period_end IS
  'Last day of that export range';

-- One export's numbers for posts that already have a row: per metric, an incoming value higher than the row's CURRENT
-- value (or a first value) replaces it together with the export range; otherwise the stored value and its range stay.
-- post_date and raw_row follow the export; metrics_updated_at moves only when a number changed. article_id and
-- match_method are never touched (the XLSX knows numbers, humans know articles). Returns the rows whose numbers rose.
-- p_rows: [{post_url, post_date, impressions, engagements, raw_row}] — post_url required; numbers may be null.
CREATE OR REPLACE FUNCTION public.apply_linkedin_post_metrics(p_rows jsonb, p_period_start date, p_period_end date)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_raised integer;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'invalid: p_rows must be a JSON array';
  END IF;
  IF (p_period_start IS NULL) <> (p_period_end IS NULL) OR p_period_start > p_period_end THEN
    RAISE EXCEPTION 'invalid: export range';
  END IF;

  WITH incoming AS (
    SELECT DISTINCT ON (x.post_url) x.post_url, x.post_date, x.impressions, x.engagements, x.raw_row
    FROM jsonb_to_recordset(p_rows) AS x(post_url text, post_date date, impressions integer, engagements integer, raw_row jsonb)
    WHERE x.post_url IS NOT NULL AND x.post_url <> ''
    ORDER BY x.post_url
  ), changed AS (
    UPDATE public.linkedin_post_metrics m
    SET
      impressions = CASE WHEN i.impressions IS NOT NULL AND (m.impressions IS NULL OR i.impressions > m.impressions)
                         THEN i.impressions ELSE m.impressions END,
      impressions_period_start = CASE WHEN i.impressions IS NOT NULL AND (m.impressions IS NULL OR i.impressions > m.impressions)
                         THEN p_period_start ELSE m.impressions_period_start END,
      impressions_period_end = CASE WHEN i.impressions IS NOT NULL AND (m.impressions IS NULL OR i.impressions > m.impressions)
                         THEN p_period_end ELSE m.impressions_period_end END,
      engagements = CASE WHEN i.engagements IS NOT NULL AND (m.engagements IS NULL OR i.engagements > m.engagements)
                         THEN i.engagements ELSE m.engagements END,
      engagements_period_start = CASE WHEN i.engagements IS NOT NULL AND (m.engagements IS NULL OR i.engagements > m.engagements)
                         THEN p_period_start ELSE m.engagements_period_start END,
      engagements_period_end = CASE WHEN i.engagements IS NOT NULL AND (m.engagements IS NULL OR i.engagements > m.engagements)
                         THEN p_period_end ELSE m.engagements_period_end END,
      metrics_updated_at = CASE
        WHEN (i.impressions IS NOT NULL AND (m.impressions IS NULL OR i.impressions > m.impressions))
          OR (i.engagements IS NOT NULL AND (m.engagements IS NULL OR i.engagements > m.engagements))
        THEN now() ELSE m.metrics_updated_at END,
      post_date = COALESCE(i.post_date, m.post_date),
      raw_row = COALESCE(i.raw_row, m.raw_row)
    FROM incoming i
    WHERE m.post_url = i.post_url
    RETURNING (m.metrics_updated_at = now()) AS raised
  )
  SELECT count(*) FILTER (WHERE raised) INTO v_raised FROM changed;
  RETURN v_raised;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_linkedin_post_metrics(jsonb, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_linkedin_post_metrics(jsonb, date, date) TO service_role;
