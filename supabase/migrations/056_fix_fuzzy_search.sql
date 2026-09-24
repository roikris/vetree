-- Migration 056: stop search_articles_fuzzy sequentially scanning `articles`,
-- without losing typo recall for the synthesis caller
--
-- PROBLEM (measured as anon, the role production requests run as)
--   The function body is a single WHERE with `similarity(...) > t OR similarity(...) > t
--   OR ILIKE OR ILIKE`. similarity() in function form cannot use a trigram index, and the
--   OR drags the ILIKE arms down with it, so every call is a full scan:
--     Seq Scan on articles, Rows Removed by Filter 25297, ~950–1000 ms as anon.
--   Same defect migration 030 fixed for search_articles_ranked; never applied here because
--   this function lived outside migrations/ until 054.
--
-- FIX — three parts, each required
--
--   1. Index-answerable retrieval. The main branch requires one of four indexable
--      predicates (`%` on the expression indexes from migration 055, ILIKE on the existing
--      raw-column trigram indexes), then applies the caller's exact predicate as a filter
--      over those rows. Each branch carries the full row — an earlier draft gathered ids and
--      joined back to `articles`, and the planner hash-joined against a full scan of the
--      table (716–1037 ms) because it couldn't rule out a large fallback result.
--
--   2. SECURITY DEFINER + search_path = public, pg_temp (as in 052). Without it the rewrite
--      does nothing for real users: under RLS the non-leakproof `%` / ILIKE operators cannot
--      be promoted ahead of the security qual, so the indexes go unused. Measured as anon:
--        rewrite as INVOKER:  pyometrra ~960 ms, cardiomyapathy ~965 ms  (no gain)
--        rewrite as DEFINER:  pyometrra  ~48 ms, cardiomyapathy  ~95 ms, mastitis ~250 ms
--      Safe because the body enforces the full publication-eligibility predicate itself.
--      postgres owns the function and has rolbypassrls=true (verified for 052).
--
--   3. A fallback branch for thresholds below the trigram default. `%` matches at
--      show_limit() (0.3 here), taken from a server setting this role is NOT permitted to
--      change — `SET pg_trgm.similarity_threshold` fails with 42501 as a function attribute
--      and in-session. So `%` alone cannot reach rows scoring between a caller's lower
--      threshold and 0.3. Measured on the candidate pool, threshold 0.2, `%`-only:
--        cardiomyapathy  10 matches -> 1   (9 lost)
--        cardiac        393 matches -> 392
--      i.e. the loss lands on misspellings, which only exist in that trigram band, and
--      synthesis (lib/synthesis/generateSynthesis.ts, threshold 0.2) needs >= 3 articles.
--      The fallback runs only when the caller's threshold is below the EXACT setting `%`
--      compares against — a parameter-only condition, planned as a One-Time Filter and
--      confirmed `never executed` at 0.3. How the gate is written matters:
--        - show_limit() returns the setting ROUNDED TO FLOAT4 (0.30000001…), while `%`
--          compares scores against the double-precision setting (0.3). Comparing a
--          threshold against show_limit() made "0.3 < 0.3" true and ran the full scan on
--          every search call.
--        - Casting the threshold to float4 instead fixed 0.3 but raised overflow /
--          underflow errors for thresholds like 1e100 or 1e-100 that the old function
--          accepted.
--        - So the gate reads the exact setting via current_setting() and compares in
--          double precision: no cast of the caller's value, and the same number `%` uses.
--          If the setting is not yet defined in the session, COALESCE falls back to
--          show_limit(), which errs toward running the fallback — slower, never lossy.
--      Synthesis pays for the scan on its own path, where a Claude call follows anyway.
--
-- VERIFIED (all inside rolled-back transactions against production, with a guard that
-- aborts unless the new SECURITY DEFINER body is actually live — an earlier verification
-- round silently compared the old function against itself and was discarded)
--   Recall, old vs new result sets, 19 probes at thresholds 0.2 and 0.3: identical score
--   lists on every probe, zero rows lost, including cardiomyapathy at 0.2 (10 -> 10).
--   Edge inputs, old vs new, identical and error-free: thresholds 1e100, 1e-100, -1e100,
--   NaN, Infinity, -Infinity, NULL; empty query string.
--   Performance as anon, 3 samples each, today ~950 ms:
--     threshold 0.3 (search):     pyometrra ~46 ms, cardiomyapathy ~80 ms, mastitis ~255 ms
--     threshold 0.2 (synthesis):  ~900–1150 ms — unchanged from today, as intended
--
-- PRECONDITION — re-verify this function if it ever stops holding
--   Correct as long as pg_trgm.similarity_threshold has at most SIX significant digits.
--   Every way Postgres exposes that setting rounds it: current_setting(), SHOW and
--   pg_settings to six digits (%g), show_limit() to float4. With a setting of e.g.
--   0.30000002 the gate would read 0.3, skip the fallback at threshold 0.3, and drop a row
--   scoring exactly 0.3 that has no substring match. No exact reader exists, so a gate
--   correct for every conceivable setting would have to run the full scan on every call.
--   Today the setting is 0.3 (reads back exactly), and no role in this project can change
--   it: SET fails with 42501 in-session and as a function attribute. Changing it requires
--   a Supabase platform-level setting change. Accepted deliberately (2026-09-24).
--
-- ORDER BY adds `id` as a tie-breaker. The old function ordered by similarity alone, so
-- which of several equal-scoring rows landed in the 100th slot varied between calls.
--
-- ROLLBACK: re-apply the function definition from migration 054, which is the previous
-- production body verbatim. The indexes from 055 can stay; they are inert without this.

CREATE OR REPLACE FUNCTION public.search_articles_fuzzy(
  search_query text,
  similarity_threshold double precision DEFAULT 0.3
)
RETURNS TABLE(
  id text, title text, clinical_bottom_line text, summary text, labels text[],
  source_journal text, publication_date date, authors text, pubmed_id text, doi text,
  article_url text, strength_of_evidence text, needs_enrichment boolean,
  enrichment_attempts integer, quarantined boolean,
  created_at timestamp with time zone, similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT r.* FROM (
    SELECT a.id, a.title, a.clinical_bottom_line, a.summary, a.labels, a.source_journal,
      a.publication_date, a.authors, a.pubmed_id, a.doi, a.article_url,
      a.strength_of_evidence, a.needs_enrichment, a.enrichment_attempts, a.quarantined,
      a.created_at,
      GREATEST(similarity(lower(a.title), lower(search_query)),
               similarity(lower(COALESCE(a.clinical_bottom_line, '')), lower(search_query))) AS similarity
    FROM articles a
    WHERE a.needs_enrichment = false AND a.summary IS NOT NULL
      AND a.clinical_bottom_line IS NOT NULL
      AND (a.quarantined IS NULL OR a.quarantined = false)
      AND ( lower(a.title) % lower(search_query)
         OR lower(COALESCE(a.clinical_bottom_line, '')) % lower(search_query)
         OR a.title ILIKE '%' || search_query || '%'
         OR a.clinical_bottom_line ILIKE '%' || search_query || '%' )
      AND ( similarity(lower(a.title), lower(search_query)) > similarity_threshold
         OR similarity(lower(COALESCE(a.clinical_bottom_line, '')), lower(search_query)) > similarity_threshold
         OR a.title ILIKE '%' || search_query || '%'
         OR a.clinical_bottom_line ILIKE '%' || search_query || '%' )
    UNION
    SELECT a.id, a.title, a.clinical_bottom_line, a.summary, a.labels, a.source_journal,
      a.publication_date, a.authors, a.pubmed_id, a.doi, a.article_url,
      a.strength_of_evidence, a.needs_enrichment, a.enrichment_attempts, a.quarantined,
      a.created_at,
      GREATEST(similarity(lower(a.title), lower(search_query)),
               similarity(lower(COALESCE(a.clinical_bottom_line, '')), lower(search_query)))
    FROM articles a
    WHERE similarity_threshold < COALESCE(
            NULLIF(current_setting('pg_trgm.similarity_threshold', true), '')::double precision,
            show_limit())
      AND a.needs_enrichment = false AND a.summary IS NOT NULL
      AND a.clinical_bottom_line IS NOT NULL
      AND (a.quarantined IS NULL OR a.quarantined = false)
      AND ( similarity(lower(a.title), lower(search_query)) > similarity_threshold
         OR similarity(lower(COALESCE(a.clinical_bottom_line, '')), lower(search_query)) > similarity_threshold )
  ) r
  ORDER BY r.similarity DESC, r.id
  LIMIT 100;
$function$;

GRANT EXECUTE ON FUNCTION public.search_articles_fuzzy(text, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.search_articles_fuzzy(text, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_articles_fuzzy(text, double precision) TO service_role;
