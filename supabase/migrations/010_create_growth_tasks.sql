-- Create growth_tasks table
CREATE TABLE growth_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 90),
  scheduled_date date NOT NULL,
  platform text NOT NULL CHECK (platform IN ('facebook_il', 'facebook_intl', 'whatsapp', 'reddit', 'linkedin', 'twitter', 'instagram', 'telegram', 'kol')),
  group_name text NOT NULL,
  language text NOT NULL CHECK (language IN ('he', 'en')),
  content text NOT NULL,
  article_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  notes text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE growth_tasks ENABLE ROW LEVEL SECURITY;

-- Policy for admins only
CREATE POLICY "Admins can manage growth tasks" ON growth_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create index for better query performance
CREATE INDEX idx_growth_tasks_date ON growth_tasks(scheduled_date);
CREATE INDEX idx_growth_tasks_status ON growth_tasks(status);
CREATE INDEX idx_growth_tasks_day ON growth_tasks(day_number);
