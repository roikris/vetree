import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { tag } = body

    if (!tag) {
      return NextResponse.json({ error: 'Tag is required' }, { status: 400 })
    }

    // Delete followed tag
    const { error } = await supabase
      .from('followed_tags')
      .delete()
      .eq('user_id', user.id)
      .eq('tag', tag)

    if (error) {
      console.error('[unfollow-tag] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get updated list of followed tags
    const { data: followedTags } = await supabase
      .from('followed_tags')
      .select('tag')
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      followedTags: followedTags?.map(ft => ft.tag) || []
    })

  } catch (error) {
    console.error('[unfollow-tag] Error:', error)
    return NextResponse.json({ error: 'Failed to unfollow tag' }, { status: 500 })
  }
}
