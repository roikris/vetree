-- Create articles_blacklist table to prevent re-adding deleted articles
CREATE TABLE IF NOT EXISTS articles_blacklist (
  pubmed_id text PRIMARY KEY,
  reason text DEFAULT 'manually_deleted',
  blacklisted_at timestamptz DEFAULT now()
);

-- Add index for faster lookups during ingestion
CREATE INDEX IF NOT EXISTS idx_articles_blacklist_pubmed_id ON articles_blacklist(pubmed_id);

-- Add comment for documentation
COMMENT ON TABLE articles_blacklist IS 'Prevents re-importing articles that have been manually deleted by admins';
COMMENT ON COLUMN articles_blacklist.pubmed_id IS 'PubMed ID of the blacklisted article';
COMMENT ON COLUMN articles_blacklist.reason IS 'Reason for blacklisting (e.g., admin_deleted, manually_deleted)';
COMMENT ON COLUMN articles_blacklist.blacklisted_at IS 'Timestamp when article was blacklisted';
