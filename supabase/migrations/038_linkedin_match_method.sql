-- Add match_method to linkedin_post_metrics to track how each post was linked to an article
ALTER TABLE linkedin_post_metrics
  ADD COLUMN IF NOT EXISTS match_method text
  CHECK (match_method IN ('slug', 'date', 'haiku', 'manual'));
