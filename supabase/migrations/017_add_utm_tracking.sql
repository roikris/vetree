-- Add UTM tracking columns to page_views table
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS utm_campaign text;

-- Create indexes for UTM analytics queries
CREATE INDEX IF NOT EXISTS idx_page_views_utm_source ON page_views(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_utm_campaign ON page_views(utm_campaign) WHERE utm_campaign IS NOT NULL;
