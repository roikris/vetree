-- Migration 083: "Articles saved this week" counts every reader's saves (2026-10-15, feed-002)
--
-- The homepage section ("Trending This Week" until now) read saved_articles with the reader's own client, so RLS
-- ("Users can view their own saved articles") gave guests 0 rows and signed-in readers only their own saves. The
-- count now runs here, called only by the service role from lib/queries/savedThisWeek.ts: one statement (one
-- snapshot, no row cap), ties settled before the LIMIT, and no user id ever leaves the database.
--
-- p_excluded: admin + the smoke-test account (CLAUDE.md rule 10); NULL elements are ignored. user_id is nullable:
-- NULL rows are kept, as excludedUsersOrFilter() does. Only publicly visible articles count (the predicate every
-- public surface uses). p_limit is clamped to 1..50 (NULL → 20).
CREATE FUNCTION public.saved_this_week(p_since timestamptz, p_until timestamptz, p_excluded uuid[], p_limit integer)
RETURNS TABLE(article_id text, save_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT s.article_id, count(*) AS save_count
  FROM public.saved_articles s
  JOIN public.articles a ON a.id = s.article_id
  WHERE s.saved_at >= p_since
    AND s.saved_at < p_until
    AND (s.user_id IS NULL OR s.user_id <> ALL (coalesce(array_remove(p_excluded, NULL), '{}'::uuid[])))
    AND a.needs_enrichment = false
    AND a.summary IS NOT NULL
    AND a.clinical_bottom_line IS NOT NULL
    AND a.quarantined IS NOT TRUE
  GROUP BY s.article_id, a.created_at
  ORDER BY count(*) DESC, a.created_at DESC NULLS LAST, s.article_id
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

REVOKE ALL ON FUNCTION public.saved_this_week(timestamptz, timestamptz, uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.saved_this_week(timestamptz, timestamptz, uuid[], integer) TO service_role;

-- anon kept SELECT on saved_articles only for the old Trending read (079); nothing anonymous reads it now.
REVOKE SELECT ON public.saved_articles FROM anon;
