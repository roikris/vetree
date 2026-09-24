-- Migration 052: enforce article publication eligibility at the RLS layer
--
-- PROBLEM
--   `articles` is world-readable: policy 005 is `USING (true)` and 032 grants SELECT
--   to anon, and the anon key ships in the client bundle. Publication eligibility was
--   enforced only in TypeScript, in ~7 independently drifted copies, several of which
--   omitted the quarantine predicate. Verified against production: quarantined articles
--   (and rows whose `summary` still held a raw PubMed abstract) were readable straight
--   from the REST endpoint regardless of any application-side filter.
--
-- FIX, IN TWO PARTS AND IN THIS ORDER
--
--   Part 1 marks the ranked and synthesis search functions SECURITY DEFINER so they
--   keep bypassing RLS. This MUST land before the policies in Part 2, which is why both
--   live in one file rather than two migrations — `db push` applies files in order, so
--   splitting them would leave a window where the policies are live and the search path
--   is still exposed to the planner problem below.
--
--   Why this is necessary: `search_articles_ranked` is LANGUAGE sql with no SECURITY
--   clause, so it runs as invoker and RLS predicates get injected into its
--   `gin_candidates` CTE. `ts_match_vq` (the implementation behind `tsvector @@ tsquery`)
--   is NOT marked leakproof, so under RLS it cannot be promoted ahead of the security
--   qual and Postgres may refuse to use it as an index condition — dropping the GIN scan
--   and reverting to a sequential scan. That is precisely the 57014 timeout that
--   migration 030 was written to fix, reached by a different route. Marking the function
--   SECURITY DEFINER removes RLS from the hot path entirely, so the question cannot arise.
--
--   Why this is SAFE: both functions already enforce the full eligibility predicate
--   inline in their own `gin_candidates` WHERE clause (see migration 030), so the
--   function body is the security boundary, and both already carry
--   `SET search_path = public` — the standard SECURITY DEFINER hardening.
--
-- NOT COVERED HERE — `search_articles_fuzzy`
--   Defined in `supabase/fuzzy_search_setup.sql`, which is versioned but sits OUTSIDE
--   `migrations/`, so `db push` never applies it (same for analytics_agent.sql,
--   articles_blacklist.sql, retention_views.sql — all predate the migration policy).
--   That file's definition is SECURITY INVOKER and carries the complete eligibility
--   predicate, which matches an empirical check against production: a near-exact title
--   search for an ineligible article does not return it. It is left as invoker, so RLS
--   filters it — correct, at some cost on what is only the third-tier fallback.
--   CAVEAT: the repo file is not proof of the live definition. Confirm with
--   `pg_get_functiondef` / `pg_proc.prosecdef` before relying on it.
--   FOLLOW-UP: reconcile those four files into migrations so a fresh database built
--   from `migrations/` alone is complete.
--
-- ROLLBACK
--   supabase/rollbacks/053_rollback_rls_publication_eligibility.sql — deliberately kept
--   OUT of supabase/migrations/ so a routine `db push` cannot apply it and silently
--   revert this migration.
--
-- PERFORMANCE GATE — verify before and after, and do not rely on an outer EXPLAIN.
--   Migration 030 sets `search_path` on these functions, which prevents SQL inlining, so
--   `EXPLAIN SELECT * FROM search_articles_ranked(...)` shows only `Function Scan` and
--   hides the internal index decision. Compare real RPC timings against the recorded
--   anon baseline: cardiology ~1.02s, feline chronic kidney disease ~0.64s,
--   anesthesia ~0.76s.

-- ── Part 1: take the hot search path out of RLS scope ───────────────────────────
-- search_path must name pg_temp explicitly. Migration 030 set `search_path = public`,
-- which OMITS pg_temp — and an omitted pg_temp is searched FIRST for relations, so a
-- caller able to create temporary objects could shadow the unqualified `articles`
-- reference inside a definer function. Naming it last closes that.
ALTER FUNCTION search_articles_ranked(text, integer) SECURITY DEFINER;
ALTER FUNCTION search_articles_ranked(text, integer) SET search_path = public, pg_temp;

ALTER FUNCTION search_articles_synthesis(text, integer, integer) SECURITY DEFINER;
ALTER FUNCTION search_articles_synthesis(text, integer, integer) SET search_path = public, pg_temp;

-- ── Part 2: make the database the authority for publication eligibility ─────────
DROP POLICY IF EXISTS "Articles are publicly readable" ON articles;

-- anon: published articles only. No auth lookup keeps the public path cheap.
CREATE POLICY "Anon reads published articles"
  ON articles FOR SELECT
  TO anon
  USING (
    needs_enrichment = false
    AND summary IS NOT NULL
    AND clinical_bottom_line IS NOT NULL
    AND (quarantined IS NULL OR quarantined = false)
  );

-- authenticated: published articles, plus everything for admins. The admin exemption
-- exists because two admin surfaces read articles through the user session and CANNOT
-- hold a service-role key (they are client components):
-- app/admin/pipeline/DownloadFailedCSV.tsx and app/admin/growth/CampaignCalendar.tsx,
-- plus the server actions in app/actions/admin.ts. Without it, "download failed
-- articles" returns nothing.
--
-- auth.uid() is wrapped in a scalar subquery so it is evaluated once per statement
-- (InitPlan) rather than per row. user_roles has a "Users can read their own role"
-- SELECT policy (migration 003), so this lookup does not recurse.
CREATE POLICY "Authenticated reads published articles"
  ON articles FOR SELECT
  TO authenticated
  USING (
    (
      needs_enrichment = false
      AND summary IS NOT NULL
      AND clinical_bottom_line IS NOT NULL
      AND (quarantined IS NULL OR quarantined = false)
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- service_role is unaffected throughout: it bypasses RLS entirely (enrichment pipeline,
-- daily-sync, admin API routes, analytics).
