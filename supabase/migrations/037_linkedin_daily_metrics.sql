-- linkedin_post_metrics: make impressions/engagements nullable
-- (posts can appear in only one of the two top-50 lists in an export)
ALTER TABLE linkedin_post_metrics
  ALTER COLUMN impressions DROP NOT NULL,
  ALTER COLUMN impressions DROP DEFAULT,
  ALTER COLUMN engagements DROP NOT NULL,
  ALTER COLUMN engagements DROP DEFAULT;

-- Daily account-level LinkedIn metrics
CREATE TABLE linkedin_daily_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date date UNIQUE NOT NULL,
  impressions integer,
  engagements integer,
  new_followers integer,
  total_followers integer,  -- only set on dates LinkedIn states the snapshot
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE linkedin_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to linkedin daily metrics" ON linkedin_daily_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_linkedin_daily_metrics_date ON linkedin_daily_metrics(metric_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_daily_metrics TO postgres, service_role;
