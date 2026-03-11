-- Add enrichment error tracking columns
ALTER TABLE articles ADD COLUMN IF NOT EXISTS last_enrichment_error text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS last_enrichment_at timestamptz;

-- Create index for querying failed enrichments
CREATE INDEX IF NOT EXISTS idx_articles_enrichment_error ON articles(last_enrichment_error) WHERE last_enrichment_error IS NOT NULL;
