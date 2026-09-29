-- Migration 066: account deletion also erases analytics_events (GDPR Art. 17)
--
-- analytics_events holds funnel and (since migration 065) synthesis events with user_id. Its FK is
-- ON DELETE SET NULL, so deleting the auth user alone would leave the events (with ip_hash in
-- detail) behind. /api/delete-account now deletes them explicitly; this keeps the SQL function in
-- step. CREATE OR REPLACE keeps the function's ACL (migration 064: service_role only).

CREATE OR REPLACE FUNCTION public.delete_user_account(user_id_to_delete uuid)
RETURNS void AS $$
BEGIN
  -- Analytics / logs
  DELETE FROM public.page_views         WHERE user_id = user_id_to_delete;
  DELETE FROM public.search_logs        WHERE user_id = user_id_to_delete;
  DELETE FROM public.analytics_events   WHERE user_id = user_id_to_delete;

  -- Preferences / consent
  DELETE FROM public.user_preferences   WHERE user_id = user_id_to_delete;
  DELETE FROM public.user_consents      WHERE user_id = user_id_to_delete;

  -- Feedback
  DELETE FROM public.synthesis_feedback WHERE user_id = user_id_to_delete;

  -- Social / saved content
  DELETE FROM public.followed_tags      WHERE user_id = user_id_to_delete;
  DELETE FROM public.saved_articles     WHERE user_id = user_id_to_delete;

  -- Reports & roles
  DELETE FROM public.reports            WHERE user_id = user_id_to_delete;
  DELETE FROM public.user_roles         WHERE user_id = user_id_to_delete;

  -- Auth record
  DELETE FROM auth.users                WHERE id = user_id_to_delete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Belt and braces: the ACL must stay service_role only (migration 064)
REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;
