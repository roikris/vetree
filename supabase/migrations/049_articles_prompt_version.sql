ALTER TABLE public.articles ADD COLUMN prompt_version text;

COMMENT ON COLUMN public.articles.prompt_version IS
  'Enrichment prompt version that produced summary/clinical_bottom_line. NULL = enriched before versioning was added. Powers the weekly review + rollback: UPDATE articles SET needs_enrichment=true, force_retry=true WHERE prompt_version = ''<bad-version>''.';
