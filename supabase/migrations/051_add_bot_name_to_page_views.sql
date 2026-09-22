-- Tag page_views rows that came from a known automated crawler / link-preview
-- bot (meta-externalagent, AdsBot-Google, etc.) instead of dropping them.
-- Rows stay in the table for resource/burst monitoring (e.g. a bot crawl
-- spiking hundreds of hits in a few hours); analytics queries that report
-- human traffic filter bot_name IS NULL.
ALTER TABLE page_views ADD COLUMN bot_name text;

-- Partial index: only bot rows are ever looked up by this column
-- (WHERE bot_name IS NOT NULL for the bot-traffic panel, or IS NULL is the
-- common case covered by existing created_at/ip_hash indexes).
CREATE INDEX IF NOT EXISTS idx_page_views_bot_name ON page_views (bot_name) WHERE bot_name IS NOT NULL;
