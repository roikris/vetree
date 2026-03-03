-- ============================================
-- VETREE SECURITY AUDIT
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Check which tables have RLS enabled
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Check all existing RLS policies
SELECT
  tablename,
  policyname,
  cmd as command,
  CASE
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE 'No USING clause'
  END as using_clause,
  CASE
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Check for tables without RLS enabled
SELECT
  tablename,
  'WARNING: RLS not enabled!' as status
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT IN ('schema_migrations', 'migrations')
ORDER BY tablename;

-- 4. Check policy coverage per table
SELECT
  t.tablename,
  COUNT(p.policyname) as policy_count,
  ARRAY_AGG(DISTINCT p.cmd) as commands_covered
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename NOT IN ('schema_migrations', 'migrations')
GROUP BY t.tablename
ORDER BY t.tablename;
