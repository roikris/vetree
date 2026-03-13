-- User Retention Analytics SQL Views
-- Run these in Supabase SQL Editor

-- Daily active users (registered only)
CREATE OR REPLACE VIEW daily_active_users AS
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) as active_users
FROM page_views
WHERE user_id IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Weekly retention: users who returned after signup
CREATE OR REPLACE VIEW user_retention AS
SELECT
  u.id,
  u.email,
  DATE(u.created_at) as signup_date,
  MAX(DATE(pv.created_at)) as last_seen,
  COUNT(DISTINCT DATE(pv.created_at)) as active_days,
  NOW()::date - MAX(DATE(pv.created_at)) as days_since_last_visit
FROM auth.users u
LEFT JOIN page_views pv ON pv.user_id = u.id
GROUP BY u.id, u.email, u.created_at;

-- Grant access to views for authenticated users (if needed)
GRANT SELECT ON daily_active_users TO authenticated;
GRANT SELECT ON user_retention TO authenticated;
