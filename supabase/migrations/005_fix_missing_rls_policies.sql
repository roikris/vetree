-- ============================================
-- FIX MISSING RLS POLICIES
-- Based on security audit results
-- ============================================

-- ============================================
-- FIX: ARTICLES TABLE
-- Issue: 0 policies, table is locked down
-- Solution: Add public SELECT policy
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (shouldn't be any, but just in case)
DROP POLICY IF EXISTS "Articles are publicly readable" ON articles;
DROP POLICY IF EXISTS "Public can read articles" ON articles;
DROP POLICY IF EXISTS "Anyone can read articles" ON articles;

-- Allow public to SELECT articles
CREATE POLICY "Articles are publicly readable"
  ON articles FOR SELECT
  TO public
  USING (true);

-- Note: Service role can write articles (bypasses RLS)


-- ============================================
-- FIX: SAVED_ARTICLES TABLE
-- Issue: Only has 1 "ALL" policy, not granular
-- Solution: Replace with specific policies
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE saved_articles ENABLE ROW LEVEL SECURITY;

-- Drop the existing "ALL" policy and any other policies
DROP POLICY IF EXISTS "Users can view their own saved articles" ON saved_articles;
DROP POLICY IF EXISTS "Users can save articles" ON saved_articles;
DROP POLICY IF EXISTS "Users can unsave their own articles" ON saved_articles;
DROP POLICY IF EXISTS "Users can manage their saved articles" ON saved_articles;
-- Drop any policy that might use "ALL" command
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_articles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON saved_articles', pol.policyname);
  END LOOP;
END $$;

-- Create granular policies

-- Policy 1: Users can SELECT their own saved articles
CREATE POLICY "Users can view their own saved articles"
  ON saved_articles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Users can INSERT their own saves
CREATE POLICY "Users can save articles"
  ON saved_articles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can DELETE their own saves
CREATE POLICY "Users can unsave their own articles"
  ON saved_articles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Note: No UPDATE policy needed - saved_articles has no updatable fields


-- ============================================
-- VERIFICATION
-- ============================================

-- Check articles policies
SELECT
  'articles' as table_name,
  COUNT(*) as policy_count,
  ARRAY_AGG(policyname) as policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'articles';

-- Check saved_articles policies
SELECT
  'saved_articles' as table_name,
  COUNT(*) as policy_count,
  ARRAY_AGG(policyname) as policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'saved_articles';

-- Verify RLS is enabled on all tables
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('articles', 'saved_articles', 'user_roles', 'reports')
ORDER BY tablename;
