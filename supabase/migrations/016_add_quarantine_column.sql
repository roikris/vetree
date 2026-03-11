-- Add quarantine column to articles table
-- Quarantined articles are hidden from public view but visible to admins
ALTER TABLE articles ADD COLUMN IF NOT EXISTS quarantined boolean DEFAULT false;

-- Create index for filtering quarantined articles
CREATE INDEX IF NOT EXISTS idx_articles_quarantined ON articles(quarantined) WHERE quarantined = true;
