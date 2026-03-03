-- ============================================
-- COMPREHENSIVE RLS POLICIES FOR VETREE
-- ============================================

-- ============================================
-- ARTICLES TABLE
-- Public read, service role write
-- ============================================

-- Enable RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Articles are publicly readable" ON articles;
DROP POLICY IF EXISTS "Service role can insert articles" ON articles;
DROP POLICY IF EXISTS "Service role can update articles" ON articles;
DROP POLICY IF EXISTS "Service role can delete articles" ON articles;

-- Allow public SELECT access (everyone can read articles)
CREATE POLICY "Articles are publicly readable"
  ON articles FOR SELECT
  TO public
  USING (true);

-- Service role can manage articles (handled by Supabase service role, no policy needed)
-- Note: Service role bypasses RLS, so we don't need explicit policies


-- ============================================
-- SAVED_ARTICLES TABLE
-- Users can only read/write their own saves
-- ============================================

-- Enable RLS
ALTER TABLE saved_articles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own saved articles" ON saved_articles;
DROP POLICY IF EXISTS "Users can save articles" ON saved_articles;
DROP POLICY IF EXISTS "Users can unsave their own articles" ON saved_articles;

-- Users can SELECT their own saved articles
CREATE POLICY "Users can view their own saved articles"
  ON saved_articles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can INSERT their own saves
CREATE POLICY "Users can save articles"
  ON saved_articles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own saves
CREATE POLICY "Users can unsave their own articles"
  ON saved_articles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================
-- USER_ROLES TABLE
-- Users can read their own, only admins can write
-- (Already configured in previous migration)
-- ============================================

-- Enable RLS (should already be enabled)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policies should already exist from migration 003
-- Verify they exist:
-- - "Users can read their own role" FOR SELECT
-- - "Admins can insert roles" FOR INSERT
-- - "Admins can update roles" FOR UPDATE
-- - "Admins can delete roles" FOR DELETE


-- ============================================
-- REPORTS TABLE
-- Users create and read their own, admins read/write all
-- (Already configured in previous migration)
-- ============================================

-- Enable RLS (should already be enabled)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policies should already exist from migration 003
-- Verify they exist:
-- - "Users can create reports" FOR INSERT
-- - "Users can read their own reports" FOR SELECT
-- - "Admins can read all reports" FOR SELECT
-- - "Admins can update all reports" FOR UPDATE
-- - "Admins can delete all reports" FOR DELETE


-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify RLS is working correctly
-- ============================================

-- Check all tables have RLS enabled
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('articles', 'saved_articles', 'user_roles', 'reports')
      AND rowsecurity = false
  LOOP
    RAISE WARNING 'Table % does not have RLS enabled!', rec.tablename;
  END LOOP;
END $$;

-- Summary of policies
SELECT
  tablename,
  COUNT(*) as policy_count,
  ARRAY_AGG(policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
