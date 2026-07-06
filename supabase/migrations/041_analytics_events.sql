CREATE TABLE IF NOT EXISTS analytics_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name  text NOT NULL,
  article_id  text REFERENCES articles(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_events" ON analytics_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin_read_events" ON analytics_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Cleanup synthetic rows written to page_views before this table existed
DELETE FROM page_views
WHERE path IN (
  '/events/save_intent_arrived',
  '/events/save_intent_auth_shown',
  '/events/save_intent_completed'
);
