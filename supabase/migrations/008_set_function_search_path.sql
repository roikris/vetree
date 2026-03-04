-- ============================================
-- SET SEARCH PATH FOR FUNCTIONS (Security Best Practice)
-- Prevents search_path injection attacks
-- ============================================

-- Set search_path for delete_user_account function
ALTER FUNCTION public.delete_user_account(uuid) SET search_path = public;

-- Set search_path for update_updated_at_column function (if exists)
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Verify the changes
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  p.proconfig as config_settings
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('delete_user_account', 'update_updated_at_column')
ORDER BY p.proname;
