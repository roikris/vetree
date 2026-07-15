-- Add 'no_article' to match_method allowed values on linkedin_post_metrics.
-- Used for reshares and group posts that have no associated article.
-- These rows exit the unmatched count without needing manual article assignment.
ALTER TABLE linkedin_post_metrics
  DROP CONSTRAINT IF EXISTS linkedin_post_metrics_match_method_check;

ALTER TABLE linkedin_post_metrics
  ADD CONSTRAINT linkedin_post_metrics_match_method_check
  CHECK (match_method IN ('activity_id', 'slug', 'date', 'ai', 'haiku', 'manual', 'no_article'));
