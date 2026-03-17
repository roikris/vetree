-- Add user_id to synthesis tables for better analytics

ALTER TABLE topic_syntheses
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

ALTER TABLE synthesis_feedback
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_topic_syntheses_user_id ON topic_syntheses(user_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_feedback_user_id ON synthesis_feedback(user_id);

-- Update RLS policies to allow users to see their own syntheses
-- (if policies exist, this will replace them)
