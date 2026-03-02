# Vetree Database Setup

## Saved Articles Table

Run this SQL in the Supabase SQL Editor:

```sql
-- Create saved_articles table
CREATE TABLE saved_articles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  saved_at timestamptz DEFAULT now(),
  UNIQUE(user_id, article_id)
);

-- Enable Row Level Security
ALTER TABLE saved_articles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own saved articles
CREATE POLICY "Users can manage their own saved articles" ON saved_articles
  FOR ALL USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_saved_articles_user_id ON saved_articles(user_id);
CREATE INDEX idx_saved_articles_article_id ON saved_articles(article_id);
```

## Verification

After running the SQL, verify the table was created:

```sql
SELECT * FROM saved_articles LIMIT 5;
```
