-- Fuzzy Search Setup for Vetree
-- Run these in Supabase SQL Editor

-- LAYER 1: Enable pg_trgm extension for trigram similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram GIN indexes on searchable text fields
-- These indexes enable fast similarity searches for handling typos
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm
  ON articles USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_articles_cbl_trgm
  ON articles USING GIN (clinical_bottom_line gin_trgm_ops);

-- LAYER 3: Create fuzzy search RPC function
-- This function uses trigram similarity to find articles even with spelling errors
-- Example: "astma" will find "asthma" articles
CREATE OR REPLACE FUNCTION search_articles_fuzzy(
  search_query text,
  similarity_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id text,
  title text,
  clinical_bottom_line text,
  summary text,
  labels text[],
  source_journal text,
  publication_date timestamptz,
  authors text,
  strength_of_evidence text,
  needs_enrichment boolean,
  enrichment_attempts integer,
  last_enrichment_at timestamptz,
  last_enrichment_error text,
  quarantined boolean,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.id,
    a.title,
    a.clinical_bottom_line,
    a.summary,
    a.labels,
    a.source_journal,
    a.publication_date,
    a.authors,
    a.strength_of_evidence,
    a.needs_enrichment,
    a.enrichment_attempts,
    a.last_enrichment_at,
    a.last_enrichment_error,
    a.quarantined,
    a.created_at,
    GREATEST(
      similarity(lower(a.title), lower(search_query)),
      similarity(lower(COALESCE(a.clinical_bottom_line, '')), lower(search_query))
    ) as similarity
  FROM articles a
  WHERE
    a.needs_enrichment = false
    AND a.summary IS NOT NULL
    AND a.clinical_bottom_line IS NOT NULL
    AND (a.quarantined IS NULL OR a.quarantined = false)
    AND (
      similarity(lower(a.title), lower(search_query)) > similarity_threshold
      OR similarity(lower(COALESCE(a.clinical_bottom_line, '')), lower(search_query)) > similarity_threshold
      OR a.title ILIKE '%' || search_query || '%'
      OR a.clinical_bottom_line ILIKE '%' || search_query || '%'
    )
  ORDER BY similarity DESC
  LIMIT 100;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_articles_fuzzy(text, float) TO authenticated;
GRANT EXECUTE ON FUNCTION search_articles_fuzzy(text, float) TO anon;

-- Test the fuzzy search (optional)
-- This should find "asthma" articles even with typo:
-- SELECT * FROM search_articles_fuzzy('astma', 0.3) LIMIT 5;
