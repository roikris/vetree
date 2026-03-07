import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force this route to use Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Fetch preferences
    const { data: preferences } = await supabase
      .from('growth_agent_preferences')
      .select('*')
      .limit(1)
      .single()

    // Count unique articles used
    const { data: uniqueArticles } = await supabase
      .from('growth_agent_memory')
      .select('article_id', { count: 'exact', head: false })

    const uniqueArticleIds = uniqueArticles
      ? [...new Set(uniqueArticles.map(a => a.article_id))]
      : []

    return NextResponse.json({
      approved_count: preferences?.approved_count || 0,
      skipped_count: preferences?.skipped_count || 0,
      preferred_specialties: preferences?.preferred_specialties || [],
      avoided_specialties: preferences?.avoided_specialties || [],
      unique_articles_count: uniqueArticleIds.length
    })

  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: String(error) },
      { status: 500 }
    )
  }
}
