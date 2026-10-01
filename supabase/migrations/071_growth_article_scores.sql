-- Migration 071: Growth OS relevance scoring (2026-10-01)
--
-- growth_article_scores — one cached Claude score per article on three 0–10 dimensions the owner
-- picks posts by: practice (changes what a GP does), talk (vets will discuss/share it), wow (defies
-- standard thinking). Ranking uses max(practice, talk, wow). A row is valid only while its
-- rubric_version and input_hash (hash of the scored article fields + model) still match — see
-- lib/growth/scoring.ts. No personal data.
--
-- growth_recommendation_sets — every set of recommendations served to the admin panel, with each
-- item's pool rank, display position, wildcard flag and scores. Approvals/dismissals in
-- growth_agent_memory are joined to these by article_id + time to learn from what was shown
-- (including the deliberate low-ranked wildcard). No personal data.
--
-- Both: service role only (RLS on, no policies).

CREATE TABLE IF NOT EXISTS public.growth_article_scores (
  article_id     text PRIMARY KEY REFERENCES public.articles(id) ON DELETE CASCADE,
  practice       smallint NOT NULL CHECK (practice BETWEEN 0 AND 10),
  talk           smallint NOT NULL CHECK (talk BETWEEN 0 AND 10),
  wow            smallint NOT NULL CHECK (wow BETWEEN 0 AND 10),
  reason         text CHECK (reason IS NULL OR char_length(reason) <= 300),
  rubric_version integer NOT NULL,
  model          text NOT NULL,
  input_hash     text NOT NULL,
  scored_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growth_recommendation_sets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  served_at      timestamptz NOT NULL DEFAULT now(),
  rubric_version integer NOT NULL,
  ranking_policy text NOT NULL,
  eligible_count integer NOT NULL,
  scored_count   integer NOT NULL,
  items          jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_growth_recommendation_sets_served_at
  ON public.growth_recommendation_sets (served_at DESC);

ALTER TABLE public.growth_article_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_recommendation_sets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.growth_article_scores FROM anon, authenticated;
REVOKE ALL ON public.growth_recommendation_sets FROM anon, authenticated;
GRANT ALL ON public.growth_article_scores TO service_role;
GRANT ALL ON public.growth_recommendation_sets TO service_role;
