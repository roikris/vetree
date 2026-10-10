-- Migration 076: close topic_syntheses to the public Data API (2026-10-10, infra-002)
--
-- The RLS report (075) showed three policies on topic_syntheses that apply to PUBLIC with no condition:
--   "Public read"          SELECT USING (true)       — anyone could list every stored synthesis, including
--                                                      query_original and the asking user's user_id
--   "Service role insert"  INSERT WITH CHECK (true)  — anyone could add a synthesis (served from the cache)
--   "Service role update"  UPDATE USING (true)       — anyone could rewrite any synthesis
-- and anon / authenticated held every table privilege. Every app path that touches the table uses the service
-- role (app/api/synthesis/generate, app/api/growth/generate-synthesis-post, app/api/delete-account), which
-- bypasses RLS, so none of these policies or grants is needed. A metadata-only integrity check of the 30 rows
-- (2026-10-10) found nothing created outside the generator.
--
-- RLS stays enabled with no policies (service role only, like growth_article_scores). service_role's grants
-- are unchanged. supabase/access.json is updated in the same PR.

DROP POLICY IF EXISTS "Public read"         ON public.topic_syntheses;
DROP POLICY IF EXISTS "Service role insert" ON public.topic_syntheses;
DROP POLICY IF EXISTS "Service role update" ON public.topic_syntheses;

REVOKE ALL ON public.topic_syntheses FROM PUBLIC, anon, authenticated;
