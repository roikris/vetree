-- Digest memory: records every article ever included in a weekly digest send,
-- globally (not per-user), so future digest runs never re-select it.
-- Written by /api/digest/send after a successful send; read at selection time
-- to exclude already-sent articles from every candidate query.

CREATE TABLE IF NOT EXISTS public.digest_sent_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date date NOT NULL,
  article_id text NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (digest_date, article_id)
);

CREATE INDEX IF NOT EXISTS idx_digest_sent_articles_article_id
  ON public.digest_sent_articles (article_id);

ALTER TABLE public.digest_sent_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only" ON public.digest_sent_articles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_sent_articles TO postgres, service_role;
GRANT SELECT ON public.digest_sent_articles TO authenticated;
