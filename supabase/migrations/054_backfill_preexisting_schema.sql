-- Migration 054: backfill schema objects that predate the migration policy
--
-- WHY
--   Four .sql files sit in supabase/ but OUTSIDE supabase/migrations/, left over from
--   before the migration workflow was adopted. `db push` never applies them, so a
--   database built from migrations/ alone is missing the fuzzy search function, the
--   blacklist table and every analytics-agent table — the daily aggregate, the weekly
--   insights run and the PubMed sync would all fail on a fresh environment.
--
-- GENERATED FROM LIVE STATE, NOT FROM THOSE FILES. Three of the four had drifted:
--   - fuzzy_search_setup.sql   STALE. Its function returns last_enrichment_at /
--                              last_enrichment_error; production returns pubmed_id /
--                              doi / article_url. Applying the file would have replaced
--                              a working function with an older signature.
--   - analytics_agent.sql      STALE and non-idempotent. Missing five columns that exist
--                              in production (analytics_daily_snapshot.new_sessions,
--                              .registered_mau, .synthesis_engaged,
--                              .median_session_duration_seconds, and
--                              analytics_insights.report_markdown — all of which the
--                              aggregate and insights routes write to). Its CREATE TABLE
--                              statements also lack IF NOT EXISTS and would error.
--   - retention_views.sql      NEVER APPLIED. There are zero views in the public schema.
--                              Its daily_active_users / user_retention are NOT
--                              reconstructed here: nothing queries them. The identically
--                              named keys in app/api/admin/analytics/retention/route.ts
--                              are JSON response fields computed in TypeScript, not reads
--                              of these views. Recreating them would add dead objects.
--   - articles_blacklist.sql   Matched production.
--
-- This migration is a strict no-op against the current database and reproduces the same
-- objects on an empty one. Every statement is guarded; no DROP, no data change.
--
-- FOLLOW-UPS, deliberately NOT bundled here so this stays a pure capture:
--   1. search_articles_fuzzy has NO `SET search_path`. Harmless while SECURITY INVOKER,
--      but it must be fixed before the function is ever promoted to DEFINER.
--   2. Its WHERE clause is `similarity(...) > t OR similarity(...) > t OR ILIKE ... OR
--      ILIKE ...` — the exact OR pattern migration 030 identified as defeating GIN index
--      usage. 030 fixed that for search_articles_ranked and never for this function,
--      which is why tier-3 search runs 1.2s on typos and can exceed anon's 3s
--      statement_timeout on pathological input.
--   3. Once applied, the four supabase/*.sql files should be deleted so there is one
--      source of truth.

BEGIN;

-- ── fuzzy search (from supabase/fuzzy_search_setup.sql, corrected to live) ──────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_articles_title_trgm
  ON articles USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_articles_cbl_trgm
  ON articles USING GIN (clinical_bottom_line gin_trgm_ops);

-- Verbatim from pg_get_functiondef() in production. SECURITY INVOKER (default), so RLS
-- applies to its reads; it also enforces the eligibility predicate itself.
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
AS $function$
  SELECT
    a.id, a.title, a.clinical_bottom_line, a.summary, a.labels, a.source_journal,
    a.publication_date, a.authors, a.pubmed_id, a.doi, a.article_url,
    a.strength_of_evidence, a.needs_enrichment, a.enrichment_attempts, a.quarantined,
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
$function$;

GRANT EXECUTE ON FUNCTION public.search_articles_fuzzy(text, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.search_articles_fuzzy(text, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_articles_fuzzy(text, double precision) TO service_role;

-- ── articles_blacklist (from supabase/articles_blacklist.sql) ───────────────────
CREATE TABLE IF NOT EXISTS articles_blacklist (
  pubmed_id text PRIMARY KEY,
  reason text,
  blacklisted_at timestamptz DEFAULT now()
);

-- ── analytics agent tables (from supabase/analytics_agent.sql, corrected to live) ──
CREATE TABLE IF NOT EXISTS analytics_daily_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  dau integer DEFAULT 0,
  wau integer DEFAULT 0,
  mau integer DEFAULT 0,
  new_sessions integer DEFAULT 0,
  total_searches integer DEFAULT 0,
  zero_result_searches integer DEFAULT 0,
  zero_result_rate double precision DEFAULT 0,
  synthesis_runs integer DEFAULT 0,
  synthesis_helpful integer DEFAULT 0,
  synthesis_not_relevant integer DEFAULT 0,
  articles_saved integer DEFAULT 0,
  avg_session_duration_seconds integer DEFAULT 0,
  top_searches jsonb DEFAULT '[]'::jsonb,
  top_saved_articles jsonb DEFAULT '[]'::jsonb,
  device_breakdown jsonb DEFAULT '{}'::jsonb,
  traffic_sources jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  median_session_duration_seconds integer DEFAULT 0,
  registered_mau integer DEFAULT 0,
  synthesis_engaged integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analytics_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  type text NOT NULL,
  severity double precision NOT NULL,
  description text NOT NULL,
  data_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  insights_json jsonb NOT NULL,
  top_3_actions jsonb DEFAULT '[]'::jsonb,
  content_roadmap jsonb DEFAULT '[]'::jsonb,
  churn_risks jsonb DEFAULT '[]'::jsonb,
  model_used text,
  tokens_used integer,
  status text DEFAULT 'active'::text,
  report_markdown text
);

CREATE TABLE IF NOT EXISTS analytics_insight_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid,
  insight_index integer,
  action text,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  search_count integer DEFAULT 0,
  zero_result_rate double precision DEFAULT 0,
  save_count integer DEFAULT 0,
  opportunity_score double precision DEFAULT 0,
  suggested_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending'::text
);

CREATE INDEX IF NOT EXISTS idx_signals_date ON analytics_signals(date);
CREATE INDEX IF NOT EXISTS idx_signals_severity ON analytics_signals(severity DESC);
CREATE INDEX IF NOT EXISTS idx_insights_generated ON analytics_insights(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_score ON analytics_opportunities(opportunity_score DESC);

-- ── RLS + admin-only policies, matching production ──────────────────────────────
-- CREATE POLICY has no IF NOT EXISTS, so guard rather than DROP/CREATE — dropping
-- would briefly leave these tables unprotected mid-migration.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'articles_blacklist','analytics_daily_snapshot','analytics_signals',
    'analytics_insights','analytics_insight_feedback','analytics_opportunities'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polname = 'Admins only' AND polrelid = format('public.%I', t)::regclass
    ) THEN
      EXECUTE format($f$
        CREATE POLICY "Admins only" ON %I FOR ALL USING (
          EXISTS (SELECT 1 FROM user_roles
                  WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
        )$f$, t);
    END IF;

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
    EXECUTE format('GRANT ALL ON %I TO service_role', t);
  END LOOP;
END $$;

COMMIT;
