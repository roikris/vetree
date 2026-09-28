-- Migration 062: at most one signup-source consent row per user (from 2026-09-28)
--
-- Part of closing the open consent endpoint (Codex re-evaluation #5a). /api/auth/save-consent is
-- now session-only; email-signup choices are kept in the signing-up browser and recorded by
-- ConsentGate once the VERIFIED owner has a session (a pre-verification choice can't be proven
-- to be the email owner's, so nothing is recorded server-side before verification).
--
-- This index makes the signup-source write idempotent: concurrent/retried submissions can't
-- create duplicates (the app treats 23505 as "already recorded"). Partial on recording time
-- because user_consents is an append-only audit log and one historical user (the admin account,
-- testing in May–June) already has 4 signup rows, which stay as they are.
--
-- ROLLBACK: DROP INDEX public.user_consents_one_signup_per_user;

CREATE UNIQUE INDEX IF NOT EXISTS user_consents_one_signup_per_user
  ON public.user_consents (user_id)
  WHERE consent_source = 'signup' AND consented_at >= '2026-09-28 00:00:00+00';
