-- Add synthesis_topic column to growth_agent_memory
-- Used for tracking approved LinkedIn posts generated from Topic Synthesis feature.
-- When set, article_id is null (synthesis posts span multiple articles).
ALTER TABLE growth_agent_memory ADD COLUMN IF NOT EXISTS synthesis_topic text;
