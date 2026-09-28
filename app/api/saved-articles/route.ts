import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// IDs of the signed-in user's saved articles, for the bookmark state on article rows
// (lib/hooks/useSavedArticles). A plain route, NOT a server action: server actions share
// Next.js's sequential router queue with navigations, and one-per-row calls queued ahead of
// a new search held it for 10–15 s (CLAUDE.md rule 12).
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 })
    }
    const { data, error } = await supabase
      .from('saved_articles')
      .select('article_id')
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Could not load saved articles' }, { status: 500 })
    return NextResponse.json(
      { articleIds: (data ?? []).map(r => r.article_id) },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch {
    return NextResponse.json({ error: 'Could not load saved articles' }, { status: 500 })
  }
}
