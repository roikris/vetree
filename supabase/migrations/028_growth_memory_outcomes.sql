-- Expand growth_agent_memory outcome CHECK constraint to include
-- recommendation dismissal outcomes: 'irrelevant' and 'already_published'
ALTER TABLE growth_agent_memory
  DROP CONSTRAINT IF EXISTS growth_agent_memory_outcome_check;

ALTER TABLE growth_agent_memory
  ADD CONSTRAINT growth_agent_memory_outcome_check
  CHECK (outcome IN ('approved', 'skipped', 'irrelevant', 'already_published'));
