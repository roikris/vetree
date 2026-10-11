-- Migration 078: close direct inserts on the tracking tables (2026-10-11, infra-002)
--
-- page_views ("Anyone can insert"), search_logs ("Anyone can insert searches") and analytics_events
-- ("insert_events") each had an INSERT policy to PUBLIC WITH CHECK (true), and anon / authenticated held
-- INSERT. They existed because /api/analytics/track, /event and /search inserted with the cookie client;
-- they also let anyone holding the public key insert rows directly, past those routes' filters (production
-- only, QA, admin / excluded users, crawler tagging), skewing analytics and the synthesis experiment KPIs.
-- Since PR #122 (deployed 2026-10-11, confirmed recording) every writer uses the service role, which bypasses
-- RLS, so the policies and INSERT grants are no longer needed. The admin SELECT policies are unchanged; the
-- remaining unused grants are trimmed with the other tables in a later step.

DROP POLICY IF EXISTS "Anyone can insert"          ON public.page_views;
DROP POLICY IF EXISTS "Anyone can insert searches" ON public.search_logs;
DROP POLICY IF EXISTS "insert_events"              ON public.analytics_events;

REVOKE INSERT ON public.page_views       FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON public.search_logs      FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON public.analytics_events FROM PUBLIC, anon, authenticated;
