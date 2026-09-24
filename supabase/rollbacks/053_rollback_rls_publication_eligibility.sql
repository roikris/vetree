-- Rollback for migration 052 — restores unconditional public read on `articles`
-- AND returns the two search functions to SECURITY INVOKER.
--
-- DO NOT APPLY unless 052 needs reverting. Kept OUTSIDE supabase/migrations/ on purpose:
-- `db push` applies every pending file in order, so shipping this alongside 052 would
-- apply the fix and immediately undo it.
--
-- Apply if, after 052:
--   - search regresses against the recorded anon baseline (cardiology ~1.02s, feline
--     chronic kidney disease ~0.64s, anesthesia ~0.76s) — including the FTS / ILIKE /
--     fuzzy fallback tiers and label-filtered browsing, which remain RLS-bound and can
--     time out independently of the two definer functions, or
--   - an admin surface reading through the user session stops returning unpublished
--     articles (app/actions/admin.ts, DownloadFailedCSV.tsx, CampaignCalendar.tsx), or
--   - anon can still read ineligible rows, which would mean another permissive SELECT
--     policy exists that 052 did not drop — likely created before the migration policy
--     was adopted.
--
-- Runs as one transaction: a partial rollback that restored public reads while leaving
-- the functions elevated would be a worse state than either end point.
--
-- NOTE: reverting reopens the exposure 052 closes. It is a stopgap to restore service,
-- not a resting state. The follow-up is the fallback design — strict predicate for both
-- roles, with the three session-reading admin surfaces moved to service-role API routes.

BEGIN;

-- Restore invoker semantics on the search functions.
-- search_path is restored to migration 030's original value so that reverting 052
-- leaves the database exactly as 030 left it.
ALTER FUNCTION search_articles_ranked(text, integer) SECURITY INVOKER;
ALTER FUNCTION search_articles_ranked(text, integer) SET search_path = public;

ALTER FUNCTION search_articles_synthesis(text, integer, integer) SECURITY INVOKER;
ALTER FUNCTION search_articles_synthesis(text, integer, integer) SET search_path = public;

-- Restore the original permissive policy.
DROP POLICY IF EXISTS "Anon reads published articles" ON articles;
DROP POLICY IF EXISTS "Authenticated reads published articles" ON articles;

CREATE POLICY "Articles are publicly readable"
  ON articles FOR SELECT
  TO public
  USING (true);

COMMIT;
