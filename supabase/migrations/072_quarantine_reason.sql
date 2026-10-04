-- Migration 072: who hid an article, and an atomic way to record a failed enrichment (2026-10-04)
--
-- An article that fails enrichment 3 times must be HIDDEN (quarantined), not published: the
-- enrichment job used to set needs_enrichment = false, which the visibility rule reads as "done".
-- "Retry failed" may later lift that quarantine — but only that one: never an admin's or a
-- no-abstract one. Keeping the "why" inside last_enrichment_error failed review (other writers
-- overwrite it, and multi-step updates raced), so it gets its own column:
--
--   quarantine_reason  'enrichment_failed' | 'no_abstract' | 'admin' | NULL (= unknown / older:
--                      never lifted automatically)
--
-- record_enrichment_failure(id, error) records one failed attempt in a single locked transaction:
-- attempts + 1; the attempt that reaches 3 hides the article with reason 'enrichment_failed' unless
-- it is already quarantined (then quarantine and reason are left as they are).
-- Returns 'queued' (< 3 attempts), 'hidden' (this call hid it), 'kept' (already quarantined) or
-- 'missing'. Service role only (the enrichment job).
--
-- requeue_failed_articles() is admin "Retry failed": one UPDATE whose WHERE is re-evaluated on each
-- row's current version (so an article that just succeeded is not re-hidden), re-queuing failed,
-- unpublished articles that have a source abstract — 3+ attempts, or hidden by the enrichment job
-- whatever the attempt count says (editing labels resets it) — and lifting only the
-- 'enrichment_failed' quarantine. Returns (requeued, released). Service role only.

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS quarantine_reason text;
COMMENT ON COLUMN public.articles.quarantine_reason IS
  'Why quarantined: enrichment_failed (lifted only by admin "Retry failed"), no_abstract, admin; NULL = unknown/older, never lifted automatically';

CREATE OR REPLACE FUNCTION public.record_enrichment_failure(p_id text, p_error text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempts integer;
  v_quarantined boolean;
  v_hide boolean;
BEGIN
  -- Lock the row: no other writer can change quarantine between this read and the update
  SELECT coalesce(enrichment_attempts, 0) + 1, coalesce(quarantined, false)
    INTO v_attempts, v_quarantined
    FROM public.articles WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;

  v_hide := v_attempts >= 3 AND NOT v_quarantined;

  UPDATE public.articles SET
    enrichment_attempts   = v_attempts,
    needs_enrichment      = v_attempts < 3,
    force_retry           = false,
    last_enrichment_at    = now(),
    last_enrichment_error = left(coalesce(p_error, 'unknown error'), 1000),
    quarantined           = CASE WHEN v_hide THEN true ELSE quarantined END,
    quarantine_reason     = CASE WHEN v_hide THEN 'enrichment_failed' ELSE quarantine_reason END
  WHERE id = p_id;

  RETURN CASE WHEN v_hide THEN 'hidden' WHEN v_attempts >= 3 THEN 'kept' ELSE 'queued' END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_enrichment_failure(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.record_enrichment_failure(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.requeue_failed_articles(OUT requeued integer, OUT released integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- FOR UPDATE re-checks each row's WHERE against its latest version when it takes the lock, and
  -- holds the lock until the UPDATE commits: nothing can change a selected row in between
  WITH eligible AS (
    SELECT a.id, coalesce(a.quarantine_reason = 'enrichment_failed', false) AS was_failed
    FROM public.articles a
    WHERE a.abstract IS NOT NULL
      AND (
        a.quarantine_reason = 'enrichment_failed'
        OR (coalesce(a.enrichment_attempts, 0) >= 3
            AND (a.needs_enrichment OR a.summary IS NULL OR a.clinical_bottom_line IS NULL))
      )
    FOR UPDATE
  ), upd AS (
    UPDATE public.articles a SET
      needs_enrichment  = true,
      force_retry       = true,
      quarantined       = CASE WHEN e.was_failed THEN false ELSE a.quarantined END,
      quarantine_reason = CASE WHEN e.was_failed THEN NULL  ELSE a.quarantine_reason END
    FROM eligible e
    WHERE a.id = e.id
    RETURNING e.was_failed
  )
  SELECT count(*)::integer, (count(*) FILTER (WHERE was_failed))::integer
    INTO requeued, released
    FROM upd;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.requeue_failed_articles() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.requeue_failed_articles() TO service_role;
