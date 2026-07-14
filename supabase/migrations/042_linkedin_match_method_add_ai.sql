-- Add 'ai' to match_method allowed values on linkedin_post_metrics.
-- The current matcher code (post-Sonnet migration) writes 'ai'; the constraint
-- only listed 'haiku' (legacy). New AI matches would violate the CHECK.
ALTER TABLE linkedin_post_metrics
  DROP CONSTRAINT IF EXISTS linkedin_post_metrics_match_method_check;

ALTER TABLE linkedin_post_metrics
  ADD CONSTRAINT linkedin_post_metrics_match_method_check
  CHECK (match_method IN ('activity_id', 'slug', 'date', 'ai', 'haiku', 'manual'));
