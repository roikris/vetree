-- growth-006 (Roi 2026-11-24, "logging only"): how the December trial's article of the day was chosen.
--
-- Why: the analysis of Oct 13 – Nov 23 found the recommendation scores don't (yet) predict audience response on 39
-- posted articles, so the ranking stays unchanged; December records how each day's article was picked so January
-- can compare outcomes by pick with ~70 articles. Scores are already kept per article (growth_article_scores) and each
-- recommendation list shown is logged (growth_recommendation_sets) — no ranking is stored here.
--
-- Written by /api/admin/growth/trial/mark after record_trial_post() succeeds (best effort: a failed write never fails
-- the post). Client-reported, admin only, normalised server-side (lib/growth/pickSource.ts).
--
-- Additive only: one nullable column. service_role already has SELECT, INSERT, UPDATE on the table (089) — no grant
-- change.

ALTER TABLE public.growth_trial_posts
  ADD COLUMN IF NOT EXISTS pick_source text
    CHECK (pick_source IS NULL OR pick_source IN ('auto', 'recommendation', 'search', 'unknown'));

COMMENT ON COLUMN public.growth_trial_posts.pick_source IS
  'How the day''s article was chosen in the trial tab: auto (server pick), recommendation, search, unknown; NULL = not recorded';
