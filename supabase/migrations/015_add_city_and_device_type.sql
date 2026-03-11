-- Add city and device_type columns to page_views table for enhanced analytics
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS device_type text;

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_page_views_country ON page_views(country);
CREATE INDEX IF NOT EXISTS idx_page_views_city ON page_views(city);
CREATE INDEX IF NOT EXISTS idx_page_views_device_type ON page_views(device_type);
