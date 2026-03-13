export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// GET: Fetch all feature flags
export async function GET() {
  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('flag_name')

    if (error) {
      console.error('[feature-flags] Error fetching flags:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ flags })

  } catch (error) {
    console.error('[feature-flags] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    )
  }
}

// POST: Update a feature flag
export async function POST(request: NextRequest) {
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

    // Parse request
    const body = await request.json()
    const { flag_name, enabled } = body

    if (!flag_name || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'flag_name and enabled (boolean) are required' },
        { status: 400 }
      )
    }

    // Use service role client to update
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await adminSupabase
      .from('feature_flags')
      .update({
        enabled,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('flag_name', flag_name)
      .select()
      .single()

    if (error) {
      console.error('[feature-flags] Error updating flag:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[feature-flags] ${flag_name} set to ${enabled} by ${user.email}`)

    return NextResponse.json({ flag: data })

  } catch (error) {
    console.error('[feature-flags] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    )
  }
}
