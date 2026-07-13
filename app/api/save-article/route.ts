import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ratelimitModerate, getClientIP } from '@/lib/ratelimit'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const { success } = await ratelimitModerate.limit(`save-article:${ip}`)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 })
    }

    const body = await request.json()
    const { articleId, action } = body

    if (!articleId || !['save', 'unsave'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (action === 'save') {
      const { error } = await supabase
        .from('saved_articles')
        .insert({ user_id: user.id, article_id: articleId })

      if (error) {
        // Duplicate key = already saved = desired state achieved
        if (error.code === '23505') {
          return NextResponse.json({ success: true })
        }
        console.error('[save-article] insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      const { error } = await supabase
        .from('saved_articles')
        .delete()
        .eq('user_id', user.id)
        .eq('article_id', articleId)

      if (error) {
        console.error('[save-article] delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    revalidatePath('/library')
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[save-article] unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
