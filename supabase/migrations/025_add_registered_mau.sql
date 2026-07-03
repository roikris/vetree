-- Add registered_mau to analytics_daily_snapshot
-- Tracks distinct authenticated (non-anonymous, non-admin) users active in the last 30 days.
-- Separate from mau which counts all IP hashes including bots and anonymous visitors.
ALTER TABLE analytics_daily_snapshot
  ADD COLUMN IF NOT EXISTS registered_mau integer DEFAULT 0;

GRANT SELECT ON public.analytics_daily_snapshot TO anon;
GRANT SELECT, INSERT, UPDATE ON public.analytics_daily_snapshot TO authenticated;
GRANT ALL ON public.analytics_daily_snapshot TO service_role;
