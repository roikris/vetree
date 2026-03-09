-- Add session tracking columns to page_views table
ALTER TABLE page_views ADD COLUMN session_id text;
ALTER TABLE page_views ADD COLUMN duration_seconds integer;

-- Create index for session queries
CREATE INDEX idx_page_views_session_id ON page_views(session_id);
CREATE INDEX idx_page_views_duration ON page_views(duration_seconds) WHERE duration_seconds IS NOT NULL;
