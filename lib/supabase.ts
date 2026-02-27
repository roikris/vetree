import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Article = {
  id: string
  title: string
  summary: string
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
