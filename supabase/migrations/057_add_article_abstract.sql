-- Migration 057: keep the source abstract in its own column
--
-- PROBLEM
--   Ingestion (daily-sync, both backfills, fetch-truncated-journal) stores the PubMed
--   abstract in `summary`. Enrichment then overwrites `summary` with Claude's summary, so
--   the source text is gone after the first run. Every later enrichment — force_retry,
--   admin re-queue, label edit, fix-incomplete, reset-enrichment, or the retry after a
--   partial result (summary returned, bottom line missing) — sends the previous AI summary
--   to Claude as if it were the abstract.
--
-- FIX
--   `abstract` holds the source text. Enrichment reads only this column and never writes
--   it. Populated by ingestion going forward and by scripts/backfill-abstracts.cjs for
--   existing rows. Nullable: ~18 articles have no PubMed ID, and some PubMed records have
--   no abstract.
--
--   `abstract_fetched_at` records when the text was retrieved from PubMed. Backfilled
--   abstracts are PubMed's CURRENT text, which can differ from what was originally
--   ingested (and summarized) if the record was corrected since; the attribution UI should
--   say "retrieved from PubMed on <date>" rather than imply it is the exact input.
--
--   Both are readable through the public API like the other article columns: the article
--   page will display the abstract with attribution (decided 2026-09-25).
--
-- ROLLBACK
--   Revert the code first (ingestion and enrichment write/read these columns and would
--   fail without them). The columns are additive and harmless to leave in place; dropping
--   them discards the backfilled abstracts, which can only be re-fetched from PubMed:
--     ALTER TABLE public.articles DROP COLUMN abstract, DROP COLUMN abstract_fetched_at;

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS abstract text,
  ADD COLUMN IF NOT EXISTS abstract_fetched_at timestamptz;

COMMENT ON COLUMN public.articles.abstract IS
  'Source abstract from PubMed (all inline text kept, structured-section labels kept). Written by ingestion and backfill only; enrichment reads it and never writes it.';
COMMENT ON COLUMN public.articles.abstract_fetched_at IS
  'When `abstract` was retrieved from PubMed. Backfilled rows carry the backfill time, not the original ingest time.';
