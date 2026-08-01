-- Consent audit trail: provable consent is the compliance point, not just a boolean.
--
-- consented_at already exists (NOT NULL DEFAULT now(), migration 024) and is always
-- populated on every existing row — there is no "unknown timestamp" case to backfill.
--
-- consent_source is new. Nullable by design: a NULL source means "this row's
-- marketing_opted_in value is not the result of a dedicated marketing ask" (the
-- mandatory terms-acceptance gate writes a row too, since marketing_opted_in is
-- NOT NULL, but that row's false is a placeholder, not a decline). Non-null values
-- mean the user was genuinely asked about the digest specifically:
--   'signup'        — asked during account creation (email step or Google, both paths)
--   'in_app_prompt'  — asked via the one-time dismissible in-app prompt
--   'settings'       — changed via the profile/settings toggle
-- This distinction is what lets the digest send route tell "declined" (asked, said no)
-- apart from "never_asked" (no dedicated ask on record) instead of collapsing both into
-- one undifferentiated "no_consent" skip reason.

ALTER TABLE public.user_consents
  ADD COLUMN IF NOT EXISTS consent_source text;

ALTER TABLE public.user_consents
  ADD CONSTRAINT user_consents_consent_source_check
  CHECK (consent_source IS NULL OR consent_source IN ('signup', 'in_app_prompt', 'settings'));

-- Backfill: every row that already exists predates this column. Per product decision,
-- treat all of them as 'signup'-sourced -- they were already recorded as an account-time
-- consent decision.
UPDATE public.user_consents
SET consent_source = 'signup'
WHERE consent_source IS NULL;
