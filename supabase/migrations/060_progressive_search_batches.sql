-- Migration 060: progressive search — search_articles_batch (Best match | Newest | Oldest)
--
-- Plan: reviewed with Codex over 6 rounds (final BLOCKING none); owner decisions 2026-09-27:
-- Best match is the default search order, a visible Best match | Newest toggle, batches of 500,
-- the next batch loads as the reader scrolls.
--
-- WHAT IT REPLACES
--   search_articles_ranked (058/059) ranks an ARBITRARY pool of up to 1,000 matches (unordered
--   LIMIT — ordering the pool made cold broad searches exceed anon's 3 s statement_timeout), and the
--   app then re-sorts that capped list by date. So "newest" was "newest of an arbitrary subset", and
--   nothing beyond the cap was reachable.
--
-- DESIGN
--   Sort key k = coalesce(publication_date, DATE '1900-01-01'): a never-NULL key, so one continuous
--   keyset order covers undated articles (last in newest, first in oldest; never dropped).
--   - newest : ORDER BY k DESC, id DESC; next batch: (k, id) < cursor.
--   - oldest : ORDER BY k ASC,  id ASC;  next batch: (k, id) > cursor.
--   - relevance ("Best match"): the pool is exactly the first newest batch (the newest batch_size
--     in-scope matches), scored as in 059 and returned ORDER BY score DESC, id. No cursor. Exact
--     for queries with <= batch_size matches (276 of 296 logged queries at 500); the app discloses
--     "best among the most recent" when the pool is full.
--   Rows come back in one order per call; the app's cursor is the (sort_key, id) of the last row
--   in DATE order, and exhaustion = fewer rows than batch_size.
--
-- WHY plpgsql + EXECUTE ... USING
--   A plain SQL function is planned without the actual search values; the right plan depends on
--   them: rare words → GIN bitmap + sort of a few rows (35–270 ms measured); broad words → walk the
--   date index and stop at batch_size (0.4–1.7 s cold measured). EXECUTE replans per call with the
--   actual parameter values (PL/pgSQL docs). All values are passed with USING — no user input is
--   concatenated into SQL text.
--
-- SECURITY DEFINER (as 052/056/058/059): under RLS the non-leakproof @@ operator cannot use the GIN
--   index. The body enforces the full publication-eligibility predicate itself (identical to 052's
--   policy). search_path pinned; objects schema-qualified; EXECUTE revoked from PUBLIC, granted to
--   anon / authenticated / service_role only. Inputs validated (SQLSTATE 22023 → API 400).
--
-- INDEXES
--   - (k DESC, id DESC) expression index: the keyset order for both directions (reverse scan).
--   - strength_of_evidence, source_journal: broad word + selective filter combine with the GIN index
--     via BitmapAnd. Without them, "results" + RCT + small animal took 3,769 ms cold; with them 93 ms
--     (measured in an uncommitted transaction).
--
-- search_logs.results_count_is_lower_bound: a progressive search knows only its first batch's count
--   when it is logged; true means "at least results_count".
--
-- ROLLBACK: revert the app first (it calls this function). Then
--   DROP FUNCTION public.search_articles_batch(text, text, text[], boolean, text[], text[], text, date, text, integer);
--   The indexes and the search_logs column are additive and can stay.

SET lock_timeout = '5s';

CREATE INDEX IF NOT EXISTS idx_articles_sortdate_id
  ON public.articles ((coalesce(publication_date, DATE '1900-01-01')) DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_articles_strength_of_evidence
  ON public.articles (strength_of_evidence);
CREATE INDEX IF NOT EXISTS idx_articles_source_journal
  ON public.articles (source_journal);

ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS results_count_is_lower_bound boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.search_articles_batch(
  search_query     text,
  species_scope    text    DEFAULT 'all',
  filter_labels    text[]  DEFAULT NULL,
  labels_match_all boolean DEFAULT false,
  filter_evidence  text[]  DEFAULT NULL,
  filter_journals  text[]  DEFAULT NULL,
  sort_order       text    DEFAULT 'relevance',
  cursor_date      date    DEFAULT NULL,
  cursor_id        text    DEFAULT NULL,
  batch_size       integer DEFAULT 500
)
RETURNS TABLE(
  id text, title text, clinical_bottom_line text, labels text[], source_journal text,
  publication_date date, authors text, pubmed_id text, doi text, article_url text,
  strength_of_evidence text, sort_key date, score double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_order  text;
  v_cursor text;
  v_sql    text;
  v_outer  text;
BEGIN
  -- ── Input validation (SQLSTATE 22023 = invalid_parameter_value → API 400) ──────────────────
  IF search_query IS NULL OR length(btrim(search_query)) = 0 OR length(search_query) > 200 THEN
    RAISE EXCEPTION 'search_query must be 1–200 characters' USING ERRCODE = '22023';
  END IF;
  IF species_scope IS NULL OR species_scope NOT IN ('all', 'small-animal', 'large-animal') THEN
    RAISE EXCEPTION 'invalid species_scope' USING ERRCODE = '22023';
  END IF;
  IF sort_order IS NULL OR sort_order NOT IN ('relevance', 'newest', 'oldest') THEN
    RAISE EXCEPTION 'invalid sort_order' USING ERRCODE = '22023';
  END IF;
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > 500 THEN
    RAISE EXCEPTION 'batch_size must be 1–500' USING ERRCODE = '22023';
  END IF;
  IF (cursor_date IS NULL) <> (cursor_id IS NULL) THEN
    RAISE EXCEPTION 'cursor_date and cursor_id must be given together' USING ERRCODE = '22023';
  END IF;
  IF sort_order = 'relevance' AND cursor_date IS NOT NULL THEN
    RAISE EXCEPTION 'relevance has a single pool and no cursor' USING ERRCODE = '22023';
  END IF;
  IF cursor_id IS NOT NULL AND length(cursor_id) > 100 THEN
    RAISE EXCEPTION 'invalid cursor' USING ERRCODE = '22023';
  END IF;
  IF coalesce(cardinality(filter_labels), 0) > 25 OR coalesce(cardinality(filter_evidence), 0) > 25
     OR coalesce(cardinality(filter_journals), 0) > 25 THEN
    RAISE EXCEPTION 'too many filter values' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(filter_labels, '{}') || coalesce(filter_evidence, '{}')
                                  || coalesce(filter_journals, '{}')) v WHERE v IS NULL OR length(v) > 200) THEN
    RAISE EXCEPTION 'invalid filter value' USING ERRCODE = '22023';
  END IF;

  -- ── Order and keyset (fixed SQL fragments, chosen from validated enums) ─────────────────────
  IF sort_order = 'oldest' THEN
    v_order  := 'ORDER BY coalesce(a.publication_date, DATE ''1900-01-01'') ASC, a.id ASC';
    v_cursor := 'AND (coalesce(a.publication_date, DATE ''1900-01-01''), a.id) > ($8, $9)';
    v_outer  := 'ORDER BY p.sort_key ASC, p.id ASC';
  ELSE -- newest, and the relevance pool (the first newest batch)
    v_order  := 'ORDER BY coalesce(a.publication_date, DATE ''1900-01-01'') DESC, a.id DESC';
    v_cursor := 'AND (coalesce(a.publication_date, DATE ''1900-01-01''), a.id) < ($8, $9)';
    v_outer  := CASE WHEN sort_order = 'relevance' THEN 'ORDER BY score DESC, p.id'
                     ELSE 'ORDER BY p.sort_key DESC, p.id DESC' END;
  END IF;

  v_sql := '
    WITH q AS (
      SELECT websearch_to_tsquery(''english'', $1) AS broad_q,
             phraseto_tsquery(''english'', $1)     AS phrase_q,
             ARRAY[''Equine'',''equine'',''Large Animal'',''large animal'',''Livestock'',''livestock'',
                   ''Poultry'',''poultry'',''Food Animal'',''food animal'']::text[] AS large_labels,
             ARRAY[''Small Animal'',''small animal'']::text[]                    AS small_labels
    ),
    page AS (
      SELECT a.id, a.title, a.clinical_bottom_line, a.labels, a.source_journal, a.publication_date,
             a.authors, a.pubmed_id, a.doi, a.article_url, a.strength_of_evidence,
             coalesce(a.publication_date, DATE ''1900-01-01'') AS sort_key,
             a.search_vector
      FROM public.articles a, q
      WHERE a.needs_enrichment = false
        AND a.summary IS NOT NULL
        AND a.clinical_bottom_line IS NOT NULL
        AND (a.quarantined IS NULL OR a.quarantined = false)
        AND a.search_vector @@ q.broad_q
        AND CASE $2
              WHEN ''small-animal'' THEN (a.labels IS NULL
                                        OR NOT (a.labels && q.large_labels)
                                        OR a.labels && q.small_labels)
              WHEN ''large-animal'' THEN coalesce(a.labels && q.large_labels, false)
              ELSE true
            END
        AND ($3 IS NULL OR cardinality($3) = 0
             OR CASE WHEN $4 THEN coalesce(a.labels @> $3, false)
                     ELSE coalesce(a.labels && $3, false) END)
        AND ($5 IS NULL OR cardinality($5) = 0 OR a.strength_of_evidence = ANY ($5))
        AND ($6 IS NULL OR cardinality($6) = 0 OR a.source_journal = ANY ($6))
        ' || CASE WHEN cursor_date IS NULL THEN '' ELSE v_cursor END || '
      ' || v_order || '
      LIMIT $10
    )
    SELECT p.id, p.title, p.clinical_bottom_line, p.labels, p.source_journal, p.publication_date,
           p.authors, p.pubmed_id, p.doi, p.article_url, p.strength_of_evidence, p.sort_key,
           ' || CASE WHEN sort_order = 'relevance' THEN '
           (0.60 * ts_rank_cd(p.search_vector, q.broad_q, 32) +
            0.25 * ts_rank_cd(p.search_vector, q.phrase_q, 32) +
            0.10 * CASE WHEN lower(p.title) LIKE ''%'' || lower($1) || ''%'' THEN 1.0 ELSE 0.0 END +
            0.05 * GREATEST(public.similarity(lower(p.title), lower($1)),
                            public.similarity(lower(coalesce(p.clinical_bottom_line, '''')), lower($1))))::double precision'
           ELSE '0::double precision' END || ' AS score
    FROM page p, q
    ' || v_outer;

  RETURN QUERY EXECUTE v_sql
    USING search_query, species_scope, filter_labels, labels_match_all, filter_evidence,
          filter_journals, sort_order, cursor_date, cursor_id, batch_size;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_articles_batch(text, text, text[], boolean, text[], text[], text, date, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_articles_batch(text, text, text[], boolean, text[], text[], text, date, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.search_articles_batch(text, text, text[], boolean, text[], text[], text, date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_articles_batch(text, text, text[], boolean, text[], text[], text, date, text, integer) TO service_role;

ANALYZE public.articles;
