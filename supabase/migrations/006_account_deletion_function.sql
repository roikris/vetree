-- ============================================
-- GDPR-COMPLIANT ACCOUNT DELETION FUNCTION
-- ============================================

-- Drop function if it exists (for re-running migration)
DROP FUNCTION IF EXISTS delete_user_account(uuid);

-- Create function to delete all user data atomically
-- SECURITY DEFINER allows this function to delete from auth.users
CREATE OR REPLACE FUNCTION delete_user_account(user_id_to_delete uuid)
RETURNS void AS $$
BEGIN
  -- Delete user's saved articles
  DELETE FROM saved_articles WHERE user_id = user_id_to_delete;

  -- Delete user's reports
  DELETE FROM reports WHERE user_id = user_id_to_delete;

  -- Delete user's role
  DELETE FROM user_roles WHERE user_id = user_id_to_delete;

  -- Delete the auth user (this cascades to any other user data)
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account(uuid) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION delete_user_account(uuid) IS
'GDPR-compliant account deletion. Deletes all user data atomically: saved_articles, reports, user_roles, and auth.users record.';
