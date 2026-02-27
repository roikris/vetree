-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  clinical_bottom_line TEXT,
  strength_of_evidence TEXT,
  labels TEXT[],
  source_journal TEXT,
  article_url TEXT,
  doi TEXT,
  authors TEXT,
  pubmed_id TEXT,
  publication_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on publication_date for faster queries
CREATE INDEX IF NOT EXISTS idx_articles_publication_date ON articles(publication_date DESC);

-- Create an index on labels for filtering
CREATE INDEX IF NOT EXISTS idx_articles_labels ON articles USING GIN(labels);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
