-- LinkedIn post metrics: stores per-post performance data from manual XLSX uploads
CREATE TABLE linkedin_post_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_url text UNIQUE,                      -- idempotency key; re-uploading same range is safe
  post_date date NOT NULL,
  article_id text REFERENCES articles(id),   -- TEXT to match articles.id; null if no Growth OS match
  impressions integer DEFAULT 0,
  engagements integer DEFAULT 0,
  raw_row jsonb,                             -- full original row, format-proof
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE linkedin_post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to linkedin metrics" ON linkedin_post_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_linkedin_metrics_post_date ON linkedin_post_metrics(post_date DESC);
CREATE INDEX idx_linkedin_metrics_article_id ON linkedin_post_metrics(article_id);

-- Grant access to service_role for API writes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_post_metrics TO postgres, service_role;
