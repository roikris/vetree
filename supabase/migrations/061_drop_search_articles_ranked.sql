-- Migration 061: drop search_articles_ranked (superseded by search_articles_batch, 060)
--
-- Since PR #74 (progressive search) no app code calls it: searches run through
-- lib/search/progressive.ts → search_articles_batch; the only remaining reference, the search
-- branch of lib/queries/articles.ts searchArticles, was dead code and is removed in the same
-- change (searchArticles now serves the feed only). Verified before dropping: no reference in
-- app/, lib/, components/, scripts/, .github/, e2e/, and no public SQL function body mentions it.
--
-- ROLLBACK: re-apply the definition from migration 059 (7-argument signature, SECURITY DEFINER,
-- search_path public, pg_temp) and its grants from 058.

DROP FUNCTION IF EXISTS public.search_articles_ranked(text, integer, text, text[], boolean, text[], text[]);
