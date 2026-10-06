-- Migration 073: articles Claude refuses are hidden as 'ai_refused' and wait for the Codex fallback
-- (2026-10-06, enrich-001)
--
-- Claude declines to summarize some livestock/poultry pathogen papers (stop_reason 'refusal' —
-- FMD, ASF, HPAI, tularemia, PRRSV, BVDV…). A refusal repeats, so retrying costs calls and never
-- succeeds. CLAUDE.md rule 0 exception (Roi, 2026-10-06): the identical prompt goes to the fallback
-- model via Codex on Roi's Mac (scripts/enrich-refused.mjs, his ChatGPT plan).
--
--   quarantine_reason  … | 'ai_refused' — hidden; the enrichment job sets it on a refusal, the Codex
--                      fallback lifts it when it saves a valid summary. Never re-queued to Claude.
--
-- 1. requeue_failed_articles() (admin "Retry failed") no longer selects ai_refused articles — same
--    set as FAILED_UNPUBLISHED_OR in lib/enrichment/requeueFailed.ts.
-- 2. Backfill: the articles already refused (3 attempts each, before this change) become ai_refused.
--    Only refusal errors, only articles not publicly visible, never over an admin / no-abstract /
--    unknown (NULL-reason) quarantine. Not "summary IS NULL": pre-057 rows still hold a copy of the abstract in summary.

COMMENT ON COLUMN public.articles.quarantine_reason IS
  'Why the article is hidden: enrichment_failed (3rd failed enrichment attempt; lifted only by admin "Retry failed") | no_abstract | admin | ai_refused (Claude refused; lifted by the Codex fallback when it saves a summary) | NULL = unknown/older, never lifted automatically';

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
            AND a.quarantine_reason IS DISTINCT FROM 'ai_refused'
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

UPDATE public.articles SET
  quarantined       = true,
  quarantine_reason = 'ai_refused',
  needs_enrichment  = false,
  force_retry       = false
WHERE last_enrichment_error ILIKE '%stop_reason: refusal%'
  AND abstract IS NOT NULL
  -- never over an admin / no-abstract / unknown (NULL-reason) quarantine
  AND ((quarantine_reason IS NULL AND coalesce(quarantined, false) = false) OR quarantine_reason = 'enrichment_failed')
  -- never hide a publicly visible article (IS NOT TRUE: a NULL needs_enrichment must not skip a hidden row)
  AND (needs_enrichment = false AND summary IS NOT NULL AND clinical_bottom_line IS NOT NULL
       AND coalesce(quarantined, false) = false) IS NOT TRUE;
