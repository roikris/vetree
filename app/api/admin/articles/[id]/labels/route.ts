export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type RouteContext = {
  params: Promise<{ id: string }>
}

// PATCH: Update article labels
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()

    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { labels } = body

    if (!Array.isArray(labels)) {
      return NextResponse.json({ error: 'labels must be an array' }, { status: 400 })
    }

    // Use service role to update
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update labels AND reset enrichment to retry with new labels
    const { data, error } = await adminSupabase
      .from('articles')
      .update({
        labels,
        enrichment_attempts: 0,
        needs_enrichment: true,
        last_enrichment_error: 'Labels updated - retrying enrichment'
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[admin/articles/labels] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, article: data })

  } catch (error) {
    console.error('[admin/articles/labels] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update labels' },
      { status: 500 }
    )
  }
}
