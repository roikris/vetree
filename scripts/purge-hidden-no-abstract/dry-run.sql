-- See README.sql. Counts only; writes nothing.
WITH marked AS (
  SELECT a.id, a.pubmed_id FROM articles a
  WHERE a.quarantined = true AND a.last_enrichment_error = 'hidden_no_source_abstract_2026-09-25'
), referenced AS (
  SELECT m.id FROM marked m WHERE
       EXISTS (SELECT 1 FROM saved_articles        r WHERE r.article_id = m.id)
    OR EXISTS (SELECT 1 FROM digest_sent_articles  r WHERE r.article_id = m.id)
    OR EXISTS (SELECT 1 FROM growth_agent_memory   r WHERE r.article_id = m.id)
    OR EXISTS (SELECT 1 FROM growth_tasks          r WHERE r.article_id = m.id)
    OR EXISTS (SELECT 1 FROM linkedin_post_metrics r WHERE r.article_id = m.id)
    OR EXISTS (SELECT 1 FROM reports               r WHERE r.article_id = m.id)
    OR EXISTS (SELECT 1 FROM analytics_events      r WHERE r.article_id = m.id)
    OR EXISTS (SELECT 1 FROM topic_syntheses       t WHERE m.id = ANY (t.article_ids))
)
SELECT (SELECT count(*) FROM marked) AS marked_hidden,
       (SELECT count(*) FROM referenced) AS referenced_will_be_restored,
       (SELECT count(*) FROM marked) - (SELECT count(*) FROM referenced) AS targeted_unreferenced;
