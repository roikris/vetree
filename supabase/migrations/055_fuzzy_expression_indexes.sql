-- Migration 055: expression indexes for fuzzy search — MEASUREMENT PREREQUISITE ONLY
--
-- This migration deliberately does NOT change search_articles_fuzzy. It adds two
-- indexes and nothing else.
--
-- WHY SPLIT THIS OUT
--   search_articles_fuzzy sequentially scans all ~25k articles (EXPLAIN ANALYZE,
--   production: Seq Scan, Rows Removed by Filter 25297, 982 ms). The rewrite that fixes
--   it cannot be evaluated honestly yet: measuring it required creating these indexes
--   inside a rolled-back transaction, where the planner has no statistics for them and
--   produced unusable numbers — the same query measured 566 ms and 6523 ms on
--   consecutive runs.
--
--   So the indexes land first, with ANALYZE, and the function rewrite is judged against
--   real planner statistics afterwards.
--
-- WHY THESE EXPRESSIONS
--   The function compares `lower(title)` and `lower(COALESCE(clinical_bottom_line,''))`,
--   while the existing idx_articles_title_trgm / idx_articles_cbl_trgm are on the raw
--   columns. An expression index is only usable if it matches the query expression, so
--   the lowered comparisons currently have no index available at all.
--
-- SAFETY
--   Purely additive. No function, policy or data change. Nothing reads these until the
--   function is rewritten, so this is inert on its own and revertible with DROP INDEX.
--   Ordinary (non-CONCURRENT) builds take a write lock on articles for the duration —
--   acceptable at ~25k rows, and the sync/enrichment workflows run at 06:00/07:00 UTC.
--   CONCURRENTLY is not usable here because migrations run inside a transaction.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_articles_title_lower_trgm
  ON articles USING GIN (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_articles_cbl_lower_trgm
  ON articles USING GIN (lower(COALESCE(clinical_bottom_line, '')) gin_trgm_ops);

COMMIT;

-- Outside the transaction: refresh planner statistics so the next measurement is real.
ANALYZE articles;
