-- Add a free-form jsonb detail column to analytics_events so individual
-- events can carry structured context (branch, timing, device, UTM) without
-- a schema change per new field. Used first by save_intent_resolved to make
-- every SaveIntentHandler branch (saved_now / already_saved / auth_shown /
-- save_error) observable, and by save_intent_arrived for the same UA/UTM
-- payload.
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS detail jsonb;
