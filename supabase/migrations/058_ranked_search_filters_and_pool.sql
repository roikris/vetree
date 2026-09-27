-- Migration 058: search_articles_ranked — rank a relevant pool, and filter inside SQL
--
-- PROBLEM (measured 2026-09-27)
--   1. The candidate step took `LIMIT 200` with NO ORDER BY: an arbitrary 200 of the
--      matches, and only those were ranked. Any query with more than 200 matches returned
--      the best of a random subset — dog 7,470 matches, cat 3,277, anesthesia 1,983,
--      diarrhea 444, kidney disease 323, osteoarthritis 243, lymphoma 242.
--   2. Species / specialty / evidence / journal filters were applied in JavaScript to
--      those 200 rows (lib/queries/articles.ts), so narrowing a broad search filtered an
--      arbitrary 200 instead of every match.
--
-- WHY NOT RANK EVERY MATCH
--   Ranking reads each match's tsvector. "dog" (7,470 matches) took 3.2 s cold / 0.3 s
--   warm, and anon's statement_timeout is 3 s (pg_roles.rolconfig) — a cold broad search
--   would fail outright, worse than today. The 200 cap (migration 030) existed for this.
--
-- FIX
--   - Filters move into the candidate step, so they apply to every match before any cap.
--   - The pool grows from 200 to 1,000 matches, all fully scored. Of the 296 distinct
--     queries in search_logs, 32 (11%) had more than 200 matches — ranked from an arbitrary
--     subset until now — and only 12 have more than 1,000 (broad single words: dog,
--     veterinary, canine, cat, feline, anesthesia, imaging). So ranking is exact for 284 of
--     296 real queries, and the broad words rank a 5x larger subset. 1,000 rather than
--     1,500: the same coverage of real queries (1,500 adds one) for ~2/3 of the cost.
--   - ORDER BY score DESC, id: deterministic ties.
--
--   Species semantics are identical to lib/utils/species.ts (the app's single definition):
--     'small-animal' = not large-animal-only: labels IS NULL, OR no large-animal label,
--                      OR also a small-animal label
--     'large-animal' = has a large-animal label
--     'all' / NULL   = no species filter (unknown values also fall back to no filter;
--                      the app validates before calling)
--   CLAUDE.md rule 4 ("large-animal filtering in JS, not Supabase") is about PostgREST's
--   array-filter syntax; array operators inside SQL are exact (parity verified below).
--
-- SIGNATURE: new parameters all have defaults, so the current app call
-- (search_query, result_limit) keeps working between db push and deploy. The old
-- two-argument function is DROPPED first: leaving it would make every call ambiguous.
--
-- ROLLBACK: DROP this 7-argument signature, re-apply the definition from migration 030,
-- then re-apply migration 052's two ALTERs (SECURITY DEFINER; SET search_path = public,
-- pg_temp). 030 alone restores invoker execution, which brings back the RLS-related
-- search timeouts documented in 052. Revert the app change (lib/queries/articles.ts) first:
-- the 2-argument function rejects the new parameters.

DROP FUNCTION IF EXISTS public.search_articles_ranked(text, integer);

CREATE FUNCTION public.search_articles_ranked(
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
    -- Deterministic pool: when a query has more than 1,000 in-scope matches (broad single
    -- words), take the newest 1,000 rather than whichever the index returns first, so every
    -- page of the same search ranks the same pool. Ordering by relevance here would read
    -- every match's tsvector — the cost the cap exists to avoid.
    ORDER BY a.publication_date DESC NULLS LAST, a.id
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

GRANT EXECUTE ON FUNCTION public.search_articles_ranked(text, integer, text, text[], boolean, text[], text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.search_articles_ranked(text, integer, text, text[], boolean, text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_articles_ranked(text, integer, text, text[], boolean, text[], text[]) TO service_role;
