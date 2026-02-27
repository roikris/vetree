-- Add columns for enrichment workflow
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS needs_enrichment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0;

-- Create index for efficient querying of articles that need enrichment
CREATE INDEX IF NOT EXISTS idx_articles_needs_enrichment
ON articles(needs_enrichment, enrichment_attempts)
WHERE needs_enrichment = true;

-- Add comment explaining the columns
COMMENT ON COLUMN articles.needs_enrichment IS 'Flag indicating if article needs AI enrichment';
COMMENT ON COLUMN articles.enrichment_attempts IS 'Number of times enrichment has been attempted';
