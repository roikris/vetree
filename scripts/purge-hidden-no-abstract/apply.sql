-- See README.sql. Refuses to run before 2026-09-26 (hold moved forward by the owner).
BEGIN;

DO $$ BEGIN
  -- Hold was 2026-10-02; the owner reviewed all hidden articles (browsable export with live
  -- PubMed status + publication types) and moved it forward to 2026-09-26.
  IF now() < timestamptz '2026-09-26 00:00:00+00' THEN
    RAISE EXCEPTION 'purge held until 2026-09-26';
  END IF;
END $$;

-- SHARE mode: blocks INSERT/UPDATE/DELETE on these tables until COMMIT, allows reads.
-- Held for the few seconds this transaction takes.
LOCK TABLE saved_articles, digest_sent_articles, growth_agent_memory, growth_tasks,
           linkedin_post_metrics, reports, analytics_events, topic_syntheses IN SHARE MODE;

-- Anything that gained a reference during the hold is kept VISIBLE (owner's rule), not
-- skipped-and-left-hidden: restore it under the same locks, before the delete.
UPDATE articles a
SET quarantined = false, last_enrichment_error = 'no_source_abstract_kept_referenced'
WHERE a.quarantined = true
  AND a.last_enrichment_error = 'hidden_no_source_abstract_2026-09-25'
  AND (   EXISTS (SELECT 1 FROM saved_articles        r WHERE r.article_id = a.id)
       OR EXISTS (SELECT 1 FROM digest_sent_articles  r WHERE r.article_id = a.id)
       OR EXISTS (SELECT 1 FROM growth_agent_memory   r WHERE r.article_id = a.id)
       OR EXISTS (SELECT 1 FROM growth_tasks          r WHERE r.article_id = a.id)
       OR EXISTS (SELECT 1 FROM linkedin_post_metrics r WHERE r.article_id = a.id)
       OR EXISTS (SELECT 1 FROM reports               r WHERE r.article_id = a.id)
       OR EXISTS (SELECT 1 FROM analytics_events      r WHERE r.article_id = a.id)
       OR EXISTS (SELECT 1 FROM topic_syntheses       t WHERE a.id = ANY (t.article_ids)));

WITH targets AS (
  SELECT a.id, a.pubmed_id FROM articles a
  WHERE a.quarantined = true
    AND a.last_enrichment_error = 'hidden_no_source_abstract_2026-09-25'
    AND NOT EXISTS (SELECT 1 FROM saved_articles        r WHERE r.article_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM digest_sent_articles  r WHERE r.article_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM growth_agent_memory   r WHERE r.article_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM growth_tasks          r WHERE r.article_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM linkedin_post_metrics r WHERE r.article_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM reports               r WHERE r.article_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM analytics_events      r WHERE r.article_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM topic_syntheses       t WHERE a.id = ANY (t.article_ids))
  FOR UPDATE
), blacklisted AS (
  INSERT INTO articles_blacklist (pubmed_id, reason, blacklisted_at)
  SELECT pubmed_id, 'admin_deleted', now() FROM targets WHERE pubmed_id IS NOT NULL
  ON CONFLICT (pubmed_id) DO NOTHING
  RETURNING 1
)
DELETE FROM articles a
USING targets t
WHERE a.id = t.id
  AND a.quarantined = true
  AND a.last_enrichment_error = 'hidden_no_source_abstract_2026-09-25';

COMMIT;
