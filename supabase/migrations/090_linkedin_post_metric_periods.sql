-- analytics-002 (Roi 2026-11-23): per-post LinkedIn numbers carry the date range they were counted over.
--
-- Why: a LinkedIn analytics export's "Top posts" sheet counts each post's impressions / engagements over the
-- EXPORT'S date range only, and lists only the top 50 posts of that range (two separate lists: by engagements
-- and by impressions). The upload overwrote each row with the latest export's numbers, so an old post listed in
-- a quiet week went from thousands to a handful (the 2026-06-11 maropitant post: stored 4 impressions with 108
-- engagements; LinkedIn shows 9,375 impressions). From now on the upload keeps, per metric, the HIGHEST value any
-- export reported (a lower bound of the post's lifetime number) and the export range it came from
-- (lib/linkedin/postMetrics.ts). Rows written before this migration have no range (NULL = unknown).
--
-- Additive only: four nullable columns, no backfill, no data changed.

ALTER TABLE public.linkedin_post_metrics
  ADD COLUMN IF NOT EXISTS impressions_period_start date,
  ADD COLUMN IF NOT EXISTS impressions_period_end   date,
  ADD COLUMN IF NOT EXISTS engagements_period_start date,
  ADD COLUMN IF NOT EXISTS engagements_period_end   date;

COMMENT ON COLUMN public.linkedin_post_metrics.impressions_period_start IS
  'First day of the LinkedIn export range the stored impressions were counted over (NULL: before migration 090, or entered by hand)';
COMMENT ON COLUMN public.linkedin_post_metrics.impressions_period_end IS
  'Last day of that export range';
COMMENT ON COLUMN public.linkedin_post_metrics.engagements_period_start IS
  'First day of the LinkedIn export range the stored engagements were counted over (NULL: before migration 090, or entered by hand)';
COMMENT ON COLUMN public.linkedin_post_metrics.engagements_period_end IS
  'Last day of that export range';
