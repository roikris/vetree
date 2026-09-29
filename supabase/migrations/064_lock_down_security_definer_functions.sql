-- Migration 064: lock down SECURITY DEFINER functions that anon/authenticated could execute
--
-- PROBLEM (found 2026-09-29)
--   delete_user_account(uuid) is SECURITY DEFINER and deletes an arbitrary user's rows plus the
--   auth.users record. Migration 034 granted EXECUTE to authenticated, and PUBLIC/anon also held
--   EXECUTE (proacl: =X, anon=X, authenticated=X). PostgREST exposes public functions as
--   /rest/v1/rpc/*, so anyone holding the public anon key (shipped in the site's JavaScript) could
--   delete ANY account by UUID. Verified with a random, non-matching UUID: anon RPC → HTTP 204.
--   The app never calls this function (/api/delete-account deletes explicitly with the service
--   role), so revoking it breaks nothing.
--
--   check_table_grants() (SECURITY DEFINER) discloses table/role grant metadata; it is only called
--   by the admin security scan through the service role.
--
--   count_short_unquarantined_abstracts() (SECURITY DEFINER, a harmless integer count) was created
--   outside the migrations and has no caller in the repo; locked down for least privilege.
--
-- FIX: only service_role (and the owner) may execute these three functions. The search RPCs
-- (search_articles_batch, search_articles_fuzzy, search_articles_synthesis) stay public on purpose:
-- the site's search calls them with the anon key, and they enforce publication eligibility inside.

REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_table_grants() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_table_grants() TO service_role;

REVOKE EXECUTE ON FUNCTION public.count_short_unquarantined_abstracts() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.count_short_unquarantined_abstracts() TO service_role;

NOTIFY pgrst, 'reload schema';
