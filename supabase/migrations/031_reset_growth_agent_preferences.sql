-- Migration 031: Reset corrupted growth_agent_preferences
--
-- The avoided_specialties and preferred_specialties arrays accumulated incorrect
-- values during early use: "Internal Medicine" was added to avoided (it's the
-- largest category with 644 articles), and "Equine"/"Large Animal" were added to
-- preferred (opposite of what's wanted). Hook style patterns were stored as 3-word
-- fragments, too short to be meaningful signal.
--
-- This resets the learned preference arrays to empty so the agent starts fresh
-- with clean state. Counts (approved_count, skipped_count) are preserved.
-- The code fix in feedback/route.ts prevents re-corruption going forward.

UPDATE growth_agent_preferences
SET
  avoided_specialties   = '[]'::jsonb,
  preferred_specialties = '[]'::jsonb,
  preferred_hook_styles = '[]'::jsonb,
  avoided_hook_styles   = '[]'::jsonb,
  updated_at            = now();
