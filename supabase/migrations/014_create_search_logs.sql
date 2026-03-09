-- Create search_logs table for search analytics
CREATE TABLE search_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  query text NOT NULL,
  results_count integer,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_search_logs_created_at ON search_logs(created_at DESC);
CREATE INDEX idx_search_logs_query ON search_logs(query);
CREATE INDEX idx_search_logs_user_id ON search_logs(user_id);

-- Enable RLS
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can read all searches" ON search_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can insert searches" ON search_logs
  FOR INSERT WITH CHECK (true);
