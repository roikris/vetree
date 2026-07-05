-- Add 'activity_id' to match_method allowed values
ALTER TABLE linkedin_post_metrics
  DROP CONSTRAINT IF EXISTS linkedin_post_metrics_match_method_check;

ALTER TABLE linkedin_post_metrics
  ADD CONSTRAINT linkedin_post_metrics_match_method_check
  CHECK (match_method IN ('activity_id', 'slug', 'date', 'haiku', 'manual'));
