-- ============================================
-- ADD FORCE_RETRY COLUMN FOR ADMIN MANUAL RETRY
-- ============================================

-- Add force_retry boolean column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS force_retry boolean DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_articles_force_retry ON articles(force_retry) WHERE force_retry = true;

-- Comment explaining the column
COMMENT ON COLUMN articles.force_retry IS 'Set to true when admin manually retries failed enrichment. Reset to false after processing.';
