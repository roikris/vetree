-- Migration 059 (HOTFIX): remove the pool ORDER BY added in 058
--
-- PROBLEM (production, 2026-09-27, found in the post-push PostgREST check)
--   058 ordered the candidate pool by publication_date so broad queries would rank a
--   deterministic pool. To pick the newest 1,000, Postgres must read EVERY match's heap row
--   before it can stop — 7,470 for "dog". Cold, through PostgREST as anon, "dog" hit the 3 s
--   statement_timeout (57014) and other broad words took 0.7–2.1 s; warm 330–480 ms. The
--   pre-push benchmarks ran mostly warm and missed it.
--
-- FIX
--   Pool back to an unordered LIMIT 1000, so the index scan stops as soon as it has 1,000
--   in-scope matches (measured before 058's ORDER BY: broad words 70–430 ms). Everything
--   else in 058 stays: filters inside the pool step, pool 1,000 vs the old 200, full scoring,
--   ORDER BY score DESC, id on the final result.
--
-- TRADE-OFF (owner decision): for queries with more than 1,000 in-scope matches — about a
--   dozen broad single words in search history (dog, veterinary, canine, cat, feline,
--   anesthesia, imaging, ...) — which 1,000 get ranked is not fixed, so pages of such a
--   search can shift slightly between requests. Queries with <= 1,000 matches (284 of 296
--   logged) are exactly ranked and stable.
--
-- Same signature and grants as 058 (CREATE OR REPLACE keeps them).
-- ROLLBACK: re-apply 058 (brings the timeout back) or see 058's rollback note.

CREATE OR REPLACE FUNCTION public.search_articles_ranked(
  search_query     text,
  result_limit     integer DEFAULT 50,
  species_scope    text    DEFAULT 'all',
  filter_labels    text[]  DEFAULT NULL,
  labels_match_all boolean DEFAULT false,
  filter_evidence  text[]  DEFAULT NULL,
  filter_journals  text[]  DEFAULT NULL
)
RETURNS TABLE(
  id text, title text, clinical_bottom_line text, summary text, labels text[],
  source_journal text, publication_date date, authors text, pubmed_id text, doi text,
  article_url text, strength_of_evidence text, score double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH queries AS (
    SELECT
      websearch_to_tsquery('english', search_query) AS broad_q,
      phraseto_tsquery('english', search_query)     AS phrase_q,
      ARRAY['Equine','equine','Large Animal','large animal','Livestock','livestock',
            'Poultry','poultry','Food Animal','food animal']::text[] AS large_labels,
      ARRAY['Small Animal','small animal']::text[]                    AS small_labels
  ),
  -- Step 1: index-driven candidates, every filter applied BEFORE the pool cap
  pool AS (
    SELECT a.id
    FROM articles a, queries q
    WHERE a.needs_enrichment = false
      AND a.summary IS NOT NULL
      AND a.clinical_bottom_line IS NOT NULL
      AND (a.quarantined IS NULL OR a.quarantined = false)
      AND a.search_vector @@ q.broad_q
      AND CASE species_scope
            WHEN 'small-animal' THEN (a.labels IS NULL
                                      OR NOT (a.labels && q.large_labels)
                                      OR a.labels && q.small_labels)
            WHEN 'large-animal' THEN coalesce(a.labels && q.large_labels, false)
            ELSE true
          END
      AND (filter_labels IS NULL OR cardinality(filter_labels) = 0
           OR CASE WHEN labels_match_all THEN coalesce(a.labels @> filter_labels, false)
                   ELSE coalesce(a.labels && filter_labels, false) END)
      AND (filter_evidence IS NULL OR cardinality(filter_evidence) = 0
           OR a.strength_of_evidence = ANY (filter_evidence))
      AND (filter_journals IS NULL OR cardinality(filter_journals) = 0
           OR a.source_journal = ANY (filter_journals))
    -- Unordered on purpose (migration 059): the scan must be able to stop at 1,000.
    LIMIT 1000
  ),
  -- Step 2: full score for the pool
  scored AS (
    SELECT
      a.id, a.title, a.clinical_bottom_line, a.summary, a.labels, a.source_journal,
      a.publication_date, a.authors, a.pubmed_id, a.doi, a.article_url,
      a.strength_of_evidence,
      (
        0.60 * ts_rank_cd(a.search_vector, q.broad_q, 32) +
        0.25 * ts_rank_cd(a.search_vector, q.phrase_q, 32) +
        0.10 * CASE WHEN lower(a.title) LIKE '%' || lower(search_query) || '%'
                    THEN 1.0 ELSE 0.0 END +
        0.05 * GREATEST(
                 similarity(lower(a.title), lower(search_query)),
                 similarity(lower(coalesce(a.clinical_bottom_line, '')), lower(search_query))
               )
      ) AS score
    FROM articles a
    JOIN pool p ON a.id = p.id
    CROSS JOIN queries q
  )
  SELECT * FROM scored
  ORDER BY score DESC, id
  LIMIT result_limit;
$function$;
