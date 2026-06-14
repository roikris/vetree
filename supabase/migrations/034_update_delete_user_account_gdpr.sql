-- ============================================================
-- GDPR Art. 17 / Israeli Privacy Protection Law § 11
-- Right to Erasure — complete account deletion function
-- ============================================================
-- Updates delete_user_account() to cover all tables that store
-- user-identifiable data, not just the original 3 from migration 006.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_user_account(user_id_to_delete uuid)
RETURNS void AS $$
BEGIN
  -- Analytics / logs
  DELETE FROM page_views        WHERE user_id = user_id_to_delete;
  DELETE FROM search_logs       WHERE user_id = user_id_to_delete;

  -- Preferences / consent
  DELETE FROM user_preferences  WHERE user_id = user_id_to_delete;
  DELETE FROM user_consents     WHERE user_id = user_id_to_delete;

  -- Feedback
  DELETE FROM synthesis_feedback WHERE user_id = user_id_to_delete;

  -- Social / saved content
  DELETE FROM followed_tags     WHERE user_id = user_id_to_delete;
  DELETE FROM saved_articles    WHERE user_id = user_id_to_delete;

  -- Reports & roles
  DELETE FROM reports           WHERE user_id = user_id_to_delete;
  DELETE FROM user_roles        WHERE user_id = user_id_to_delete;

  -- Auth record (cascades Supabase-managed storage objects etc.)
  DELETE FROM auth.users        WHERE id = user_id_to_delete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply search_path hardening (see migration 008)
ALTER FUNCTION public.delete_user_account(uuid) SET search_path = public;

GRANT EXECUTE ON FUNCTION delete_user_account(uuid) TO authenticated;

COMMENT ON FUNCTION delete_user_account(uuid) IS
'GDPR Art. 17 / Israeli Privacy Protection Law compliant account deletion.
Deletes all user PII atomically: page_views, search_logs, user_preferences,
user_consents, synthesis_feedback, followed_tags, saved_articles, reports,
user_roles, auth.users.';
