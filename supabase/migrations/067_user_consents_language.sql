-- Migration 067: record the language of the consent wording each person saw
--
-- Since 2026-09-30 consent is shown in English (the interface language) with a Hebrew toggle
-- (lib/consent/copy.ts). For evidence of what was agreed to, each row records the language of
-- the wording actually shown — separately for the two questions, because they can be answered on
-- different screens (a Google signup answers the digest question on /signup, then accepts terms
-- on ConsentGate after the OAuth redirect):
--   terms_language      language of the terms/privacy wording, when it was shown for this row
--   marketing_language  language of the digest question, when it was asked for this row
-- NULL = that wording was not shown for this row, or its language is unknown (a pending choice
-- written before this change) — e.g. the digest prompt re-records terms as
-- already accepted), or the row predates this migration. Before 2026-09-30 the terms wording was
-- Hebrew-only and the digest wording English-only.
--
-- Additive: the running code neither reads nor writes these columns.

ALTER TABLE public.user_consents
  ADD COLUMN IF NOT EXISTS terms_language text,
  ADD COLUMN IF NOT EXISTS marketing_language text;

DO $$ BEGIN
  ALTER TABLE public.user_consents
    ADD CONSTRAINT user_consents_terms_language_check
    CHECK (terms_language IS NULL OR terms_language IN ('en', 'he'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_consents
    ADD CONSTRAINT user_consents_marketing_language_check
    CHECK (marketing_language IS NULL OR marketing_language IN ('en', 'he'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
