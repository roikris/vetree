-- Add median_session_duration_seconds column to analytics_daily_snapshot
ALTER TABLE analytics_daily_snapshot
ADD COLUMN IF NOT EXISTS median_session_duration_seconds integer DEFAULT 0;

COMMENT ON COLUMN analytics_daily_snapshot.median_session_duration_seconds IS 'Median session duration in seconds (capped at 30 min, outliers removed)';
COMMENT ON COLUMN analytics_daily_snapshot.avg_session_duration_seconds IS 'Average session duration in seconds (capped at 30 min, outliers removed)';
