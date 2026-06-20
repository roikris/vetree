ALTER TABLE analytics_daily_snapshot
  ADD COLUMN IF NOT EXISTS synthesis_engaged integer DEFAULT 0;
