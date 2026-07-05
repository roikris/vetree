-- Add posted_url to growth_agent_memory so the exact LinkedIn URL can be stored
-- after publishing, enabling activity_id-based matching in linkedin_post_metrics.
ALTER TABLE growth_agent_memory
  ADD COLUMN IF NOT EXISTS posted_url text;
