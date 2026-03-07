-- Create growth agent memory table to track article usage and outcomes
CREATE TABLE growth_agent_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id text REFERENCES articles(id),
  platform text NOT NULL,
  language text NOT NULL CHECK (language IN ('he', 'en')),
  outcome text NOT NULL CHECK (outcome IN ('approved', 'skipped')),
  skip_reason text,
  hook_line text,
  created_at timestamptz DEFAULT now()
);

-- Create growth agent preferences table to learn from feedback
CREATE TABLE growth_agent_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  preferred_specialties text[] DEFAULT '{}',
  avoided_specialties text[] DEFAULT '{}',
  preferred_hook_styles text[] DEFAULT '{}',
  avoided_hook_styles text[] DEFAULT '{}',
  approved_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Seed initial preferences with common small animal specialties
INSERT INTO growth_agent_preferences (preferred_specialties)
VALUES (ARRAY[
  'cardiology',
  'oncology',
  'dermatology',
  'internal medicine',
  'surgery',
  'pain management',
  'neurology',
  'ophthalmology',
  'anesthesia',
  'emergency medicine'
]);

-- Enable RLS
ALTER TABLE growth_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_agent_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for admin-only access
CREATE POLICY "Admins can manage agent memory" ON growth_agent_memory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage agent preferences" ON growth_agent_preferences
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create indexes for better performance
CREATE INDEX idx_agent_memory_article ON growth_agent_memory(article_id);
CREATE INDEX idx_agent_memory_outcome ON growth_agent_memory(outcome);
CREATE INDEX idx_agent_memory_created ON growth_agent_memory(created_at DESC);
