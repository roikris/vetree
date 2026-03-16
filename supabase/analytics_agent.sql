-- Analytics Agent Database Schema

CREATE TABLE analytics_daily_snapshot (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date UNIQUE NOT NULL,
  dau integer DEFAULT 0,
  wau integer DEFAULT 0,
  mau integer DEFAULT 0,
  new_sessions integer DEFAULT 0,
  total_searches integer DEFAULT 0,
  zero_result_searches integer DEFAULT 0,
  zero_result_rate float DEFAULT 0,
  synthesis_runs integer DEFAULT 0,
  synthesis_helpful integer DEFAULT 0,
  synthesis_not_relevant integer DEFAULT 0,
  articles_saved integer DEFAULT 0,
  avg_session_duration_seconds integer DEFAULT 0,
  top_searches jsonb DEFAULT '[]',
  top_saved_articles jsonb DEFAULT '[]',
  device_breakdown jsonb DEFAULT '{}',
  traffic_sources jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE analytics_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN (
    'search_gap', 'churn_risk', 'content_opportunity',
    'growth_signal', 'retention_driver', 'ux_problem'
  )),
  severity float NOT NULL CHECK (severity >= 0 AND severity <= 1),
  description text NOT NULL,
  data_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE analytics_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  insights_json jsonb NOT NULL,
  top_3_actions jsonb DEFAULT '[]',
  content_roadmap jsonb DEFAULT '[]',
  churn_risks jsonb DEFAULT '[]',
  model_used text,
  tokens_used integer,
  status text DEFAULT 'active'
);

CREATE TABLE analytics_insight_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_id uuid REFERENCES analytics_insights(id),
  insight_index integer,
  action text CHECK (action IN ('implemented', 'ignored', 'noted')),
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE analytics_opportunities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  topic text NOT NULL,
  search_count integer DEFAULT 0,
  zero_result_rate float DEFAULT 0,
  save_count integer DEFAULT 0,
  opportunity_score float DEFAULT 0,
  suggested_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'dismissed'))
);

CREATE INDEX idx_signals_date ON analytics_signals(date);
CREATE INDEX idx_signals_severity ON analytics_signals(severity DESC);
CREATE INDEX idx_insights_generated ON analytics_insights(generated_at DESC);
CREATE INDEX idx_opportunities_score ON analytics_opportunities(opportunity_score DESC);
