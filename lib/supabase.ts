import { createClient } from './supabase/client'

// Browser client for backward compatibility
export const supabase = createClient()

export type Article = {
  id: string
  title: string
  summary?: string | null
  clinical_bottom_line: string
  strength_of_evidence: string
  labels: string[]
  source_journal: string
  article_url: string
  doi: string
  authors: string
  pubmed_id: string
  publication_date: string
}
