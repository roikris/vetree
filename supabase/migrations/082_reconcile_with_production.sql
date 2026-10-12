-- Migration 082: reconcile the migrations with production's actual schema (2026-10-12, infra-003)
--
-- A database rebuilt from supabase/migrations/ (docs/harness/replay.sh) differs from production in what was changed
-- in the dashboard and never written down as a migration. This file brings a rebuild to production's state. Every
-- statement is behind a catalog check, so on PRODUCTION NOTHING RUNS — each object is already in the state this
-- file establishes (schema-audit, rls-audit and acl-audit before and after prove it). The source of every value is
-- production's own catalog (supabase/rls.json, supabase/schema.json).
--
-- 1. Row-level security, set up in the dashboard on 8 dashboard-era tables (see 000): RLS on for digest_logs,
--    digest_runs, feature_flags, followed_tags, security_reports, sync_skipped_articles, synthesis_feedback,
--    topic_syntheses, and their 7 policies exactly as production has them.
-- 2. Constraints production has that no migration adds: articles_pubmed_id_unique; saved_articles_article_id_fkey
--    (000 cannot create it — articles comes in 001); growth_tasks_article_id_fkey.
-- 3. What production NO LONGER has, though a migration creates it (dropped in the dashboard): the indexes
--    idx_articles_needs_enrichment (002) and idx_growth_tasks_date / _status / _day (010), the CHECK
--    growth_tasks_day_number_check and NOT NULL on growth_tasks.scheduled_date (010). Whether production should get
--    any of them back is a separate decision (Roi) — this file only makes a rebuild match production.

-- 1. row-level security and policies
DO $$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.digest_logs'::regclass) THEN ALTER TABLE public.digest_logs ENABLE ROW LEVEL SECURITY; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.digest_logs'::regclass AND polname = 'Admins read digest logs') THEN
    EXECUTE 'CREATE POLICY "Admins read digest logs" ON public.digest_logs FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ''admin''::text)))))';
  END IF;
END $$;
DO $$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.digest_runs'::regclass) THEN ALTER TABLE public.digest_runs ENABLE ROW LEVEL SECURITY; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.digest_runs'::regclass AND polname = 'Admins can view digest runs') THEN
    EXECUTE 'CREATE POLICY "Admins can view digest runs" ON public.digest_runs FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ''admin''::text)))))';
  END IF;
END $$;
DO $$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.feature_flags'::regclass) THEN ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.feature_flags'::regclass AND polname = 'Admins manage flags') THEN
    EXECUTE 'CREATE POLICY "Admins manage flags" ON public.feature_flags FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ''admin''::text)))))';
  END IF;
END $$;
DO $$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.followed_tags'::regclass) THEN ALTER TABLE public.followed_tags ENABLE ROW LEVEL SECURITY; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.followed_tags'::regclass AND polname = 'Users manage own tags') THEN
    EXECUTE 'CREATE POLICY "Users manage own tags" ON public.followed_tags FOR ALL TO PUBLIC USING ((auth.uid() = user_id))';
  END IF;
END $$;
DO $$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.security_reports'::regclass) THEN ALTER TABLE public.security_reports ENABLE ROW LEVEL SECURITY; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.security_reports'::regclass AND polname = 'Admins only') THEN
    EXECUTE 'CREATE POLICY "Admins only" ON public.security_reports FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ''admin''::text)))))';
  END IF;
END $$;
DO $$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.sync_skipped_articles'::regclass) THEN ALTER TABLE public.sync_skipped_articles ENABLE ROW LEVEL SECURITY; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.sync_skipped_articles'::regclass AND polname = 'Admins only') THEN
    EXECUTE 'CREATE POLICY "Admins only" ON public.sync_skipped_articles FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ''admin''::text)))))';
  END IF;
END $$;
DO $$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.synthesis_feedback'::regclass) THEN ALTER TABLE public.synthesis_feedback ENABLE ROW LEVEL SECURITY; END IF; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.synthesis_feedback'::regclass AND polname = 'Admins read') THEN
    EXECUTE 'CREATE POLICY "Admins read" ON public.synthesis_feedback FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ''admin''::text)))))';
  END IF;
END $$;
DO $$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.topic_syntheses'::regclass) THEN ALTER TABLE public.topic_syntheses ENABLE ROW LEVEL SECURITY; END IF; END $$;

-- 2. constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.articles'::regclass AND conname = 'articles_pubmed_id_unique') THEN
    ALTER TABLE public.articles ADD CONSTRAINT "articles_pubmed_id_unique" UNIQUE (pubmed_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.saved_articles'::regclass AND conname = 'saved_articles_article_id_fkey') THEN
    ALTER TABLE public.saved_articles ADD CONSTRAINT "saved_articles_article_id_fkey" FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.growth_tasks'::regclass AND conname = 'growth_tasks_article_id_fkey') THEN
    ALTER TABLE public.growth_tasks ADD CONSTRAINT "growth_tasks_article_id_fkey" FOREIGN KEY (article_id) REFERENCES public.articles(id);
  END IF;
END $$;

-- 3. removed in production
DO $$ BEGIN IF to_regclass('public.idx_articles_needs_enrichment') IS NOT NULL THEN DROP INDEX public.idx_articles_needs_enrichment; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.idx_growth_tasks_date') IS NOT NULL THEN DROP INDEX public.idx_growth_tasks_date; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.idx_growth_tasks_status') IS NOT NULL THEN DROP INDEX public.idx_growth_tasks_status; END IF; END $$;
DO $$ BEGIN IF to_regclass('public.idx_growth_tasks_day') IS NOT NULL THEN DROP INDEX public.idx_growth_tasks_day; END IF; END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.growth_tasks'::regclass AND conname = 'growth_tasks_day_number_check') THEN
    ALTER TABLE public.growth_tasks DROP CONSTRAINT growth_tasks_day_number_check;
  END IF;
END $$;
DO $$ BEGIN
  IF (SELECT attnotnull FROM pg_attribute WHERE attrelid = 'public.growth_tasks'::regclass AND attname = 'scheduled_date') THEN
    ALTER TABLE public.growth_tasks ALTER COLUMN scheduled_date DROP NOT NULL;
  END IF;
END $$;
