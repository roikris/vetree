-- Add 'cleared' to match_method allowed values on linkedin_post_metrics.
-- Set when an admin manually unassigns an erroneous article match via the
-- LinkedIn Performance table. Distinct from 'no_article' (post genuinely has
-- no article, e.g. reshares) — 'cleared' means "unknown, needs assignment".
-- Excluded from the automatic rematch pass (see rematch/route.ts) so the
-- same wrong tier match can't immediately reassign itself; only resolvable
-- via the manual picker or explicit "no article".
ALTER TABLE linkedin_post_metrics
  DROP CONSTRAINT IF EXISTS linkedin_post_metrics_match_method_check;

ALTER TABLE linkedin_post_metrics
  ADD CONSTRAINT linkedin_post_metrics_match_method_check
  CHECK (match_method IN ('activity_id', 'slug', 'date', 'ai', 'haiku', 'manual', 'no_article', 'cleared'));
