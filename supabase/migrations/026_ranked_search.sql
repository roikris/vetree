-- Migration 026: Weighted multi-field search vector + ranked search RPCs
-- Run in Supabase SQL Editor. ALTER TABLE on ~15k rows takes 30-60 seconds.
-- After running, verify: SELECT count(*) FROM articles WHERE search_vector IS NOT NULL;

-- Step 1: Add plain search_vector column (not generated — to_tsvector isn't immutable enough
-- for GENERATED ALWAYS in Supabase's PostgreSQL config; use trigger instead)
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Step 2: GIN index on the column
CREATE INDEX IF NOT EXISTS articles_search_vector_gin
  ON articles USING GIN (search_vector);

-- Step 3: Trigger function to keep search_vector in sync
CREATE OR REPLACE FUNCTION articles_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.simple'::regconfig,  coalesce(array_to_string(NEW.labels, ' '), '')), 'B') ||
    setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(NEW.clinical_bottom_line, '')), 'B') ||
    setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(NEW.summary, '')), 'C');
  RETURN NEW;
END;
$$;

ALTER FUNCTION articles_search_vector_update() SET search_path = public;

CREATE OR REPLACE TRIGGER articles_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, labels, clinical_bottom_line, summary
  ON articles
  FOR EACH ROW EXECUTE FUNCTION articles_search_vector_update();

-- Step 4: Backfill existing enriched rows (~15k rows, takes a few seconds)
UPDATE articles
SET search_vector =
  setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(title, '')), 'A') ||
  setweight(to_tsvector('pg_catalog.simple'::regconfig,  coalesce(array_to_string(labels, ' '), '')), 'B') ||
  setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(clinical_bottom_line, '')), 'B') ||
  setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(summary, '')), 'C')
WHERE needs_enrichment = false
  AND summary IS NOT NULL
  AND clinical_bottom_line IS NOT NULL;

-- Step 3: RPC function for ranked search
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
AS $$
  WITH queries AS (
    SELECT
      websearch_to_tsquery('english', search_query) AS broad_q,
      phraseto_tsquery('english', search_query)     AS phrase_q
  )
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
      0.55 * ts_rank_cd(a.search_vector, q.broad_q, 32) +
      0.20 * ts_rank_cd(a.search_vector, q.phrase_q, 32) +
      0.15 * CASE
               WHEN lower(a.title) LIKE '%' || lower(search_query) || '%'
               THEN 1.0 ELSE 0.0
             END +
      0.07 * GREATEST(
               similarity(lower(a.title), lower(search_query)),
               similarity(lower(coalesce(a.clinical_bottom_line,'')), lower(search_query))
             ) +
      0.03 * (1.0 / (1.0 + extract(epoch from (now() - a.publication_date::timestamptz) / 86400 / 365)))
    ) AS score
  FROM articles a, queries q
  WHERE
    a.needs_enrichment = false
    AND a.summary IS NOT NULL
    AND a.clinical_bottom_line IS NOT NULL
    AND (a.quarantined IS NULL OR a.quarantined = false)
    AND (
      a.search_vector @@ q.broad_q
      OR similarity(lower(a.title), lower(search_query)) > 0.3
      OR similarity(lower(coalesce(a.clinical_bottom_line,'')), lower(search_query)) > 0.3
    )
  ORDER BY score DESC, a.publication_date DESC
  LIMIT result_limit;
$$;

ALTER FUNCTION search_articles_ranked(text, integer) SET search_path = public;

GRANT EXECUTE ON FUNCTION search_articles_ranked(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION search_articles_ranked(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION search_articles_ranked(text, integer) TO service_role;

-- Step 4: Species/disease anchor scoring for synthesis (separate RPC)
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
AS $$
  WITH queries AS (
    SELECT
      websearch_to_tsquery('english', search_query) AS broad_q,
      phraseto_tsquery('english', search_query)     AS phrase_q
  ),
  -- Species anchor detection (soft bonus, not hard filter)
  species_context AS (
    SELECT
      CASE WHEN lower(search_query) ~ '\m(cat|cats|feline|kitten)\M' THEN 'feline'
           WHEN lower(search_query) ~ '\m(dog|dogs|canine|puppy|puppies)\M' THEN 'canine'
           ELSE 'any' END AS target_species
  ),
  candidates AS (
    SELECT
      a.*,
      (
        0.50 * ts_rank_cd(a.search_vector, q.broad_q, 32) +
        0.20 * ts_rank_cd(a.search_vector, q.phrase_q, 32) +
        0.15 * CASE
                 WHEN lower(a.title) LIKE '%' || lower(search_query) || '%'
                 THEN 1.0 ELSE 0.0
               END +
        -- Species alignment bonus (soft)
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
    FROM articles a, queries q, species_context sc
    WHERE
      a.needs_enrichment = false
      AND a.summary IS NOT NULL
      AND a.clinical_bottom_line IS NOT NULL
      AND (a.quarantined IS NULL OR a.quarantined = false)
      AND (
        a.search_vector @@ q.broad_q
        OR similarity(lower(a.title), lower(search_query)) > 0.3
      )
    ORDER BY score DESC
    LIMIT candidate_limit
  )
  SELECT
    id, title, clinical_bottom_line, summary, labels,
    source_journal, publication_date, authors, pubmed_id,
    doi, article_url, strength_of_evidence, score
  FROM candidates
  ORDER BY score DESC
  LIMIT final_limit;
$$;

ALTER FUNCTION search_articles_synthesis(text, integer, integer) SET search_path = public;

GRANT EXECUTE ON FUNCTION search_articles_synthesis(text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION search_articles_synthesis(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION search_articles_synthesis(text, integer, integer) TO service_role;
