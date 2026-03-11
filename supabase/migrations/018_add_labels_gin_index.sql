-- Add GIN index on labels column for efficient array operations
-- GIN indexes are optimized for array overlap queries like .overlaps() and array contains
CREATE INDEX IF NOT EXISTS idx_articles_labels_gin ON articles USING GIN (labels);
