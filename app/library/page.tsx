import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LibraryClient } from '@/components/library/LibraryClient'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch saved articles with saved_at timestamp
  const { data, error } = await supabase
    .from('saved_articles')
    .select('article_id, saved_at, articles(id, title, clinical_bottom_line, labels, source_journal, publication_date, strength_of_evidence, authors, article_url, doi, pubmed_id)')
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false })

  const entries = (data || [])
    .filter((item: any) => item.articles && item.articles.needs_enrichment !== true && item.articles.clinical_bottom_line)
    .map((item: any) => ({
      article: item.articles,
      savedAt: item.saved_at,
    }))

  return (
    <LibraryClient
      entries={entries}
      userEmail={user.email ?? null}
    />
  )
}
