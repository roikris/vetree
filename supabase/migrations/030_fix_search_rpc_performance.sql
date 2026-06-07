-- Migration 030: Fix search RPC performance — eliminate sequential scan
--
-- Problem: search_articles_ranked and search_articles_synthesis used
--   WHERE search_vector @@ broad_q OR similarity() > threshold
-- The OR clause breaks GIN index usage → full sequential scan on 15,000 rows → 57014 timeout.
--
-- Fix: Two-step architecture
--   Step 1: GIN-only WHERE clause → fast index scan → ~200 candidates
--   Step 2: similarity() scoring applied ONLY to the small candidate set → instant
--
-- No app code changes needed — routes already call these RPCs by name.
--
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION search_articles_ranked(
  search_query text,
  result_limit integer DEFAULT 50
)
RETURNS TABLE (
  id text,
  title text,
  clinical_bottom_line text,
  summary text,
  labels text[],
  source_journal text,
  publication_date date,
  authors text,
  pubmed_id text,
  doi text,
  article_url text,
  strength_of_evidence text,
  score float
)
LANGUAGE sql
STABLE
AS $func$
  WITH queries AS (
    SELECT
      websearch_to_tsquery('english', search_query) AS broad_q,
      phraseto_tsquery('english', search_query)     AS phrase_q
  ),
  -- Step 1: GIN index candidate retrieval ONLY
  -- No similarity() here — keep the index path clean
  gin_candidates AS (
    SELECT a.id
    FROM articles a, queries q
    WHERE
      a.needs_enrichment = false
      AND a.summary IS NOT NULL
      AND a.clinical_bottom_line IS NOT NULL
      AND (a.quarantined IS NULL OR a.quarantined = false)
      AND a.search_vector @@ q.broad_q
    LIMIT 200
  ),
  -- Step 2: Score only the GIN candidates (small set)
  -- NOW we can afford similarity() — only on ~200 rows not 15,000
  scored AS (
    SELECT
      a.id,
      a.title,
      a.clinical_bottom_line,
      a.summary,
      a.labels,
      a.source_journal,
      a.publication_date,
      a.authors,
      a.pubmed_id,
      a.doi,
      a.article_url,
      a.strength_of_evidence,
      (
        0.60 * ts_rank_cd(a.search_vector, q.broad_q, 32) +
        0.25 * ts_rank_cd(a.search_vector, q.phrase_q, 32) +
        0.10 * CASE
                 WHEN lower(a.title) LIKE '%' || lower(search_query) || '%'
                 THEN 1.0 ELSE 0.0
               END +
        0.05 * GREATEST(
                 similarity(lower(a.title), lower(search_query)),
                 similarity(lower(coalesce(a.clinical_bottom_line,'')), lower(search_query))
               )
      ) AS score
    FROM articles a
    JOIN gin_candidates gc ON a.id = gc.id
    CROSS JOIN queries q
  )
  SELECT * FROM scored
  ORDER BY score DESC
  LIMIT result_limit;
$func$;

ALTER FUNCTION search_articles_ranked(text, integer)
SET search_path = public;

GRANT EXECUTE ON FUNCTION search_articles_ranked(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION search_articles_ranked(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION search_articles_ranked(text, integer) TO service_role;

-- Also fix search_articles_synthesis with the same pattern:
CREATE OR REPLACE FUNCTION search_articles_synthesis(
  search_query text,
  candidate_limit integer DEFAULT 50,
  final_limit integer DEFAULT 15
)
RETURNS TABLE (
  id text,
  title text,
  clinical_bottom_line text,
  summary text,
  labels text[],
  source_journal text,
  publication_date date,
  authors text,
  pubmed_id text,
  doi text,
  article_url text,
  strength_of_evidence text,
  score float
)
LANGUAGE sql
STABLE
AS $func$
  WITH queries AS (
    SELECT
      websearch_to_tsquery('english', search_query) AS broad_q,
      phraseto_tsquery('english', search_query)     AS phrase_q
  ),
  species_context AS (
    SELECT
      CASE
        WHEN lower(search_query) ~ '\m(cat|cats|feline|kitten)\M' THEN 'feline'
        WHEN lower(search_query) ~ '\m(dog|dogs|canine|puppy|puppies)\M' THEN 'canine'
        ELSE 'any'
      END AS target_species
  ),
  -- GIN candidates only — no similarity in WHERE clause
  gin_candidates AS (
    SELECT a.id
    FROM articles a, queries q
    WHERE
      a.needs_enrichment = false
      AND a.summary IS NOT NULL
      AND a.clinical_bottom_line IS NOT NULL
      AND (a.quarantined IS NULL OR a.quarantined = false)
      AND a.search_vector @@ q.broad_q
    LIMIT candidate_limit
  ),
  -- Score candidates with species bonus
  scored AS (
    SELECT
      a.id,
      a.title,
      a.clinical_bottom_line,
      a.summary,
      a.labels,
      a.source_journal,
      a.publication_date,
      a.authors,
      a.pubmed_id,
      a.doi,
      a.article_url,
      a.strength_of_evidence,
      (
        0.50 * ts_rank_cd(a.search_vector, q.broad_q, 32) +
        0.20 * ts_rank_cd(a.search_vector, q.phrase_q, 32) +
        0.15 * CASE
                 WHEN lower(a.title) LIKE '%' || lower(search_query) || '%'
                 THEN 1.0 ELSE 0.0
               END +
        0.10 * CASE
                 WHEN sc.target_species = 'feline'
                      AND (a.labels && ARRAY['Feline','feline']
                           OR lower(a.title) ~ '\m(cat|cats|feline|kitten)\M')
                 THEN 1.0
                 WHEN sc.target_species = 'canine'
                      AND (a.labels && ARRAY['Canine','canine']
                           OR lower(a.title) ~ '\m(dog|dogs|canine|puppy)\M')
                 THEN 1.0
                 WHEN sc.target_species = 'any' THEN 0.5
                 ELSE 0.0
               END +
        0.05 * GREATEST(
                 similarity(lower(a.title), lower(search_query)),
                 similarity(lower(coalesce(a.clinical_bottom_line,'')), lower(search_query))
               )
      ) AS score
    FROM articles a
    JOIN gin_candidates gc ON a.id = gc.id
    CROSS JOIN queries q
    CROSS JOIN species_context sc
  )
  SELECT * FROM scored
  ORDER BY score DESC
  LIMIT final_limit;
$func$;

ALTER FUNCTION search_articles_synthesis(text, integer, integer)
SET search_path = public;

GRANT EXECUTE ON FUNCTION search_articles_synthesis(text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION search_articles_synthesis(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION search_articles_synthesis(text, integer, integer) TO service_role;
